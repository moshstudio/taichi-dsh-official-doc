window.__ModuleLoader__.load({
  id: 'taichi-dsh-official-doc',
  factory: (require) => {
    const React = require('react')
    const NS = 'taichi-dsh-official-doc'
const STYLE_ID = 'taichi-dsh-official-doc'
const copy = {
  zh: {
    name: '公文',
    workspace: '工作台',
    process: '文档处理',
    markdown: 'Markdown优化',
    review: '校审中心',
    templates: '模板中心',
    about: '关于'
  },
  en: {
    name: 'Official document',
    workspace: 'Workspace',
    process: 'Documents',
    markdown: 'Markdown',
    review: 'Review',
    templates: 'Templates',
    about: 'About'
  }
}
const sections = ['workspace', 'process', 'markdown', 'review', 'templates', 'about']
const STATUS_LABEL = { uploaded: '已上传', checked: '已校审', optimized: '已优化', failed: '处理失败' }

const CSS = `
[data-taichi-official-doc]{box-sizing:border-box;display:flex;flex-direction:column;gap:16px;width:100%;height:100%;min-height:0;padding:20px 24px;overflow:auto;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-size:13px;line-height:20px}
[data-taichi-official-doc] *,[data-taichi-official-doc] *::before,[data-taichi-official-doc] *::after{box-sizing:border-box}
[data-taichi-official-doc] nav{display:flex;flex-wrap:wrap;gap:8px;flex:none}
[data-taichi-official-doc] nav button{appearance:none;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 12px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer}
[data-taichi-official-doc] nav button:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
[data-taichi-official-doc] nav button[aria-current=page]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,var(--dsw-alias-bg-layer-1))}
[data-taichi-official-doc] nav button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
[data-taichi-official-doc] [data-status]{min-height:20px;color:var(--dsw-alias-label-secondary)}
[data-taichi-official-doc] [data-status=error]{color:var(--dsw-alias-state-error-primary)}
[data-taichi-official-doc] [data-status=loading]{color:var(--dsw-alias-label-tertiary)}
[data-taichi-official-doc] article{display:flex;flex-direction:column;gap:12px;min-width:0;flex:1}
[data-taichi-official-doc] h1{margin:0;font-size:18px;line-height:26px;font-weight:600}
[data-taichi-official-doc] h2{margin:0;font-size:14px;line-height:22px;font-weight:600}
[data-taichi-official-doc] p{margin:0;color:var(--dsw-alias-label-secondary)}
[data-taichi-official-doc] label{display:flex;align-items:flex-start;gap:8px;color:var(--dsw-alias-label-primary)}
[data-taichi-official-doc] form{display:flex;flex-direction:column;gap:10px;max-width:560px}
[data-taichi-official-doc] .tod-actions{display:flex;flex-wrap:wrap;gap:8px}
[data-taichi-official-doc] .tod-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
[data-taichi-official-doc] .tod-card{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:12px;background:var(--dsw-alias-bg-layer-1)}
[data-taichi-official-doc] .tod-card strong{display:block;font-size:20px;line-height:28px;color:var(--dsw-alias-label-primary)}
[data-taichi-official-doc] .tod-split{display:grid;grid-template-columns:minmax(280px,1fr) minmax(280px,1fr);gap:16px;min-height:0}
@media (max-width:960px){[data-taichi-official-doc] .tod-split{grid-template-columns:1fr}}
[data-taichi-official-doc] .tod-issue{display:flex;flex-direction:column;gap:4px;padding:8px 0;border-bottom:1px solid var(--dsw-alias-border-l2)}
[data-taichi-official-doc] .tod-badge{display:inline-block;padding:2px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);font-size:12px}
[data-taichi-official-doc] .tod-drop{border:1px dashed var(--dsw-alias-border-l2);border-radius:8px;padding:20px;text-align:center;background:var(--dsw-alias-bg-layer-1)}
[data-taichi-official-doc] .tod-drop[data-active=true]{border-color:var(--dsw-alias-brand-primary)}
[data-taichi-official-doc] .tod-modal{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:24px;z-index:80}
[data-taichi-official-doc] .tod-modal-panel{width:min(920px,100%);max-height:90vh;overflow:auto;background:var(--dsw-alias-bg-base);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px}
[data-taichi-official-doc] input[type=text],
[data-taichi-official-doc] input:not([type]),
[data-taichi-official-doc] input[type=file],
[data-taichi-official-doc] select,
[data-taichi-official-doc] textarea{width:100%;max-width:560px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px 10px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit}
[data-taichi-official-doc] textarea{min-height:160px;resize:vertical}
[data-taichi-official-doc] input:focus-visible,
[data-taichi-official-doc] select:focus-visible,
[data-taichi-official-doc] textarea:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
[data-tod-a4-wrap]{display:flex;flex-direction:column;gap:8px;min-width:0}
[data-tod-a4-toolbar]{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
[data-tod-a4-stage]{overflow:auto;padding:12px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;max-height:70vh}
[data-tod-a4-page]{width:210mm;min-height:297mm;margin:0 auto;background:#fff;color:#111;box-shadow:0 1px 4px rgba(0,0,0,.12);padding:37mm 26mm 35mm 28mm;transform-origin:top center;font-family:仿宋,FangSong,STFangsong,serif;font-size:16pt;line-height:28pt}
[data-tod-a4-page] .tod-title{font-family:方正小标宋简体,宋体,SimSun,serif;font-size:22pt;text-align:center;line-height:33pt;margin:0 0 18pt}
[data-tod-a4-page] .tod-recipient{text-align:left;margin:0 0 12pt}
[data-tod-a4-page] .tod-body{text-align:justify;text-indent:2em;margin:0}
[data-tod-a4-page] .tod-heading{font-family:黑体,SimHei,sans-serif;text-indent:2em;margin:12pt 0 0}
[data-tod-a4-page] .tod-signature,[data-tod-a4-page] .tod-date{text-align:right;margin:18pt 4em 0 0}
[data-tod-a4-page] table{width:100%;border-collapse:collapse;margin:12pt 0;font-size:14pt}
[data-tod-a4-page] td,[data-tod-a4-page] th{border:1px solid #333;padding:4pt 6pt;text-align:left}
@media print{
  body *{visibility:hidden!important}
  [data-tod-a4-print],[data-tod-a4-print] *{visibility:visible!important}
  [data-tod-a4-print]{position:absolute;left:0;top:0;width:100%}
  [data-tod-a4-page]{box-shadow:none;margin:0}
}
@media (prefers-reduced-motion:reduce){[data-taichi-official-doc] *{transition:none!important}}
`

const inject = ['slots', 'locale', 'connection']

function apply(ctx) {
  const state = { open: false, section: 'workspace', docId: null, listeners: new Set() }
  let cached = { open: state.open, section: state.section, docId: state.docId }
  const publish = () => {
    cached = { open: state.open, section: state.section, docId: state.docId }
    for (const listener of state.listeners) listener()
  }
  const controller = {
    open: () => { state.open = true; publish() },
    close: () => { state.open = false; publish() },
    toggle: () => { state.open = !state.open; publish() },
    choose: (section, docId = null) => {
      state.section = section
      state.docId = docId
      state.open = true
      publish()
    },
    layout: () => ctx.get('layout'),
    subscribe: listener => { state.listeners.add(listener); return () => state.listeners.delete(listener) },
    getSnapshot: () => cached
  }
  const t = ctx.locale.bind(NS)

  ctx.effect(() => ctx.locale.register(NS, copy), 'taichi-official-doc: locale')
  ctx.effect(() => ensureStyles(), 'taichi-official-doc: styles')
  ctx.effect(() => {
    const home = () => { controller.close(); ctx.get('layout')?.selectPanel?.(null) }
    document.addEventListener('dsh-activity-home', home)
    return () => document.removeEventListener('dsh-activity-home', home)
  }, 'taichi-official-doc: home')

  ctx.slots.inject('shell.activity.main', () => ctx.slots.register({
    name: 'shell.activity.main',
    id: 'taichi-official-doc',
    order: 30,
    locale: NS,
    inject: () => ({ controller, t })
  }, ActivityButton))

  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: 'taichi-official-doc',
    locale: NS,
    inject: () => ({ controller, t, connection: ctx.get('connection') })
  }, Page))
}

function ensureStyles() {
  if (typeof document === 'undefined' || !document.head?.appendChild) return () => {}
  const existing = document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`)
  if (existing) {
    if (existing.textContent !== CSS) existing.textContent = CSS
    return () => existing.remove()
  }
  const style = document.createElement('style')
  style.dataset.plugin = STYLE_ID
  style.dataset.pluginCss = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
  return () => style.remove()
}

function ActivityButton({ controller, t, bindTip }) {
  /* React from factory */
  const selected = React.useSyncExternalStore(
    controller.subscribe,
    () => controller.getSnapshot().open
  )
  const openPage = () => {
    document.dispatchEvent(new Event('dsh-activity-home'))
    document.dispatchEvent(new CustomEvent('dsh-activity-sidebar', { detail: { mode: 'hidden' } }))
    const layout = controller.layout?.()
    layout?.selectPanel?.('taichi-official-doc')
    controller.open()
  }
  const props = {
    type: 'button',
    'data-dsh-activity': '',
    'aria-label': t('name'),
    'aria-current': selected ? 'page' : undefined,
    'data-selected': selected ? 'true' : 'false',
    onClick: openPage
  }
  return React.createElement('button', typeof bindTip === 'function' ? bindTip(props) : props,
    React.createElement('span', { 'data-dsh-activity-glyph': '', key: selected ? 'on' : 'off' },
      React.createElement('svg', {
        viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: 'currentColor',
        strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true
      },
        React.createElement('path', { d: 'M6 3h9l3 3v15H6z' }),
        React.createElement('path', { d: 'M14 4v4h4M8 11h8M8 15h8' }))))
}

function Page({ controller, t, connection }) {
  /* React from factory */
  const { Button } = require('@deepseek-ai/dsh-client-ui-primitives')
  const openLocal = React.useSyncExternalStore(controller.subscribe, () => controller.getSnapshot().open)
  const section = React.useSyncExternalStore(controller.subscribe, () => controller.getSnapshot().section)
  const docId = React.useSyncExternalStore(controller.subscribe, () => controller.getSnapshot().docId)
  const panel = React.useSyncExternalStore(subscribePanel(controller), panelSnapshot(controller))
  const open = openLocal || panel === 'taichi-official-doc'
  const [status, setStatus] = React.useState({ kind: 'ready', text: '' })
  const [result, setResult] = React.useState(null)
  const [previewModel, setPreviewModel] = React.useState(null)
  const [history, setHistory] = React.useState([])
  const [templates, setTemplates] = React.useState([])
  const [types, setTypes] = React.useState([])
  const [stats, setStats] = React.useState(null)
  const [meta, setMeta] = React.useState(null)
  const [markdown, setMarkdown] = React.useState('')
  const [markdownType, setMarkdownType] = React.useState('notice')
  const [showPreview, setShowPreview] = React.useState(false)

  React.useLayoutEffect(ensureStyles, [])
  React.useEffect(() => {
    if (!open) return
    refreshLists(setHistory, setTemplates, setTypes, setStats, setMeta, setStatus)
  }, [open])

  React.useEffect(() => {
    if (!open || !docId) return
    setStatus({ kind: 'loading', text: '加载校审结果' })
    request('GET', `/api/plugin/taichi_official_doc/job?id=${encodeURIComponent(docId)}`)
      .then(payload => {
        setResult(payload)
        setPreviewModel(payload.model)
        setStatus({ kind: 'ready', text: '' })
      })
      .catch(error => setStatus(failed(error)))
  }, [open, docId])

  if (!open) return null

  const run = action => {
    setStatus({ kind: 'loading', text: '正在处理' })
    return action().then(value => {
      if (value?.issues) setResult(value)
      if (value?.model) setPreviewModel(value.model)
      setStatus({ kind: 'ready', text: '' })
      refreshLists(setHistory, setTemplates, setTypes, setStats, setMeta, setStatus)
      return value
    }).catch(error => {
      setStatus(failed(error))
      throw error
    })
  }

  const props = {
    result, setResult, previewModel, setPreviewModel, history, templates, types, stats, meta,
    markdown, setMarkdown, markdownType, setMarkdownType, showPreview, setShowPreview,
    run, connection, Button, controller
  }

  return React.createElement('section', { 'data-taichi-official-doc': '', role: 'region', 'aria-label': t('name') },
    React.createElement('nav', { 'aria-label': t('name') }, sections.map(id => React.createElement('button', {
      key: id, type: 'button', 'aria-current': section === id ? 'page' : undefined, onClick: () => controller.choose(id)
    }, t(id)))),
    React.createElement('div', { 'data-status': status.kind, role: 'status', 'aria-live': 'polite' }, status.text),
    view(section, props),
    showPreview ? React.createElement(PreviewModal, {
      model: previewModel,
      onClose: () => setShowPreview(false),
      Button
    }) : null)
}

function refreshLists(setHistory, setTemplates, setTypes, setStats, setMeta, setStatus) {
  Promise.all([
    request('GET', '/api/plugin/taichi_official_doc/history'),
    request('GET', '/api/plugin/taichi_official_doc/templates'),
    request('GET', '/api/plugin/taichi_official_doc/types'),
    request('GET', '/api/plugin/taichi_official_doc/stats'),
    request('GET', '/api/plugin/taichi_official_doc/meta')
  ]).then(([history, templates, types, stats, meta]) => {
    setHistory(history)
    setTemplates(templates)
    setTypes(types)
    setStats(stats)
    setMeta(meta)
  }).catch(error => setStatus(failed(error)))
}

function subscribePanel(controller) {
  return listener => controller.layout?.()?.panelInfo?.subscribe?.(listener) ?? (() => {})
}

function panelSnapshot(controller) {
  return () => controller.layout?.()?.panelInfo?.getSnapshot?.().activePanelId ?? null
}

function view(section, props) {
  /* React from factory */
  if (section === 'workspace') return React.createElement(Workspace, props)
  if (section === 'process') return React.createElement(ProcessView, props)
  if (section === 'review') return React.createElement(Review, props)
  if (section === 'markdown') return React.createElement(MarkdownView, props)
  if (section === 'templates') return React.createElement(Templates, props)
  return React.createElement(About, props)
}

function Workspace({ history, stats, meta, controller, Button }) {
  /* React from factory */
  const cards = [
    ['文档总数', stats?.documents ?? 0],
    ['校审次数', stats?.checks ?? 0],
    ['发现问题', stats?.issues ?? 0],
    ['优化完成', stats?.optimized ?? 0]
  ]
  return React.createElement('article', null,
    React.createElement('h1', null, '公文智能校审工作台'),
    React.createElement('p', null, new Date().toLocaleDateString('zh-CN', { dateStyle: 'full' })),
    React.createElement('div', { className: 'tod-grid' }, cards.map(([label, value]) =>
      React.createElement('div', { key: label, className: 'tod-card' },
        React.createElement('span', null, label),
        React.createElement('strong', null, value)))),
    React.createElement('div', { className: 'tod-actions' },
      React.createElement(Button, { type: 'button', variant: 'primary', onClick: () => controller.choose('process') }, '上传公文'),
      React.createElement(Button, { type: 'button', variant: 'outline', onClick: () => controller.choose('templates') }, '选择模板'),
      React.createElement(Button, { type: 'button', variant: 'outline', onClick: () => controller.choose('about') }, '关于 AI')),
    React.createElement('h2', null, '最近文档'),
    history.slice(0, 8).map(item => React.createElement('p', {
      key: item.id,
      style: { cursor: 'pointer' },
      onClick: () => controller.choose('review', item.id)
    }, `${item.name} · ${STATUS_LABEL[item.status] || '已校审'} · ${item.type || ''} · ${item.issueCount ?? item.issues ?? 0} 个问题`)),
    history.length === 0 ? React.createElement('p', null, '还没有处理过的文档，先去文档处理上传。') : null,
    React.createElement('p', null, `规则 ${meta?.rules ?? '-'} 条 · 插件 v${meta?.version ?? '-' } · AI 使用太极当前会话`))
}

function ProcessView({ types, run, setResult, setPreviewModel, setShowPreview, controller, Button }) {
  /* React from factory */
  const [file, setFile] = React.useState(null)
  const [type, setType] = React.useState('notice')
  const [phase, setPhase] = React.useState('')
  const [dragging, setDragging] = React.useState(false)

  const onFile = next => {
    if (!next) return
    if (/\.(doc|wps)$/i.test(next.name)) {
      setPhase('请先另存为 .docx 后再上传')
      return
    }
    setFile(next)
    setPhase(`已选择 ${next.name}`)
  }

  const startCheck = () => {
    if (!file) return
    setPhase('上传中')
    file.arrayBuffer().then(buffer => {
      setPhase('检查中')
      return run(() => request('POST', '/api/plugin/taichi_official_doc/check', {
        filename: file.name,
        type,
        bytes: Array.from(new Uint8Array(buffer))
      }))
    }).then(payload => {
      setResult(payload)
      setPreviewModel(payload.model)
      setPhase('完成')
    }).catch(() => setPhase('失败'))
  }

  return React.createElement('article', null,
    React.createElement('h1', null, '文档处理'),
    React.createElement('p', null, '上传 .docx，选择文种后开始格式检查。'),
    React.createElement('div', {
      className: 'tod-drop',
      'data-active': dragging ? 'true' : 'false',
      onDragOver: event => { event.preventDefault(); setDragging(true) },
      onDragLeave: () => setDragging(false),
      onDrop: event => {
        event.preventDefault()
        setDragging(false)
        onFile(event.dataTransfer.files?.[0])
      }
    },
      React.createElement('p', null, file ? `${file.name}（${Math.round(file.size / 1024)} KB）` : '拖拽或选择 Word 文档（.docx）'),
      React.createElement('input', {
        type: 'file', accept: '.docx,.doc,.wps', 'aria-label': '选择文档',
        onChange: event => onFile(event.target.files?.[0])
      })),
    React.createElement('label', null, '文种',
      React.createElement('select', { 'aria-label': '文种', value: type, onChange: event => setType(event.target.value) },
        (types.length ? types : [{ id: 'notice', name: '通知' }]).map(item =>
          React.createElement('option', { key: item.id, value: item.id }, item.name)))),
    React.createElement('div', { className: 'tod-actions' },
      React.createElement(Button, { type: 'button', variant: 'primary', disabled: !file, onClick: startCheck }, '开始检查'),
      React.createElement(Button, { type: 'button', variant: 'outline', disabled: !phase || phase === '失败', onClick: () => controller.choose('review') }, '查看检查结果'),
      React.createElement(Button, { type: 'button', variant: 'outline', disabled: !phase || phase === '失败', onClick: () => setShowPreview(true) }, 'A4 预览')),
    phase ? React.createElement('p', null, `状态：${phase}`) : null)
}

function Review({ result, setResult, setPreviewModel, setShowPreview, run, connection, Button }) {
  /* React from factory */
  const [filter, setFilter] = React.useState('all')
  const [selected, setSelected] = React.useState(() => new Set((result?.issues ?? []).map(item => item.id)))
  const [darkHits, setDarkHits] = React.useState(null)

  React.useEffect(() => {
    setSelected(new Set((result?.issues ?? []).map(item => item.id)))
  }, [result?.id])

  const issues = (result?.issues ?? []).filter(item => filter === 'all' || item.severity === filter)
  const toggle = id => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!result?.id) {
    return React.createElement('article', null,
      React.createElement('h1', null, '校审中心'),
      React.createElement('p', null, '请先在「文档处理」上传并检查，或从工作台打开最近文档。'))
  }

  return React.createElement('article', null,
    React.createElement('h1', null, '校审中心'),
    React.createElement('p', null, `${result.type || ''} · ${result.issues?.length || 0} 个问题`),
    React.createElement('div', { className: 'tod-actions' },
      ['all', 'P0', 'P1', 'P2'].map(level => React.createElement(Button, {
        key: level, type: 'button', variant: filter === level ? 'primary' : 'outline', onClick: () => setFilter(level)
      }, level === 'all' ? '全部' : level)),
      React.createElement(Button, { type: 'button', variant: 'outline', onClick: () => setSelected(new Set(issues.map(item => item.id))) }, '全选'),
      React.createElement(Button, {
        type: 'button', variant: 'primary',
        onClick: () => run(() => request('POST', '/api/plugin/taichi_official_doc/fix', {
          id: result.id, issues: [...selected]
        }).then(file => { download(file); return file }))
      }, '应用选中并下载'),
      React.createElement(Button, {
        type: 'button', variant: 'outline',
        onClick: () => run(() => request('POST', '/api/plugin/taichi_official_doc/fix', {
          id: result.id, issues: (result.issues ?? []).map(item => item.id)
        }).then(file => { download(file); return file }))
      }, '全部应用'),
      React.createElement(Button, { type: 'button', variant: 'outline', onClick: () => setShowPreview(true) }, 'A4 预览'),
      React.createElement(Button, { type: 'button', variant: 'outline', onClick: () => window.print() }, '打印/导出 PDF'),
      React.createElement(Button, {
        type: 'button', variant: 'outline',
        onClick: () => run(() => request('POST', '/api/plugin/taichi_official_doc/dark-bid', { id: result.id })
          .then(payload => { setDarkHits(payload.hits); return payload }))
      }, '暗标扫描'),
      React.createElement(Button, {
        type: 'button', variant: 'outline',
        onClick: () => draft(connection, aiAnalyzePrompt(result))
      }, 'AI 深度分析')),
    issues.map(item => React.createElement('div', { key: `${item.id}-${item.original}`, className: 'tod-issue' },
      React.createElement('label', null,
        React.createElement('input', {
          type: 'checkbox', checked: selected.has(item.id), onChange: () => toggle(item.id)
        }),
        React.createElement('span', null, `${item.severity || ''} ${item.name}：${item.fix || item.suggestion || ''}`)),
      item.standard_ref ? React.createElement('p', null, `GB/T 9704 ${item.standard_ref}`) : null,
      item.original ? React.createElement('p', null, `原文：${item.original}`) : null)),
    darkHits ? React.createElement('div', { className: 'tod-card' },
      React.createElement('h2', null, `暗标命中 ${darkHits.length}`),
      darkHits.map((hit, index) => React.createElement('p', { key: index }, `${hit.type}：${hit.excerpt} → ${hit.mask}`)),
      React.createElement(Button, {
        type: 'button', variant: 'primary',
        onClick: () => run(() => request('POST', '/api/plugin/taichi_official_doc/dark-bid/redact', { id: result.id })
          .then(file => { download(file); setPreviewModel(file.model); return file }))
      }, '脱敏并下载'),
      React.createElement(Button, { type: 'button', variant: 'outline', onClick: () => setDarkHits(null) }, '关闭')) : null)
}

function MarkdownView({ markdown, setMarkdown, markdownType, setMarkdownType, types, previewModel, setPreviewModel, run, connection, Button }) {
  /* React from factory */
  const [zoom, setZoom] = React.useState(0.8)
  const [help, setHelp] = React.useState(false)

  return React.createElement('article', null,
    React.createElement('h1', null, 'Markdown 优化'),
    React.createElement('p', null, '左侧编辑，右侧 A4 预览。润色/去 AI 味写入太极当前会话，请自行粘贴回编辑器。'),
    React.createElement('div', { className: 'tod-split' },
      React.createElement('div', null,
        React.createElement('label', null, '文种',
          React.createElement('select', { 'aria-label': 'Markdown 文种', value: markdownType, onChange: event => setMarkdownType(event.target.value) },
            (types.length ? types : [{ id: 'notice', name: '通知' }]).map(item =>
              React.createElement('option', { key: item.id, value: item.id }, item.name)))),
        React.createElement('textarea', {
          'aria-label': 'Markdown 公文', value: markdown,
          onChange: event => setMarkdown(event.target.value)
        }),
        React.createElement('div', { className: 'tod-actions' },
          React.createElement(Button, {
            type: 'button', variant: 'primary',
            onClick: () => run(() => request('POST', '/api/plugin/taichi_official_doc/markdown/preview', {
              markdown, type: markdownType
            }).then(payload => { setPreviewModel(payload.model); return payload }))
          }, '生成预览'),
          React.createElement(Button, {
            type: 'button', variant: 'outline',
            onClick: () => run(() => request('POST', '/api/plugin/taichi_official_doc/markdown/download', {
              markdown, type: markdownType
            }).then(download))
          }, '下载 docx'),
          React.createElement(Button, {
            type: 'button', variant: 'outline',
            onClick: () => draft(connection, polishPrompt(markdown))
          }, 'AI 润色'),
          React.createElement(Button, {
            type: 'button', variant: 'outline',
            onClick: () => draft(connection, deaiPrompt(markdown))
          }, '去 AI 味'),
          React.createElement(Button, { type: 'button', variant: 'outline', onClick: () => setHelp(value => !value) }, '语法说明')),
        help ? React.createElement('p', null, '支持 # 标题、## 层次、**加粗**、列表、- 项、以及 | 表格 |。') : null),
      React.createElement(A4Preview, { model: previewModel, zoom, setZoom, Button })))
}

function Templates({ templates, run, connection, Button, setPreviewModel, setShowPreview }) {
  /* React from factory */
  const [category, setCategory] = React.useState('全部')
  const [editing, setEditing] = React.useState(null)
  const categories = ['全部', '政府机关', '其他常用', '自定义']
  const list = templates.filter(item => category === '全部' || (item.category || (item.builtin ? '政府机关' : '自定义')) === category)

  return React.createElement('article', null,
    React.createElement('h1', null, '模板中心'),
    React.createElement('div', { className: 'tod-actions' },
      categories.map(item => React.createElement(Button, {
        key: item, type: 'button', variant: category === item ? 'primary' : 'outline', onClick: () => setCategory(item)
      }, item))),
    React.createElement('div', { className: 'tod-grid' }, list.map(item =>
      React.createElement('div', { key: item.id, className: 'tod-card' },
        React.createElement('h2', null, item.name),
        React.createElement('p', null, item.description || ''),
        React.createElement('div', { className: 'tod-actions' },
          React.createElement(Button, {
            type: 'button', variant: 'primary',
            onClick: () => run(() => request('POST', '/api/plugin/taichi_official_doc/templates/apply', { id: item.id })
              .then(file => { download(file); setPreviewModel(file.model); return file }))
          }, '选用生成'),
          React.createElement(Button, {
            type: 'button', variant: 'outline',
            onClick: () => run(() => request('POST', '/api/plugin/taichi_official_doc/templates/apply', { id: item.id })
              .then(file => { setPreviewModel(file.model); setShowPreview(true); return file }))
          }, '预览'),
          React.createElement(Button, {
            type: 'button', variant: 'outline',
            onClick: () => draft(connection, `请按「${item.name}」文种起草一份完整公文 Markdown，包含标题、主送、正文、署名与成文日期。`)
          }, '会话起草'),
          React.createElement(Button, { type: 'button', variant: 'outline', onClick: () => setEditing(item) }, '编辑规则'),
          !item.builtin ? React.createElement(Button, {
            type: 'button', variant: 'outline',
            onClick: () => run(() => request('POST', '/api/plugin/taichi_official_doc/templates/delete', { id: item.id }))
          }, '删除') : null)))),
    React.createElement('h2', null, '新建模板'),
    React.createElement('form', {
      onSubmit: event => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        run(() => request('POST', '/api/plugin/taichi_official_doc/templates/create', {
          name: data.get('name'),
          id: data.get('id'),
          description: data.get('description'),
          category: '自定义',
          rules: data.get('rules')
        })).then(() => event.target.reset())
      }
    },
      React.createElement('input', { name: 'name', 'aria-label': '模板名称', required: true, placeholder: '名称' }),
      React.createElement('input', { name: 'id', 'aria-label': '模板标识', placeholder: '英文标识，可空' }),
      React.createElement('input', { name: 'description', 'aria-label': '模板说明', placeholder: '说明' }),
      React.createElement('textarea', { name: 'rules', 'aria-label': '模板规则', placeholder: 'YAML 规则' }),
      React.createElement(Button, { type: 'submit', variant: 'primary' }, '保存模板')),
    React.createElement('h2', null, '从文档提取格式'),
    React.createElement('input', {
      type: 'file', accept: '.docx', 'aria-label': '提取格式的文档',
      onChange: event => {
        const file = event.target.files?.[0]
        if (!file) return
        file.arrayBuffer().then(buffer => run(() => request('POST', '/api/plugin/taichi_official_doc/templates/extract', {
          filename: file.name,
          name: file.name.replace(/\.docx$/i, ''),
          bytes: Array.from(new Uint8Array(buffer))
        }).then(extracted => request('POST', '/api/plugin/taichi_official_doc/templates/create', extracted))))
      }
    }),
    editing ? React.createElement('form', {
      onSubmit: event => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        run(() => request('POST', '/api/plugin/taichi_official_doc/templates/rules', {
          id: editing.id,
          rules: data.get('rules')
        })).then(() => setEditing(null))
      }
    },
      React.createElement('h2', null, `编辑规则 · ${editing.name}`),
      React.createElement('textarea', {
        name: 'rules', 'aria-label': '规则 YAML', defaultValue: `name: ${editing.name}\nstructure:\n  - title\n  - body\n  - signature\n  - date\n`
      }),
      React.createElement('div', { className: 'tod-actions' },
        React.createElement(Button, { type: 'submit', variant: 'primary' }, '保存规则'),
        React.createElement(Button, { type: 'button', variant: 'outline', onClick: () => setEditing(null) }, '取消'))) : null)
}

function About({ meta }) {
  /* React from factory */
  return React.createElement('article', null,
    React.createElement('h1', null, '关于'),
    React.createElement('p', null, `taichi-dsh-official-doc ${meta?.version || ''}。格式检查、修复、暗标、Markdown 与模板在插件内完成。`),
    React.createElement('p', null, '文字润色、去 AI 味、深度分析与模板起草使用太极当前会话，不在插件内配置模型供应商。'),
    React.createElement('p', null, 'PDF 通过浏览器打印另存；不支持 Office 插件桥与 .doc/.wps 内嵌转换（请先另存为 .docx）。'),
    React.createElement('p', null, `内置规则文种 ${meta?.rules ?? '-'} 个。`))
}

function PreviewModal({ model, onClose, Button }) {
  /* React from factory */
  const [zoom, setZoom] = React.useState(0.75)
  return React.createElement('div', { className: 'tod-modal', role: 'dialog', 'aria-label': 'A4 预览', onClick: onClose },
    React.createElement('div', { className: 'tod-modal-panel', onClick: event => event.stopPropagation() },
      React.createElement('div', { className: 'tod-actions' },
        React.createElement(Button, { type: 'button', variant: 'outline', onClick: () => window.print() }, '打印/导出 PDF'),
        React.createElement(Button, { type: 'button', variant: 'primary', onClick: onClose }, '关闭')),
      React.createElement(A4Preview, { model, zoom, setZoom, Button, print: true })))
}

function A4Preview({ model, zoom, setZoom, Button, print }) {
  /* React from factory */
  const paragraphs = model?.paragraphs ?? []
  const tables = model?.tables ?? []
  return React.createElement('div', { 'data-tod-a4-wrap': '', ...(print ? { 'data-tod-a4-print': '' } : {}) },
    React.createElement('div', { 'data-tod-a4-toolbar': '' },
      React.createElement(Button, { type: 'button', variant: 'outline', onClick: () => setZoom(value => Math.max(0.5, Number((value - 0.1).toFixed(1)))) }, '缩小'),
      React.createElement('span', null, `${Math.round((zoom || 1) * 100)}%`),
      React.createElement(Button, { type: 'button', variant: 'outline', onClick: () => setZoom(value => Math.min(1.5, Number((value + 0.1).toFixed(1)))) }, '放大')),
    React.createElement('div', { 'data-tod-a4-stage': '' },
      React.createElement('div', {
        'data-tod-a4-page': '',
        style: { transform: `scale(${zoom || 1})`, marginBottom: `${((zoom || 1) - 1) * 297}mm` }
      },
        paragraphs.length === 0 ? React.createElement('p', { className: 'tod-body' }, '暂无预览，请先生成或检查文档。') : null,
        paragraphs.map((paragraph, index) => {
          if (paragraph.tableIndex != null && tables[paragraph.tableIndex]) {
            const table = tables[paragraph.tableIndex]
            return React.createElement('table', { key: `t-${index}` },
              React.createElement('thead', null, React.createElement('tr', null,
                (table.headers || []).map((cell, cellIndex) => React.createElement('th', { key: cellIndex }, cell)))),
              React.createElement('tbody', null, (table.rows || []).map((row, rowIndex) =>
                React.createElement('tr', { key: rowIndex }, row.map((cell, cellIndex) =>
                  React.createElement('td', { key: cellIndex }, cell))))))
          }
          return React.createElement('p', { key: index, className: roleClass(paragraph.role) }, paragraph.text)
        }))))
}

function roleClass(role) {
  if (role === 'title') return 'tod-title'
  if (role === 'recipient') return 'tod-recipient'
  if (role === 'heading') return 'tod-heading'
  if (role === 'signature') return 'tod-signature'
  if (role === 'date') return 'tod-date'
  return 'tod-body'
}

function polishPrompt(markdown) {
  return `请将以下 Markdown 润色为规范公文语体，保留 Markdown 结构（标题、列表、表格），不要改写成纯叙述：\n\n${markdown || '（请粘贴待润色文稿）'}`
}

function deaiPrompt(markdown) {
  return `请按公文写作习惯去除 AI 痕迹：少用排比与空泛套话、避免“首先其次最后”机械结构、删掉无信息量形容词、保持短句与具体事项。只输出改写后的 Markdown：\n\n${markdown || '（请粘贴文稿）'}`
}

function aiAnalyzePrompt(result) {
  const lines = (result?.issues ?? []).slice(0, 30).map((item, index) =>
    `${index + 1}. [${item.severity}] ${item.name}：${item.original || ''} → ${item.fix || item.suggestion || ''}`)
  return `请对以下公文校审问题做语义级深度分析，文种为「${result?.type || ''}」。按条目给出是否误报、补充建议与改写示例：\n\n${lines.join('\n') || '（暂无规则问题，请通读后给出写作建议）'}`
}

function draft(connection, text) {
  connection?.conversation?.draft?.(text)
}

async function request(method, path, body) {
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

function download(file) {
  const bytes = normalizeBytes(file.bytes)
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = file.filename || '公文.docx'
  link.click()
  URL.revokeObjectURL(link.href)
  return file
}

function normalizeBytes(value) {
  if (value instanceof Uint8Array) return value
  if (Array.isArray(value)) return new Uint8Array(value)
  if (value?.type === 'Buffer' && Array.isArray(value.data)) return new Uint8Array(value.data)
  if (value && typeof value === 'object') return new Uint8Array(Object.values(value))
  return new Uint8Array()
}

function failed(error) {
  return { kind: 'error', text: error instanceof Error ? error.message : '处理失败' }
}

    return { apply, inject }
  }
})
