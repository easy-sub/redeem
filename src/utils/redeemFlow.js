export const createRequestNonce = () => {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.getRandomValues) return ''
  const bytes = window.crypto.getRandomValues(new Uint8Array(32))
  let binary = ''
  bytes.forEach((value) => {
    binary += String.fromCharCode(value)
  })
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
