import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'
import { extractErrorURL } from '../src/utils/errorUrl.js'
import { readRedeemFlow, writeRedeemFlow } from '../src/utils/redeemFlow.js'

let server
let App
let StepToken
let StepOrder

before(async () => {
  // 通过项目的 Vue 编译配置载入组件，测试实际流程方法。
  server = await createServer({
    server: { middlewareMode: true, watch: null, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: 'custom',
  })
  App = (await server.ssrLoadModule('/src/App.vue')).default
  StepToken = (await server.ssrLoadModule('/src/components/StepToken.vue')).default
  StepOrder = (await server.ssrLoadModule('/src/components/StepOrder.vue')).default
})
after(async () => { await server?.close() })

const component = (options, props = {}) => {
  const events = []
  const instance = { ...props, $emit: (...args) => events.push(args), $refs: {} }
  Object.assign(instance, options.data.call(instance))
  for (const [name, method] of Object.entries(options.methods)) instance[name] = method.bind(instance)
  for (const [name, getter] of Object.entries(options.computed)) {
    Object.defineProperty(instance, name, { get: getter.bind(instance) })
  }
  return { instance, events }
}

const setupWindow = (t, initialPath = '/') => {
  const storage = () => {
    const values = new Map()
    return {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    }
  }
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const history = [new URL(initialPath, 'http://localhost')]
  globalThis.window = {
    crypto: webcrypto, btoa,
    localStorage: storage(), sessionStorage: storage(),
    location: history[0],
    history: {
      pushState: (_state, _title, path) => {
        const location = new URL(path, 'http://localhost')
        history.push(location)
        window.location = location
      },
    },
  }
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'window', previous)
    else delete globalThis.window
  })
  return history
}

test('查询视图支持刷新和历史返回，返回兑换时移除查询参数', (t) => {
  const history = setupWindow(t)
  const { instance: app } = component(App)
  app.switchToQuery()
  assert.equal(window.location.search, '?view=query')
  assert.equal(component(App).instance.viewMode, 'query')
  app.switchToExchange()
  assert.equal(window.location.search, '')
  window.location = history[1]
  app.handlePopState()
  assert.equal(app.isQueryMode, true)
})

test('从查询页切换 Grok 会回到兑换并重置旧厂商流程', (t) => {
  setupWindow(t, '/?view=query')
  writeRedeemFlow({ cdk: 'OLD', requestNonce: 'old-nonce' })
  const { instance: app } = component(App)
  app.cardData = { cardCode: 'OLD', cardInfo: { provider: 'openai' } }
  app.switchProviderMode('grok')
  assert.equal(app.providerTitle, 'Grok')
  assert.equal(app.viewMode, 'exchange')
  assert.equal(window.location.search, '')
  assert.equal(app.cardData.cardCode, '')
  assert.equal(readRedeemFlow(), null)
  assert.equal(component(App).instance.providerMode, 'grok')
})

test('刷新过期兑换流程仍按原 nonce 恢复校验', async (t) => {
  setupWindow(t)
  writeRedeemFlow({
    state: 'reserved', cdk: 'CDK', requestNonce: 'same-nonce', provider: 'grok',
    expiresAt: '2020-01-01T00:00:00Z',
  })
  let calls = 0
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    calls++
    const payload = JSON.parse(options.body)
    assert.equal(payload.request_nonce, 'same-nonce')
    assert.equal(payload.expected_provider, 'grok')
    return { status: 200, json: async () => ({ code: 200, provider: 'grok', activation_token: 'fresh-token' }) }
  })
  const { instance: app } = component(App)
  await app.restoreRedeemFlow()
  assert.equal(calls, 1)
  assert.equal(app.currentStep, 1)
  assert.equal(app.cardData.cardInfo.activationToken, 'fresh-token')
  assert.equal(readRedeemFlow().requestNonce, 'same-nonce')
})

test('提交结果待确认时释放 loading，连续点击只查询一次', async (t) => {
  setupWindow(t)
  let release
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => {
    calls++
    await new Promise((resolve) => { release = resolve })
    throw new Error('模拟网络中断')
  })
  const { instance: order, events } = component(StepOrder, {
    cardCode: 'CDK', token: 'token', requestNonce: 'nonce',
    cardInfo: { activationToken: 'old-token' }, tokenInfo: {}, initialOrder: null,
  })
  const pending = order.submitOrder()
  assert.equal(order.loading, true)
  await order.submitOrder()
  assert.equal(calls, 1)
  release()
  await pending
  assert.equal(order.loading, false)
  assert.match(order.error, /暂未确认/)
  assert.deepEqual(events.map(([name]) => name), ['submitting'])
})

test('账号校验失败时收起旧信息并保留完整 KYC 错误', async (t) => {
  setupWindow(t)
  const url = `https://withpersona.com/verify?code=${'x'.repeat(300)}&locale=zh#verify`
  t.mock.method(globalThis, 'fetch', async () => ({
    status: 200, json: async () => ({ code: 0, error: `请完成 KYC：${url}` }),
  }))
  const { instance: token, events } = component(StepToken, {
    provider: 'claude', cardCode: 'CDK', cardInfo: { activationToken: 'token' }, requestNonce: '',
  })
  token.token = 'sk-ant-session-test'
  token.tokenInfo = { email: 'old@example.com' }
  await token.validateToken()
  assert.equal(token.loading, false)
  assert.equal(token.tokenInfo, null)
  assert.equal(token.errorURL, url)
  assert.equal(events.length, 0)
})

test('续期后的凭据持久化后可用于刷新恢复', (t) => {
  setupWindow(t)
  const { instance: app } = component(App)
  app.currentStep = 2
  app.cardData = { cardCode: 'CDK', cardInfo: { activationToken: 'expired' } }
  app.handleCardReverified({ activationToken: 'fresh', expiresAt: '2030-01-01T00:00:00Z' })
  assert.equal(readRedeemFlow().state, 'submitting')
  assert.equal(readRedeemFlow().cardInfo.activationToken, 'fresh')
  assert.equal(readRedeemFlow().cdk, 'CDK')
})

test('说明弹窗限制 Tab、Escape 关闭并恢复焦点，教程关闭暂停视频', (t) => {
  setupWindow(t)
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const trigger = { focus: t.mock.fn() }
  const first = { focus: t.mock.fn() }
  const last = { focus: t.mock.fn() }
  globalThis.document = { activeElement: trigger, body: { style: {} } }
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'document', previous)
    else delete globalThis.document
  })
  const { instance: app } = component(App)
  app.$nextTick = (callback) => callback()
  app.$refs = { helpClose: first, tutorialClose: first, tutorialVideo: { pause: t.mock.fn() } }
  app.$el = { querySelector: () => ({ querySelectorAll: () => [first, last] }) }
  app.openHelp()
  assert.equal(first.focus.mock.callCount(), 1)
  document.activeElement = last
  const preventDefault = t.mock.fn()
  app.handleKeydown({ key: 'Tab', preventDefault })
  assert.equal(preventDefault.mock.callCount(), 1)
  assert.equal(first.focus.mock.callCount(), 2)
  app.handleKeydown({ key: 'Escape' })
  assert.equal(app.helpOpen, false)
  assert.equal(trigger.focus.mock.callCount(), 1)
  app.openTutorial()
  app.closeTutorial()
  assert.equal(app.$refs.tutorialVideo.pause.mock.callCount(), 2)
  assert.equal(document.body.style.overflow, '')
})

test('错误网址保留长参数和片段，去掉句尾标点', () => {
  const url = `https://example.com/verify?code=${'x'.repeat(300)}&locale=zh#verify`
  assert.equal(extractErrorURL(`请打开 ${url}。`), url)
  assert.equal(extractErrorURL('没有网址'), '')
})
