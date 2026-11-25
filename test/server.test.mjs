import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chargeAccount, loadAccount, refundAccount } from '../dsh/account.js'
import { apply, MAX_UPLOAD_BYTES } from '../dsh/index.js'

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
    ['GET', '/api/plugin/taichi_official_doc/account'],
    ['POST', '/api/plugin/taichi_official_doc/account/charge'],
    ['POST', '/api/plugin/taichi_official_doc/account/refund'],
    ['GET', '/api/plugin/taichi_official_doc/preview']
  ])
})

test('超过 8 MiB 的上传被拒绝', async () => {
  const routes = []
  apply({
    connection: { fetch: { register(route) { routes.push(route) } } }
  }, { root: 'data' })
  const check = routes.find(route => route.path.endsWith('/check'))
  const response = await check.fetch({
    json: async () => ({ filename: 'big.docx', bytes: Buffer.alloc(MAX_UPLOAD_BYTES + 1) })
  })
  assert.equal(response.status, 400)
  assert.match((await response.json()).error, /8 MiB/)
})

test('积分先扣后退回，余额不足时拒绝', async () => {
  const root = await mkdtemp(join(tmpdir(), 'official-doc-account-'))
  assert.equal((await loadAccount(root)).balance, 20)
  assert.equal((await chargeAccount(root, 'analyze')).balance, 18)
  assert.equal((await refundAccount(root, 'analyze')).balance, 20)
  for (let index = 0; index < 20; index += 1) await chargeAccount(root, 'polish')
  await assert.rejects(() => chargeAccount(root, 'draft'), /积分不足/)
})
