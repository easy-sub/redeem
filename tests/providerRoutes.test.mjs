import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import vm from 'node:vm'

const root = process.env.TARGET_ROOT || fileURLToPath(new URL('..', import.meta.url))
const appSource = readFileSync(path.join(root, 'src/App.vue'), 'utf8')

// loadApp 在隔离环境执行真实页面脚本，仅模拟浏览器与公开接口，避免真实兑换副作用。
function loadApp(urlPath, stored = 'openai', flow = null) {
  const calls = []
  const storage = new Map([['redeem.client.provider', stored]])
  const location = new URL(urlPath, 'https://client.test')
  const window = {
    location,
    addEventListener() {},
    localStorage: {
      getItem: key => storage.get(key),
      setItem: (key, value) => storage.set(key, value),
    },
    history: { pushState: (_, __, href) => { location.href = new URL(href, location).href } },
  }
  const context = {
    window, URLSearchParams, siteConfig: {}, ReceiptText: {}, ScanSearch: {},
    createRequestNonce: () => 'new-nonce',
    readRedeemFlow: () => flow,
    clearRedeemFlow: () => { flow = null },
    writeRedeemFlow: value => { flow = value },
    validateCard: async (...args) => { calls.push(args); return { code: 200, data: { provider: args[1] } } },
    ...Object.fromEntries(['ProgressBar', 'StepCard', 'StepToken', 'StepOrder', 'CDKService', 'BillingQuery', 'TokenQuery', 'TokenSimplify', 'ClientAnnouncements', 'ClientHeader', 'ClientIcon'].map(name => [name, {}])),
  }
  const script = appSource.match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/^import .*$/gm, '').replace('export default', 'globalThis.options =')
  vm.runInNewContext(script, context)
  const options = context.options
  const app = options.data()
  for (const [name, method] of Object.entries(options.methods)) app[name] = method.bind(app)
  for (const [name, getter] of Object.entries(options.computed)) Object.defineProperty(app, name, { get: getter.bind(app) })
  return { app, location, calls, getFlow: () => flow, mount: () => options.mounted.call(app) }
}

for (const provider of ['openai', 'claude', 'grok']) {
  test(`直达 /${provider} 优先于已记住的平台，刷新后仍一致`, () => {
    for (const suffix of ['', '/']) {
      const { app } = loadApp(`/${provider}${suffix}`, provider === 'claude' ? 'grok' : 'claude')
      assert.equal(app.providerMode, provider)
      assert.equal(app.viewMode, 'exchange')
      assert.equal(app.providerThemeClass, `provider-${provider}`)
    }
  })
}

test('根路径仍沿用用户已选择的平台', () => {
  assert.equal(loadApp('/', 'grok').app.providerMode, 'grok')
})

test('顶部切换、查询返回及浏览器前进后退同步平台和路径', () => {
  const { app, location } = loadApp('/openai')
  app.switchProviderMode('claude')
  assert.equal(location.pathname, '/claude')
  assert.equal(app.providerMode, 'claude')
  app.switchToQuery()
  assert.equal(location.pathname, '/claude')
  assert.equal(location.search, '?view=query')
  app.switchToExchange()
  assert.equal(location.pathname, '/claude')
  assert.equal(location.search, '')
  app.cardData = { cardCode: 'TEST', cardInfo: {} }
  location.pathname = '/grok'
  app.handlePopState()
  assert.equal(app.providerMode, 'grok')
  assert.equal(app.currentStep, 0)
  assert.equal(app.cardData.cardCode, '')
  location.pathname = '/claude'
  app.handlePopState()
  assert.equal(app.providerMode, 'claude')
})

test('刷新始终从当前平台第一步开始，不恢复旧进度或请求接口', async () => {
  for (const provider of ['openai', 'claude', 'grok']) {
    for (const state of ['reserved', 'account_validated', 'submitting', 'ordered']) {
      const flow = {
        provider: 'openai', cdk: 'TEST-CDK', requestNonce: 'old-nonce', state,
        cardInfo: { activationToken: 'old-token' },
        orderData: { orderId: 'EXISTING' }, orderQueryToken: 'old-query-token',
      }
      const { app, calls, mount } = loadApp(`/${provider}`, 'grok', flow)
      await mount()
      assert.equal(app.providerMode, provider)
      assert.equal(app.currentStep, 0)
      assert.equal(app.cardData.cardCode, '')
      assert.equal(app.tokenData.token, '')
      assert.equal(app.orderData, null)
      assert.equal(app.orderCompleted, false)
      assert.equal(app.requestNonce, 'new-nonce')
      assert.equal(calls.length, 0)
    }
  }
  assert.doesNotMatch(appSource, /restoreRedeemFlow|persistRedeemFlow|readRedeemFlow|writeRedeemFlow/)
})

test('当前页面保留步骤、校验更新及订单结果，不依赖刷新缓存', () => {
  const { app, getFlow } = loadApp('/openai')
  app.handleCardValidated({ cardCode: 'TEST-CDK', cardInfo: { activationToken: 'first-token' } })
  assert.equal(app.currentStep, 1)
  app.handleTokenValidated({ token: 'fixture-session', tokenInfo: { email: 'fixture@example.test' } })
  assert.equal(app.currentStep, 2)
  app.handleCardReverified({ activationToken: 'fresh-token' })
  assert.equal(app.cardData.cardInfo.activationToken, 'fresh-token')
  assert.equal(app.tokenData.token, 'fixture-session')
  const order = { orderId: 'EXISTING', orderQueryToken: 'query-token' }
  app.handleOrderCompleted(order)
  assert.equal(app.orderData, order)
  assert.equal(app.orderCompleted, true)
  assert.equal(getFlow(), null)
  app.resetAll()
  assert.equal(app.currentStep, 0)
  assert.equal(app.cardData.cardCode, '')
  assert.equal(app.tokenData.token, '')
  assert.equal(app.orderData, null)
})

test('现有工具页和查询入口不变，返回兑换保留平台路径', () => {
  for (const view of ['billing', 'token-query']) {
    const { app, location } = loadApp(`/${view}`, 'grok')
    assert.equal(app.viewMode, view)
    app.switchToExchange()
    assert.equal(location.pathname, '/grok')
    assert.equal(app.viewMode, 'exchange')
  }
  assert.equal(loadApp('/?view=query').app.viewMode, 'query')
  assert.equal(loadApp('/claude?view=query').app.providerMode, 'claude')
})

test('平台入口提供真实链接，修饰键和中键保留浏览器默认行为', () => {
  assert.match(appSource, /:href="`\/\$\{item.key\}`"/)
  const { app, location } = loadApp('/openai')
  for (const modifier of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
    app.navigateProvider({ button: 0, [modifier]: true, preventDefault: () => assert.fail('不应拦截修饰键') }, 'claude')
  }
  app.navigateProvider({ button: 1, preventDefault: () => assert.fail('不应拦截中键') }, 'claude')
  assert.equal(location.pathname, '/openai')
  let prevented = false
  app.navigateProvider({ button: 0, preventDefault: () => { prevented = true } }, 'claude')
  assert.equal(prevented, true)
  assert.equal(location.pathname, '/claude')
  assert.equal(app.providerMode, 'claude')
})
