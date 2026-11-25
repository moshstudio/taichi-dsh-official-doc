const TYPES = [
  ['会议纪要', 'minutes'],
  ['技术方案', 'proposal'],
  ['工作方案', 'plan'],
  ['通知', 'notice'],
  ['报告', 'report'],
  ['请示', 'request'],
  ['批复', 'reply'],
  ['函', 'letter'],
  ['纪要', 'minutes'],
  ['决定', 'decision'],
  ['意见', 'opinion']
]

export function detectType(filename) {
  const name = String(filename ?? '')
  const found = TYPES.find(([word]) => name.includes(word))
  return found?.[1] ?? 'notice'
}

export function parseRules(text) {
  const lines = String(text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/)
  const root = {}
  const stack = [{ indent: -1, value: root }]
  for (const raw of lines) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue
    const indent = raw.match(/^ */)?.[0].length ?? 0
    const content = raw.trim()
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop()
    const parent = stack[stack.length - 1].value
    if (content.startsWith('- ')) {
      if (!Array.isArray(parent)) throw new Error('规则列表位置不正确')
      const item = content.slice(2)
      if (item.includes(':')) {
        const entry = {}
        const [key, ...rest] = item.split(':')
        entry[key.trim()] = cast(rest.join(':').trim())
        parent.push(entry)
        stack.push({ indent, value: entry })
      } else parent.push(cast(item))
      continue
    }
    const split = content.indexOf(':')
    if (split < 0) throw new Error(`规则行无法读取：${content}`)
    const key = content.slice(0, split).trim()
    const inline = content.slice(split + 1).trim()
    if (inline) parent[key] = cast(inline)
    else {
      const container = []
      parent[key] = container
      stack.push({ indent, value: container })
    }
  }
  return root
}

function cast(value) {
  if (value === 'true') return true
  if (value === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value)
  return value.replace(/^["']|["']$/g, '')
}

export function mergeRules(common, specific) {
  return {
    ...common,
    ...specific,
    common: { ...(common.common ?? {}), ...(specific.common ?? {}) },
    check_rules: [...(common.check_rules ?? []), ...(specific.check_rules ?? [])],
    fix_rules: [...(common.fix_rules ?? []), ...(specific.fix_rules ?? [])]
  }
}

export function checkModel(model, rules) {
  const expected = rules.common ?? {}
  const issues = []
  const page = model.page ?? {}
  if (page.widthMm !== expected.page?.width_mm || page.heightMm !== expected.page?.height_mm) {
    issues.push(issue('page-size', 'P0', '页面尺寸', '页面不是 A4', '改为 A4'))
  }
  const margin = expected.page ?? {}
  if ([page.top, page.bottom, page.left, page.right].some((value, index) => value !== [margin.margin_top_mm, margin.margin_bottom_mm, margin.margin_left_mm, margin.margin_right_mm][index])) {
    issues.push(issue('page-margin', 'P1', '页边距', '页边距不符合 GB/T 9704', '按标准页边距修复'))
  }
  for (const paragraph of model.paragraphs ?? []) {
    if (paragraph.role === 'title') {
      if (paragraph.font !== expected.title?.font) issues.push(issue('title-font', 'P0', '标题字体', paragraph.text, `改为${expected.title?.font}`))
      if (paragraph.align !== expected.title?.align) issues.push(issue('title-align', 'P1', '标题对齐', paragraph.text, '改为居中'))
    }
    if (paragraph.role === 'body') {
      if (paragraph.font !== expected.body?.font) issues.push(issue('body-font', 'P0', '正文字体', paragraph.text, `改为${expected.body?.font}`))
      if (paragraph.size !== expected.body?.size_pt) issues.push(issue('body-size', 'P0', '正文字号', paragraph.text, '改为三号'))
    }
  }
  const roles = new Set((model.paragraphs ?? []).map(item => item.role))
  for (const role of rules.structure ?? []) {
    if (!roles.has(role)) issues.push(issue(`missing-${role}`, 'P1', '结构', `缺少${roleName(role)}`, `补充${roleName(role)}`))
  }
  return issues
}

export function applyFixes(model, rules, selected = null) {
  const allow = selected ? new Set(selected) : null
  const next = structuredClone(model)
  const page = rules.common?.page ?? {}
  const actions = new Set((rules.fix_rules ?? []).map(item => item.action))
  if (actions.has('page') && (!allow || allow.has('page-size') || allow.has('page-margin'))) {
    next.page = { widthMm: page.width_mm, heightMm: page.height_mm, top: page.margin_top_mm, bottom: page.margin_bottom_mm, left: page.margin_left_mm, right: page.margin_right_mm }
  }
  for (const paragraph of next.paragraphs ?? []) {
    if (paragraph.role === 'title' && actions.has('title') && (!allow || allow.has('title-font') || allow.has('title-align'))) {
      paragraph.font = rules.common?.title?.font
      paragraph.size = rules.common?.title?.size_pt
      paragraph.align = rules.common?.title?.align
    }
    if (paragraph.role === 'body' && actions.has('body') && (!allow || allow.has('body-font') || allow.has('body-size'))) {
      paragraph.font = rules.common?.body?.font
      paragraph.size = rules.common?.body?.size_pt
      paragraph.line = rules.common?.body?.line_pt
    }
  }
  return next
}

export function parseMarkdown(markdown, type = 'notice') {
  const lines = String(markdown ?? '').replace(/\r\n/g, '\n').split('\n')
  const paragraphs = []
  for (const line of lines) {
    const text = line.trim()
    if (!text) continue
    const heading = text.match(/^(#{1,3})\s+(.*)$/)
    paragraphs.push(heading ? {
      role: heading[1].length === 1 ? 'title' : 'heading',
      text: heading[2],
      font: heading[1].length === 1 ? '方正小标宋简体' : '黑体',
      size: heading[1].length === 1 ? 22 : 16,
      align: heading[1].length === 1 ? 'center' : 'left'
    } : roleFromText(text))
  }
  return { type, page: standardPage(), paragraphs }
}

function roleFromText(text) {
  if (/：$/.test(text)) return { role: 'recipient', text, font: '仿宋', size: 16, align: 'left' }
  if (/\d{4}年\d{1,2}月\d{1,2}日$/.test(text)) return { role: 'date', text, font: '仿宋', size: 16, align: 'right' }
  if (text.length <= 30 && !/[。！？]$/.test(text)) return { role: 'signature', text, font: '仿宋', size: 16, align: 'right' }
  return { role: 'body', text, font: '仿宋', size: 16, align: 'justify', line: 28 }
}

function standardPage() {
  return { widthMm: 210, heightMm: 297, top: 37, bottom: 35, left: 28, right: 26 }
}

function issue(id, severity, name, original, fix) {
  return { id, severity, name, original, fix, selected: true }
}

function roleName(role) {
  return { title: '标题', recipient: '主送机关', body: '正文', signature: '署名', date: '成文日期', heading: '层次标题' }[role] ?? role
}