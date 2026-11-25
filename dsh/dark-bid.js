/** 暗标/敏感信息扫描：身份证、手机、邮箱、银行卡 */

const MOBILE_RE = /(?<!\d)1[3-9]\d{9}(?!\d)/g
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const BANK_RE = /(?<!\d)(?:\d[ -]*?){16,19}(?!\d)/g
const ID_RE = /(?<!\d)[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx](?!\d)/g

export function scanDarkBid(model) {
  const hits = []
  const paragraphs = model?.paragraphs ?? []
  for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex++) {
    const text = String(paragraphs[paragraphIndex]?.text ?? '')
    if (!text) continue
    for (const match of text.matchAll(ID_RE)) {
      if (!validId18(match[0])) continue
      hits.push(hit('id', match[0], maskKeepEnds(match[0], 4, 4), paragraphIndex, text))
    }
    for (const match of text.matchAll(MOBILE_RE)) {
      hits.push(hit('mobile', match[0], maskKeepEnds(match[0], 3, 4), paragraphIndex, text))
    }
    for (const match of text.matchAll(EMAIL_RE)) {
      hits.push(hit('email', match[0], maskEmail(match[0]), paragraphIndex, text))
    }
    for (const match of text.matchAll(BANK_RE)) {
      const digits = match[0].replace(/\D/g, '')
      if (digits.length < 16 || digits.length > 19) continue
      if (/^1[3-9]\d{9}$/.test(digits)) continue
      hits.push(hit('bank', match[0], maskKeepEnds(digits, 4, 4), paragraphIndex, text))
    }
  }
  return hits
}

export function redactDarkBid(model, selected = null) {
  const allow = selected ? new Set(selected.map(String)) : null
  const next = structuredClone(model)
  const hits = scanDarkBid(next)
  for (const item of hits) {
    const key = `${item.type}:${item.excerpt}:${item.paragraphIndex}`
    if (allow && !allow.has(key) && !allow.has(item.excerpt)) continue
    const paragraph = next.paragraphs[item.paragraphIndex]
    if (!paragraph) continue
    paragraph.text = paragraph.text.split(item.excerpt).join(item.mask)
  }
  return { model: next, hits }
}

function hit(type, excerpt, mask, paragraphIndex, text) {
  const start = Math.max(0, text.indexOf(excerpt) - 8)
  return {
    type,
    excerpt,
    mask,
    paragraphIndex,
    context: text.slice(start, start + excerpt.length + 16)
  }
}

function maskKeepEnds(value, head, tail) {
  const text = String(value).replace(/\s/g, '')
  if (text.length <= head + tail) return '*'.repeat(text.length)
  return text.slice(0, head) + '*'.repeat(text.length - head - tail) + text.slice(-tail)
}

function maskEmail(value) {
  const [user, domain] = String(value).split('@')
  if (!domain) return '***'
  const safeUser = user.length <= 2 ? '*'.repeat(user.length) : `${user[0]}***${user.slice(-1)}`
  return `${safeUser}@${domain}`
}

/** GB 11643 校验位 */
function validId18(value) {
  const id = String(value).toUpperCase()
  if (!/^\d{17}[\dX]$/.test(id)) return false
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  const codes = '10X98765432'
  let sum = 0
  for (let i = 0; i < 17; i++) sum += Number(id[i]) * weights[i]
  return codes[sum % 11] === id[17]
}
