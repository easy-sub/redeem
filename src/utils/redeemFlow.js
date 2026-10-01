const REDEEM_FLOW_STORAGE_KEY = 'redeem.client.redeem-flow.v1'

export const createRequestNonce = () => {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.getRandomValues) return ''
  const bytes = window.crypto.getRandomValues(new Uint8Array(32))
  let binary = ''
  bytes.forEach((value) => {
    binary += String.fromCharCode(value)
  })
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export const readRedeemFlow = () => {
  if (typeof window === 'undefined') return null
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(REDEEM_FLOW_STORAGE_KEY) || 'null')
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export const writeRedeemFlow = (flow) => {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(REDEEM_FLOW_STORAGE_KEY, JSON.stringify(flow))
  } catch {
    // sessionStorage may be unavailable in private mode.
  }
}

export const clearRedeemFlow = () => {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(REDEEM_FLOW_STORAGE_KEY)
  } catch {
    // sessionStorage may be unavailable in private mode.
  }
}
