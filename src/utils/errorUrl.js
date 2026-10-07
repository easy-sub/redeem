const errorUrlPattern = /https?:\/\/[^\s"'<>]+/i

/** 从错误文本中提取第一个网址，供复制按钮使用。 */
export function extractErrorURL(value) {
  const match = String(value || '').match(errorUrlPattern)
  if (!match) return ''
  return match[0].replace(/[\])}>,.;!?，。；！？]+$/g, '')
}
