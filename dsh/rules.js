import { parse as parseYaml } from 'yaml'
import { inferRole } from './roles.js'
import { checkSemantic } from './semantic.js'
import { TYPE_ALIASES } from './types.js'

export function detectType(filename) {
  const name = String(filename ?? '')
  const found = TYPE_ALIASES.find(([word]) => name.includes(word))
  return found?.[1] ?? 'notice'
}

export function parseRules(text) {
  const rules = parseYaml(String(text ?? ''), { uniqueKeys: true })
  if (rules == null) return {}
  if (typeof rules !== 'object' || Array.isArray(rules)) throw new Error('规则文件根节点必须为对象')
  return rules
}

export function mergeRules(common, specific) {
  return {
    ...common,
    ...specific,
    common: deepMerge(common.common ?? {}, specific.common ?? {}),
    structure: specific.structure?.length ? specific.structure : (common.structure ?? []),
    check_rules: [...(common.check_rules ?? []), ...(specific.check_rules ?? [])],
    fix_rules: [...(common.fix_rules ?? []), ...(specific.fix_rules ?? [])]
  }
}

function deepMerge(base, extra) {
  const out = { ...base }
  for (const [key, value] of Object.entries(extra)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object') {
      out[key] = { ...base[key], ...value }
    } else out[key] = value
  }
  return out
}

export function checkModel(model, rules) {
  const expected = rules.common ?? {}
  const issues = []
  const page = model.page ?? {}
  const margin = expected.page ?? {}

  if (page.widthMm !== expected.page?.width_mm || page.heightMm !== expected.page?.height_mm) {
    issues.push(issue('page-size', 'P0', '页面尺寸', 'page.size', pageLabel(page), '改为 A4', '公文用 A4', '7.1'))
  }
  if ([page.top, page.bottom, page.left, page.right].some((value, index) =>
    value !== [margin.margin_top_mm, margin.margin_bottom_mm, margin.margin_left_mm, margin.margin_right_mm][index])) {
    issues.push(issue('page-margin', 'P1', '页边距', 'page.margin', pageMarginLabel(page),
      '按标准页边距修复', '页边距按 GB/T 9704', '7.1'))
  }

  for (const paragraph of model.paragraphs ?? []) {
    const role = paragraph.role
    if (role === 'title') {
      if (paragraph.font !== expected.title?.font) {
        issues.push(issue('title-font', 'P0', '标题字体', 'title.font', paragraph.text,
          `改为${expected.title?.font}`, '标题使用方正小标宋简体', '7.3.2', paragraph))
      }
      if (paragraph.align !== expected.title?.align) {
        issues.push(issue('title-align', 'P1', '标题对齐', 'title.align', paragraph.text,
          '改为居中', '标题居中', '7.3.2', paragraph))
      }
      if (expected.title?.size_pt && paragraph.size !== expected.title.size_pt) {
        issues.push(issue('title-size', 'P1', '标题字号', 'title.size', paragraph.text,
          `改为${expected.title.size_pt}磅`, '标题字号不符', '7.3.2', paragraph))
      }
    }
    if (role === 'body') {
      if (paragraph.font !== expected.body?.font) {
        issues.push(issue('body-font', 'P0', '正文字体', 'body.font', paragraph.text,
          `改为${expected.body?.font}`, '正文使用仿宋', '7.3.3', paragraph))
      }
      if (paragraph.size !== expected.body?.size_pt) {
        issues.push(issue('body-size', 'P0', '正文字号', 'body.size', paragraph.text,
          '改为三号', '正文使用三号字', '7.3.3', paragraph))
      }
    }
    if (role.startsWith('heading')) {
      const heading = expected[role] ?? expected.heading ?? {}
      if (heading.font && paragraph.font !== heading.font) issues.push(issue(`${role}-font`, 'P2', '层次标题字体', `${role}.font`, paragraph.text, `改为${heading.font}`, '层次标题字体不符', '7.3.3', paragraph))
      if (heading.size_pt && paragraph.size !== heading.size_pt) issues.push(issue(`${role}-size`, 'P2', '层次标题字号', `${role}.size`, paragraph.text, `改为${heading.size_pt}磅`, '层次标题字号不符', '7.3.3', paragraph))
      continue
    }
    if (role === 'heading' && expected.heading?.font && paragraph.font !== expected.heading.font) {
      issues.push(issue('heading-font', 'P2', '层次标题字体', 'heading.font', paragraph.text,
        `改为${expected.heading.font}`, '层次标题字体不符', '7.3.3', paragraph))
    }
    for (const field of ['font', 'size_pt', 'align']) {
      const configured = expected[role]?.[field]
      const actual = field === 'size_pt' ? paragraph.size : paragraph[field]
      if (configured != null && actual !== configured) issues.push(issue(`${role}-${field === 'size_pt' ? 'size' : field}`, field === 'font' ? 'P0' : 'P1', `${roleName(role)}${field === 'font' ? '字体' : field === 'size_pt' ? '字号' : '对齐'}`, `${role}.${field}`, paragraph.text, `改为${configured}`, `${roleName(role)}格式不符`, '7.3.3', paragraph))
    }
  }

  const roles = new Set((model.paragraphs ?? []).map(item => item.role))
  for (const role of rules.structure ?? []) {
    if (!roles.has(role)) {
      issues.push(issue(`missing-${role}`, 'P1', '结构', `structure.${role}`, `缺少${roleName(role)}`,
        `补充${roleName(role)}`, `文种应包含${roleName(role)}`, '7.3'))
    }
  }

  for (const rule of rules.check_rules ?? []) {
    if (!rule?.id || issues.some(item => item.id === rule.id || item.rule_id === rule.id)) continue
    if (rule.field === 'ending.check') {
      const lastBody = [...(model.paragraphs ?? [])].reverse().find(item => item.role === 'body')
      const text = lastBody?.text ?? ''
      if (text && !/特此通知|特此报告|请批复|此复|为荷/.test(text)) {
        issues.push(issue(rule.id, rule.severity || 'P2', rule.name || rule.id, rule.field,
          text.slice(0, 40), rule.expected || '补充规范结语', rule.message || '结语不规范', rule.standard_ref || ''))
      }
    }
  }

  issues.push(...checkSemantic(model))
  return issues
}

export function applyFixes(model, rules, selected = null) {
  const allow = selected ? new Set(selected) : null
  const next = structuredClone(model)
  next.meta = { ...(next.meta ?? {}), type: next.type || next.meta?.type }
  const page = rules.common?.page ?? {}
  const actions = new Set((rules.fix_rules ?? []).map(item => item.action))
  if (actions.has('page') && (!allow || allow.has('page-size') || allow.has('page-margin'))) {
    next.page = {
      widthMm: page.width_mm,
      heightMm: page.height_mm,
      top: page.margin_top_mm,
      bottom: page.margin_bottom_mm,
      left: page.margin_left_mm,
      right: page.margin_right_mm
    }
  }
  for (const paragraph of next.paragraphs ?? []) {
    if (paragraph.role === 'title' && actions.has('title') && (!allow || allow.has('title-font') || allow.has('title-align') || allow.has('title-size'))) {
      paragraph.font = rules.common?.title?.font
      paragraph.size = rules.common?.title?.size_pt
      paragraph.align = rules.common?.title?.align
    }
    if (paragraph.role === 'body' && actions.has('body') && (!allow || allow.has('body-font') || allow.has('body-size'))) {
      paragraph.font = rules.common?.body?.font
      paragraph.size = rules.common?.body?.size_pt
      paragraph.line = rules.common?.body?.line_pt
      paragraph.firstLineIndent = rules.common?.body?.first_indent_chars
    }
    const role = paragraph.role ?? ''
    if (role.startsWith('heading') && actions.has(role) && (!allow || allow.has(`${role}-font`) || allow.has(`${role}-size`))) {
      const heading = rules.common?.[role] ?? rules.common?.heading ?? {}
      paragraph.font = heading.font || paragraph.font
      paragraph.size = heading.size_pt || paragraph.size
    }
  }
  return next
}

export function parseMarkdown(markdown, type = 'notice') {
  const lines = String(markdown ?? '').replace(/\r\n/g, '\n').split('\n')
  const paragraphs = []
  const tables = []
  let index = 0
  while (index < lines.length) {
    const text = lines[index].trim()
    if (!text) { index += 1; continue }
    if (text.includes('|') && index + 1 < lines.length && /^\|?\s*:?-{3,}/.test(lines[index + 1].trim())) {
      const headers = splitRow(text)
      index += 2
      const rows = []
      while (index < lines.length && lines[index].includes('|')) rows.push(splitRow(lines[index++].trim()))
      tables.push({ headers, rows })
      paragraphs.push({ role: 'body', text: `[表格 ${headers.join(' / ')}]`, font: '仿宋_GB2312', size: 16, align: 'left', tableIndex: tables.length - 1 })
      continue
    }
    const heading = text.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      const level = heading[1].length
      paragraphs.push(level === 1
        ? { role: 'title', text: stripMd(heading[2]), font: '方正小标宋简体', size: 22, align: 'center' }
        : { role: `heading${Math.min(level - 1, 4)}`, headingLevel: Math.min(level - 1, 4), text: stripMd(heading[2]), font: level === 2 ? '黑体' : '楷体_GB2312', size: 16, align: 'left' })
      index += 1
      continue
    }
    const list = text.match(/^[-*+]\s+(.*)$/)
    if (list) {
      paragraphs.push({ role: 'body', text: list[2], font: '仿宋_GB2312', size: 16, align: 'justify', line: 28, firstLineIndent: 2 })
      index += 1
      continue
    }
    paragraphs.push(roleFromText(stripMd(text), null))
    index += 1
  }
  return { type, page: standardPage(), paragraphs, tables, meta: { type, layoutProfile: 'formal' } }
}

export function sampleModel(type, name) {
  const title = name || '示例公文'
  return {
    type,
    page: standardPage(),
    paragraphs: [
      { role: 'title', text: title, font: '方正小标宋简体', size: 22, align: 'center' },
      { role: 'recipient', text: '各有关单位：', font: '仿宋', size: 16, align: 'left' },
      { role: 'body', text: '　　现将有关事项通知如下。', font: '仿宋', size: 16, align: 'justify', line: 28, firstLineIndent: 2 },
      { role: 'body', text: '　　特此通知。', font: '仿宋', size: 16, align: 'justify', line: 28, firstLineIndent: 2 },
      { role: 'signature', text: '发文机关名称', font: '仿宋', size: 16, align: 'right' },
      { role: 'date', text: '2026年11月25日', font: '仿宋', size: 16, align: 'right' }
    ],
    tables: [],
    meta: { type, layoutProfile: 'formal' }
  }
}

function splitRow(line) {
  return line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => stripMd(cell.trim()))
}

function stripMd(text) {
  return String(text).replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/`([^`]+)`/g, '$1')
}

function roleFromText(text, align = 'left') {
  const value = String(text ?? '').trim()
  const role = inferRole(value, align).role
  const heading = /^heading([1-4])$/.exec(role)
  if (heading) {
    const level = Number(heading[1])
    const font = level === 1 ? '黑体' : level === 2 ? '楷体_GB2312' : '仿宋_GB2312'
    return { role, headingLevel: level, text: value, font, size: 16, align: 'left' }
  }
  const styled = {
    title: { font: '方正小标宋简体', size: 22, align: 'center' },
    issuer: { font: '楷体_GB2312', size: 16, align: 'right' },
    date: { font: '仿宋_GB2312', size: 16, align: 'right' },
    signature: { font: '仿宋_GB2312', size: 16, align: 'right' }
  }[role]
  if (styled) return { role, text: value, ...styled }
  if (role === 'body') return { role, text: value, font: '仿宋_GB2312', size: 16, align: 'justify', line: 28, firstLineIndent: 2 }
  return { role, text: value, font: '仿宋_GB2312', size: 16, align: 'left' }
}

function standardPage() {
  return { widthMm: 210, heightMm: 297, top: 37, bottom: 35, left: 28, right: 26 }
}

function issue(id, severity, name, field, original, fix, message, standardRef = '', paragraph = null) {
  return {
    id,
    rule_id: id,
    severity,
    name,
    field,
    original: String(original ?? '').slice(0, 120),
    fix,
    suggestion: fix,
    message: message || fix,
    standard_ref: standardRef,
    paragraphIndex: paragraph ? undefined : undefined,
    selected: true
  }
}

function pageLabel(page) {
  return `${page.widthMm || '?'}×${page.heightMm || '?'}mm`
}

function pageMarginLabel(page) {
  return `上${page.top} 下${page.bottom} 左${page.left} 右${page.right}`
}

function roleName(role) {
  return {
    title: '标题',
    recipient: '主送机关',
    body: '正文',
    signature: '署名',
    date: '成文日期',
    heading: '层次标题',
    heading1: '一级标题',
    heading2: '二级标题',
    heading3: '三级标题',
    heading4: '四级标题',
    documentNumber: '发文字号',
    attachment: '附件说明',
    issuer: '签发人',
    colophon: '版记',
    cc: '抄送'
  }[role] ?? role
}
