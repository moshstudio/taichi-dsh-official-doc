import assert from 'node:assert/strict'
import test from 'node:test'
import { apply } from '../lib/client-logic.js'

function stubDomAndReact() {
  const head = { appendChild() {}, children: [] }
  globalThis.document = {
    head,
    addEventListener() {},
    removeEventListener() {},
    createElement: () => ({ id: '', dataset: {}, textContent: '', remove() {} }),
    querySelector: () => null,
    body: { append() {} },
    dispatchEvent() { return true }
  }
  globalThis.require = name => {
    if (name === 'react') return {
      createElement: (type, props, ...children) => ({ type, props, children }),
      useState: value => [value, () => {}],
      useEffect: () => {},
      useLayoutEffect: () => {},
      useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot()
    }
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
  assert.equal(registered[1].descriptor.name, 'main')
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
