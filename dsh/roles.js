/** 段落角色识别。docx 读取与 Markdown 解析共用，避免两套规则分叉。 */

const HEADINGS = [
  [/^(?:一|二|三|四|五|六|七|八|九|十)、/, 'heading1'],
  [/^（[一二三四五六七八九十]+）/, 'heading2'],
  [/^[0-9]+[.、]/, 'heading3'],
  [/^（[0-9]+）/, 'heading4']
]

export function inferRole(text, align = 'left', size = 0) {
  const value = String(text ?? '').trim()
  if (!value) return { role: 'empty' }
  if (align === 'center' && size >= 20 || /^(关于|关于.*的).{1,40}(通知|报告|请示|意见|方案|办法)$/.test(value)) return { role: 'title' }
  for (const [pattern, role] of HEADINGS) {
    if (pattern.test(value)) return { role, level: Number(role.slice(-1)) }
  }
  if (/^(?:附件(?:[：:]|\d)|（此件公开发布）)/.test(value)) return { role: 'attachment' }
  if (/^抄送[:：]/.test(value)) return { role: 'cc' }
  if (/^(?:印发机关|印发日期|印发份数)[:：]/.test(value) || /^印发/.test(value)) return { role: 'colophon' }
  if (/(?:发|字|办|函|厅)[〔\[【]\d{4}[〕\]】]\d+号/.test(value)) return { role: 'documentNumber' }
  if (/^签发人[:：]/.test(value)) return { role: 'issuer' }
  if (/^(?:[\u4e00-\u9fff、]{1,12}[:：]|各有关单位[:：])$/.test(value) || /[:：]$/.test(value)) return { role: 'recipient' }
  if (/\d{4}年\d{1,2}月\d{1,2}日$/.test(value)) return { role: 'date' }
  if (align === 'right' && value.length <= 40) return { role: 'signature' }
  if (align == null && value.length <= 30 && !/[。！？]$/.test(value)) return { role: 'signature' }
  return { role: 'body' }
}