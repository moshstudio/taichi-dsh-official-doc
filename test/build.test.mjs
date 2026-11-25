import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)

test('客户端构建产物遵循 DSH ModuleLoader 契约', async () => {
  const bundle = await readFile(new URL('lib/client.js', root), 'utf8')
  assert.match(bundle, /^window\.__ModuleLoader__\.load\(\{[\s\S]*id: "taichi-dsh-official-doc"/)
  assert.match(bundle, /factory: \(require\) => \{/)
  assert.match(bundle, /return module\.exports;\s*}\s*}\);\s*$/)
  assert.match(bundle, /function apply\(ctx\)/)
  assert.match(bundle, /shell\.activity\.main/)
})

test('package manifest points at built Node and browser entries', async () => {
  const manifest = JSON.parse(await readFile(new URL('package.json', root), 'utf8'))
  assert.equal(manifest.main, './dsh/index.mjs')
  assert.equal(manifest.exports['.'], './dsh/index.mjs')
  assert.equal(manifest.exports['./client'], './lib/client.js')
  assert.deepEqual(manifest.dsh.client.inject, [
    '@deepseek-ai/dsh-client-ui-primitives',
    'react',
    'react-dom'
  ])
})