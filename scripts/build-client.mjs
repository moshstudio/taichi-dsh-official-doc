import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'

const source = readFileSync(new URL('../lib/client-logic.js', import.meta.url), 'utf8')
  .replace("export const inject = ['slots', 'locale', 'connection']", "const inject = ['slots', 'locale', 'connection']")
  .replace('export function apply(ctx)', 'function apply(ctx)')

// Hoist React like dsh-desktop-office so component render never hits a bare
// global require outside the ModuleLoader factory parameter.
const client = `window.__ModuleLoader__.load({
  id: 'taichi-dsh-official-doc',
  factory: (require) => {
    const React = require('react')
    ${source.replaceAll("const React = require('react')", '/* React from factory */')}
    return { apply, inject }
  }
})
`
writeFileSync(new URL('../lib/client.js', import.meta.url), client)

// Stale alternate entry used factory: () => without require — keep it gone.
try {
  unlinkSync(new URL('../lib/client-entry.js', import.meta.url))
} catch {
  // absent is fine
}
