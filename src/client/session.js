/** 把提示词写入太极当前会话草稿。插件不配置模型，也不代发。 */

export function draftToSession(ctx, text) {
  const conversation = ctx?.get?.('conversation') ?? ctx?.conversation
  const input = currentInput(conversation)
  if (!input?.setDraft) throw new Error('当前没有可用的太极会话')
  const snapshot = input.state?.getSnapshot?.()
  const existing = String(snapshot?.draft ?? '').trim()
  const next = String(text ?? '').trim()
  if (!next) throw new Error('没有可写入的内容')
  if (existing && existing !== next) throw new Error('当前会话已有草稿，未覆盖')
  if (existing !== next) input.setDraft(next)
  input.focus?.()
  return { written: existing !== next }
}

export function takeSessionMarkdown(ctx) {
  const conversation = ctx?.get?.('conversation') ?? ctx?.conversation
  const input = currentInput(conversation)
  const messages = input?.messages?.() ?? conversation?.messages?.() ?? []
  const last = [...messages].reverse().find(item => item?.role === 'assistant' || item?.from === 'assistant')
  const text = String(last?.content ?? last?.text ?? '').trim()
  const fenced = text.match(/```(?:markdown|md)?\s*([\s\S]*?)```/)
  const markdown = (fenced?.[1] ?? text).trim()
  if (!markdown) throw new Error('当前会话没有可取回的回复')
  return markdown
}

export async function useSessionAction(ctx, action, text) {
  const charged = await accountRequest('charge', action)
  try {
    return { ...charged, ...draftToSession(ctx, text) }
  } catch (error) {
    await accountRequest('refund', action).catch(() => {})
    throw error
  }
}

function accountRequest(kind, action) {
  return request('POST', `/api/plugin/taichi_official_doc/account/${kind}`, { action })
}

async function request(method, path, body) {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload?.error || '请求失败')
  return payload
}

function currentInput(conversation) {
  const sessions = conversation?.sessions
  const current = sessions?.current ?? sessions?.active
  const scope = typeof current === 'function' ? current() : current
  if (scope && conversation?.input?.for) return conversation.input.for(scope)
  return conversation?.input?.current?.() ?? conversation?.input
}