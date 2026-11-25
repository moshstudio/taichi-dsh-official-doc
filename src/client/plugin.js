import { CSS, NS, STYLE_ID, copy, sections } from './copy.js'
import { failed, request } from './api.js'
import { PreviewModal } from './preview.js'
import { About, Templates } from './pages.js'
import { MarkdownView, ProcessView, Review, Workspace } from './views.js'

export const inject = ['slots', 'locale', 'connection']

export function apply(ctx) {
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

  ctx.effect(() => seatSidebar(controller), 'taichi-official-doc: sidebar')

  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: 'taichi-official-doc',
    locale: NS,
    inject: () => ({ controller, t, connection: ctx })
  }, Page))
}

export function ensureStyles() {
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
  const React = require('react')
  const selected = React.useSyncExternalStore(
    controller.subscribe,
    () => controller.getSnapshot().open
  )
  const openPage = () => {
    document.dispatchEvent(new Event('dsh-activity-home'))
    document.dispatchEvent(new CustomEvent('dsh-activity-sidebar', { detail: { mode: 'expanded' } }))
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
      activityGlyph(React, selected)))
}

function Page({ controller, t, connection }) {
  const React = require('react')
  const { createPortal } = require('react-dom')
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
  const [sidebarHost, setSidebarHost] = React.useState(null)

  React.useLayoutEffect(ensureStyles, [])
  React.useEffect(() => {
    const syncHost = () => setSidebarHost(document.querySelector(HOST_SELECTOR))
    syncHost()
    const observer = new MutationObserver(syncHost)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
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

  return React.createElement(React.Fragment, null,
    sidebarHost ? createPortal(React.createElement(SectionNav, { section, t, controller, wide: true }), sidebarHost) : null,
    React.createElement('section', { 'data-taichi-official-doc': '', role: 'region', 'aria-label': t('name') },
    React.createElement('div', { 'data-status': status.kind, role: 'status', 'aria-live': 'polite' }, status.text),
    view(section, props),
      showPreview ? React.createElement(PreviewModal, {
        model: previewModel,
        onClose: () => setShowPreview(false),
        Button
      }) : null))
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
  const React = require('react')
  if (section === 'workspace') return React.createElement(Workspace, props)
  if (section === 'process') return React.createElement(ProcessView, props)
  if (section === 'review') return React.createElement(Review, props)
  if (section === 'markdown') return React.createElement(MarkdownView, props)
  if (section === 'templates') return React.createElement(Templates, props)
  return React.createElement(About, props)
}

const WORKSPACES_ANCHOR = '[data-slot="sidebar.workspaces"]'
const CHROME_ANCHORS = [
  '[data-slot="sidebar.brand.mark"]',
  '[data-slot="sidebar.brand.name"]',
  '[data-slot="sidebar.footer.action"]',
  '[data-slot="sidebar.settings"]'
]
const ROOT_ATTR = 'data-tod-sidebar-root'
const REGION_ATTR = 'data-tod-sidebar-region'
const HIDE_ATTR = 'data-tod-sidebar-hide'
const HOST_SELECTOR = '[data-tod-sidebar-host]'

function seatSidebar(controller) {
  let root
  let host
  let region
  let hidden = []
  let scheduled = 0
  const paint = () => {
    const open = controller.getSnapshot().open
    document.documentElement.toggleAttribute('data-tod-active', open)
    const nextRoot = sidebarRoot()
    const nextRegion = nextRoot ? regionSeat(nextRoot) : undefined
    if (!nextRoot || !nextRegion) return
    if (root !== nextRoot) {
      clearOverlay()
      root = nextRoot
      root.setAttribute(ROOT_ATTR, '')
    }
    if (region !== nextRegion) {
      region?.removeAttribute(REGION_ATTR)
      region = nextRegion
      region.setAttribute(REGION_ATTR, '')
    }
    host = placeHost(region, host)
    hidden = open ? hideSessionSurface(root, hidden) : releaseHidden(hidden)
  }
  const schedule = () => {
    if (scheduled !== 0) return
    scheduled = window.setTimeout(() => {
      scheduled = 0
      paint()
    }, 0)
  }
  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true })
  const stop = controller.subscribe(paint)
  paint()
  return () => {
    stop()
    observer.disconnect()
    if (scheduled !== 0) window.clearTimeout(scheduled)
    clearOverlay()
    document.documentElement.removeAttribute('data-tod-active')
  }

  function clearOverlay() {
    host?.remove()
    host = undefined
    region?.removeAttribute(REGION_ATTR)
    region = undefined
    root?.removeAttribute(ROOT_ATTR)
    root = undefined
    for (const block of hidden) block.removeAttribute(HIDE_ATTR)
    hidden = []
  }

  function releaseHidden(previous) {
    for (const block of previous) block.removeAttribute(HIDE_ATTR)
    return []
  }
}

function placeHost(region, current) {
  if (current?.isConnected && current.parentElement === region) return current
  current?.remove()
  const host = document.createElement('div')
  host.setAttribute('data-tod-sidebar-host', '')
  region.append(host)
  return host
}

function sidebarRoot() {
  const region = seatOf(WORKSPACES_ANCHOR)
  if (!region) return undefined
  const action = newSessionButton()
  for (let candidate = region.parentElement; candidate && candidate !== document.body; candidate = candidate.parentElement) {
    if (candidate.hasAttribute('data-sidebar-scrollport')) continue
    const chrome = candidate.querySelector('[data-slot="sidebar.brand.mark"], [data-slot="sidebar.brand.name"], [data-slot="sidebar.footer.action"], [data-slot="sidebar.settings"]')
    const ownsChrome = chrome && blockHolding(candidate, chrome) !== candidate
    if ((action && candidate.contains(action)) || ownsChrome) return candidate
  }
  return region.parentElement ?? undefined
}

function regionSeat(root) {
  const anchored = seatOf(WORKSPACES_ANCHOR)
  return anchored && root.contains(anchored) && anchored !== root ? anchored : undefined
}

function seatOf(selector) {
  for (const anchor of document.querySelectorAll(selector)) {
    if (!anchor || anchor.nodeType !== 1 || !isVisible(anchor)) continue
    const seat = boxAncestor(anchor)
    if (seat && isVisible(seat)) return seat
  }
  return undefined
}

function boxAncestor(anchor) {
  let node = anchor.parentElement
  while (node) {
    if (!isContents(node)) return node
    node = node.parentElement
  }
  return undefined
}

function isContents(node) {
  const inline = node.getAttribute?.('style') ?? ''
  if (/display:\s*contents/.test(inline)) return true
  return typeof getComputedStyle === 'function' && getComputedStyle(node).display === 'contents'
}

function isVisible(node) {
  if (!node.isConnected) return false
  if (typeof getComputedStyle !== 'function') return true
  for (let cursor = node; cursor && cursor !== document.body; cursor = cursor.parentElement) {
    let display = ''
    try { display = getComputedStyle(cursor).display } catch { display = '' }
    if (display === 'none') return false
  }
  return true
}

function newSessionButton(root = document) {
  return Array.from(root.querySelectorAll('button')).find(button =>
    /new session|new chat|新建会话|新会话/.test(`${button.getAttribute('aria-label') ?? ''} ${button.textContent ?? ''}`.toLowerCase())
    && button.closest(WORKSPACES_ANCHOR) === null
    && isVisible(button))
}

function hideSessionSurface(root, previous) {
  const next = ['[data-slot="sidebar.panellist"]', '[data-slot="sidebar.quickSwitcher"]', '[data-slot="sidebar.primaryNavigation"]']
    .flatMap(selector => Array.from(root.querySelectorAll(selector)))
    .map(node => blockHolding(root, node))
    .filter((node, index, nodes) => node && nodes.indexOf(node) === index && !node.querySelector('[data-slot="sidebar.brand.mark"], [data-slot="sidebar.footer.action"], [data-slot="sidebar.settings"], [data-tod-sidebar-host]'))
  for (const block of previous) {
    if (!next.includes(block)) block.removeAttribute(HIDE_ATTR)
  }
  for (const block of next) block.setAttribute(HIDE_ATTR, '')
  return next
}

export const seatSidebarForTest = seatSidebar
export { HOST_SELECTOR }

function blockHolding(root, node) {
  return Array.from(root.children).find(child => child.nodeType === 1 && child.contains(node))
}

function SectionNav({ section, t, controller, wide }) {
  const React = require('react')
  return React.createElement('nav', { 'data-tod-nav': '', 'data-wide': wide === false ? 'false' : 'true', 'aria-label': t('name') },
    sections.map(id => React.createElement('button', {
      key: id,
      type: 'button',
      'aria-current': section === id ? 'page' : undefined,
      onClick: () => controller.choose(id)
    },
      React.createElement('svg', {
        viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none', stroke: 'currentColor',
        strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true
      }, React.createElement('path', { d: sectionIcon(id) })),
      React.createElement('span', { hidden: wide === false }, t(id)))))
}

function activityGlyph(React, selected) {
  const page = 'M5 2h14v20H5z'
  const head = 'M8 6.2h8v1.7H8z'
  const lines = 'M8 11h8v1.3H8zM8 14.2h8v1.3H8zM8 17.4h5v1.3H8z'
  return React.createElement('svg', {
    viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', 'aria-hidden': true
  }, selected
    ? React.createElement('path', {
      fill: 'currentColor', fillRule: 'evenodd',
      d: `${page}${head}${lines}`
    })
    : [
      React.createElement('path', {
        key: 'page', d: page, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6
      }),
      React.createElement('path', {
        key: 'head', d: 'M8 7h8', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8
      }),
      React.createElement('path', {
        key: 'lines', d: 'M8 11.6h8M8 14.8h8M8 18h5', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4
      })
    ])
}

function sectionIcon(id) {
  return {
    workspace: 'M4 10.5 12 4l8 6.5V20H4zM9 20v-6h6v6',
    process: 'M7 3h7l5 5v13H7zM14 3v5h5M9 13h6M9 17h6',
    markdown: 'M4 6h16M4 12h10M4 18h16',
    review: 'M8 4h8v3a4 4 0 0 1-8 0zM6 20l2.2-6h7.6L18 20M9 20h6',
    templates: 'M7 4h8l4 4v12H7zM15 4v4h4M9 12h6M9 16h4',
    about: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01'
  }[id]
}