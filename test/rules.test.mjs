import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { applyFixes, checkModel, detectType, mergeRules, parseMarkdown, parseRules } from '../dsh/rules.js'
import { readDocx, writeDocx } from '../dsh/docx.js'
import { scanDarkBid, redactDarkBid } from '../dsh/dark-bid.js'
import { extractFormat } from '../dsh/format-extract.js'
import { checkSemantic } from '../dsh/semantic.js'
import { listTemplates, loadRules, saveJob, loadJob, saveTemplate, getStats, rememberDocument } from '../dsh/store.js'

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))

test('文件名识别文种', () => {
  assert.equal(detectType('年度工作报告.docx'), 'report')
  assert.equal(detectType('未命名.docx'), 'notice')
  assert.equal(detectType('会议纪要.docx'), 'meeting')
})

test('规则能发现并修复正文和页面', async () => {
  const rules = await loadRules(root, root, 'notice')
  const model = { page: { widthMm: 200, heightMm: 300, top: 20, bottom: 20, left: 20, right: 20 }, paragraphs: [
    { role: 'title', text: '通知', font: '宋体', size: 16, align: 'left' },
    { role: 'body', text: '正文', font: '宋体', size: 12, align: 'left' }
  ] }
  const issues = checkModel(model, rules)
  assert.ok(issues.some(item => item.id === 'body-font'))
  assert.ok(issues.some(item => item.standard_ref))
  const fixed = applyFixes(model, rules, ['body-font', 'body-size'])
  assert.equal(fixed.paragraphs[1].font, '仿宋')
  assert.equal(fixed.page.widthMm, 200)
})

test('缺规则文种回退到通知规则', async () => {
  const rules = await loadRules(root, root, 'unknown_type_xyz')
  assert.ok(rules.check_rules?.length || rules.common)
})

test('坏文件和旧格式被拒绝', async () => {
  await assert.rejects(() => readDocx(Buffer.from('not a docx')), /docx/)
})

test('Markdown 生成可再次读取的 docx，并识别表格', async () => {
  const model = parseMarkdown('# 关于测试的通知\n各部门：\n请于今日完成。\n| 项目 | 进度 |\n| --- | --- |\n| A | 完成 |\n办公室\n2026年11月25日')
  assert.equal(model.tables.length, 1)
  assert.equal(model.tables[0].headers[0], '项目')
  const bytes = await writeDocx(model)
  const back = await readDocx(bytes)
  assert.equal(back.paragraphs[0].role, 'title')
  assert.equal(back.page.widthMm, 210)
})

test('语义校验发现错误文号括号', () => {
  const issues = checkSemantic({
    paragraphs: [{ role: 'body', text: '××发[2026]01号' }]
  })
  assert.ok(issues.some(item => item.id === 'CHK-S001'))
})

test('暗标扫描与脱敏', () => {
  const model = {
    paragraphs: [
      { role: 'body', text: '联系人手机 13800138000，邮箱 a@example.com' }
    ]
  }
  const hits = scanDarkBid(model)
  assert.ok(hits.some(item => item.type === 'mobile'))
  assert.ok(hits.some(item => item.type === 'email'))
  const { model: next } = redactDarkBid(model)
  assert.match(next.paragraphs[0].text, /\*/)
})

test('作业持久化', async () => {
  const data = await mkdtemp(join(tmpdir(), 'official-doc-job-'))
  await saveJob(data, { id: 'job-1', model: { paragraphs: [] }, type: 'notice', filename: 'a.docx' })
  const job = await loadJob(data, 'job-1')
  assert.equal(job.type, 'notice')
})

test('统计由历史聚合', async () => {
  const data = await mkdtemp(join(tmpdir(), 'official-doc-stats-'))
  await rememberDocument(data, { id: '1', name: 'a', type: 'notice', issues: 3, status: 'checked' })
  await rememberDocument(data, { id: '2', name: 'b', type: 'report', issues: 1, status: 'optimized' })
  const stats = await getStats(data)
  assert.equal(stats.documents, 2)
  assert.equal(stats.optimized, 1)
  assert.equal(stats.issues, 4)
})

test('格式提取生成 YAML', () => {
  const extracted = extractFormat({
    page: { widthMm: 210, heightMm: 297, top: 37, bottom: 35, left: 28, right: 26 },
    paragraphs: [
      { role: 'title', text: '标题', font: '黑体', size: 22, align: 'center' },
      { role: 'body', text: '正文', font: '仿宋', size: 16 }
    ]
  }, { name: '提取样例', id: 'extracted-demo' })
  assert.equal(extracted.id, 'extracted-demo')
  assert.match(extracted.rules, /title:/)
})

test('用户模板写入独立数据目录', async () => {
  const data = await mkdtemp(join(tmpdir(), 'official-doc-'))
  const saved = await saveTemplate(data, { name: 'custom', description: '单位模板', rules: 'name: 自定义\n' })
  const templates = await listTemplates(root, data)
  assert.ok(templates.some(item => item.id === saved.id && item.builtin === false))
  assert.equal(parseRules(await readFile(join(data, 'rules', 'custom.yaml'), 'utf8')).name, '自定义')
  await assert.rejects(() => saveTemplate(data, { name: 'bad', id: '../secret' }), /模板标识/)
})

test('规则合并保留两层检查项', () => {
  const merged = mergeRules({ check_rules: [{ id: 'a' }] }, { check_rules: [{ id: 'b' }] })
  assert.deepEqual(merged.check_rules.map(item => item.id), ['a', 'b'])
})

test('内置模板目录覆盖 22 文种', async () => {
  const templates = await listTemplates(root, root)
  assert.ok(templates.filter(item => item.builtin).length >= 22)
})
