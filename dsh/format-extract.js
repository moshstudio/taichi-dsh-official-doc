/** 从 DocumentModel 提取版式，生成可保存的规则 YAML 草稿 */

export function extractFormat(model, options = {}) {
  const paragraphs = model?.paragraphs ?? []
  const title = paragraphs.find(item => item.role === 'title') ?? paragraphs[0]
  const body = paragraphs.find(item => item.role === 'body') ?? paragraphs.find(item => item.role !== 'title')
  const page = model?.page ?? {}
  const name = String(options.name ?? '导入模板').trim() || '导入模板'
  const id = safeId(options.id || name)
  const common = {
    page: {
      width_mm: page.widthMm || 210,
      height_mm: page.heightMm || 297,
      margin_top_mm: page.top || 37,
      margin_bottom_mm: page.bottom || 35,
      margin_left_mm: page.left || 28,
      margin_right_mm: page.right || 26
    },
    title: {
      font: title?.font || '方正小标宋简体',
      size_pt: title?.size || 22,
      align: title?.align || 'center'
    },
    body: {
      font: body?.font || '仿宋',
      size_pt: body?.size || 16,
      line_pt: body?.line || 28,
      first_indent_chars: 2
    }
  }
  const structure = uniqueRoles(paragraphs)
  const yaml = toYaml({
    name,
    title_prefix: name,
    structure,
    common,
    check_rules: [
      { id: 'title-font', name: '标题字体', severity: 'P0', field: 'title.font', expected: common.title.font, message: `标题使用${common.title.font}` },
      { id: 'body-font', name: '正文字体', severity: 'P0', field: 'body.font', expected: common.body.font, message: `正文使用${common.body.font}` }
    ],
    fix_rules: [
      { id: 'fix-page', action: 'page' },
      { id: 'fix-title', action: 'title' },
      { id: 'fix-body', action: 'body' }
    ]
  })
  return {
    id,
    name,
    description: String(options.description ?? `从文档提取的${name}格式`),
    category: '自定义',
    structure,
    common,
    rules: yaml
  }
}

function uniqueRoles(paragraphs) {
  const roles = []
  for (const item of paragraphs) {
    if (item?.role && !roles.includes(item.role)) roles.push(item.role)
  }
  return roles.length ? roles : ['title', 'body', 'signature', 'date']
}

function toYaml(value, indent = 0) {
  const pad = '  '.repeat(indent)
  if (Array.isArray(value)) {
    if (!value.length) return `${pad}[]\n`
    return value.map(item => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const entries = Object.entries(item)
        if (!entries.length) return `${pad}- {}\n`
        const [firstKey, firstVal] = entries[0]
        const head = `${pad}- ${firstKey}: ${formatScalar(firstVal)}\n`
        const rest = entries.slice(1).map(([key, val]) => {
          if (val && typeof val === 'object') return `${pad}  ${key}:\n${toYaml(val, indent + 2)}`
          return `${pad}  ${key}: ${formatScalar(val)}\n`
        }).join('')
        return head + rest
      }
      return `${pad}- ${formatScalar(item)}\n`
    }).join('')
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).map(([key, val]) => {
      if (val && typeof val === 'object') return `${pad}${key}:\n${toYaml(val, indent + 1)}`
      return `${pad}${key}: ${formatScalar(val)}\n`
    }).join('')
  }
  return `${pad}${formatScalar(value)}\n`
}

function formatScalar(value) {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  const text = String(value ?? '')
  if (/[:#\n]|^\s|\s$/.test(text)) return JSON.stringify(text)
  return text
}

function safeId(value) {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!raw || !/^[a-z0-9_-]+$/.test(raw)) throw new Error('模板标识不正确')
  return raw.slice(0, 48)
}
