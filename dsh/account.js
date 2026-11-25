import { readFile, mkdir, writeFile, rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'

export const ACTIONS = {
  polish: 1,
  deai: 1,
  analyze: 2,
  draft: 2
}

const DEFAULT_GRANT = 20

export async function loadAccount(dataRoot) {
  const file = join(dataRoot, 'account.json')
  const stored = await readJson(file)
  return {
    name: stored?.name || '本地账号',
    balance: Number.isFinite(stored?.balance) ? stored.balance : DEFAULT_GRANT,
    ledger: Array.isArray(stored?.ledger) ? stored.ledger.slice(0, 20) : []
  }
}

export async function chargeAccount(dataRoot, action) {
  const cost = ACTIONS[action]
  if (!cost) throw new Error('未知的积分操作')
  const account = await loadAccount(dataRoot)
  if (account.balance < cost) throw new Error(`积分不足，需要 ${cost}，剩余 ${account.balance}`)
  const next = {
    ...account,
    balance: account.balance - cost,
    ledger: [{ action, cost, at: new Date().toISOString() }, ...account.ledger].slice(0, 20)
  }
  await writeAccount(dataRoot, next)
  return { balance: next.balance, cost }
}

export async function refundAccount(dataRoot, action) {
  const cost = ACTIONS[action]
  if (!cost) throw new Error('未知的积分操作')
  const account = await loadAccount(dataRoot)
  const next = {
    ...account,
    balance: account.balance + cost,
    ledger: [{ action, cost: -cost, at: new Date().toISOString() }, ...account.ledger].slice(0, 20)
  }
  await writeAccount(dataRoot, next)
  return { balance: next.balance, refunded: cost }
}

async function writeAccount(dataRoot, account) {
  await mkdir(dataRoot, { recursive: true })
  const target = join(dataRoot, 'account.json')
  const temporary = `${target}.${process.pid}.tmp`
  await writeFile(temporary, JSON.stringify(account))
  try {
    await rename(temporary, target)
  } catch (error) {
    await unlink(temporary).catch(() => {})
    throw error
  }
}

async function readJson(file) {
  try { return JSON.parse(await readFile(file, 'utf8')) } catch { return null }
}