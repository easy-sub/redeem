import { encodeSessionToken } from '../utils/zstdToken'
import { clearRedeemFlow } from '../utils/redeemFlow'

const BASE_URL = '/api/v1/sub'
const CDK_VERIFICATION_EXPIRED_MESSAGE = 'CDK 验证有效期为 3 分钟，当前验证已失效。页面将在 3 秒后返回首页，请重新验证 CDK。'
const CDK_VERIFICATION_EXPIRED_REDIRECT_DELAY = 3000

let cdkVerificationExpiredRedirectTimer = null

const handleCDKVerificationExpired = (payload) => {
  const message = String(payload?.error || payload?.message || '')
  const expired = payload?.error_code === 'CDK_VERIFICATION_EXPIRED' || /CDK\s*验证已过期/.test(message)
  if (!expired) return payload

  clearRedeemFlow()
  if (typeof window !== 'undefined' && !cdkVerificationExpiredRedirectTimer) {
    cdkVerificationExpiredRedirectTimer = window.setTimeout(() => {
      clearRedeemFlow()
      window.location.replace('/')
    }, CDK_VERIFICATION_EXPIRED_REDIRECT_DELAY)
  }

  return {
    ...payload,
    error: CDK_VERIFICATION_EXPIRED_MESSAGE,
    message: CDK_VERIFICATION_EXPIRED_MESSAGE,
    cdkVerificationExpired: true,
  }
}

const request = async (url, method = 'POST', data = {}) => {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  }

  if (method !== 'GET') {
    options.body = JSON.stringify(data)
  }

  try {
    const response = await fetch(`${BASE_URL}${url}`, options)
    const payload = await response.json()
    return handleCDKVerificationExpired({
      ...payload,
      httpStatus: response.status,
    })
  } catch (error) {
    return {
      code: 0,
      error: '网络异常，请重新提交',
      networkError: true,
    }
  }
}

const normalizeError = (response, fallback) => {
  return response?.error || response?.message || fallback
}

const isRetryableResponse = (response) => {
  return Boolean(response?.networkError || Number(response?.httpStatus || 0) >= 500)
}

export const getClientAnnouncements = async () => {
  const response = await request('/announcements', 'GET')
  if (response.status_code !== 0 || !Array.isArray(response.data)) return []
  return response.data
}

const normalizePlanName = (plan) => {
  const names = {
    chatgptplusplan: 'ChatGPT Plus',
    chatgptprolite: 'ChatGPT Pro 5x',
    chatgptpro: 'ChatGPT Pro 20x',
    chatgptpromax: 'ChatGPT Pro 50x',
    chatgptgoplan: 'ChatGPT Go',
    chatgpt2pro20x: 'ChatGPT Pro 20x',
    claudepro: 'Claude Pro',
    claudemax5x: 'Claude Max 5x',
    claudemax20x: 'Claude Max 20x',
  }
  return names[plan] || plan || '订阅方案'
}

const normalizeProvider = (provider) => {
  return String(provider || 'openai').trim().toLowerCase() === 'claude' ? 'claude' : 'openai'
}

const providerLabel = (provider) => {
  return normalizeProvider(provider) === 'claude' ? 'Claude' : 'ChatGPT'
}

const mapCDKStatusText = (status) => {
  const statusMap = {
    unused: '可兑换',
    activating: '已锁定',
    activated: '已兑换',
    replaced: '已调换',
    disabled: '已禁用',
    expired: '已过期',
  }
  return statusMap[status] || status || '未知'
}

export const validateCard = async (cardCode, expectedProvider = 'openai', requestNonce = '') => {
  const cdk = String(cardCode || '').trim()
  const expected = normalizeProvider(expectedProvider)
  const response = await request('/verifyCdk', 'POST', {
    cdk,
    expected_provider: expected,
    request_nonce: String(requestNonce || '').trim(),
  })

  if (response.code !== 200) {
    return {
      code: 0,
      message: normalizeError(response, 'CDK 校验失败'),
      retryable: isRetryableResponse(response),
    }
  }
  const provider = normalizeProvider(response.provider)
  if (provider !== expected) {
    return {
      code: 0,
      message: `该 CDK 属于 ${providerLabel(provider)} 兑换，请切换后继续`,
    }
  }

  return {
    code: 200,
    data: {
      provider,
      productName: response.product_name || normalizePlanName(response.plan),
      productAlias: providerLabel(provider),
      productType: response.product_type || 'subscription',
      creditQuantity: Number(response.credit_quantity || 0),
      cardStatus: 1,
      cardStatusText: '已锁定，可继续兑换',
      cdk,
      activationToken: response.activation_token,
      expiresIn: response.expires_in,
      expiresAt: response.expires_at,
      resumed: Boolean(response.resumed),
    },
  }
}

export const validateToken = async (sessionText, provider = 'openai', cdk = '', activationToken = '') => {
  const normalizedProvider = normalizeProvider(provider)
  if (normalizedProvider === 'claude') {
    return validateClaudeSessionKey(sessionText, cdk, activationToken)
  }
  const parsed = parseSessionToken(sessionText)

  if (parsed.parseError) {
    return {
      code: 0,
      message: parsed.parseError,
    }
  }

  if (!parsed.accessToken) {
    return {
      code: 0,
      message: '未从会话 JSON 中识别到 accessToken',
    }
  }

  if (!parsed.email) {
    return {
      code: 0,
      message: '未从会话 JSON 中识别到账号邮箱',
    }
  }

  let redeemToken = ''
  try {
    redeemToken = await encodeSessionToken(sessionText)
  } catch {
    return {
      code: 0,
      message: '会话 JSON 压缩失败，请刷新页面后重试',
    }
  }

  const precheck = await request('/precheckAccount', 'POST', {
    token: redeemToken,
    cdk,
    activation_token: activationToken,
  })
  const accountData = {
    provider: 'openai',
    email: precheck.email || parsed.email,
    name: precheck.name || parsed.name || parsed.email,
    accountType: precheck.plan_type || parsed.planType || 'unknown',
    accountId: precheck.account_id || '',
    subscriptionPlan: precheck.subscription_plan || '',
    hasActiveSubscription: Boolean(precheck.has_active_subscription),
    purchaseOriginPlatform: precheck.purchase_origin_platform || '',
    billingPeriod: precheck.billing_period || '',
    expiresAt: precheck.expires_at || parsed.expiresAt || '',
    renewsAt: precheck.renews_at || '',
    cancelsAt: precheck.cancels_at || '',
    redeemToken: precheck.refreshed_token || redeemToken,
  }

  if (precheck.code !== 200) {
    return {
      code: 0,
      message: normalizeError(precheck, '账号预检失败'),
      data: accountData,
    }
  }

  return {
    code: 200,
    data: accountData,
  }
}

const validateClaudeSessionKey = async (sessionText, cdk, activationToken) => {
  const sessionKey = String(sessionText || '').trim()
  if (!sessionKey) {
    return {
      code: 0,
      message: '请输入 Claude sessionKey',
    }
  }
  let redeemToken = ''
  try {
    redeemToken = await encodeSessionToken(sessionKey)
  } catch {
    return {
      code: 0,
      message: 'sessionKey 压缩失败，请刷新页面后重试',
    }
  }
  const precheck = await request('/precheckAccount', 'POST', {
    token: redeemToken,
    cdk,
    activation_token: activationToken,
  })
  const accountEmail = precheck.email || ''
  const accountName = precheck.account_name || ''
  const accountData = {
    provider: 'claude',
    email: accountEmail,
    name: accountEmail,
    accountName,
    accountType: precheck.plan_type || 'claude',
    accountId: precheck.account_id || '',
    subscriptionPlan: precheck.subscription_plan || '',
    hasActiveSubscription: Boolean(precheck.has_active_subscription),
    purchaseOriginPlatform: precheck.purchase_origin_platform || '',
    billingPeriod: precheck.billing_period || '',
    expiresAt: precheck.expires_at || '',
    renewsAt: precheck.renews_at || '',
    cancelsAt: precheck.cancels_at || '',
    redeemToken,
  }
  if (precheck.code !== 200) {
    return {
      code: 0,
      message: normalizeError(precheck, 'Claude 账号校验失败'),
      data: accountData,
    }
  }
  return {
    code: 200,
    data: accountData,
  }
}

export const createOrder = async (cardCode, token, tokenInfo, cardInfo) => {
  const cdk = String(cardCode || '').trim()
  const verifiedProductName = cardInfo?.productName || ''
  const verifiedProductAlias = cardInfo?.productAlias || ''
  const payload = {
    token,
    cdk,
    activation_token: cardInfo?.activationToken || '',
  }
  let response = await request('/redeem', 'POST', payload)

  if (isRetryableResponse(response)) {
    await new Promise((resolve) => window.setTimeout(resolve, 600))
    response = await request('/redeem', 'POST', payload)
  }

  if (response.code === 200) {
    const orderQueryToken = response.order_query_token || ''
    const orderResponse = orderQueryToken ? await queryRedeemResult(orderQueryToken, cdk) : null
    return {
      code: 200,
      data: orderResponse && orderResponse.code === 200 && orderResponse.data
        ? {
            ...orderResponse.data,
            productName: verifiedProductName || orderResponse.data.productName,
            productAlias: verifiedProductAlias || orderResponse.data.productAlias,
            orderQueryToken,
          }
        : {
            orderId: response.order_no || '',
            orderQueryToken,
            productName: verifiedProductName || response.product_name || normalizePlanName(response.plan),
            productAlias: verifiedProductAlias || response.plan || '',
            productType: response.product_type || cardInfo?.productType || 'subscription',
            creditQuantity: Number(response.credit_quantity || cardInfo?.creditQuantity || 0),
            email: tokenInfo?.email || '',
            status: mapOrderStatus(response.status || 'processing'),
            createTime: new Date().toISOString(),
            attemptCurrent: 1,
            attemptMax: 1,
            retrying: false,
          },
	    }
  }

  if (isRetryableResponse(response)) {
    const recovered = await queryOrderByCard(cdk, cardInfo?.activationToken || '')
    if (recovered.code === 200 && recovered.data) {
      return {
        code: 200,
        data: {
          ...recovered.data,
          productName: verifiedProductName || recovered.data.productName,
          productAlias: verifiedProductAlias || recovered.data.productAlias,
        },
      }
    }
    return {
      code: 0,
      uncertain: true,
      message: '提交结果暂未确认，请保持当前页面并重新点击确认提交',
    }
  }

  return {
    code: 0,
    message: normalizeError(response, '订阅兑换失败'),
  }
}

export const queryOrdersByCards = async (cardCodes) => {
  const cdks = Array.isArray(cardCodes)
    ? cardCodes.map((code) => String(code || '').trim()).filter(Boolean)
    : []
  const response = await request('/queryOrder', 'POST', { cdks })

  if (response.code !== 200) {
    return {
      code: 0,
      message: normalizeError(response, '订单查询失败'),
    }
  }

  const rows = Array.isArray(response.results) ? response.results : []
  return {
    code: 200,
    data: rows
      .map((item) => mapQueryOrderResponse(item.cdk || '', item))
      .filter(Boolean),
  }
}

export const queryOrderByCard = async (cardCode, activationToken = '') => {
  const cdk = String(cardCode || '').trim()
  const response = await request('/queryOrder', 'POST', {
    cdk,
    activation_token: String(activationToken || '').trim(),
  })

  return mapQueryOrderSingleResponse(cdk, response)
}

export const refreshCards = async (cardCodes, idempotencyKey) => {
  const cdks = Array.isArray(cardCodes)
    ? cardCodes.map((code) => String(code || '').trim()).filter(Boolean)
    : []
  const response = await request('/refreshCdk', 'POST', {
    cdks,
    idempotency_key: String(idempotencyKey || '').trim(),
  })

  if (response.code !== 200) {
    return {
      code: 0,
      message: normalizeError(response, 'CDK 调换失败'),
    }
  }

  return {
    code: 200,
    data: {
      successCount: Number(response.success_count || 0),
      failedCount: Number(response.failed_count || 0),
      results: Array.isArray(response.results)
        ? response.results.map((item) => ({
            oldCDK: item.cdk || '',
            code: Number(item.code || 0),
            error: item.error || '',
            oldCDKStatus: item.old_cdk_status || '',
            newCDK: item.new_cdk || '',
            newCDKStatus: item.new_cdk_status || '',
            provider: item.provider || '',
            productName: item.product_name || normalizePlanName(item.plan),
            plan: item.plan || '',
          }))
        : [],
    },
  }
}

const mapQueryOrderSingleResponse = (cdk, response) => {
  if (response.code !== 200) {
    return {
      code: 0,
      message: normalizeError(response, '订单查询失败'),
      retryable: isRetryableResponse(response),
    }
  }

  if (!response.order) {
    return {
      code: 200,
      data: null,
    }
  }

  return {
    code: 200,
    cdkStatus: response.cdk_status,
    data: {
      ...mapPublicOrder(cdk, response.cdk_status, response.order),
      orderQueryToken: response.order_query_token || '',
    },
  }
}

const mapQueryOrderResponse = (cardCode, response) => {
  const mapped = mapQueryOrderSingleResponse(cardCode, response || {})
  return mapped.code === 200 ? mapped.data : null
}

export const queryRedeemResult = async (orderQueryToken, cardCode = '') => {
  const token = String(orderQueryToken || '').trim()
  const response = await request('/redeemResult', 'POST', { order_query_token: token })

  if (response.code !== 200) {
    return {
      code: 0,
      message: normalizeError(response, '订单结果查询失败'),
      retryable: isRetryableResponse(response),
    }
  }

  if (!response.order) {
    return {
      code: 200,
      data: null,
    }
  }

  return {
    code: 200,
    data: {
      ...mapPublicOrder(cardCode, response.cdk_status || '', response.order),
      orderQueryToken: token,
    },
  }
}

export const queryBilling = async (tokenInput) => {
  const source = String(tokenInput || '').trim()
  if (!source) {
    return {
      code: 0,
      message: '请输入 Session JSON 或 access token',
    }
  }

  let token = ''
  try {
    token = await encodeSessionToken(source)
  } catch {
    return {
      code: 0,
      message: '登录态压缩失败，请刷新页面后重试',
    }
  }

  const response = await request('/queryBilling', 'POST', { token })
  if (response.code !== 200) {
    return {
      code: 0,
      message: normalizeError(response, '账单查询失败'),
    }
  }

  return {
    code: 200,
    data: {
      profile: response.profile || {},
      subscription: response.subscription || null,
      paymentMethod: response.payment_method || null,
      customer: response.customer || null,
      invoices: Array.isArray(response.invoices) ? response.invoices : [],
      hasMore: Boolean(response.has_more),
      notice: response.notice || '',
    },
  }
}

const queryEncodedToken = async (token) => {
  const response = await request('/queryToken', 'POST', { token })
  if (response.code !== 200) {
    return {
      code: 0,
      message: normalizeError(response, 'Token 查询失败'),
    }
  }

  const profile = response.profile || {}
  const tokenInfo = response.token || {}
  const subscription = response.subscription || {}
  const hasActiveSubscription = Boolean(subscription.has_active_subscription)
  const currentPlan = hasActiveSubscription
    ? (subscription.subscription_plan || subscription.plan_type)
    : (subscription.plan_type || subscription.subscription_plan)
  const planName = hasActiveSubscription
    ? (subscription.plan_name || normalizePlanName(currentPlan))
    : normalizePlanName(currentPlan)
  return {
    code: 200,
    data: {
      queryToken: token,
      serverTime: response.server_time || new Date().toISOString(),
      profile: {
        email: profile.email || '',
        name: profile.name || '',
        accountId: profile.account_id || '',
      },
      token: {
        valid: Boolean(tokenInfo.valid),
        issuedAt: tokenInfo.issued_at || '',
        expiresAt: tokenInfo.expires_at || '',
      },
      subscription: {
        planType: subscription.plan_type || '',
        subscriptionPlan: subscription.subscription_plan || '',
        planName,
        status: subscription.status || 'unknown',
        statusText: subscription.status_text || '状态未知',
        statusDescription: subscription.status_description || '',
        hasActiveSubscription,
        isDelinquent: Boolean(subscription.is_delinquent),
        willRenew: Boolean(subscription.will_renew),
        startedAt: subscription.started_at || '',
        startedAtEstimated: Boolean(subscription.started_at_estimated),
        expiresAt: subscription.expires_at || '',
        renewsAt: subscription.renews_at || '',
        cancelsAt: subscription.cancels_at || '',
        gracePeriodEndAt: subscription.grace_period_end_at || '',
        billingPeriod: subscription.billing_period || '',
        purchaseOriginPlatform: subscription.purchase_origin_platform || '',
        currency: subscription.currency || '',
      },
    },
  }
}

export const queryToken = async (tokenInput) => {
  const source = String(tokenInput || '').trim()
  if (!source) {
    return {
      code: 0,
      message: '请输入 Session JSON 或 access token',
    }
  }

  let token = ''
  try {
    token = await encodeSessionToken(source)
  } catch {
    return {
      code: 0,
      message: '登录态压缩失败，请刷新页面后重试',
    }
  }

  return queryEncodedToken(token)
}

export const refreshTokenQuery = async (queryToken) => {
  const token = String(queryToken || '').trim()
  if (!token) return { code: 0, message: '当前查询登录态已失效，请重新查询' }
  return queryEncodedToken(token)
}

export const setTokenAutoRenew = async (queryToken, enabled) => {
  const token = String(queryToken || '').trim()
  if (!token) return { code: 0, message: '当前查询登录态已失效，请重新查询' }
  const response = await request('/setTokenAutoRenew', 'POST', { token, enabled: Boolean(enabled) })
  if (response.code !== 200) {
    return {
      code: 0,
      message: normalizeError(response, '续费设置失败'),
    }
  }
  return {
    code: 200,
    enabled: Boolean(response.enabled),
    queryToken: response.refreshed_token || token,
  }
}

const parseSessionToken = (sessionText) => {
  const text = String(sessionText || '').trim()
  if (!text) return {}

  try {
    const session = JSON.parse(text)
    const user = session.user || session.profile || {}
    const auth = session.auth || {}

    return {
      accessToken: session.accessToken || session.access_token || auth.accessToken || auth.access_token || '',
      email: user.email || session.email || auth.email || '',
      name: user.name || session.name || '',
      planType: user.plan_type || user.planType || session.plan_type || session.planType || '',
      expiresAt: session.expires_at || session.expiresAt || user.expires_at || user.expiresAt || '',
    }
  } catch {
    return {
      parseError: '会话 JSON 格式无效，请复制完整的 session JSON',
      accessToken: '',
      email: '',
      name: '',
      planType: '',
    }
  }
}

const mapPublicOrder = (cdk, cdkStatus, order) => {
  return {
    cardCode: cdk,
    cardExists: true,
    cardValid: false,
    cardStatus: cdkStatus,
    cardStatusText: mapCDKStatusText(cdkStatus),
    found: true,
    orderId: order.order_no,
    productName: order.product_name || normalizePlanName(order.plan),
    productAlias: order.plan,
    productType: order.product_type || 'subscription',
    creditQuantity: Number(order.credit_quantity || 0),
    provider: normalizeProvider(order.provider),
    email: order.account,
    status: mapOrderStatus(order.status, cdkStatus),
    message: order.error || '',
    createTime: order.started_at || order.finished_at,
    finishedTime: order.finished_at || '',
    amountMinor: order.amount_minor,
    currency: order.currency,
    country: order.country,
    durationMs: order.duration_ms,
    paymentCard: order.payment_card || '',
    attemptCurrent: Number(order.attempt_current || 1),
    attemptMax: Number(order.attempt_max || 1),
    retrying: Boolean(order.retrying),
    paymentResultChecking: Boolean(order.payment_result_checking),
  }
}

const mapOrderStatus = (status, cdkStatus = '') => {
  const normalized = String(status || '').toLowerCase()
  const normalizedCDKStatus = String(cdkStatus || '').toLowerCase()
  if (normalized === 'success') return 'COMPLETED'
	if (normalized === 'manual_success') return 'MANUAL_COMPLETED'
  if (normalized === 'failed' && normalizedCDKStatus === 'unused') return 'CARD_RETURNED'
  if (normalized === 'failed' && normalizedCDKStatus === 'activated') return 'PARTIAL_CLOSED'
  if (normalized === 'failed') return 'EXCEPTION'
  if (normalized === 'processing') return 'PROCESSING'
  return normalized.toUpperCase()
}
