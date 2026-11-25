import { download, request } from './api.js'
import { draftPrompt } from './prompts.js'

export function Templates({ templates, run, connection, Button, setPreviewModel, setShowPreview }) {
  const React = require('react')
  const [category, setCategory] = React.useState('全部')
  const [editing, setEditing] = React.useState(null)
  const categories = ['全部', '政府机关', '其他常用', '自定义']
  const list = templates.filter(item => category === '全部' || (item.category || (item.builtin ? '政府机关' : '自定义')) === category)

  return React.createElement('article', null,
    React.createElement('h1', null, '模板中心'),
    React.createElement('div', { className: 'tod-actions' },
      categories.map(item => React.createElement(Button, {
        key: item, type: 'button', variant: category === item ? 'primary' : 'outline', onClick: () => setCategory(item)
      }, item))),
    React.createElement('div', { className: 'tod-grid' }, list.map(item =>
      React.createElement('div', { key: item.id, className: 'tod-card' },
        React.createElement('h2', null, item.name),
        React.createElement('p', null, item.description || ''),
        React.createElement('div', { className: 'tod-actions' },
          React.createElement(Button, {
            type: 'button', variant: 'primary',
            onClick: () => run(() => request('POST', '/api/plugin/taichi_official_doc/templates/apply', { id: item.id })
              .then(file => { download(file); setPreviewModel(file.model); return file }))
          }, '选用生成'),
          React.createElement(Button, {
            type: 'button', variant: 'outline',
            onClick: () => run(() => request('POST', '/api/plugin/taichi_official_doc/templates/apply', { id: item.id })
              .then(file => { setPreviewModel(file.model); setShowPreview(true); return file }))
          }, '预览'),
          React.createElement(Button, {
            type: 'button', variant: 'outline',
            onClick: () => run(() => useSessionAction(connection, 'draft', draftPrompt(item.name)))
          }, '会话起草'),
          React.createElement(Button, { type: 'button', variant: 'outline', onClick: () => setEditing(item) }, '编辑规则'),
          !item.builtin ? React.createElement(Button, {
            type: 'button', variant: 'outline',
            onClick: () => run(() => request('POST', '/api/plugin/taichi_official_doc/templates/delete', { id: item.id }))
          }, '删除') : null)))),
    React.createElement('h2', null, '新建模板'),
    React.createElement('form', {
      onSubmit: event => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        run(() => request('POST', '/api/plugin/taichi_official_doc/templates/create', {
          name: data.get('name'),
          id: data.get('id'),
          description: data.get('description'),
          category: '自定义',
          rules: data.get('rules')
        })).then(() => event.target.reset())
      }
    },
      React.createElement('input', { name: 'name', 'aria-label': '模板名称', required: true, placeholder: '名称' }),
      React.createElement('input', { name: 'id', 'aria-label': '模板标识', placeholder: '英文标识，可空' }),
      React.createElement('input', { name: 'description', 'aria-label': '模板说明', placeholder: '说明' }),
      React.createElement('textarea', { name: 'rules', 'aria-label': '模板规则', placeholder: 'YAML 规则' }),
      React.createElement(Button, { type: 'submit', variant: 'primary' }, '保存模板')),
    React.createElement('h2', null, '从文档提取格式'),
    React.createElement('input', {
      type: 'file', accept: '.docx', 'aria-label': '提取格式的文档',
      onChange: event => {
        const file = event.target.files?.[0]
        if (!file) return
        file.arrayBuffer().then(buffer => run(() => request('POST', '/api/plugin/taichi_official_doc/templates/extract', {
          filename: file.name,
          name: file.name.replace(/\.docx$/i, ''),
          bytes: Array.from(new Uint8Array(buffer))
        }).then(extracted => request('POST', '/api/plugin/taichi_official_doc/templates/create', extracted))))
      }
    }),
    editing ? React.createElement('form', {
      onSubmit: event => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        run(() => request('POST', '/api/plugin/taichi_official_doc/templates/rules', {
          id: editing.id,
          rules: data.get('rules')
        })).then(() => setEditing(null))
      }
    },
      React.createElement('h2', null, `编辑规则 · ${editing.name}`),
      React.createElement('textarea', {
        name: 'rules', 'aria-label': '规则 YAML', defaultValue: `name: ${editing.name}\nstructure:\n  - title\n  - body\n  - signature\n  - date\n`
      }),
      React.createElement('div', { className: 'tod-actions' },
        React.createElement(Button, { type: 'submit', variant: 'primary' }, '保存规则'),
        React.createElement(Button, { type: 'button', variant: 'outline', onClick: () => setEditing(null) }, '取消'))) : null)
}

export function About({ meta }) {
  const React = require('react')
  return React.createElement('article', null,
    React.createElement('h1', null, '关于'),
    React.createElement('p', null, `taichi-dsh-official-doc ${meta?.version || ''}。格式检查、修复、暗标、Markdown 与模板在插件内完成。`),
    React.createElement('p', null, '文字润色、去 AI 味、深度分析与模板起草使用太极当前会话，不在插件内配置模型供应商。'),
    React.createElement('p', null, 'PDF 通过浏览器打印另存；不支持 Office 插件桥与 .doc/.wps 内嵌转换（请先另存为 .docx）。'),
    React.createElement('p', null, `内置规则文种 ${meta?.rules ?? '-'} 个。`),
    React.createElement('h2', null, '账号积分'),
    React.createElement('p', null, `${meta?.account?.name ?? '本地账号'} · 剩余 ${meta?.account?.balance ?? '-'} 分`),
    React.createElement('p', null, '格式检查不扣积分。润色、去 AI 味各 1 分，深度分析、模板起草各 2 分。写入会话失败会退回。'))
}