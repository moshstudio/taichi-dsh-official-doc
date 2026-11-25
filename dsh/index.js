import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readDocx, writeDocx } from './docx.js'
import { applyFixes, checkModel, detectType, parseMarkdown } from './rules.js'
import { listHistory, listTemplates, loadRules, rememberDocument, saveTemplate } from './store.js'

export const name = 'taichi-dsh-official-doc'
export const inject = ['webServer']
const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export function apply(ctx, config) {
  const root = typeof config?.root === 'string' ? config.root : join(PACKAGE_ROOT, 'data')
  const jobs = new Map()
  ctx.webServer.register({ method: 'POST', path: '/taichi-official-doc/check', handle: body => check(root, body, jobs) })
  ctx.webServer.register({ method: 'POST', path: '/taichi-official-doc/fix', handle: body => fix(root, body, jobs) })
  ctx.webServer.register({ method: 'POST', path: '/taichi-official-doc/markdown', handle: body => markdown(body) })
  ctx.webServer.register({ method: 'GET', path: '/taichi-official-doc/templates', handle: () => listTemplates(PACKAGE_ROOT, root) })
  ctx.webServer.register({ method: 'POST', path: '/taichi-official-doc/templates', handle: body => saveTemplate(root, body) })
  ctx.webServer.register({ method: 'GET', path: '/taichi-official-doc/history', handle: () => listHistory(root) })
}

async function check(root, body, jobs) {
  const model = await modelFrom(body)
  const type = body?.type || detectType(body?.filename)
  const rules = await loadRules(PACKAGE_ROOT, root, type)
  const issues = checkModel(model, rules)
  const id = `${Date.now()}-${jobs.size}`
  jobs.set(id, { model, type, filename: body?.filename || '公文.docx' })
  await rememberDocument(root, { id, name: body?.filename || '未命名', type, issues: issues.length })
  return { id, type, issues }
}

async function fix(root, body, jobs) {
  const job = jobs.get(body?.id)
  if (!job) throw new Error('请先完成校审')
  const rules = await loadRules(PACKAGE_ROOT, root, job.type)
  const fixed = applyFixes(job.model, rules, Array.isArray(body?.issues) ? body.issues : null)
  return { filename: job.filename.replace(/\.docx$/i, '') + '-已修复.docx', bytes: await writeDocx(fixed) }
}

async function markdown(body) {
  const text = String(body?.markdown ?? '')
  if (!text.trim()) throw new Error('Markdown 不能为空')
  const model = parseMarkdown(text, body?.type || 'notice')
  return { model, bytes: await writeDocx(model) }
}

async function modelFrom(body) {
  if (body?.markdown) return parseMarkdown(body.markdown, body.type)
  if (!body?.bytes) throw new Error('请上传 docx')
  const name = String(body.filename ?? '')
  if (/\.(doc|wps)$/i.test(name)) throw new Error('第一版只接收 docx')
  return readDocx(body.bytes)
}