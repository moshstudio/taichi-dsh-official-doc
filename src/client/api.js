export async function request(method, path, body) {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload?.error || '请求失败')
  return payload
}

export function download(file) {
  const bytes = normalizeBytes(file.bytes)
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = file.filename || '公文.docx'
  link.click()
  URL.revokeObjectURL(link.href)
  return file
}

export function failed(error) {
  return { kind: 'error', text: error instanceof Error ? error.message : '处理失败' }
}

function normalizeBytes(value) {
  if (value instanceof Uint8Array) return value
  if (Array.isArray(value)) return new Uint8Array(value)
  if (value?.type === 'Buffer' && Array.isArray(value.data)) return new Uint8Array(value.data)
  if (value && typeof value === 'object') return new Uint8Array(Object.values(value))
  return new Uint8Array()
}