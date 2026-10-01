import { init, compress } from '@bokuweb/zstd-wasm'

const TOKEN_PREFIX = 'zstd64:'
const COMPRESSION_LEVEL = 10

let zstdInitPromise = null

const ensureZstd = () => {
  if (!zstdInitPromise) {
    zstdInitPromise = init()
  }
  return zstdInitPromise
}

const uint8ToBase64 = (bytes) => {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

export const encodeSessionToken = async (sessionText) => {
  const text = String(sessionText || '').trim()
  await ensureZstd()
  const raw = new TextEncoder().encode(text)
  const compressed = compress(raw, COMPRESSION_LEVEL)
  return `${TOKEN_PREFIX}${uint8ToBase64(compressed)}`
}
