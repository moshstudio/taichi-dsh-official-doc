/** 轻量 A4 预览：输入 model，返回可挂载的 DOM 节点描述（React createElement 树由调用方组装亦可） */

export const A4_CSS = `
[data-tod-a4-wrap]{display:flex;flex-direction:column;gap:8px;min-width:0}
[data-tod-a4-toolbar]{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
[data-tod-a4-stage]{overflow:auto;padding:12px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;max-height:70vh}
[data-tod-a4-page]{width:210mm;min-height:297mm;margin:0 auto;background:#fff;color:#111;box-shadow:0 1px 4px rgba(0,0,0,.12);padding:37mm 26mm 35mm 28mm;transform-origin:top center;font-family:仿宋,FangSong,STFangsong,serif;font-size:16pt;line-height:28pt}
[data-tod-a4-page][data-role=title],[data-tod-a4-page] .tod-title{font-family:方正小标宋简体,宋体,SimSun,serif;font-size:22pt;text-align:center;line-height:33pt;margin:0 0 18pt}
[data-tod-a4-page] .tod-recipient{text-align:left;margin:0 0 12pt}
[data-tod-a4-page] .tod-body{text-align:justify;text-indent:2em;margin:0 0 0}
[data-tod-a4-page] .tod-heading{font-family:黑体,SimHei,sans-serif;text-indent:2em;margin:12pt 0 0}
[data-tod-a4-page] .tod-signature,[data-tod-a4-page] .tod-date{text-align:right;margin:18pt 4em 0 0}
[data-tod-a4-page] table{width:100%;border-collapse:collapse;margin:12pt 0;font-size:14pt}
[data-tod-a4-page] td,[data-tod-a4-page] th{border:1px solid #333;padding:4pt 6pt;text-align:left}
@media print{
  body *{visibility:hidden!important}
  [data-tod-a4-print], [data-tod-a4-print] *{visibility:visible!important}
  [data-tod-a4-print]{position:absolute;left:0;top:0;width:100%}
  [data-tod-a4-page]{box-shadow:none;margin:0}
}
`

export function scaleStyle(zoom) {
  const value = Math.min(1.5, Math.max(0.5, Number(zoom) || 1))
  return { transform: `scale(${value})`, marginBottom: `${(value - 1) * 297}mm` }
}

export function roleClass(role) {
  if (role === 'title') return 'tod-title'
  if (role === 'recipient') return 'tod-recipient'
  if (role === 'heading') return 'tod-heading'
  if (role === 'signature') return 'tod-signature'
  if (role === 'date') return 'tod-date'
  return 'tod-body'
}
