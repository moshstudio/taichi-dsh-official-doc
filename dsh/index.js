import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { readDocx, writeDocx } from './docx.js'
import { applyFixes, checkModel, detectType, parseMarkdown, sampleModel } from './rules.js'
import { scanDarkBid, redactDarkBid } from './dark-bid.js'
import { extractFormat } from './format-extract.js'
import {
  availableRuleCount,
  deleteUserTemplate,
  documentTypeList,
  getStats,
  listHistory,
  listTemplates,
  loadJob,
  loadRules,
  rememberDocument,
  saveJob,
  saveTemplate,
  updateHistoryStatus,
  updateTemplateRules
} from './store.js'

export const name = 'taichi-dsh-official-doc'
export const inject = ['connection']
const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export function apply(ctx, config) {
  const root = typeof config?.root === 'string' ? config.root : join(PACKAGE_ROOT, 'data')
  const routes = [
    ['POST', '/api/plugin/taichi_official_doc/check', (body) => check(root, body)],
    ['GET', '/api/plugin/taichi_official_doc/job', (_body, request) => getJob(root, request)],
    ['POST', '/api/plugin/taichi_official_doc/fix', (body) => fix(root, body)],
    ['POST', '/api/plugin/taichi_official_doc/dark-bid', (body) => darkBid(root, body)],
    ['POST', '/api/plugin/taichi_official_doc/dark-bid/redact', (body) => darkBidRedact(root, body)],
    ['POST', '/api/plugin/taichi_official_doc/markdown', (body) => markdownDownload(body)],
    ['POST', '/api/plugin/taichi_official_doc/markdown/preview', (body) => markdownPreview(body)],
    ['POST', '/api/plugin/taichi_official_doc/markdown/download', (body) => markdownDownload(body)],
    ['GET', '/api/plugin/taichi_official_doc/templates', () => listTemplates(PACKAGE_ROOT, root)],
    ['POST', '/api/plugin/taichi_official_doc/templates/save', (body) => saveTemplate(root, body)],
    ['POST', '/api/plugin/taichi_official_doc/templates/create', (body) => saveTemplate(root, body)],
    ['POST', '/api/plugin/taichi_official_doc/templates/extract', (body) => extractTemplate(body)],
    ['POST', '/api/plugin/taichi_official_doc/templates/apply', (body) => applyTemplate(PACKAGE_ROOT, root, body)],
    ['POST', '/api/plugin/taichi_official_doc/templates/rules', (body) => updateTemplateRules(PACKAGE_ROOT, root, body?.id, body?.rules)],
    ['POST', '/api/plugin/taichi_official_doc/templates/delete', (body) => deleteUserTemplate(root, body?.id)],
    ['GET', '/api/plugin/taichi_official_doc/history', () => listHistory(root)],
    ['GET', '/api/plugin/taichi_official_doc/stats', () => getStats(root)],
    ['GET', '/api/plugin/taichi_official_doc/types', () => documentTypeList()],
    ['GET', '/api/plugin/taichi_official_doc/meta', async () => ({
      version: JSON.parse(await readFile(join(PACKAGE_ROOT, 'package.json'), 'utf8')).version,
      rules: await availableRuleCount(PACKAGE_ROOT)
    })],
    ['GET', '/api/plugin/taichi_official_doc/preview', (_body, request) => previewJob(root, request)]
  ]
  for (const [method, path, handle] of routes) {
    ctx.connection.fetch.register({
      path,
      methods: [method],
      requestBody: 'buffered',
      async fetch(request) {
        try {
          const body = method === 'GET' ? undefined : await readBody(request)
          const payload = await handle(body, request)
          return Response.json(payload, { headers: { 'cache-control': 'no-store' } })
        } catch (error) {
          const message = error instanceof Error ? error.message : '处理失败'
          return Response.json({ error: message }, { status: 400, headers: { 'cache-control': 'no-store' } })
        }
      }
    })
  }
}

async function readBody(request) {
  if (!request?.json) return undefined
  try { return await request.json() } catch { return undefined }
}

function queryId(request) {
  try {
    return new URL(request.url, 'http://local').searchParams.get('id')
  } catch {
    return null
  }
}

async function check(root, body) {
  const type = body?.type || detectType(body?.filename)
  const model = await modelFrom(body)
  model.type = type
  model.meta = { ...(model.meta ?? {}), type, layoutProfile: model.meta?.layoutProfile || 'formal' }
  const rules = await loadRules(PACKAGE_ROOT, root, type)
  const issues = checkModel(model, rules)
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await saveJob(root, { id, model, type, filename: body?.filename || '公文.docx', issues })
  await rememberDocument(root, { id, name: body?.filename || '未命名', type, issues: issues.length, status: 'checked' })
  return { id, type, issues, model: previewDto(model) }
}

async function getJob(root, request) {
  const id = queryId(request)
  if (!id) throw new Error('缺少作业 id')
  const job = await loadJob(root, id)
  return { id: job.id, type: job.type, filename: job.filename, issues: job.issues ?? checkModel(job.model, await loadRules(PACKAGE_ROOT, root, job.type)), model: previewDto(job.model) }
}

async function previewJob(root, request) {
  const id = queryId(request)
  if (!id) throw new Error('缺少作业 id')
  const job = await loadJob(root, id)
  return previewDto(job.model)
}

async function fix(root, body) {
  const job = await loadJob(root, body?.id)
  const rules = await loadRules(PACKAGE_ROOT, root, job.type)
  const fixed = applyFixes(job.model, rules, Array.isArray(body?.issues) ? body.issues : null)
  await saveJob(root, { ...job, model: fixed, issues: checkModel(fixed, rules) })
  await updateHistoryStatus(root, job.id, 'optimized')
  return {
    filename: String(job.filename || '公文.docx').replace(/\.docx$/i, '') + '-已修复.docx',
    bytes: await writeDocx(fixed),
    model: previewDto(fixed)
  }
}

async function darkBid(root, body) {
  const model = body?.id ? (await loadJob(root, body.id)).model : await modelFrom(body)
  return { hits: scanDarkBid(model) }
}

async function darkBidRedact(root, body) {
  const job = body?.id ? await loadJob(root, body.id) : null
  const model = job?.model ?? await modelFrom(body)
  const { model: next, hits } = redactDarkBid(model, body?.selected)
  if (job) await saveJob(root, { ...job, model: next })
  return {
    hits,
    filename: String(job?.filename || body?.filename || '公文.docx').replace(/\.docx$/i, '') + '-已脱敏.docx',
    bytes: await writeDocx(next),
    model: previewDto(next)
  }
}

function markdownPreview(body) {
  const text = String(body?.markdown ?? '')
  if (!text.trim()) throw new Error('Markdown 不能为空')
  const model = parseMarkdown(text, body?.type || 'notice')
  return { model: previewDto(model) }
}

async function markdownDownload(body) {
  const text = String(body?.markdown ?? '')
  if (!text.trim() && !body?.model) throw new Error('Markdown 不能为空')
  const model = body?.model ? hydrateModel(body.model) : parseMarkdown(text, body?.type || 'notice')
  return {
    model: previewDto(model),
    filename: `${typeLabel(body?.type || model.type)}-草稿.docx`,
    bytes: await writeDocx(model)
  }
}

async function extractTemplate(body) {
  const model = await modelFrom(body)
  return extractFormat(model, { name: body?.name, id: body?.id, description: body?.description })
}

async function applyTemplate(packageRoot, dataRoot, body) {
  const id = body?.id || 'notice'
  const templates = await listTemplates(packageRoot, dataRoot)
  const meta = templates.find(item => item.id === id) || { id, name: id }
  let model
  try {
    const rules = await loadRules(packageRoot, dataRoot, id)
    model = sampleModel(id, `${meta.name}（示例）`)
    model = applyFixes(model, rules)
  } catch {
    model = sampleModel(id, `${meta.name}（示例）`)
  }
  return {
    filename: `${meta.name || id}-模板.docx`,
    bytes: await writeDocx(model),
    model: previewDto(model)
  }
}

async function modelFrom(body) {
  if (body?.model) return hydrateModel(body.model)
  if (body?.markdown) return parseMarkdown(body.markdown, body.type)
  if (!body?.bytes) throw new Error('请上传 docx')
  const name = String(body.filename ?? '')
  if (/\.(doc|wps)$/i.test(name)) throw new Error('请先另存为 .docx 后再上传（本插件不内嵌 doc/wps 转换）')
  return readDocx(body.bytes)
}

function hydrateModel(model) {
  return {
    type: model.type,
    page: model.page,
    paragraphs: model.paragraphs ?? [],
    tables: model.tables ?? [],
    meta: model.meta ?? { type: model.type }
  }
}

function previewDto(model) {
  return {
    type: model.type,
    page: model.page,
    paragraphs: model.paragraphs ?? [],
    tables: model.tables ?? [],
    meta: model.meta ?? {}
  }
}

function typeLabel(type) {
  return documentTypeList().find(item => item.id === type)?.name || '公文'
}
