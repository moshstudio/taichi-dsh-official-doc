export function roleClass(role) {
  if (role === 'title') return 'tod-title'
  if (role === 'recipient') return 'tod-recipient'
  if (role === 'heading' || role === 'heading1') return 'tod-heading'
  if (role === 'heading2') return 'tod-heading-2'
  if (role === 'signature') return 'tod-signature'
  if (role === 'date') return 'tod-date'
  return 'tod-body'
}

export function A4Preview({ model, zoom, setZoom, Button, print }) {
  const React = require('react')
  const paragraphs = model?.paragraphs ?? []
  const tables = model?.tables ?? []
  return React.createElement('div', { 'data-tod-a4-wrap': '', ...(print ? { 'data-tod-a4-print': '' } : {}) },
    React.createElement('div', { 'data-tod-a4-toolbar': '' },
      React.createElement(Button, { type: 'button', variant: 'outline', onClick: () => setZoom(value => Math.max(0.5, Number((value - 0.1).toFixed(1)))) }, '缩小'),
      React.createElement('span', null, `${Math.round((zoom || 1) * 100)}%`),
      React.createElement(Button, { type: 'button', variant: 'outline', onClick: () => setZoom(value => Math.min(1.5, Number((value + 0.1).toFixed(1)))) }, '放大')),
    React.createElement('div', { 'data-tod-a4-stage': '' },
      React.createElement('div', {
        'data-tod-a4-page': '',
        style: { transform: `scale(${zoom || 1})`, marginBottom: `${((zoom || 1) - 1) * 297}mm` }
      },
        paragraphs.length === 0 ? React.createElement('p', { className: 'tod-body' }, '暂无预览，请先生成或检查文档。') : null,
        paragraphs.map((paragraph, index) => {
          if (paragraph.tableIndex != null && tables[paragraph.tableIndex]) {
            const table = tables[paragraph.tableIndex]
            return React.createElement('table', { key: `t-${index}` },
              React.createElement('thead', null, React.createElement('tr', null,
                (table.headers || []).map((cell, cellIndex) => React.createElement('th', { key: cellIndex }, cell)))),
              React.createElement('tbody', null, (table.rows || []).map((row, rowIndex) =>
                React.createElement('tr', { key: rowIndex }, row.map((cell, cellIndex) =>
                  React.createElement('td', { key: cellIndex }, cell))))))
          }
          return React.createElement('p', { key: index, className: roleClass(paragraph.role) }, paragraph.text)
        }))))
}

export function PreviewModal({ model, onClose, Button }) {
  const React = require('react')
  const [zoom, setZoom] = React.useState(0.75)
  return React.createElement('div', { className: 'tod-modal', role: 'dialog', 'aria-label': 'A4 预览', onClick: onClose },
    React.createElement('div', { className: 'tod-modal-panel', onClick: event => event.stopPropagation() },
      React.createElement('div', { className: 'tod-actions' },
        React.createElement(Button, { type: 'button', variant: 'outline', onClick: () => window.print() }, '打印/导出 PDF'),
        React.createElement(Button, { type: 'button', variant: 'primary', onClick: onClose }, '关闭')),
      React.createElement(A4Preview, { model, zoom, setZoom, Button, print: true })))
}