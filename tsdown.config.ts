import { defineConfig } from 'tsdown'

const id = 'taichi-dsh-official-doc'
const platformModules = ['react', 'react/jsx-runtime', '@deepseek-ai/dsh-client-ui-primitives']

export default defineConfig([
  {
    name: 'server',
    entry: { index: 'dsh/index.js' },
    outDir: 'dsh',
    format: 'esm',
    platform: 'node',
    target: 'node20',
    clean: false,
    dts: false,
    deps: { neverBundle: ['@deepseek-ai/cordis'] }
  },
  {
    name: 'client',
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: 'cjs',
    target: 'es2022',
    inputOptions: { platform: 'browser' },
    clean: false,
    dts: false,
    deps: { neverBundle: platformModules },
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
      'import.meta.env.MODE': JSON.stringify('production')
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;'
    }
  }
])