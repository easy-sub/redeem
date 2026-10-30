import { Unzip, UnzipInflate } from 'fflate'
import { DOMParser } from '@xmldom/xmldom'
import CFB from 'cfb'

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024
const MAX_TEXT_BYTES = 2 * 1024 * 1024
const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const STRICT_WORD_NS = 'http://purl.oclc.org/ooxml/wordprocessingml/main'

// SessionImportError 仅承载可展示的固定错误，不回显解析器处理的敏感原文。
class SessionImportError extends Error {}

// extractSessionJson 只提取结构完整的单份 Session，不修补损坏 JSON，也不猜选多个账号。
export function extractSessionJson(text) {
  if (text.length > MAX_TEXT_BYTES) throw new SessionImportError('文档文字过多，请只保留本次账号的 Session JSON')
  const stack = []
  const sessions = new Set()
  let quoted = false
  let escaped = false
  let objects = 0
  let nodes = 0
  // 只在完整 JSON 内查找 Session，避免把损坏外层中的局部对象误当有效文件。
  const visit = (value, depth = 0) => {
    if (!value || typeof value !== 'object') return
    if (depth > 64 || ++nodes > 10000) throw new SessionImportError('文档 JSON 过于复杂，请只保留 Session JSON')
    const user = value.user || value.profile || {}
    const auth = value.auth || {}
    const token = value.accessToken || value.access_token || auth.accessToken || auth.access_token
    const email = user.email || value.email || auth.email
    if (!Array.isArray(value) && typeof token === 'string' && token.trim() && typeof email === 'string' && /^[^\s@]+@[^\s@]+$/.test(email)) {
      sessions.add(JSON.stringify(value))
      return
    }
    for (const item of Object.values(value)) visit(item, depth + 1)
  }
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (quoted) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') quoted = false
      continue
    }
    if (char === '"' && stack.length) quoted = true
    else if (char === '{' || char === '[') {
      if (stack.length >= 64) throw new SessionImportError('文档 JSON 嵌套过深，请只保留 Session JSON')
      stack.push({ index, char })
    } else if ((char === '}' || char === ']') && stack.length) {
      const start = stack.pop()
      if ((start.char === '{') !== (char === '}')) { stack.length = 0; continue }
      if (stack.length) continue
      if (++objects > 10000) throw new SessionImportError('文档 JSON 对象过多，请只保留 Session JSON')
      let value
      try { value = JSON.parse(text.slice(start.index, index + 1)) } catch { continue }
      visit(value)
    }
  }
  if (!sessions.size) throw new SessionImportError('未找到有效的 Session JSON，需要完整 JSON、accessToken 和账号邮箱；请检查文件内容')
  if (sessions.size > 1) throw new SessionImportError('文件中发现多份 Session，请只保留要兑换的一个账号后重新导入')
  return [...sessions][0]
}

// decodeText 支持常见 UTF-8、带 BOM 的 UTF-16 和 GB18030 文本，拒绝二进制内容。
function decodeText(bytes) {
  let encoding = 'utf-8'
  if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le'
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be'
  let text
  try { text = new TextDecoder(encoding, { fatal: true }).decode(bytes) } catch {
    text = new TextDecoder('gb18030', { fatal: true }).decode(bytes)
  }
  if (text.includes('\0')) throw new SessionImportError('文件不是可识别的文本，请另存为 TXT、RTF 或 Word 文档后重试')
  return text
}

// readRtfText 解析 RTF 分组、转义和 Unicode，只读取正文，不读取对象、图片或隐藏元数据。
function readRtfText(source) {
  const stack = []
  let state = { skip: false, uc: 1 }
  let fallback = 0
  let result = ''
  const destinations = new Set(['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'object', 'header', 'footer', 'headerl', 'headerr', 'footerl', 'footerr', 'fldinst', 'filetbl', 'datastore', 'themedata'])
  const append = char => {
    if (fallback > 0) fallback--
    else if (!state.skip) result += char
  }
  for (let i = 0; i < source.length;) {
    const char = source[i++]
    if (char === '{') {
      if (stack.length >= 128) throw new SessionImportError('RTF 文档嵌套过深')
      stack.push(state)
      state = { ...state }
    } else if (char === '}') {
      if (!stack.length) throw new SessionImportError('RTF 文档损坏，请重新保存后导入')
      state = stack.pop()
    } else if (char === '\\') {
      const next = source[i++]
      if (['{', '}', '\\'].includes(next)) append(next)
      else if (next === '*') state.skip = true
      else if (next === "'") {
        const hex = source.slice(i, i + 2)
        if (!/^[\da-f]{2}$/i.test(hex)) throw new SessionImportError('RTF 文档转义损坏')
        append(new TextDecoder('windows-1252').decode(Uint8Array.of(parseInt(hex, 16))))
        i += 2
      } else if (next === '~') append(' ')
      else if (/[a-z]/i.test(next || '')) {
        const control = source.slice(i - 1, i + 64).match(/^([a-z]+)(-?\d+)? ?/i)
        i += control[0].length - 1
        const word = control[1]
        const value = Number(control[2])
        if (destinations.has(word)) state.skip = true
        else if (word === 'uc') state.uc = Math.min(16, Math.max(0, value))
        else if (word === 'u') {
          if (!state.skip) result += String.fromCharCode(value & 0xffff)
          fallback = state.uc
        } else if (word === 'bin') {
          if (value < 0 || i + value > source.length) throw new SessionImportError('RTF 文档二进制段损坏')
          i += value
        } else if (['par', 'line'].includes(word)) append('\n')
        else if (word === 'tab') append('\t')
      }
    } else if (char !== '\r' && char !== '\n') append(char)
    if (result.length > MAX_TEXT_BYTES) throw new SessionImportError('RTF 正文过大，请只保留 Session JSON')
  }
  if (stack.length) throw new SessionImportError('RTF 文档不完整，请重新保存后导入')
  return result
}

// readDocxText 只解压有大小上限的 Word 正文 XML，不加载图片、外链、宏或嵌入对象。
function readDocxText(bytes) {
  let size = 0
  let found = false
  let finished = false
  const chunks = []
  const unzip = new Unzip(entry => {
    if (entry.name !== 'word/document.xml') return
    if (found) throw new SessionImportError('Word 文档存在重复正文，请重新保存')
    found = true
    if (entry.originalSize > MAX_TEXT_BYTES) throw new SessionImportError('Word 正文过大，请只保留 Session JSON')
    entry.ondata = (error, data, final) => {
      if (error) throw error
      size += data.length
      if (size > MAX_TEXT_BYTES) throw new SessionImportError('Word 正文过大，请只保留 Session JSON')
      chunks.push(data)
      finished = final
    }
    entry.start()
  })
  unzip.register(UnzipInflate)
  // 分块解压并累计实际输出，不能只信任 ZIP 头声明的解压大小。
  for (let offset = 0; offset < bytes.length; offset += 1024) {
    unzip.push(bytes.subarray(offset, offset + 1024), offset + 1024 >= bytes.length)
  }
  if (!found || !finished) throw new SessionImportError('未找到完整 Word 正文，文件可能损坏或不是 DOCX')
  const content = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { content.set(chunk, offset); offset += chunk.length }
  const xml = new TextDecoder('utf-8', { fatal: true }).decode(content)
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new SessionImportError('不支持包含自定义实体的 Word 文档')
  const document = new DOMParser({ onError: () => { throw new SessionImportError('Word 正文 XML 损坏') } }).parseFromString(xml, 'text/xml')
  const paragraphs = []
  const walk = (node, depth) => {
    if (depth > 128) throw new SessionImportError('Word 正文嵌套过深')
    const isWord = [WORD_NS, STRICT_WORD_NS].includes(node.namespaceURI)
    if (isWord && node.localName === 't') { paragraphs.push(node.textContent); return }
    if (isWord && ['br', 'cr', 'tab'].includes(node.localName)) paragraphs.push(node.localName === 'tab' ? '\t' : '\n')
    for (let child = node.firstChild; child; child = child.nextSibling) walk(child, depth + 1)
    if (isWord && node.localName === 'p') paragraphs.push('\n')
  }
  walk(document, 0)
  return paragraphs.join('')
}

// readDocText 按 Word 97–2003 的正文分段表读取 DOC，拒绝加密文件和越界片段。
function readDocText(bytes) {
  const archive = CFB.read(bytes, { type: 'array' })
  const stream = name => {
    const entry = CFB.find(archive, name)
    if (!entry?.content) throw new SessionImportError('Word 文档损坏或已加密，请另存为未加密的 DOCX 后重试')
    return new Uint8Array(entry.content)
  }
  const word = stream('WordDocument')
  const fib = new DataView(word.buffer, word.byteOffset, word.byteLength)
  if (word.length < 0x1aa || fib.getUint16(0, true) !== 0xa5ec || fib.getUint16(2, true) < 0xc1) throw new SessionImportError('不支持此旧版 Word，请另存为 DOCX 后重试')
  const flags = fib.getUint16(0x0a, true)
  if (flags & 0x8100) throw new SessionImportError('不支持加密 Word 文档，请另存为未加密文件')
  const table = stream(flags & 0x0200 ? '1Table' : '0Table')
  const view = new DataView(table.buffer, table.byteOffset, table.byteLength)
  let offset = fib.getUint32(0x1a2, true)
  const end = offset + fib.getUint32(0x1a6, true)
  const textLength = fib.getUint32(0x4c, true)
  if (end > table.length || textLength > MAX_TEXT_BYTES) throw new SessionImportError('Word 正文过大或分段表损坏')
  while (offset + 3 <= end && table[offset] === 1) offset += 3 + view.getUint16(offset + 1, true)
  if (offset + 5 > end || table[offset] !== 2) throw new SessionImportError('Word 正文分段表损坏')
  const size = view.getUint32(offset + 1, true)
  const count = (size - 4) / 12
  offset += 5
  if (!Number.isInteger(count) || count < 0 || count > 10000 || offset + size > end) throw new SessionImportError('Word 正文分段表无效')
  const chunks = []
  for (let index = 0; index < count; index++) {
    const start = view.getUint32(offset + index * 4, true)
    const stop = Math.min(view.getUint32(offset + (index + 1) * 4, true), textLength)
    if (start >= textLength) break
    if (stop < start) throw new SessionImportError('Word 正文分段顺序无效')
    const fc = view.getUint32(offset + (count + 1) * 4 + index * 8 + 2, true)
    const compressed = Boolean(fc & 0x40000000)
    const position = (fc & 0x3fffffff) / (compressed ? 2 : 1)
    const length = (stop - start) * (compressed ? 1 : 2)
    if (!Number.isInteger(position) || position + length > word.length) throw new SessionImportError('Word 正文片段越界')
    chunks.push(new TextDecoder(compressed ? 'windows-1252' : 'utf-16le', { fatal: true }).decode(word.subarray(position, position + length)))
  }
  return chunks.join('').replace(/\r/g, '\n')
}

// importSessionFile 在浏览器本地解析文件并返回唯一 Session；不发起校验、上传或兑换请求。
export async function importSessionFile(file) {
  if (!file || !/\.(txt|json|md|rtf|trf|docx|doc)$/i.test(file.name)) throw new SessionImportError('请选择 TXT、JSON、MD、RTF/TRF 或 Word（DOC/DOCX）文件')
  if (!file.size) throw new SessionImportError('文件为空，请检查后重新导入')
  if (file.size > MAX_IMPORT_BYTES) throw new SessionImportError('文件不能超过 5 MB，请只保留 Session 内容')
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (bytes.length > MAX_IMPORT_BYTES) throw new SessionImportError('文件不能超过 5 MB，请只保留 Session 内容')
    let text
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) text = readDocxText(bytes)
    else if ([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((byte, index) => bytes[index] === byte)) text = readDocText(bytes)
    else {
      text = decodeText(bytes)
      if (text.trimStart().startsWith('{\\rtf')) text = readRtfText(text.trimStart())
      else if (/\.(docx?|rtf|trf)$/i.test(file.name)) throw new SessionImportError('文件内容与文档格式不符，请重新保存为 TXT、RTF 或 Word 文档')
    }
    return extractSessionJson(text)
  } catch (error) {
    // 不向用户回显解析器异常中的文档片段或凭据。
    if (error instanceof SessionImportError) throw error
    throw new SessionImportError('文件无法读取或格式已损坏，请重新保存后导入')
  }
}
