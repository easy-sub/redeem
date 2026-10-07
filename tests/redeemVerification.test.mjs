import assert from 'node:assert/strict'
import test from 'node:test'
import { createOrder, validateToken } from '../src/services/api.js'
import { readRedeemFlow, writeRedeemFlow } from '../src/utils/redeemFlow.js'
import { decompress } from '@bokuweb/zstd-wasm'

const session = JSON.stringify({ accessToken: 'access-token', user: { email: 'customer@example.com' } })
const cardInfo = { provider: 'openai', activationToken: 'expired-token', productName: 'ChatGPT Plus' }
const verified = (provider = 'openai', token = 'fresh-token') => ({
  code: 200, provider, activation_token: token,
  expires_in: 180, expires_at: new Date(Date.now() + 180000).toISOString(),
})
const expired = { code: 0, error: 'CDK验证已过期，请刷新网页重新验证' }

const mockRequests = (t, steps) => {
  const calls = []
  const storage = new Map()
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
    sessionStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    setTimeout: (callback) => { callback(); return 1 },
    location: { replace: () => assert.fail('兑换失败不应跳回首页') },
  }
  writeRedeemFlow({ cdk: 'CDK', requestNonce: 'nonce', state: 'reserved' })
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
      assert.equal(body.renew, true)
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
  assert.equal(readRedeemFlow().cdk, 'CDK')
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
    { url: '/precheckAccount', response: { code: 200, email: 'grok@example.com', name: '测试账号', plan_type: 'free', subscription_plan: 'PRODUCT_TIER_GROK_PRO', billing_period: 'yearly' } },
  ])
  const result = await validateToken('sso=TOKEN', 'grok', 'CDK', 'expired-token', 'nonce')
  assert.equal(result.code, 200)
  assert.equal(result.data.provider, 'grok')
  assert.equal(result.data.name, '测试账号')
  assert.equal(result.data.subscriptionPlan, 'PRODUCT_TIER_GROK_PRO')
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
  assert.equal(readRedeemFlow().cdk, 'CDK')
})

test('恢复校验时网络中断，保留进度并停止提交', async (t) => {
  mockRequests(t, [
    { url: '/queryOrder', response: { code: 200 } },
    { url: '/verifyCdk', networkError: true },
  ])
  const result = await createOrder('CDK', 'session-token', {}, cardInfo, 'nonce')
  assert.equal(result.code, 0)
  assert.match(result.message, /网络异常/)
  assert.equal(readRedeemFlow().cdk, 'CDK')
})

test('查询已有订单失败时停止提交，避免未确认结果导致重复下单', async (t) => {
  mockRequests(t, [{ url: '/queryOrder', networkError: true }])
  const result = await createOrder('CDK', 'session-token', {}, cardInfo, 'nonce')
  assert.equal(result.code, 0)
  assert.equal(result.uncertain, true)
  assert.equal(readRedeemFlow().cdk, 'CDK')
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
  assert.equal(readRedeemFlow().cdk, 'CDK')
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
