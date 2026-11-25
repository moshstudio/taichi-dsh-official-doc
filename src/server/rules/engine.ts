import { applyFixes, checkModel } from '../../../dsh/rules.js'

type Paragraph = { id?: string; text: string; font?: string; size?: number; align?: string; firstLineIndent?: number; line?: number }
type PageMarginPatch = { op: 'pageMargin'; value: { side: 'top' | 'bottom' | 'left' | 'right'; mm: number } }
type TableCellPatch = { op: 'tableCell'; table: number; row: number; cell: number; to: string }
type ParagraphPatch =
  | { op: 'font'; target: string; eastAsia: string }
  | { op: 'size'; target: string; pt: number }
  | { op: 'align' | 'indent' | 'lineExact'; target: string; value: string | number }
  | { op: 'text'; target: string; from: string; to: string }
type Patch = PageMarginPatch | TableCellPatch | ParagraphPatch

type DocumentModel = {
  page?: Record<string, number>
  paragraphs?: Paragraph[]
  tables?: Array<{ headers: string[]; rows: string[][] }>
  meta?: Record<string, unknown>
}

export function applyPatches<T extends DocumentModel>(model: T, patches: Patch[]): T {
  const next = structuredClone(model)
  for (const patch of patches) {
    if (!patch || typeof patch !== 'object') throw new Error('补丁格式不正确')
    if (patch.op === 'pageMargin') {
      if (!Number.isFinite(patch.value.mm)) throw new Error('页边距补丁无效')
      next.page = { ...next.page, [patch.value.side]: patch.value.mm }
      continue
    }
    if (patch.op === 'tableCell') {
      const table = next.tables?.[patch.table]
      const row = patch.row === 0 ? table?.headers : table?.rows?.[patch.row - 1]
      if (!row || !Number.isInteger(patch.cell) || patch.cell < 0 || patch.cell >= row.length) throw new Error('表格补丁位置无效')
      row[patch.cell] = patch.to
      continue
    }
    const paragraph = next.paragraphs?.find(item => item.id === patch.target)
    if (!paragraph) throw new Error(`找不到段落：${patch.target}`)
    if (patch.op === 'font') paragraph.font = patch.eastAsia
    else if (patch.op === 'size') paragraph.size = patch.pt
    else if (patch.op === 'align') paragraph.align = String(patch.value)
    else if (patch.op === 'indent') paragraph.firstLineIndent = Number(patch.value)
    else if (patch.op === 'lineExact') paragraph.line = Number(patch.value)
    else if (patch.op === 'text') {
      if (paragraph.text !== patch.from) throw new Error(`段落内容已变化：${patch.target}`)
      paragraph.text = patch.to
    }
  }
  return next
}

export function checkModelWithPatches<T extends DocumentModel>(model: T, rules: Parameters<typeof checkModel>[1]) {
  return checkModel(model, rules).map(issue => ({ ...issue }))
}

export function applyRuleFixes<T extends DocumentModel>(model: T, rules: Parameters<typeof applyFixes>[1], selected?: string[] | null): T {
  return (applyFixes as (value: T, configuredRules: unknown, selectedIssues?: string[] | null) => T)(model, rules, selected)
}