import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'
import vm from 'node:vm'
import { zipSync, strToU8 } from 'fflate'
import CFB from 'cfb'

const root = process.env.TARGET_ROOT || fileURLToPath(new URL('..', import.meta.url))
const modulePath = pathToFileURL(path.join(root, 'src/utils/sessionImport.js')).href
const unsupported = () => { throw new Error('此基线尚无 Session 文件导入') }
const { importSessionFile = unsupported, extractSessionJson = unsupported } = await import(modulePath).catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {}
  throw error
})
const source = readFileSync(path.join(root, 'src/components/StepToken.vue'), 'utf8')
const session = { accessToken: 'test-token-not-real', user: { email: 'customer@example.test', name: '测试 } { 账号' }, sessionToken: 'test-session', account: { id: 'test-account' } }
const json = JSON.stringify(session)
const file = (name, body) => new File([body], name)
const rtf = text => '{\\rtf1\\ansi\\uc1 ' + [...text].map(char => {
  if ('{}\\'.includes(char)) return '\\' + char
  if (char.charCodeAt(0) > 127) return `\\u${char.charCodeAt(0)}?`
  return char
}).join('') + '}'
const xmlEscape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const docx = text => zipSync({ 'word/document.xml': strToU8(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${xmlEscape(text)}</w:t></w:r></w:p></w:body></w:document>`) })

// doc 构造 Word 97 的原生复合文档与正文分段表，覆盖 Unicode 与压缩片段。
function doc(text, compressed = false, encrypted = false) {
  const content = compressed ? Buffer.from(text, 'latin1') : Buffer.from(text, 'utf16le')
  const word = Buffer.alloc(1024 + content.length)
  word.writeUInt16LE(0xa5ec, 0)
  word.writeUInt16LE(0x00c1, 2)
  word.writeUInt16LE(encrypted ? 0x0100 : 0, 0x0a)
  word.writeUInt32LE(text.length, 0x4c)
  word.writeUInt32LE(0, 0x1a2)
  word.writeUInt32LE(21, 0x1a6)
  content.copy(word, 1024)
  const table = Buffer.alloc(21)
  table[0] = 2
  table.writeUInt32LE(16, 1)
  table.writeUInt32LE(0, 5)
  table.writeUInt32LE(text.length, 9)
  table.writeUInt32LE(compressed ? 0x40000800 : 1024, 15)
  const archive = CFB.utils.cfb_new()
  CFB.utils.cfb_add(archive, 'WordDocument', word)
  CFB.utils.cfb_add(archive, '0Table', table)
  return CFB.write(archive, { type: 'buffer' })
}

for (const name of ['txt', 'json', 'md']) {
  test(`${name.toUpperCase()} 混合说明及 Markdown 中提取完整 Session`, async () => {
    const result = await importSessionFile(file(`session.${name}`, `账号使用说明\n\`\`\`json\n${json}\n\`\`\`\n请勿外传`))
    assert.deepEqual(JSON.parse(result), session)
  })
}

test('识别 UTF-8 BOM、UTF-16 和 GB18030 文本', async () => {
  assert.equal(await importSessionFile(file('session.txt', '\ufeff' + json)), json)
  assert.equal(await importSessionFile(file('session.txt', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(json, 'utf16le')]))), json)
  const ascii = JSON.stringify({ accessToken: 'test', email: 'a@example.test' })
  assert.equal(await importSessionFile(file('session.txt', Buffer.concat([Buffer.from([0xcb, 0xb5, 0xc3, 0xf7]), Buffer.from(ascii)]))), ascii)
})

test('按内容识别 RTF 和误写的 TRF，忽略隐藏信息并还原 Unicode', async () => {
  for (const extension of ['rtf', 'trf', 'txt']) {
    const input = rtf(`说明\n${json}`).replace('\\uc1 ', '\\uc1 {\\*\\info 隐藏内容}')
    assert.deepEqual(JSON.parse(await importSessionFile(file(`session.${extension}`, input))), session)
  }
})

test('RTF 还原十六进制转义且不解析嵌入对象', async () => {
  const input = rtf(json).replace('test-token-not-real', "test\\'2dtoken-not-real").replace('\\uc1 ', `\\uc1 {\\object ${rtf('{"accessToken":"hidden","email":"hidden@example.test"}')}}`)
  assert.equal(await importSessionFile(file('session.rtf', input)), json)
})

test('DOCX 提取分散在不同文本片段中的 JSON，保留 XML 实体内容', async () => {
  const input = zipSync({ 'word/document.xml': strToU8(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>说明</w:t></w:r></w:p><w:p><w:r><w:t>${xmlEscape(json.slice(0, 40))}</w:t></w:r><w:r><w:t>${xmlEscape(json.slice(40))}</w:t></w:r></w:p></w:body></w:document>`), 'word/media/unused.bin': new Uint8Array(100) })
  assert.equal(await importSessionFile(file('session.docx', input)), json)
  assert.equal(await importSessionFile(file('session.docx', docx(json.replace('test-session', 'a&b<c>')))), json.replace('test-session', 'a&b<c>'))
})

test('DOC 读取原生 Word Unicode 和压缩正文片段', async () => {
  assert.equal(await importSessionFile(file('session.doc', doc('说明\r' + json))), json)
  const ascii = JSON.stringify({ accessToken: 'test', email: 'a@example.test' })
  assert.equal(await importSessionFile(file('session.doc', doc(ascii, true))), ascii)
})

test('拒绝加密、损坏、伪装和超大文档，不回显文档凭据', async () => {
  const bad = [file('secret.doc', doc(json, false, true)), file('secret.docx', 'secret-credential'), file('secret.rtf', rtf(json).slice(0, -1)), file('secret.docx', new Uint8Array([0x50, 0x4b, 1, 2])), file('secret.txt', new Uint8Array([0, 1, 2, 3]))]
  for (const input of bad) {
    await assert.rejects(importSessionFile(input), error => !error.message.includes('secret-credential'))
  }
  await assert.rejects(importSessionFile({ name: 'too-large.txt', size: 5 * 1024 * 1024 + 1, arrayBuffer: () => assert.fail('超限文件不应读取') }), /5 MB/)
  await assert.rejects(importSessionFile(file('empty.txt', '')), /为空/)
  await assert.rejects(importSessionFile(file('script.html', json)), /请选择/)
})

test('拒绝 ZIP 超大正文、自定义实体和损坏 XML', async () => {
  await assert.rejects(importSessionFile(file('large.docx', docx(' '.repeat(2 * 1024 * 1024 + 1)))), /过大/)
  await assert.rejects(importSessionFile(file('entity.docx', zipSync({ 'word/document.xml': strToU8('<!DOCTYPE test [<!ENTITY x "private">]><x/>') }))), /实体/)
  await assert.rejects(importSessionFile(file('broken.docx', zipSync({ 'word/document.xml': strToU8('<w:document><w:body>') }))), /XML|损坏/)
})

test('只接受完整且含字符串凭据和邮箱的 Session', () => {
  for (const value of ['not json', '{"accessToken":"test"}', '{"user":{"email":"a@example.test"}}', '{"accessToken":123,"email":"a@example.test"}', '{"accessToken":"test","email":"invalid"}', '{"wrapper":' + json, '{"wrapper":' + json + ',}']) {
    assert.throws(() => extractSessionJson(value), /有效的 Session/)
  }
  assert.equal(extractSessionJson(JSON.stringify({ wrapper: session })), json)
  const auth = { auth: { access_token: 'test', email: 'a@example.test' }, account: { id: 'keep-me' } }
  assert.deepEqual(JSON.parse(extractSessionJson(JSON.stringify(auth))), auth)
})

test('多个账号或同一账号不同凭据拒绝猜选，重复的相同内容只导入一次', () => {
  const other = JSON.stringify({ ...session, accessToken: 'other-test-token' })
  assert.throws(() => extractSessionJson(json + '\n' + other), /多份 Session/)
  assert.throws(() => extractSessionJson(`[${json},${other}]`), /多份 Session/)
  assert.equal(extractSessionJson(json + '\n' + json), json)
})

// loadStep 执行真实组件方法，模拟动态导入与校验 API，验证导入没有网络或兑换副作用。
function loadStep(provider = 'openai', importer = importSessionFile) {
  const events = []
  const calls = []
  const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/^import .*$/gm, '')
    .replace('export default', 'globalThis.options =')
  const context = {
    ClientIcon: {}, Check: {}, Copy: {},
    createSessionImportTask: input => ({ promise: Promise.resolve().then(() => importer(input)), cancel: () => {} }),
    validateToken: async (...args) => { calls.push(args); return { code: 200, data: { email: 'customer@example.test', redeemToken: 'safe-test-compressed-token' } } },
    extractErrorURL: () => '',
  }
  vm.runInNewContext(script, context)
  const options = context.options
  const app = { ...options.data(), provider, cardCode: 'TEST-CDK', cardInfo: { activationToken: 'test-activation' }, requestNonce: 'test-nonce', $emit: (...args) => events.push(args) }
  for (const [key, method] of Object.entries(options.methods)) app[key] = method.bind(app)
  return { app, events, calls, unmount: () => options.beforeUnmount.call(app) }
}
const importEvent = input => ({ target: { files: [input], value: 'selected-file' } })

test('仅 ChatGPT 第二步显示导入入口，导入不校验、不上传，手动校验保留原调用参数', async () => {
  assert.match(source, /v-if="provider === 'openai'" class="session-import"/)
  const { app, events, calls } = loadStep()
  const event = importEvent(file('session.txt', '说明\n' + json))
  await app.importSession(event)
  assert.equal(event.target.value, '')
  assert.equal(app.token, json)
  assert.equal(calls.length, 0)
  assert.equal(events.length, 0)
  await app.validateToken()
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].slice(0, 5), [json, 'openai', 'TEST-CDK', 'test-activation', 'test-nonce'])
  assert.equal(events[0][0], 'validated')
  for (const provider of ['claude', 'grok']) {
    const { app } = loadStep(provider, () => assert.fail('其他平台不应导入'))
    await app.importSession(importEvent(file('session.txt', json)))
    assert.equal(app.token, '')
  }
})

test('导入失败保留旧输入，读取中阻止校验，卸载后忽略结果', async () => {
  const { app } = loadStep()
  app.token = 'original-input'
  await app.importSession(importEvent(file('bad.txt', 'invalid')))
  assert.equal(app.token, 'original-input')
  assert.match(app.error, /Session/)
  let complete
  const pending = new Promise(resolve => { complete = resolve })
  const loaded = loadStep('openai', () => pending)
  const importing = loaded.app.importSession(importEvent(file('session.txt', json)))
  await loaded.app.validateToken()
  assert.equal(loaded.calls.length, 0)
  loaded.unmount()
  complete(json)
  await importing
  assert.equal(loaded.app.token, '')
  assert.equal(loaded.events.length, 0)
})


test('导入后沿用真实账号预检接口，仅发送提取的压缩 Session', async t => {
  const { validateToken } = await import('../src/services/api.js')
  const { decompress } = await import('@bokuweb/zstd-wasm')
  const imported = await importSessionFile(file('session.md', '说明\n' + json))
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) })
    return { status: 200, json: async () => ({ code: 200, email: 'customer@example.test', plan_type: 'free' }) }
  })
  const result = await validateToken(imported, 'openai', 'TEST-CDK', 'test-activation')
  assert.equal(result.code, 200)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/api/v1/sub/precheckAccount')
  assert.equal(calls[0].body.cdk, 'TEST-CDK')
  assert.equal(calls[0].body.activation_token, 'test-activation')
  assert.deepEqual(JSON.parse(new TextDecoder().decode(decompress(Buffer.from(calls[0].body.token.slice('zstd64:'.length), 'base64')))), session)
})

test('原有手动粘贴及 Claude、Grok 校验参数保持不变', async () => {
  for (const provider of ['openai', 'claude', 'grok']) {
    const { app, calls } = loadStep(provider)
    app.token = provider === 'openai' ? json : 'test-cookie'
    await app.validateToken()
    assert.equal(calls.length, 1)
    assert.equal(calls[0][0], app.token)
    assert.equal(calls[0][1], provider)
  }
})

test('Worker 成功、失败、超时与取消均释放资源，限制解析最长 10 秒', async () => {
  const workerSource = readFileSync(path.join(root, 'src/utils/sessionImportTask.js'), 'utf8')
    .replace('export function', 'function').replace('import.meta.url', "'https://client.test/sessionImportTask.js'")
  let worker
  let timeout
  let delay
  let cleared = 0
  class MockWorker {
    constructor() { worker = this; this.terminated = 0 }
    postMessage(value) { this.file = value }
    terminate() { this.terminated++ }
  }
  const context = { Worker: MockWorker, URL, setTimeout: (callback, ms) => { timeout = callback; delay = ms; return 1 }, clearTimeout: () => { cleared++ } }
  vm.runInNewContext(workerSource + '\nglobalThis.create = createSessionImportTask', context)
  let task = context.create(file('session.txt', json))
  assert.equal(delay, 10000)
  worker.onmessage({ data: { session: json } })
  assert.equal(await task.promise, json)
  assert.equal(worker.terminated, 1)
  assert.equal(cleared, 1)
  task = context.create(file('session.txt', json))
  worker.onerror()
  await assert.rejects(task.promise, /解析失败/)
  assert.equal(worker.terminated, 1)
  task = context.create(file('session.txt', json))
  timeout()
  await assert.rejects(task.promise, /超时/)
  assert.equal(worker.terminated, 1)
  task = context.create(file('session.txt', json))
  task.cancel()
  await assert.rejects(task.promise, /取消/)
  assert.equal(worker.terminated, 1)
})

// fileDrag 模拟浏览器文件拖拽，不触碰真实文件或账号服务。
function fileDrag(files = [], types = ['Files']) {
  return {
    dataTransfer: { files, types, dropEffect: '' },
    prevented: false,
    preventDefault() { this.prevented = true },
  }
}

test('文件拖拽：输入区绑定事件、悬停高亮，纯文本拖拽保留原行为', () => {
  assert.match(source, /@dragover="handleSessionDragOver"/)
  assert.match(source, /@drop="handleSessionDrop"/)
  assert.match(source, /'is-dragging': draggingSession/)
  const { app } = loadStep()
  const files = fileDrag()
  app.handleSessionDragOver(files)
  assert.equal(files.prevented, true)
  assert.equal(files.dataTransfer.dropEffect, 'copy')
  assert.equal(app.draggingSession, true)
  app.handleSessionDragLeave({ currentTarget: { contains: () => false }, relatedTarget: null })
  assert.equal(app.draggingSession, false)
  const text = fileDrag([], ['text/plain'])
  app.handleSessionDragOver(text)
  assert.equal(text.prevented, false)
})

test('文件拖拽：单个文件复用导入解析，成功填框但不校验、不上传', async () => {
  const { app, calls, events } = loadStep()
  const event = fileDrag([file('session.md', '说明\n' + json)])
  app.draggingSession = true
  await app.handleSessionDrop(event)
  assert.equal(event.prevented, true)
  assert.equal(app.draggingSession, false)
  assert.equal(app.token, json)
  assert.match(app.importNotice, /已提取/)
  assert.equal(calls.length, 0)
  assert.equal(events.length, 0)
})

test('文件拖拽：多个文件、文件夹或错误文件不覆盖旧输入', async () => {
  const { app } = loadStep()
  app.token = 'original-input'
  for (const inputs of [[], [file('a.txt', json), file('b.txt', json)]]) {
    const event = fileDrag(inputs)
    await app.handleSessionDrop(event)
    assert.equal(event.prevented, true)
    assert.match(app.error, /一个文件|单个文件|文件夹/)
    assert.equal(app.token, 'original-input')
  }
  await app.handleSessionDrop(fileDrag([file('bad.txt', 'invalid')]))
  assert.match(app.error, /Session/)
  assert.equal(app.token, 'original-input')
})

test('文件拖拽：读取中或校验中阻止重复导入，Claude/Grok 不启用', async () => {
  for (const busy of ['loading', 'importing']) {
    const { app } = loadStep('openai', () => assert.fail('忙碌时不应创建新任务'))
    app[busy] = true
    app.token = 'original-input'
    const over = fileDrag()
    app.handleSessionDragOver(over)
    assert.equal(over.prevented, true)
    assert.equal(over.dataTransfer.dropEffect, 'none')
    assert.equal(app.draggingSession, false)
    const drop = fileDrag([file('session.txt', json)])
    await app.handleSessionDrop(drop)
    assert.equal(drop.prevented, true)
    assert.equal(app.token, 'original-input')
  }
  for (const provider of ['claude', 'grok']) {
    const { app } = loadStep(provider, () => assert.fail('其他平台不应导入'))
    const over = fileDrag()
    app.handleSessionDragOver(over)
    assert.equal(over.prevented, false)
    const drop = fileDrag([file('session.txt', json)])
    await app.handleSessionDrop(drop)
    assert.equal(drop.prevented, false)
    assert.equal(app.token, '')
  }
})
