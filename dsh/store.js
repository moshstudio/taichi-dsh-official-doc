import { readFile, readdir, mkdir, writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { mergeRules, parseRules } from './rules.js'
import { DOCUMENT_TYPES, listTypes } from './types.js'

export async function loadRules(packageRoot, dataRoot, type) {
  const common = parseRules(await readFile(join(packageRoot, 'rules', '_common.yaml'), 'utf8'))
  let id = 'notice'
  try { id = safeId(type || 'notice') } catch { id = 'notice' }
  const officialPath = join(packageRoot, 'rules', `${id}.yaml`)
  const userPath = join(dataRoot, 'rules', `${id}.yaml`)
  const specificText = await readOptional(userPath) ?? await readOptional(officialPath)
  if (!specificText) {
    const fallback = await readOptional(join(packageRoot, 'rules', 'notice.yaml'))
    if (!fallback) throw new Error(`没有${type}的规则`)
    return mergeRules(common, parseRules(fallback))
  }
  return mergeRules(common, parseRules(specificText))
}

export async function listTemplates(packageRoot, dataRoot) {
  const builtin = JSON.parse(await readFile(join(packageRoot, 'templates', 'catalog.json'), 'utf8'))
  const user = await readJson(join(dataRoot, 'templates.json'), [])
  return [...builtin, ...user]
}

export async function saveTemplate(dataRoot, input) {
  const name = String(input?.name ?? '').trim()
  const id = normalizeId(input?.id, name)
  if (!name || !id) throw new Error('模板需要名称')
  const file = join(dataRoot, 'templates.json')
  const templates = await readJson(file, [])
  if (templates.some(item => item.id === id)) throw new Error('模板已存在')
  const template = {
    id,
    name,
    description: String(input.description ?? ''),
    category: String(input.category ?? '自定义'),
    builtin: false
  }
  await mkdir(dataRoot, { recursive: true })
  await writeFile(file, JSON.stringify([...templates, template], null, 2))
  if (input.rules) {
    await mkdir(join(dataRoot, 'rules'), { recursive: true })
    await writeFile(join(dataRoot, 'rules', `${id}.yaml`), String(input.rules))
  }
  return template
}

export async function updateTemplateRules(packageRoot, dataRoot, id, rulesText) {
  const tid = safeId(id)
  const templates = await listTemplates(packageRoot, dataRoot)
  if (!templates.some(item => item.id === tid)) throw new Error('模板不存在')
  await mkdir(join(dataRoot, 'rules'), { recursive: true })
  await writeFile(join(dataRoot, 'rules', `${tid}.yaml`), String(rulesText ?? ''))
  return { id: tid, saved: true }
}

export async function deleteUserTemplate(dataRoot, id) {
  const tid = safeId(id)
  const file = join(dataRoot, 'templates.json')
  const templates = await readJson(file, [])
  const next = templates.filter(item => item.id !== tid)
  if (next.length === templates.length) throw new Error('只能删除自定义模板')
  await writeFile(file, JSON.stringify(next, null, 2))
  try { await unlink(join(dataRoot, 'rules', `${tid}.yaml`)) } catch { /* optional */ }
  return { id: tid, deleted: true }
}

export async function listHistory(dataRoot) {
  return readJson(join(dataRoot, 'history.json'), [])
}

export async function rememberDocument(dataRoot, entry) {
  const file = join(dataRoot, 'history.json')
  const history = await readJson(file, [])
  const item = {
    id: entry.id,
    name: entry.name,
    type: entry.type,
    status: entry.status || 'checked',
    issues: entry.issues ?? entry.issueCount ?? 0,
    issueCount: entry.issues ?? entry.issueCount ?? 0,
    at: new Date().toISOString()
  }
  const next = [item, ...history.filter(row => row.id !== item.id)].slice(0, 50)
  await mkdir(dataRoot, { recursive: true })
  await writeFile(file, JSON.stringify(next, null, 2))
  return next
}

export async function updateHistoryStatus(dataRoot, id, status, extras = {}) {
  const file = join(dataRoot, 'history.json')
  const history = await readJson(file, [])
  const next = history.map(item => item.id === id ? { ...item, status, ...extras, at: new Date().toISOString() } : item)
  await writeFile(file, JSON.stringify(next, null, 2))
  return next
}

export async function getStats(dataRoot) {
  const history = await listHistory(dataRoot)
  return {
    documents: history.length,
    checks: history.filter(item => ['checked', 'optimized'].includes(item.status) || item.issues != null).length,
    issues: history.reduce((sum, item) => sum + Number(item.issueCount ?? item.issues ?? 0), 0),
    optimized: history.filter(item => item.status === 'optimized').length
  }
}

export async function availableRuleCount(packageRoot) {
  const names = await readdir(join(packageRoot, 'rules'))
  return names.filter(name => name.endsWith('.yaml') && !name.startsWith('_')).length
}

export async function saveJob(dataRoot, job) {
  const dir = join(dataRoot, 'jobs')
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, `${safeJobId(job.id)}.json`), JSON.stringify(job))
  return job
}

export async function loadJob(dataRoot, id) {
  const job = await readJson(join(dataRoot, 'jobs', `${safeJobId(id)}.json`), null)
  if (!job) throw new Error('请先完成校审')
  return job
}

export function documentTypeList() {
  return listTypes()
}

export function builtinCatalogFromTypes() {
  return DOCUMENT_TYPES.map(item => ({
    id: item.id,
    name: item.name,
    description: item.description,
    category: item.category,
    builtin: true
  }))
}

async function readOptional(file) {
  try { return await readFile(file, 'utf8') } catch { return null }
}

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')) } catch { return fallback }
}

function normalizeId(id, name) {
  const raw = String(id ?? '').trim().toLowerCase()
  if (raw) return safeId(raw)
  const fromName = String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (fromName && /^[a-z0-9_-]+$/.test(fromName)) return fromName
  return `tpl-${Date.now().toString(36)}`
}

function safeId(value) {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!/^[a-z0-9_-]+$/.test(raw)) throw new Error('模板标识不正确')
  return raw
}

function safeJobId(value) {
  const raw = String(value ?? '').trim()
  if (!/^[a-zA-Z0-9._-]+$/.test(raw)) throw new Error('作业标识不正确')
  return raw
}
