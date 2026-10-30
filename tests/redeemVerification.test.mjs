import assert from 'node:assert/strict'
import test from 'node:test'
import { createOrder, validateToken, validateCard, queryToken, queryBilling, setTokenAutoRenew, refreshTokenQuery } from '../src/services/api.js'
import { webcrypto } from 'node:crypto'
import { createRequestNonce } from '../src/utils/redeemFlow.js'
import { encodeSessionToken } from '../src/utils/zstdToken.js'
import { compress, decompress } from '@bokuweb/zstd-wasm'

const session = JSON.stringify({ accessToken: 'access-token', user: { email: 'customer@example.com' } })
const cardInfo = { provider: 'openai', activationToken: 'expired-token', productName: 'ChatGPT Plus' }
const verified = (provider = 'openai', token = 'fresh-token') => ({
  code: 200, provider, activation_token: token,
  expires_in: 180, expires_at: new Date(Date.now() + 180000).toISOString(),
})
const expired = { code: 0, error: 'CDK验证已过期，请刷新网页重新验证' }

const mockRequests = (t, steps) => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const step = steps[calls.length]
    const body = JSON.parse(options.body)
    calls.push({ url, body })
    if (!step) return { status: 400, json: async () => ({ code: 0 }) }
    if (step.networkError) throw new Error('模拟网络中断')
    return { status: step.status || 200, json: async () => step.response }
  })
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  globalThis.window = {
    setTimeout: (callback) => { callback(); return 1 },
    location: { replace: () => assert.fail('兑换失败不应跳回首页') },
  }
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
    else delete globalThis.window
    assert.equal(calls.length, steps.length)
    calls.forEach((call, index) => {
      assert.equal(call.url, `/api/v1/sub${steps[index].url}`)
      steps[index].check?.(call.body)
    })
  })
  return calls
}

test('第二步超时后恢复校验，保留完整 Session 和兑换进度', async (t) => {
  let updatedCard
  mockRequests(t, [
    { url: '/verifyCdk', response: verified(), check: (body) => {
      assert.equal(body.request_nonce, 'nonce')
      assert.equal(Object.hasOwn(body, 'renew'), false)
    } },
    { url: '/precheckAccount', response: { code: 200, email: 'customer@example.com' }, check: (body) => {
      assert.equal(body.activation_token, 'fresh-token')
      const decoded = decompress(Buffer.from(body.token.slice('zstd64:'.length), 'base64'))
      assert.equal(new TextDecoder().decode(decoded), session)
    } },
  ])
  const result = await validateToken(session, 'openai', 'CDK', 'expired-token', 'nonce', (card) => { updatedCard = card })
  assert.equal(result.code, 200)
  assert.equal(updatedCard.activationToken, 'fresh-token')
})

test('Claude 第二步也会自动恢复校验', async (t) => {
  mockRequests(t, [
    { url: '/verifyCdk', response: verified('claude'), check: (body) => assert.equal(body.expected_provider, 'claude') },
    { url: '/precheckAccount', response: { code: 200, email: 'claude@example.com' }, check: (body) => assert.equal(body.activation_token, 'fresh-token') },
  ])
  const result = await validateToken('sk-ant-session-test', 'claude', 'CDK', 'expired-token', 'nonce')
  assert.equal(result.code, 200)
  assert.equal(result.data.provider, 'claude')
})

test('Claude 预检失败保留完整 KYC 认证指引', async (t) => {
  const message = `请完成KYC认证：https://withpersona.com/verify?code=${'x'.repeat(300)}&locale=zh#verify`
  mockRequests(t, [
    { url: '/verifyCdk', response: verified('claude') },
    { url: '/precheckAccount', response: { code: 0, error: message } },
  ])
  const result = await validateToken('sk-ant-session-test', 'claude', 'CDK', 'expired-token', 'nonce')
  assert.equal(result.code, 0)
  assert.equal(result.message, message)
  assert.equal(result.data.provider, 'claude')
})

test('Grok SSO 校验保留官方套餐标识和年付周期', async (t) => {
  const calls = mockRequests(t, [
    { url: '/verifyCdk', response: verified('grok') },
    { url: '/precheckAccount', response: { code: 200, email: 'grok@example.com', name: '测试账号', plan_type: 'free', subscription_plan: 'grok_premium', billing_period: 'yearly' } },
  ])
  const result = await validateToken('sso=TOKEN', 'grok', 'CDK', 'expired-token', 'nonce')
  assert.equal(result.code, 200)
  assert.equal(result.data.provider, 'grok')
  assert.equal(result.data.name, '测试账号')
  assert.equal(result.data.subscriptionPlan, 'grok_premium')
  assert.equal(result.data.billingPeriod, 'yearly')
  assert.equal(calls[0].body.expected_provider, 'grok')
  const encoded = calls[1].body.token.slice('zstd64:'.length)
  assert.equal(new TextDecoder().decode(decompress(Buffer.from(encoded, 'base64'))), 'sso=TOKEN')
})

test('第三步超时后先检查订单，再恢复校验并提交', async (t) => {
  let updatedCard
  mockRequests(t, [
    { url: '/queryOrder', response: { code: 200 }, check: (body) => assert.equal(body.activation_token, 'expired-token') },
    { url: '/verifyCdk', response: verified() },
    { url: '/redeem', response: { code: 200, order_no: 'ORDER-1', status: 'processing' }, check: (body) => {
      assert.equal(body.activation_token, 'fresh-token')
      assert.equal(body.token, 'session-token')
    } },
  ])
  const result = await createOrder('CDK', 'session-token', { email: 'customer@example.com' }, cardInfo, 'nonce', (card) => { updatedCard = card })
  assert.equal(result.code, 200)
  assert.equal(result.data.orderId, 'ORDER-1')
  assert.equal(updatedCard.activationToken, 'fresh-token')
})

test('同一流程已有订单时直接恢复，不续期、不重复下单', async (t) => {
  mockRequests(t, [
    { url: '/queryOrder', response: { code: 200, order: { order_no: 'EXISTING', status: 'processing' } } },
  ])
  const result = await createOrder('CDK', 'session-token', {}, cardInfo, 'nonce')
  assert.equal(result.code, 200)
  assert.equal(result.data.orderId, 'EXISTING')
})

test('卡密被其他流程占用时停在当前页面，不继续校验账号', async (t) => {
  mockRequests(t, [
    { url: '/verifyCdk', response: { code: 0, error: 'CDK正在使用中，请120秒之后再试' } },
  ])
  const result = await validateToken(session, 'openai', 'CDK', 'expired-token', 'nonce')
  assert.equal(result.code, 0)
  assert.match(result.message, /正在使用中/)
})

test('恢复校验时网络中断，保留进度并停止提交', async (t) => {
  mockRequests(t, [
    { url: '/queryOrder', response: { code: 200 } },
    { url: '/verifyCdk', networkError: true },
  ])
  const result = await createOrder('CDK', 'session-token', {}, cardInfo, 'nonce')
  assert.equal(result.code, 0)
  assert.match(result.message, /网络异常/)
})

test('查询已有订单失败时停止提交，避免未确认结果导致重复下单', async (t) => {
  mockRequests(t, [{ url: '/queryOrder', networkError: true }])
  const result = await createOrder('CDK', 'session-token', {}, cardInfo, 'nonce')
  assert.equal(result.code, 0)
  assert.equal(result.uncertain, true)
})

test('请求途中校验过期时最多自动恢复一次，再失败也保留页面', async (t) => {
  mockRequests(t, [
    { url: '/verifyCdk', response: verified() },
    { url: '/precheckAccount', response: expired },
    { url: '/verifyCdk', response: verified('openai', 'retry-token') },
    { url: '/precheckAccount', response: expired, check: (body) => assert.equal(body.activation_token, 'retry-token') },
  ])
  const result = await validateToken(session, 'openai', 'CDK', 'expired-token', 'nonce')
  assert.equal(result.code, 0)
  assert.match(result.message, /已填写的内容会保留/)
})

test('第三步请求途中过期时自动恢复后继续提交', async (t) => {
  mockRequests(t, [
    { url: '/queryOrder', response: { code: 200 } },
    { url: '/verifyCdk', response: verified() },
    { url: '/redeem', response: expired },
    { url: '/verifyCdk', response: verified('openai', 'retry-token') },
    { url: '/redeem', response: { code: 200, order_no: 'RECOVERED' }, check: (body) => assert.equal(body.activation_token, 'retry-token') },
  ])
  const result = await createOrder('CDK', 'session-token', {}, cardInfo, 'nonce')
  assert.equal(result.code, 200)
  assert.equal(result.data.orderId, 'RECOVERED')
})

test('提交网络异常后沿用续期后的凭据重试并恢复已有订单', async (t) => {
  mockRequests(t, [
    { url: '/queryOrder', response: { code: 200 } },
    { url: '/verifyCdk', response: verified() },
    { url: '/redeem', networkError: true, check: (body) => assert.equal(body.activation_token, 'fresh-token') },
    { url: '/redeem', networkError: true, check: (body) => assert.equal(body.activation_token, 'fresh-token') },
    { url: '/queryOrder', response: { code: 200, order: { order_no: 'NETWORK-RECOVERED', status: 'processing' } }, check: (body) => assert.equal(body.activation_token, 'fresh-token') },
  ])
  const result = await createOrder('CDK', 'session-token', {}, cardInfo, 'nonce')
  assert.equal(result.code, 200)
  assert.equal(result.data.orderId, 'NETWORK-RECOVERED')
})

test('所有账号 token 提交入口保留 marketingEligibility，覆盖后台刷新 token 的复用', async (t) => {
  const expectedSession = {
    accessToken: 'access-token',
    user: { email: 'customer@example.com' },
    account: { id: 'account-id' },
    sessionToken: 'session-token',
    marketingEligibility: { eligible: true, campaigns: ['test'] },
    WARNING_BANNER: '保留原有提示',
  }
  const source = JSON.stringify(expectedSession)
  // 直接压缩模拟后台返回的完整 token。
  await encodeSessionToken(session)
  const refreshedToken = `zstd64:${Buffer.from(compress(new TextEncoder().encode(source))).toString('base64')}`
  const check = (body) => {
    const decoded = decompress(Buffer.from(body.token.slice('zstd64:'.length), 'base64'))
    assert.deepEqual(JSON.parse(new TextDecoder().decode(decoded)), expectedSession)
  }
  mockRequests(t, [
    { url: '/precheckAccount', response: { code: 200, refreshed_token: refreshedToken }, check },
    { url: '/redeem', response: { code: 200, order_no: 'PRESERVED' }, check },
    { url: '/queryToken', response: { code: 200 }, check },
    { url: '/queryBilling', response: { code: 200 }, check },
    { url: '/setTokenAutoRenew', response: { code: 200, refreshed_token: refreshedToken }, check },
    { url: '/queryToken', response: { code: 200 }, check },
  ])

  const validated = await validateToken(source, 'openai', 'CDK', 'activation-token')
  assert.equal(validated.code, 200)
  const order = await createOrder('CDK', validated.data.redeemToken, validated.data, cardInfo)
  assert.equal(order.code, 200)
  const queried = await queryToken(source)
  assert.equal(queried.code, 200)
  assert.equal((await queryBilling(source)).code, 200)
  const renewed = await setTokenAutoRenew(queried.data.queryToken, false)
  assert.equal(renewed.code, 200)
  assert.equal((await refreshTokenQuery(renewed.queryToken)).code, 200)
})

test('压缩会话时仅去除首尾空白，保留完整 JSON 与 marketingEligibility 的不同值', async () => {
  const sessions = [
    ' { "accessToken": "token", "account": { "id": "account" } } ',
    ...[{}, null, false, 'fixture'].map(marketingEligibility => JSON.stringify({
      accessToken: 'token',
      marketingEligibility,
      account: { id: 'account', marketingEligibility: { nested: true } },
    })),
  ]
  for (const source of sessions) {
    const encoded = await encodeSessionToken(source)
    const decoded = decompress(Buffer.from(encoded.slice('zstd64:'.length), 'base64'))
    assert.equal(new TextDecoder().decode(decoded), source.trim())
  }
})

test('无卡失败后立即再次提交，不要求等待锁时间', async (t) => {
  const steps = []
  for (let attempt = 0; attempt < 2; attempt++) {
    steps.push(
      { url: '/queryOrder', response: { code: 200 } },
      { url: '/verifyCdk', response: { code: 200, provider: 'openai', activation_token: 'stable-flow-token', expires_in: 0 } },
      { url: '/redeem', response: { code: 0, error: '无可用支付卡' }, check: body => assert.equal(body.activation_token, 'stable-flow-token') },
    )
  }
  mockRequests(t, steps)
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await createOrder('CDK', session, { email: 'customer@example.com' }, cardInfo, 'nonce')
    assert.equal(result.code, 0)
    assert.match(result.message, /无可用支付卡/)
    assert.doesNotMatch(result.message, /秒之后|已有兑换任务/)
  }
})

test('当前页面仍生成独立的安全流程 nonce，不依赖 sessionStorage', (t) => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  globalThis.window = {
    crypto: webcrypto,
    btoa: value => Buffer.from(value, 'binary').toString('base64'),
    get sessionStorage() { assert.fail('不应访问兑换进度存储') },
  }
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
    else delete globalThis.window
  })
  const first = createRequestNonce()
  const second = createRequestNonce()
  assert.match(first, /^[A-Za-z0-9_-]{43}$/)
  assert.notEqual(first, second)
})

test('卡密校验保留 nonce，不发送 renew，并展示提交时确认兑换', async t => {
  mockRequests(t, [{ url: '/verifyCdk', response: verified(), check: body => {
    assert.equal(body.cdk, 'CDK')
    assert.equal(body.request_nonce, 'nonce')
    assert.equal(Object.hasOwn(body, 'renew'), false)
  } }])
  const result = await validateCard(' CDK ', 'openai', 'nonce')
  assert.equal(result.data.cardStatusText, '校验通过，提交时确认兑换')
})
