import { importSessionFile } from './sessionImport.js'

// onmessage 仅向页面返回提取结果或固定错误，绝不上传、渲染或执行文档内容。
self.onmessage = async ({ data }) => {
  try {
    self.postMessage({ session: await importSessionFile(data) })
  } catch (error) {
    self.postMessage({ error: error.message || '文件导入失败，请重新保存后重试' })
  }
}
