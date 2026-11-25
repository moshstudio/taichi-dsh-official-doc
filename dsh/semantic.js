/** 要素语义校验（GB/T 9704-2012）：文号、成文日期、发文机关署名 */

const DOC_NO_RE = /〔([^〕]{1,20})〕(\d{1,4})号/g
const BAD_BRACKET_RE = /[\(\[【]\s*(\d{1,4})\s*[\)\]】]\s*(\d{1,4})\s*号/g
const DATE_FULL_RE = /(\d{4})年(\d{1,2})月(\d{1,2})日/g
const DATE_NO_DAY_RE = /(\d{4})年(\d{1,2})月(?!\d)/g
const DATE_DASH_RE = /\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/g
const DATE_CN_DIGIT_RE = /[〇零一二三四五六七八九十]{2,4}年[一二三四五六七八九十]{1,3}月/

export function checkSemantic(model) {
  const issues = []
  const paragraphs = model?.paragraphs ?? []
  for (let index = 0; index < paragraphs.length; index++) {
    const paragraph = paragraphs[index]
    const text = String(paragraph?.text ?? '').trim()
    if (!text || paragraph.role === 'title') continue
    issues.push(...checkDocNumber(text, index))
    issues.push(...checkDate(text, index, paragraph.role))
    if (paragraph.role === 'signature') issues.push(...checkSignature(text, index))
  }
  return issues
}

function checkDocNumber(text, index) {
  const issues = []
  for (const match of text.matchAll(DOC_NO_RE)) {
    const yearPart = match[1]
    if (!/^\d{4}$/.test(yearPart)) {
      issues.push(semanticIssue('CHK-S001', '文号格式校验', 'P1', '7.2.2', index, match[0],
        '例：××发〔2026〕1号', `文号年份应为 4 位阿拉伯数字，当前为「${yearPart}」`))
    } else if (match[2].startsWith('0')) {
      issues.push(semanticIssue('CHK-S001', '文号格式校验', 'P1', '7.2.2', index, match[0],
        `例：……〔2026〕${Number(match[2])}号`, '发文顺序号前不应补零'))
    }
  }
  for (const match of text.matchAll(BAD_BRACKET_RE)) {
    issues.push(semanticIssue('CHK-S001', '文号格式校验', 'P1', '7.2.2', index, match[0],
      '改为六角括号：××发〔2026〕1号', '发文字号年份应使用六角括号〔〕'))
  }
  return issues
}

function checkDate(text, index, role) {
  const issues = []
  for (const match of text.matchAll(DATE_DASH_RE)) {
    issues.push(semanticIssue('CHK-S002', '成文日期格式校验', 'P1', '7.3.6', index, match[0],
      '改为 YYYY年M月D日', '成文日期应用汉字“年月日”，不宜用短横线或点号'))
  }
  for (const match of text.matchAll(DATE_NO_DAY_RE)) {
    issues.push(semanticIssue('CHK-S002', '成文日期格式校验', 'P1', '7.3.6', index, match[0],
      '补全日，如 2026年11月25日', '成文日期应标全年、月、日'))
  }
  if (DATE_CN_DIGIT_RE.test(text)) {
    issues.push(semanticIssue('CHK-S002', '成文日期格式校验', 'P1', '7.3.6', index, text.slice(0, 24),
      '改为阿拉伯数字年月日', '成文日期应使用阿拉伯数字'))
  }
  for (const match of text.matchAll(DATE_FULL_RE)) {
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    const now = new Date().getFullYear()
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1970 || year > now + 1) {
      issues.push(semanticIssue('CHK-S003', '成文日期合理性校验', 'P2', '7.3.6', index, match[0],
        '核对成文日期', '成文日期年月日不合理'))
    }
  }
  if (role === 'date' && !DATE_FULL_RE.test(text) && !DATE_DASH_RE.test(text)) {
    DATE_FULL_RE.lastIndex = 0
    if (!/(\d{4})年(\d{1,2})月(\d{1,2})日/.test(text)) {
      issues.push(semanticIssue('CHK-S002', '成文日期格式校验', 'P1', '7.3.6', index, text,
        '例：2026年11月25日', '成文日期段落格式不完整'))
    }
  }
  return issues
}

function checkSignature(text, index) {
  if (text.length < 2) {
    return [semanticIssue('CHK-S004', '发文机关署名完整性校验', 'P2', '7.3.5', index, text,
      '补充完整发文机关名称', '发文机关署名过短或不完整')]
  }
  return []
}

function semanticIssue(ruleId, name, severity, standardRef, paragraphIndex, original, fix, message) {
  return {
    id: ruleId,
    rule_id: ruleId,
    severity,
    name,
    field: 'semantic',
    original,
    fix,
    suggestion: fix,
    message,
    standard_ref: standardRef,
    paragraphIndex,
    selected: true
  }
}
