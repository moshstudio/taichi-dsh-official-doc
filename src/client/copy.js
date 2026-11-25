export const NS = 'taichi-dsh-official-doc'
export const STYLE_ID = 'taichi-dsh-official-doc'
export const sections = ['workspace', 'process', 'markdown', 'review', 'templates', 'about']
export const STATUS_LABEL = { uploaded: '已上传', checked: '已校审', optimized: '已优化', failed: '处理失败' }

export const copy = {
  zh: {
    name: '公文',
    workspace: '工作台',
    process: '文档处理',
    markdown: 'Markdown优化',
    review: '校审中心',
    templates: '模板中心',
    about: '关于'
  },
  en: {
    name: 'Official document',
    workspace: 'Workspace',
    process: 'Documents',
    markdown: 'Markdown',
    review: 'Review',
    templates: 'Templates',
    about: 'About'
  }
}

export const CSS = `
[data-taichi-official-doc]{box-sizing:border-box;display:flex;flex-direction:column;gap:16px;width:100%;height:100%;min-height:0;padding:20px 24px;overflow:auto;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-size:13px;line-height:20px}
[data-taichi-official-doc] *,[data-taichi-official-doc] *::before,[data-taichi-official-doc] *::after{box-sizing:border-box}
[data-tod-sidebar-host]{display:none;box-sizing:border-box;width:100%;min-width:0;min-height:0;padding:6px 4px;overflow:hidden;background:var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-base))}
[data-tod-nav]{display:flex;flex-direction:column;gap:2px;box-sizing:border-box;width:100%;min-width:0;height:100%;padding:6px 0;overflow:auto;color:var(--dsw-alias-label-primary);font-size:14px;line-height:22px}
html[data-tod-active] [data-slot="sidebar.quickSwitcher"],
html[data-tod-active] [data-slot="sidebar.primaryNavigation"],
html[data-tod-active] [data-dsh-sidebar-new-session],
html[data-tod-active] [data-tod-sidebar-hide]{display:none!important}
html[data-tod-active] [data-tod-sidebar-root] [data-sidebar-scrollport]{grid-template-rows:8px max-content 2px minmax(0,1fr)}
[data-tod-sidebar-region]{position:relative;min-width:0;min-height:0}
[data-tod-sidebar-host]{position:absolute;z-index:20;inset:0;display:none;min-width:0;min-height:0;padding:6px 4px;overflow:hidden;background:var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-base))}
html[data-tod-active] [data-tod-sidebar-host]{display:flex}
[data-sidebar-collapsed] [data-tod-sidebar-host]{display:none!important}
[data-tod-nav] button{appearance:none;box-sizing:border-box;display:flex;align-items:center;gap:8px;width:100%;min-height:36px;padding:7px 8px;border:0;border-radius:var(--dsw-radius-md,10px);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;line-height:22px;text-align:start;white-space:nowrap;cursor:pointer;user-select:none}
[data-tod-nav] button:hover,[data-tod-nav] button[aria-current=page]{background:var(--dsw-alias-interactive-bg-hover)}
[data-tod-nav] button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
[data-tod-nav] svg{flex:none;width:16px;height:16px}
[data-tod-nav] span{min-width:0;overflow:hidden;text-overflow:ellipsis}
[data-tod-nav][data-wide=false] button{justify-content:center;width:36px;padding:7px 0}
[data-tod-nav][data-wide=false] span{display:none}
[data-taichi-official-doc] [data-status]{min-height:20px;color:var(--dsw-alias-label-secondary)}
[data-taichi-official-doc] [data-status=error]{color:var(--dsw-alias-state-error-primary)}
[data-taichi-official-doc] [data-status=loading]{color:var(--dsw-alias-label-tertiary)}
[data-taichi-official-doc] article{display:flex;flex-direction:column;gap:12px;min-width:0;flex:1}
[data-taichi-official-doc] h1{margin:0;font-size:18px;line-height:26px;font-weight:600}
[data-taichi-official-doc] h2{margin:0;font-size:14px;line-height:22px;font-weight:600}
[data-taichi-official-doc] p{margin:0;color:var(--dsw-alias-label-secondary)}
[data-taichi-official-doc] label{display:flex;align-items:flex-start;gap:8px;color:var(--dsw-alias-label-primary)}
[data-taichi-official-doc] form{display:flex;flex-direction:column;gap:10px;max-width:560px}
[data-taichi-official-doc] .tod-actions{display:flex;flex-wrap:wrap;gap:8px}
[data-taichi-official-doc] .tod-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
[data-taichi-official-doc] .tod-card{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:12px;background:var(--dsw-alias-bg-layer-1)}
[data-taichi-official-doc] .tod-card strong{display:block;font-size:20px;line-height:28px;color:var(--dsw-alias-label-primary)}
[data-taichi-official-doc] .tod-split{display:grid;grid-template-columns:minmax(280px,1fr) minmax(280px,1fr);gap:16px;min-height:0}
@media (max-width:960px){[data-taichi-official-doc] .tod-split{grid-template-columns:1fr}}
[data-taichi-official-doc] .tod-issue{display:flex;flex-direction:column;gap:4px;padding:8px 0;border-bottom:1px solid var(--dsw-alias-border-l2)}
[data-taichi-official-doc] .tod-badge{display:inline-block;padding:2px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);font-size:12px}
[data-taichi-official-doc] .tod-drop{border:1px dashed var(--dsw-alias-border-l2);border-radius:8px;padding:20px;text-align:center;background:var(--dsw-alias-bg-layer-1)}
[data-taichi-official-doc] .tod-drop[data-active=true]{border-color:var(--dsw-alias-brand-primary)}
[data-taichi-official-doc] .tod-modal{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:24px;z-index:80}
[data-taichi-official-doc] .tod-modal-panel{width:min(920px,100%);max-height:90vh;overflow:auto;background:var(--dsw-alias-bg-base);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px}
[data-taichi-official-doc] input[type=text],
[data-taichi-official-doc] input:not([type]),
[data-taichi-official-doc] input[type=file],
[data-taichi-official-doc] select,
[data-taichi-official-doc] textarea{width:100%;max-width:560px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px 10px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit}
[data-taichi-official-doc] textarea{min-height:160px;resize:vertical}
[data-taichi-official-doc] input:focus-visible,
[data-taichi-official-doc] select:focus-visible,
[data-taichi-official-doc] textarea:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
[data-tod-a4-wrap]{display:flex;flex-direction:column;gap:8px;min-width:0}
[data-tod-a4-toolbar]{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
[data-tod-a4-stage]{overflow:auto;padding:12px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;max-height:70vh}
[data-tod-a4-page]{width:210mm;min-height:297mm;margin:0 auto;background:#fff;color:#111;box-shadow:0 1px 4px rgba(0,0,0,.12);padding:37mm 26mm 35mm 28mm;transform-origin:top center;font-family:仿宋,FangSong,STFangsong,serif;font-size:16pt;line-height:28pt}
[data-tod-a4-page] .tod-title{font-family:方正小标宋简体,宋体,SimSun,serif;font-size:22pt;text-align:center;line-height:33pt;margin:0 0 18pt}
[data-tod-a4-page] .tod-recipient{text-align:left;margin:0 0 12pt}
[data-tod-a4-page] .tod-body{text-align:justify;text-indent:2em;margin:0}
[data-tod-a4-page] .tod-heading{font-family:黑体,SimHei,sans-serif;text-indent:2em;margin:12pt 0 0}
[data-tod-a4-page] .tod-heading-2{font-family:楷体,KaiTi,STKaiti,serif;text-indent:2em;margin:12pt 0 0}
[data-tod-a4-page] .tod-signature,[data-tod-a4-page] .tod-date{text-align:right;margin:18pt 4em 0 0}
[data-tod-a4-page] table{width:100%;border-collapse:collapse;margin:12pt 0;font-size:14pt}
[data-tod-a4-page] td,[data-tod-a4-page] th{border:1px solid #333;padding:4pt 6pt;text-align:left}
@media print{
  body *{visibility:hidden!important}
  [data-tod-a4-print],[data-tod-a4-print] *{visibility:visible!important}
  [data-tod-a4-print]{position:absolute;left:0;top:0;width:100%}
  [data-tod-a4-page]{box-shadow:none;margin:0}
}
@media (prefers-reduced-motion:reduce){[data-taichi-official-doc] *{transition:none!important}}
`