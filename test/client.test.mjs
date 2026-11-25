import assert from 'node:assert/strict'
import test from 'node:test'
import { apply, HOST_SELECTOR, seatSidebarForTest } from '../src/client/plugin.js'
import { draftToSession, takeSessionMarkdown } from '../src/client/session.js'

test('提示词写入当前会话，已有不同草稿时不覆盖', () => {
  const drafts = []
  const input = {
    state: { getSnapshot: () => ({ draft: drafts.at(-1) ?? '' }) },
    setDraft: value => drafts.push(value),
    focus() {}
  }
  const ctx = { get: () => ({ input }) }
  assert.deepEqual(draftToSession(ctx, '润色这段'), { written: true })
  assert.equal(drafts[0], '润色这段')
  assert.deepEqual(draftToSession(ctx, '润色这段'), { written: false })
  assert.throws(() => draftToSession(ctx, '另一段'), /已有草稿/)
  assert.throws(() => draftToSession({ get: () => ({}) }, '润色'), /没有可用/)
})

test('从会话回复取回 Markdown', () => {
  const ctx = {
    get: () => ({
      input: {
        messages: () => [
          { role: 'user', content: '请润色' },
          { role: 'assistant', content: '```markdown\n# 通知\n正文\n```' }
        ]
      }
    })
  }
  assert.equal(takeSessionMarkdown(ctx), '# 通知\n正文')
  assert.throws(() => takeSessionMarkdown({ get: () => ({ input: { messages: () => [] } }) }), /没有可取回/)
})

function stubDomAndReact() {
  const nodes = []
  const element = (tag = 'div') => {
    const node = {
      tag, id: '', dataset: {}, textContent: '', attributes: {}, children: [],
      nodeType: 1, parentElement: null, isConnected: true,
      setAttribute(name, value) { this.attributes[name] = String(value) },
      getAttribute(name) { return this.attributes[name] },
      hasAttribute(name) { return name in this.attributes },
      toggleAttribute(name, force) {
        const next = force ?? !this.hasAttribute(name)
        if (next) this.setAttribute(name, '')
        else this.removeAttribute(name)
        return next
      },
      removeAttribute(name) { delete this.attributes[name] },
      append(...items) {
        for (const item of items) this.insertBefore(item, null)
      },
      insertBefore(item, before) {
        item.parentElement = this
        const index = before ? this.children.indexOf(before) : -1
        if (index < 0) this.children.push(item)
        else this.children.splice(index, 0, item)
        return item
      },
      remove() {
        this.parentElement?.children.splice(this.parentElement.children.indexOf(this), 1)
        this.parentElement = null
      },
      querySelectorAll(selector) {
        return [this, ...walk(this)].filter(node => node.matches(selector))
      },
      querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null },
      matches(selector) {
        if (selector === 'button') return this.tag === 'button'
        const attribute = selector.match(/^\[([^\]=]+)/)?.[1]
        return attribute ? attribute in this.attributes : false
      },
      contains(other) { return this === other || this.children.some(child => child.contains(other)) },
      addEventListener() {},
      closest() { return null }
    }
    nodes.push(node)
    return node
  }
  const html = element('html')
  const body = element('body')
  const head = { appendChild() {}, children: [] }
  globalThis.document = {
    head, body, documentElement: html,
    addEventListener() {},
    removeEventListener() {},
    createElement: tag => element(tag),
    createElementNS: () => element('svg'),
    querySelectorAll: selector => walk(body).concat(walk(html)).filter(node => node.matches(selector)),
    querySelector: selector => document.querySelectorAll(selector)[0] ?? null,
    dispatchEvent() { return true }
  }
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() {}
  }
  globalThis.require = name => {
    if (name === 'react') return {
      createElement: (type, props, ...children) => ({
        type, props, children: typeof type === 'function' ? [type(props)] : children
      }),
      useState: value => [value, () => {}],
      useEffect: () => {},
      useLayoutEffect: () => {},
      useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot()
    }
    if (name === 'react-dom') return { createPortal: (node) => node }
    if (name === '@deepseek-ai/dsh-client-ui-primitives') {
      return { Button: (props) => ({ type: 'button', props }) }
    }
    throw new Error(name)
  }
}

function applyAndCapture() {
  const registered = []
  const ctx = {
    locale: { register: () => () => {}, bind: () => key => key === 'name' ? '公文' : key },
    slots: {
      inject: (_name, register) => register(),
      register: (descriptor, component) => {
        // Capture the controller from the activity inject closure.
        const inject = descriptor.inject?.()
        registered.push({ descriptor, component, inject })
        return () => {}
      }
    },
    get: () => null,
    effect: callback => callback()
  }
  apply(ctx)
  return registered
}

test('活动栏注册真实 button[data-dsh-activity]，与生图/市场同槽', () => {
  stubDomAndReact()
  const registered = applyAndCapture()
  assert.equal(registered.length, 2)
  assert.equal(registered[0].descriptor.name, 'shell.activity.main')
  assert.equal(registered[0].descriptor.id, 'taichi-official-doc')
  assert.equal(registered.find(item => item.descriptor.name === 'main').descriptor.name, 'main')
  const button = registered[0].component({
    controller: {
      subscribe: listener => { listener(); return () => {} },
      getSnapshot: () => ({ open: false }),
      layout: () => null,
      open() {}
    },
    t: key => key === 'name' ? '公文' : key
  })
  assert.equal(button.type, 'button')
  assert.equal(button.props['data-dsh-activity'], '')
  assert.equal(button.props['aria-label'], '公文')
  assert.equal(typeof button.props.onClick, 'function')
})

test('getSnapshot 在未变更时返回同一引用，避免 React #185 踢掉活动栏座位', () => {
  stubDomAndReact()
  const registered = applyAndCapture()
  const controller = registered[0].inject.controller
  const first = controller.getSnapshot()
  const second = controller.getSnapshot()
  assert.equal(first, second)
  controller.open()
  const third = controller.getSnapshot()
  assert.notEqual(first, third)
  assert.equal(third.open, true)
  assert.equal(controller.getSnapshot(), third)
})

test('公文栏目覆盖宿主侧栏，不占用 sidebar.workspaces', () => {
  stubDomAndReact()
  const registered = applyAndCapture()
  assert.equal(registered.some(item => item.descriptor.name === 'sidebar.workspaces'), false)
  const html = document.documentElement
  const region = document.createElement('div')
  const column = document.createElement('div')
  const anchor = document.createElement('div')
  anchor.setAttribute('data-slot', 'sidebar.workspaces')
  anchor.setAttribute('style', 'display: contents')
  region.append(anchor)
  const scroll = document.createElement('div')
  scroll.setAttribute('data-sidebar-scrollport', '')
  scroll.append(region)
  column.append(scroll)
  const shell = document.createElement('div')
  const footer = document.createElement('div')
  footer.setAttribute('data-slot', 'sidebar.settings')
  footer.setAttribute('style', 'display: contents')
  shell.append(column)
  column.append(footer)
  document.body.append(shell)
  const controller = {
    open: false,
    listeners: new Set(),
    subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener) },
    getSnapshot() { return { open: this.open } },
    setOpen(open) { this.open = open; for (const listener of this.listeners) listener() }
  }
  const release = seatSidebarForTest(controller)
  assert.equal(document.querySelector(HOST_SELECTOR)?.parentElement, region)
  controller.setOpen(true)
  const host = document.querySelector(HOST_SELECTOR)
  assert.equal(host?.parentElement, region)
  assert.equal(html.hasAttribute('data-tod-active'), true)
  controller.setOpen(false)
  assert.equal(document.querySelector(HOST_SELECTOR)?.parentElement, region)
  assert.equal(html.hasAttribute('data-tod-active'), false)
  release()
})

function walk(node) {
  return (node.children ?? []).flatMap(child => [child, ...walk(child)])
}

function shownNav(node) {
  let current = Array.isArray(node) ? node[0] : node
  while (typeof current?.type === 'function') current = current.type(current.props)
  return Array.isArray(current) ? current[0] : current
}
