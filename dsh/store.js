import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { mergeRules, parseRules } from './rules.js'

export async function loadRules(packageRoot, dataRoot, type) {
  const common = parseRules(await readFile(join(packageRoot, 'rules', '_common.yaml'), 'utf8'))
  const officialPath = join(packageRoot, 'rules', `${safeId(type)}.yaml`)
  const userPath = join(dataRoot, 'rules', `${safeId(type)}.yaml`)
  const specific = await readOptional(userPath) ?? await readOptional(officialPath)
  if (!specific) throw new Error(`没有${type}的规则`)
  return mergeRules(common, parseRules(specific))
}

export async function listTemplates(packageRoot, dataRoot) {
  const builtin = JSON.parse(await readFile(join(packageRoot, 'templates', 'catalog.json'), 'utf8'))
  const user = await readJson(join(dataRoot, 'templates.json'), [])
  return [...builtin, ...user]
}

export async function saveTemplate(dataRoot, input) {
  const name = String(input?.name ?? '').trim()
  const id = safeId(input?.id || name)
  if (!name || !id) throw new Error('模板需要名称')
  const file = join(dataRoot, 'templates.json')
  const templates = await readJson(file, [])
  if (templates.some(item => item.id === id)) throw new Error('模板已存在')
  const template = { id, name, description: String(input.description ?? ''), builtin: false }
  await mkdir(dataRoot, { recursive: true })
  await writeFile(file, JSON.stringify([...templates, template], null, 2))
  if (input.rules) {
    await mkdir(join(dataRoot, 'rules'), { recursive: true })
    await writeFile(join(dataRoot, 'rules', `${id}.yaml`), String(input.rules))
  }
  return template
}

export async function listHistory(dataRoot) {
  return readJson(join(dataRoot, 'history.json'), [])
}

export async function rememberDocument(dataRoot, entry) {
  const file = join(dataRoot, 'history.json')
  const history = await readJson(file, [])
  const next = [{ ...entry, at: new Date().toISOString() }, ...history].slice(0, 20)
  await mkdir(dataRoot, { recursive: true })
  await writeFile(file, JSON.stringify(next, null, 2))
  return next
}

export async function availableRuleCount(packageRoot) {
  const names = await readdir(join(packageRoot, 'rules'))
  return names.filter(name => name.endsWith('.yaml') && !name.startsWith('_')).length
}

async function readOptional(file) {
  try { return await readFile(file, 'utf8') } catch { return null }
}

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')) } catch { return fallback }
}

function safeId(value) {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!/^[a-z0-9_-]+$/.test(raw)) throw new Error('模板标识不正确')
  return raw
}