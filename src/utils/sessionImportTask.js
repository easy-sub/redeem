// createSessionImportTask 在独立 Worker 解析不可信文件，限制处理时间并允许离开页面时取消。
export function createSessionImportTask(file) {
  const worker = new Worker(new URL('./sessionImport.worker.js', import.meta.url), { type: 'module' })
  let timer
  let rejectTask
  const stop = () => {
    clearTimeout(timer)
    worker.terminate()
  }
  const promise = new Promise((resolve, reject) => {
    rejectTask = reject
    worker.onmessage = ({ data }) => {
      stop()
      if (data.error) reject(new Error(data.error))
      else resolve(data.session)
    }
    worker.onerror = () => {
      stop()
      reject(new Error('文件解析失败，请重新保存为 TXT 或 DOCX 后导入'))
    }
    timer = setTimeout(() => {
      stop()
      reject(new Error('文件解析超时，请只保留 Session 内容，或另存为 TXT 后导入'))
    }, 10000)
    worker.postMessage(file)
  })
  return { promise, cancel: () => { stop(); rejectTask(new Error('文件导入已取消')) } }
}
