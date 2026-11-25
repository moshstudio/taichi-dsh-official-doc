import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { applyFixes, checkModel, detectType, mergeRules, parseMarkdown, parseRules } from '../dsh/rules.js'
import { readDocx, writeDocx } from '../dsh/docx.js'
import { listTemplates, loadRules, saveTemplate } from '../dsh/store.js'

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))

test('文件名识别文种', () => {
  assert.equal(detectType('年度工作报告.docx'), 'report')
  assert.equal(detectType('未命名.docx'), 'notice')
})

test('规则能发现并修复正文和页面', async () => {
  const rules = await loadRules(root, root, 'notice')
  const model = { page: { widthMm: 200, heightMm: 300, top: 20, bottom: 20, left: 20, right: 20 }, paragraphs: [
    { role: 'title', text: '通知', font: '宋体', size: 16, align: 'left' },
    { role: 'body', text: '正文', font: '宋体', size: 12, align: 'left' }
  ] }
  const issues = checkModel(model, rules)
  assert.ok(issues.some(item => item.id === 'body-font'))
  const fixed = applyFixes(model, rules, ['body-font', 'body-size'])
  assert.equal(fixed.paragraphs[1].font, '仿宋')
  assert.equal(fixed.page.widthMm, 200)
})

test('坏文件和旧格式被拒绝', async () => {
  await assert.rejects(() => readDocx(Buffer.from('not a docx')), /docx/)
})

test('Markdown 生成可再次读取的 docx', async () => {
  const model = parseMarkdown('# 关于测试的通知\n各部门：\n请于今日完成。\n办公室\n2026年11月25日')
  const bytes = await writeDocx(model)
  const back = await readDocx(bytes)
  assert.equal(back.paragraphs[0].role, 'title')
  assert.equal(back.page.widthMm, 210)
})

test('用户模板写入独立数据目录', async () => {
  const data = await mkdtemp(join(tmpdir(), 'official-doc-'))
  const saved = await saveTemplate(data, { name: 'custom', description: '单位模板', rules: 'name: 自定义\n' })
  const templates = await listTemplates(root, data)
  assert.ok(templates.some(item => item.id === saved.id && item.builtin === false))
  assert.equal(parseRules(await readFile(join(data, 'rules', 'custom.yaml'), 'utf8')).name, '自定义')
  await assert.rejects(() => saveTemplate(data, { name: '../secret' }), /模板标识/)
})

test('规则合并保留两层检查项', () => {
  const merged = mergeRules({ check_rules: [{ id: 'a' }] }, { check_rules: [{ id: 'b' }] })
  assert.deepEqual(merged.check_rules.map(item => item.id), ['a', 'b'])
})