import assert from 'node:assert/strict'
import test from 'node:test'
import { apply } from '../lib/client.js'

test('活动栏只注册一个公文入口', () => {
  const registered = []
  const effects = []
  const ctx = {
    locale: { register: () => () => {}, bind: () => key => key },
    slots: {
      inject: (name, register) => { if (name === 'shell.activity.main') effects.push(register) },
      register: descriptor => registered.push(descriptor)
    },
    get: () => null,
    effect: callback => callback()
  }
  globalThis.document = {
    addEventListener() {},
    removeEventListener() {},
    createElement: () => ({ id: '', remove() {} }),
    body: { append() {} }
  }
  globalThis.require = name => {
    if (name === 'react') return { createElement: () => null, useSyncExternalStore: () => ({ open: false }) }
    if (name === 'react-dom/client') return { createRoot: () => ({ render() {}, unmount() {} }) }
    throw new Error(name)
  }
  apply(ctx)
  effects[0]()
  assert.equal(registered.length, 1)
  assert.equal(registered[0].id, 'taichi-official-doc')
  assert.equal(registered[0].name, 'shell.activity.main')
})