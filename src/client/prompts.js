export function polishPrompt(markdown) {
  return `请将以下 Markdown 润色为规范公文语体，保留 Markdown 结构（标题、列表、表格），不要改写成纯叙述：\n\n${markdown || '（请粘贴待润色文稿）'}`
}

export function deaiPrompt(markdown) {
  return `请按公文写作习惯去除 AI 痕迹：少用排比与空泛套话、避免“首先其次最后”机械结构、删掉无信息量形容词、保持短句与具体事项。只输出改写后的 Markdown：\n\n${markdown || '（请粘贴文稿）'}`
}

export function aiAnalyzePrompt(result) {
  const lines = (result?.issues ?? []).slice(0, 30).map((item, index) =>
    `${index + 1}. [${item.severity}] ${item.name}：${item.original || ''} → ${item.fix || item.suggestion || ''}`)
  return `请对以下公文校审问题做语义级深度分析，文种为「${result?.type || ''}」。按条目给出是否误报、补充建议与改写示例：\n\n${lines.join('\n') || '（暂无规则问题，请通读后给出写作建议）'}`
}

export function draftPrompt(name) {
  return `请按「${name}」文种起草一份完整公文 Markdown，包含标题、主送、正文、署名与成文日期。`
}