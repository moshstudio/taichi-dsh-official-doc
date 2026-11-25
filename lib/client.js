const NS = 'taichi-dsh-official-doc'
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

export const inject = ['slots', 'locale', 'connection']

export function apply(ctx) {
  const state = { open: false, section: 'workspace', listeners: new Set() }
  const publish = () => { for (const listener of state.listeners) listener(snapshot()) }
  const snapshot = () => ({ open: state.open, section: state.section })
  const controller = {
    open: () => { state.open = true; publish() },
    close: () => { state.open = false; publish() },
    toggle: () => { state.open = !state.open; publish() },
    choose: section => { state.section = section; state.open = true; publish() },
    subscribe: listener => { state.listeners.add(listener); return () => state.listeners.delete(listener) },
    getSnapshot: snapshot
  }
  ctx.effect(() => ctx.locale.register(NS, copy))
  ctx.effect(() => {
    const home = () => controller.close()
    document.addEventListener('dsh-activity-home', home)
    return () => document.removeEventListener('dsh-activity-home', home)
  })
  ctx.effect(() => ctx.slots.inject('shell.activity.main', () => ctx.slots.register({
    name: 'shell.activity.main',
    id: 'taichi-official-doc',
    order: 20,
    locale: NS,
    inject: () => ({ controller, t: ctx.locale.bind(NS) })
  }, ActivityButton)))
  ctx.effect(() => mountPage(controller, ctx.locale.bind(NS), () => ctx.get('connection')))
}

function ActivityButton({ controller, t }) {
  const React = require('react')
  const selected = React.useSyncExternalStore(controller.subscribe, controller.getSnapshot).open
  return React.createElement('span', {
    'data-dsh-activity-item': '',
    'data-label': t('name'),
    'data-selected': selected ? 'true' : 'false',
    onClick: controller.toggle
  }, React.createElement('svg', { viewBox: '0 0 24 24', width: '20', height: '20', 'aria-hidden': 'true' },
    React.createElement('path', { d: 'M6 3h9l3 3v15H6zM14 4v4h4M8 11h8M8 15h8', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' })))
}

function mountPage(controller, t, connectionOf) {
  const React = require('react')
  const root = document.createElement('div')
  root.id = 'taichi-official-doc-page'
  document.body.append(root)
  const renderer = require('react-dom/client').createRoot(root)
  renderer.render(React.createElement(Page, { controller, t, connection: connectionOf() }))
  return () => { renderer.unmount(); root.remove() }
}

function Page({ controller, t, connection }) {
  const React = require('react')
  const state = React.useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const [status, setStatus] = React.useState({ kind: 'ready', text: '' })
  const [result, setResult] = React.useState(null)
  const [history, setHistory] = React.useState([])
  const [templates, setTemplates] = React.useState([])
  const [markdown, setMarkdown] = React.useState('')
  if (!state.open) return null
  const load = () => {
    request(connection, 'GET', '/taichi-official-doc/history').then(setHistory).catch(error => setStatus(failed(error)))
    request(connection, 'GET', '/taichi-official-doc/templates').then(setTemplates).catch(error => setStatus(failed(error)))
  }
  React.useEffect(load, [])
  const run = action => {
    setStatus({ kind: 'loading', text: '正在处理' })
    action().then(value => { setResult(value); setStatus({ kind: 'ready', text: '' }); load() }).catch(error => setStatus(failed(error)))
  }
  return React.createElement('section', { 'data-taichi-official-doc': '', role: 'region', 'aria-label': t('name') },
    React.createElement('nav', { 'aria-label': t('name') }, sections.map(id => React.createElement('button', {
      key: id, type: 'button', 'aria-current': state.section === id ? 'page' : undefined, onClick: () => controller.choose(id)
    }, t(id)))),
    React.createElement('div', { 'data-status': status.kind, role: 'status' }, status.text),
    view(state.section, { result, history, templates, markdown, setMarkdown, run, connection, setStatus }))
}

function view(section, props) {
  const React = require('react')
  if (section === 'workspace') return React.createElement(Workspace, props)
  if (section === 'process') return React.createElement(FileAction, { ...props, title: '上传 docx 后检查并修复' })
  if (section === 'review') return React.createElement(Review, props)
  if (section === 'markdown') return React.createElement(MarkdownView, props)
  if (section === 'templates') return React.createElement(Templates, props)
  return React.createElement('article', null, React.createElement('h1', null, '关于'), React.createElement('p', null, 'taichi-dsh-official-doc 0.1.0。格式检查在插件内完成，润色和配图使用太极当前会话。第一版只接收 docx。'))
}

function Workspace({ history, run }) {
  const React = require('react')
  return React.createElement('article', null,
    React.createElement('h1', null, '工作台'),
    React.createElement('p', null, `最近处理 ${history.length} 份`),
    history.map(item => React.createElement('p', { key: item.id }, `${item.name} · ${item.issues} 个问题`)),
    history.length === 0 ? React.createElement('p', null, '还没有处理过的文档') : null)
}

function FileAction({ title, run, connection }) {
  const React = require('react')
  return React.createElement('article', null, React.createElement('h1', null, title), React.createElement('input', {
    type: 'file', accept: '.docx,.doc,.wps', 'aria-label': '选择文档', onChange: event => {
      const file = event.target.files?.[0]
      if (!file) return
      file.arrayBuffer().then(buffer => run(() => request(connection, 'POST', '/taichi-official-doc/check', { filename: file.name, bytes: new Uint8Array(buffer) })))
    }
  }))
}

function Review({ result, run, connection }) {
  const React = require('react')
  const issues = result?.issues ?? []
  return React.createElement('article', null,
    React.createElement('h1', null, '校审中心'),
    issues.length === 0 ? React.createElement('p', null, '没有待修复的问题') : null,
    issues.map(item => React.createElement('label', { key: item.id }, React.createElement('input', { type: 'checkbox', defaultChecked: true, value: item.id }), `${item.name}：${item.fix}`)),
    React.createElement('button', { type: 'button', disabled: !result?.id, onClick: event => {
      const selected = [...event.currentTarget.parentElement.querySelectorAll('input:checked')].map(input => input.value)
      run(() => request(connection, 'POST', '/taichi-official-doc/fix', { id: result.id, issues: selected }).then(download))
    } }, '修复并下载'))
}

function MarkdownView({ markdown, setMarkdown, run, connection }) {
  const React = require('react')
  return React.createElement('article', null,
    React.createElement('h1', null, 'Markdown优化'),
    React.createElement('textarea', { 'aria-label': 'Markdown 公文', value: markdown, onChange: event => setMarkdown(event.target.value) }),
    React.createElement('button', { type: 'button', onClick: () => run(() => request(connection, 'POST', '/taichi-official-doc/markdown', { markdown })) }, '生成预览'),
    React.createElement('button', { type: 'button', onClick: () => draft(connection, markdown) }, '发给当前会话润色'))
}

function Templates({ templates, run, connection }) {
  const React = require('react')
  return React.createElement('article', null,
    React.createElement('h1', null, '模板中心'),
    templates.map(item => React.createElement('p', { key: item.id }, `${item.name}：${item.description}`)),
    React.createElement('button', { type: 'button', onClick: () => draft(connection, '请为当前公文模板生成一张配图') }, '用当前会话配图'),
    React.createElement('form', { onSubmit: event => {
      event.preventDefault()
      const data = new FormData(event.currentTarget)
      run(() => request(connection, 'POST', '/taichi-official-doc/templates', { name: data.get('name'), description: data.get('description'), rules: data.get('rules') }))
    } },
      React.createElement('input', { name: 'name', 'aria-label': '模板名称', required: true }),
      React.createElement('input', { name: 'description', 'aria-label': '模板说明' }),
      React.createElement('textarea', { name: 'rules', 'aria-label': '模板规则' }),
      React.createElement('button', { type: 'submit' }, '保存模板')))
}

function draft(connection, text) {
  const input = document.querySelector('textarea')
  if (input && text) input.value = text
  connection?.conversation?.draft?.(text)
}

async function request(connection, method, path, body) {
  const response = await connection.request({ method, path, body })
  if (!response?.ok && response?.status >= 400) throw new Error(response.message || '请求失败')
  return response?.body ?? response
}

function download(file) {
  const blob = new Blob([file.bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = file.filename
  link.click()
  URL.revokeObjectURL(link.href)
  return file
}

function failed(error) {
  return { kind: 'error', text: error instanceof Error ? error.message : '处理失败' }
}