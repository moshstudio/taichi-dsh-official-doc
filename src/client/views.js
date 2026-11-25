import { STATUS_LABEL } from './copy.js'
import { download, request } from './api.js'
import { draftToSession, takeSessionMarkdown, useSessionAction } from './session.js'
import { aiAnalyzePrompt, deaiPrompt, draftPrompt, polishPrompt } from './prompts.js'
import { A4Preview } from './preview.js'

export function Workspace({ history, stats, meta, controller, Button }) {
  const React = require('react')
  const cards = [
    ['文档总数', stats?.documents ?? 0],
    ['校审次数', stats?.checks ?? 0],
    ['发现问题', stats?.issues ?? 0],
    ['优化完成', stats?.optimized ?? 0]
  ]
  return React.createElement('article', null,
    React.createElement('h1', null, '公文智能校审工作台'),
    React.createElement('p', null, new Date().toLocaleDateString('zh-CN', { dateStyle: 'full' })),
    React.createElement('div', { className: 'tod-grid' }, cards.map(([label, value]) =>
      React.createElement('div', { key: label, className: 'tod-card' },
        React.createElement('span', null, label),
        React.createElement('strong', null, value)))),
    React.createElement('div', { className: 'tod-actions' },
      React.createElement(Button, { type: 'button', variant: 'primary', onClick: () => controller.choose('process') }, '上传公文'),
      React.createElement(Button, { type: 'button', variant: 'outline', onClick: () => controller.choose('templates') }, '选择模板'),
      React.createElement(Button, { type: 'button', variant: 'outline', onClick: () => controller.choose('about') }, '关于 AI')),
    React.createElement('h2', null, '最近文档'),
    history.slice(0, 8).map(item => React.createElement('p', {
      key: item.id,
      style: { cursor: 'pointer' },
      onClick: () => controller.choose('review', item.id)
    }, `${item.name} · ${STATUS_LABEL[item.status] || '已校审'} · ${item.type || ''} · ${item.issueCount ?? item.issues ?? 0} 个问题`)),
    history.length === 0 ? React.createElement('p', null, '还没有处理过的文档，先去文档处理上传。') : null,
    React.createElement('p', null, `规则 ${meta?.rules ?? '-'} 条 · 插件 v${meta?.version ?? '-'} · AI 使用太极当前会话`))
}

export function ProcessView({ types, run, setResult, setPreviewModel, setShowPreview, controller, Button }) {
  const React = require('react')
  const [file, setFile] = React.useState(null)
  const [type, setType] = React.useState('notice')
  const [phase, setPhase] = React.useState('')
  const [dragging, setDragging] = React.useState(false)

  const onFile = next => {
    if (!next) return
    if (/\.(doc|wps)$/i.test(next.name)) {
      setPhase('请先另存为 .docx 后再上传')
      return
    }
    setFile(next)
    setPhase(`已选择 ${next.name}`)
  }

  const startCheck = () => {
    if (!file) return
    setPhase('上传中')
    file.arrayBuffer().then(buffer => {
      setPhase('检查中')
      return run(() => request('POST', '/api/plugin/taichi_official_doc/check', {
        filename: file.name,
        type,
        bytes: Array.from(new Uint8Array(buffer))
      }))
    }).then(payload => {
      setResult(payload)
      setPreviewModel(payload.model)
      setPhase('完成')
    }).catch(() => setPhase('失败'))
  }

  return React.createElement('article', null,
    React.createElement('h1', null, '文档处理'),
    React.createElement('p', null, '上传 .docx，选择文种后开始格式检查。'),
    React.createElement('div', {
      className: 'tod-drop',
      'data-active': dragging ? 'true' : 'false',
      onDragOver: event => { event.preventDefault(); setDragging(true) },
      onDragLeave: () => setDragging(false),
      onDrop: event => {
        event.preventDefault()
        setDragging(false)
        onFile(event.dataTransfer.files?.[0])
      }
    },
      React.createElement('p', null, file ? `${file.name}（${Math.round(file.size / 1024)} KB）` : '拖拽或选择 Word 文档（.docx）'),
      React.createElement('input', {
        type: 'file', accept: '.docx,.doc,.wps', 'aria-label': '选择文档',
        onChange: event => onFile(event.target.files?.[0])
      })),
    React.createElement('label', null, '文种',
      React.createElement('select', { 'aria-label': '文种', value: type, onChange: event => setType(event.target.value) },
        (types.length ? types : [{ id: 'notice', name: '通知' }]).map(item =>
          React.createElement('option', { key: item.id, value: item.id }, item.name)))),
    React.createElement('div', { className: 'tod-actions' },
      React.createElement(Button, { type: 'button', variant: 'primary', disabled: !file, onClick: startCheck }, '开始检查'),
      React.createElement(Button, { type: 'button', variant: 'outline', disabled: !phase || phase === '失败', onClick: () => controller.choose('review') }, '查看检查结果'),
      React.createElement(Button, { type: 'button', variant: 'outline', disabled: !phase || phase === '失败', onClick: () => setShowPreview(true) }, 'A4 预览')),
    phase ? React.createElement('p', null, `状态：${phase}`) : null)
}

export function Review({ result, setPreviewModel, setShowPreview, run, connection, Button }) {
  const React = require('react')
  const [filter, setFilter] = React.useState('all')
  const [selected, setSelected] = React.useState(() => new Set((result?.issues ?? []).map(item => item.id)))
  const [darkHits, setDarkHits] = React.useState(null)

  React.useEffect(() => {
    setSelected(new Set((result?.issues ?? []).map(item => item.id)))
  }, [result?.id])

  const issues = (result?.issues ?? []).filter(item => filter === 'all' || item.severity === filter)
  const toggle = id => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!result?.id) {
    return React.createElement('article', null,
      React.createElement('h1', null, '校审中心'),
      React.createElement('p', null, '请先在「文档处理」上传并检查，或从工作台打开最近文档。'))
  }

  return React.createElement('article', null,
    React.createElement('h1', null, '校审中心'),
    React.createElement('p', null, `${result.type || ''} · ${result.issues?.length || 0} 个问题`),
    React.createElement('div', { className: 'tod-actions' },
      ['all', 'P0', 'P1', 'P2'].map(level => React.createElement(Button, {
        key: level, type: 'button', variant: filter === level ? 'primary' : 'outline', onClick: () => setFilter(level)
      }, level === 'all' ? '全部' : level)),
      React.createElement(Button, { type: 'button', variant: 'outline', onClick: () => setSelected(new Set(issues.map(item => item.id))) }, '全选'),
      React.createElement(Button, {
        type: 'button', variant: 'primary',
        onClick: () => run(() => request('POST', '/api/plugin/taichi_official_doc/fix', {
          id: result.id, issues: [...selected]
        }).then(file => { download(file); return file }))
      }, '应用选中并下载'),
      React.createElement(Button, {
        type: 'button', variant: 'outline',
        onClick: () => run(() => request('POST', '/api/plugin/taichi_official_doc/fix', {
          id: result.id, issues: (result.issues ?? []).map(item => item.id)
        }).then(file => { download(file); return file }))
      }, '全部应用'),
      React.createElement(Button, { type: 'button', variant: 'outline', onClick: () => setShowPreview(true) }, 'A4 预览'),
      React.createElement(Button, { type: 'button', variant: 'outline', onClick: () => window.print() }, '打印/导出 PDF'),
      React.createElement(Button, {
        type: 'button', variant: 'outline',
        onClick: () => run(() => request('POST', '/api/plugin/taichi_official_doc/dark-bid', { id: result.id })
          .then(payload => { setDarkHits(payload.hits); return payload }))
      }, '暗标扫描'),
      React.createElement(Button, {
        type: 'button', variant: 'outline',
        onClick: () => run(() => useSessionAction(connection, 'analyze', aiAnalyzePrompt(result)))
      }, 'AI 深度分析')),
    issues.map(item => React.createElement('div', { key: `${item.id}-${item.original}`, className: 'tod-issue' },
      React.createElement('label', null,
        React.createElement('input', {
          type: 'checkbox', checked: selected.has(item.id), onChange: () => toggle(item.id)
        }),
        React.createElement('span', null, `${item.severity || ''} ${item.name}：${item.fix || item.suggestion || ''}`)),
      item.standard_ref ? React.createElement('p', null, `GB/T 9704 ${item.standard_ref}`) : null,
      item.original ? React.createElement('p', null, `原文：${item.original}`) : null)),
    darkHits ? React.createElement('div', { className: 'tod-card' },
      React.createElement('h2', null, `暗标命中 ${darkHits.length}`),
      darkHits.map((hit, index) => React.createElement('p', { key: index }, `${hit.type}：${hit.excerpt} → ${hit.mask}`)),
      React.createElement(Button, {
        type: 'button', variant: 'primary',
        onClick: () => run(() => request('POST', '/api/plugin/taichi_official_doc/dark-bid/redact', { id: result.id })
          .then(file => { download(file); setPreviewModel(file.model); return file }))
      }, '脱敏并下载'),
      React.createElement(Button, { type: 'button', variant: 'outline', onClick: () => setDarkHits(null) }, '关闭')) : null)
}

export function MarkdownView({ markdown, setMarkdown, markdownType, setMarkdownType, types, previewModel, setPreviewModel, run, connection, Button }) {
  const React = require('react')
  const [zoom, setZoom] = React.useState(0.8)
  const [help, setHelp] = React.useState(false)
  return React.createElement('article', null,
    React.createElement('h1', null, 'Markdown 优化'),
    React.createElement('p', null, '左侧编辑，右侧 A4 预览。润色/去 AI 味写入太极当前会话，请自行粘贴回编辑器。'),
    React.createElement('div', { className: 'tod-split' },
      React.createElement('div', null,
        React.createElement('label', null, '文种',
          React.createElement('select', { 'aria-label': 'Markdown 文种', value: markdownType, onChange: event => setMarkdownType(event.target.value) },
            (types.length ? types : [{ id: 'notice', name: '通知' }]).map(item =>
              React.createElement('option', { key: item.id, value: item.id }, item.name)))),
        React.createElement('textarea', {
          'aria-label': 'Markdown 公文', value: markdown,
          onChange: event => setMarkdown(event.target.value)
        }),
        React.createElement('div', { className: 'tod-actions' },
          React.createElement(Button, {
            type: 'button', variant: 'primary',
            onClick: () => run(() => request('POST', '/api/plugin/taichi_official_doc/markdown/preview', {
              markdown, type: markdownType
            }).then(payload => { setPreviewModel(payload.model); return payload }))
          }, '生成预览'),
          React.createElement(Button, {
            type: 'button', variant: 'outline',
            onClick: () => run(() => request('POST', '/api/plugin/taichi_official_doc/markdown/download', {
              markdown, type: markdownType
            }).then(download))
          }, '下载 docx'),
          React.createElement(Button, {
            type: 'button', variant: 'outline',
            onClick: () => run(() => useSessionAction(connection, 'polish', polishPrompt(markdown)))
          }, 'AI 润色'),
          React.createElement(Button, {
            type: 'button', variant: 'outline',
            onClick: () => run(() => useSessionAction(connection, 'deai', deaiPrompt(markdown)))
          }, '去 AI 味'),
          React.createElement(Button, {
            type: 'button', variant: 'outline',
            onClick: () => run(() => Promise.resolve(setMarkdown(takeSessionMarkdown(connection))))
          }, '取回结果'),
          React.createElement(Button, { type: 'button', variant: 'outline', onClick: () => setHelp(value => !value) }, '语法说明')),
        help ? React.createElement('p', null, '支持 # 标题、## 层次、**加粗**、列表、- 项、以及 | 表格 |。') : null),
      React.createElement(A4Preview, { model: previewModel, zoom, setZoom, Button })))
}