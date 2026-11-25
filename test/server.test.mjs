import assert from 'node:assert/strict'
import test from 'node:test'
import { apply } from '../dsh/index.js'

test('服务端路由走 connection.fetch 且路径不重复', () => {
  const routes = []
  apply({
    connection: { fetch: { register(route) { routes.push(route) } } }
  }, { root: 'data' })
  assert.equal(new Set(routes.map(route => route.path)).size, routes.length)
  assert.deepEqual(routes.map(route => [route.methods[0], route.path]), [
    ['POST', '/api/plugin/taichi_official_doc/check'],
    ['GET', '/api/plugin/taichi_official_doc/job'],
    ['POST', '/api/plugin/taichi_official_doc/fix'],
    ['POST', '/api/plugin/taichi_official_doc/dark-bid'],
    ['POST', '/api/plugin/taichi_official_doc/dark-bid/redact'],
    ['POST', '/api/plugin/taichi_official_doc/markdown'],
    ['POST', '/api/plugin/taichi_official_doc/markdown/preview'],
    ['POST', '/api/plugin/taichi_official_doc/markdown/download'],
    ['GET', '/api/plugin/taichi_official_doc/templates'],
    ['POST', '/api/plugin/taichi_official_doc/templates/save'],
    ['POST', '/api/plugin/taichi_official_doc/templates/create'],
    ['POST', '/api/plugin/taichi_official_doc/templates/extract'],
    ['POST', '/api/plugin/taichi_official_doc/templates/apply'],
    ['POST', '/api/plugin/taichi_official_doc/templates/rules'],
    ['POST', '/api/plugin/taichi_official_doc/templates/delete'],
    ['GET', '/api/plugin/taichi_official_doc/history'],
    ['GET', '/api/plugin/taichi_official_doc/stats'],
    ['GET', '/api/plugin/taichi_official_doc/types'],
    ['GET', '/api/plugin/taichi_official_doc/meta'],
    ['GET', '/api/plugin/taichi_official_doc/preview']
  ])
})
