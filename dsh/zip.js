import { deflateRawSync, inflateRawSync } from 'node:zlib'

const TABLE = new Uint32Array(256)
for (let index = 0; index < TABLE.length; index += 1) {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  TABLE[index] = value >>> 0
}

const EOCD = 0x06054b50
const CENTRAL = 0x02014b50
const LOCAL = 0x04034b50

export function createZip(entries, { dataDescriptor = false } = {}) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const [name, content] of entries) {
    const nameBytes = Buffer.from(name)
    const data = Buffer.from(content)
    const packed = deflateRawSync(data)
    const crc = crc32(data)
    const flags = 0x0800 | (dataDescriptor ? 0x0008 : 0)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(LOCAL, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(flags, 6)
    local.writeUInt16LE(8, 8)
    if (!dataDescriptor) {
      local.writeUInt32LE(crc, 14)
      local.writeUInt32LE(packed.length, 18)
      local.writeUInt32LE(data.length, 22)
    }
    local.writeUInt16LE(nameBytes.length, 26)
    locals.push(local, nameBytes, packed)
    if (dataDescriptor) {
      const descriptor = Buffer.alloc(16)
      descriptor.writeUInt32LE(0x08074b50, 0)
      descriptor.writeUInt32LE(crc, 4)
      descriptor.writeUInt32LE(packed.length, 8)
      descriptor.writeUInt32LE(data.length, 12)
      locals.push(descriptor)
    }
    const central = Buffer.alloc(46)
    central.writeUInt32LE(CENTRAL, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(flags, 8)
    central.writeUInt16LE(8, 10)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(packed.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBytes.length, 28)
    central.writeUInt32LE(offset, 42)
    centrals.push(central, nameBytes)
    offset += local.length + nameBytes.length + packed.length + (dataDescriptor ? 16 : 0)
  }
  return finishZip(locals, centrals, offset, entries.length)
}

export function readZipEntries(bytes) {
  const archive = parseZip(bytes)
  return new Map([...archive.entries].map(([name, entry]) => [name, readEntry(archive, entry)]))
}

export function replaceZipEntries(bytes, replacements) {
  const archive = parseZip(bytes)
  const locals = []
  const centrals = []
  let outputOffset = 0
  for (const entry of archive.entries.values()) {
    const replacement = replacements.get(entry.name)
    const localOffset = entry.localOffset
    const localNameLength = archive.input.readUInt16LE(localOffset + 26)
    const localExtraLength = archive.input.readUInt16LE(localOffset + 28)
    const localStart = localOffset + 30
    const dataStart = localStart + localNameLength + localExtraLength
    const originalLocalEnd = dataStart + entry.compressedSize
    const name = archive.input.subarray(localStart, localStart + localNameLength)
    let descriptorLength = entry.flags & 0x0008 ? descriptorSize(archive.input, originalLocalEnd) : 0
    if (entry.flags & 0x0008 && replacement) descriptorLength = 0
    const localExtra = archive.input.subarray(localStart + localNameLength, dataStart)
    const centralExtraStart = entry.centralOffset + 46 + entry.nameLength
    const centralExtra = archive.input.subarray(centralExtraStart, centralExtraStart + entry.extraLength)
    const commentStart = centralExtraStart + entry.extraLength
    const comment = archive.input.subarray(commentStart, commentStart + entry.commentLength)

    let localHeader
    let centralHeader
    let payload
    if (replacement) {
      const data = Buffer.from(replacement)
      const method = entry.method === 0 ? 0 : 8
      payload = method === 0 ? data : deflateRawSync(data)
      const crc = crc32(data)
      localHeader = Buffer.from(archive.input.subarray(localOffset, localStart))
      localHeader.writeUInt16LE((entry.flags | 0x0800) & ~0x0008, 6)
      localHeader.writeUInt16LE(method, 8)
      localHeader.writeUInt32LE(crc, 14)
      localHeader.writeUInt32LE(payload.length, 18)
      localHeader.writeUInt32LE(data.length, 22)
      centralHeader = Buffer.from(archive.input.subarray(entry.centralOffset, entry.centralOffset + 46))
      centralHeader.writeUInt16LE((entry.flags | 0x0800) & ~0x0008, 8)
      centralHeader.writeUInt16LE(method, 10)
      centralHeader.writeUInt32LE(crc, 16)
      centralHeader.writeUInt32LE(payload.length, 20)
      centralHeader.writeUInt32LE(data.length, 24)
    } else {
      localHeader = archive.input.subarray(localOffset, localStart)
      payload = archive.input.subarray(dataStart, originalLocalEnd + descriptorLength)
      centralHeader = Buffer.from(archive.input.subarray(entry.centralOffset, entry.centralOffset + 46))
    }
    const localOffsetOut = outputOffset
    locals.push(localHeader, name, localExtra, payload)
    outputOffset += localHeader.length + name.length + localExtra.length + payload.length
    centralHeader.writeUInt32LE(localOffsetOut, 42)
    centrals.push(centralHeader, name, centralExtra, comment)
  }
  const centralSize = centrals.reduce((sum, chunk) => sum + chunk.length, 0)
  return finishZip(locals, centrals, outputOffset, archive.entries.size, centralSize)
}

function finishZip(locals, centrals, offset, entryCount, knownCentralSize) {
  const centralSize = knownCentralSize ?? centrals.reduce((sum, chunk) => sum + chunk.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(EOCD, 0)
  end.writeUInt16LE(entryCount, 8)
  end.writeUInt16LE(entryCount, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, ...centrals, end])
}

function parseZip(bytes) {
  const input = Buffer.from(bytes)
  if (input.length < 22) throw new Error('不是有效的 docx/ZIP 文件')
  let end = -1
  for (let offset = input.length - 22; offset >= Math.max(0, input.length - 22 - 0xffff); offset -= 1) {
    if (input.readUInt32LE(offset) === EOCD) { end = offset; break }
  }
  if (end < 0) throw new Error('不是有效的 docx/ZIP 文件')
  const count = input.readUInt16LE(end + 10)
  const centralSize = input.readUInt32LE(end + 12)
  const centralEnd = input.readUInt32LE(end + 16) + centralSize
  let centralOffset = input.readUInt32LE(end + 16)
  const entries = new Map()
  for (let index = 0; index < count; index += 1) {
    if (centralOffset + 46 > input.length || input.readUInt32LE(centralOffset) !== CENTRAL) throw new Error('ZIP 中央目录损坏')
    const flags = input.readUInt16LE(centralOffset + 8)
    const method = input.readUInt16LE(centralOffset + 10)
    const crc = input.readUInt32LE(centralOffset + 16)
    const compressedSize = input.readUInt32LE(centralOffset + 20)
    const size = input.readUInt32LE(centralOffset + 24)
    const nameLength = input.readUInt16LE(centralOffset + 28)
    const extraLength = input.readUInt16LE(centralOffset + 30)
    const commentLength = input.readUInt16LE(centralOffset + 32)
    const localOffset = input.readUInt32LE(centralOffset + 42)
    const nameStart = centralOffset + 46
    const name = input.subarray(nameStart, nameStart + nameLength).toString(flags & 0x0800 ? 'utf8' : 'latin1')
    if (localOffset + 30 > input.length || input.readUInt32LE(localOffset) !== LOCAL) throw new Error(`ZIP 本地条目损坏：${name}`)
    entries.set(name, { name, flags, method, crc, compressedSize, size, localOffset, centralOffset, nameLength, extraLength, commentLength })
    centralOffset += 46 + nameLength + extraLength + commentLength
  }
  if (centralOffset > centralEnd) throw new Error('ZIP 中央目录越界')
  return { input, entries }
}

function descriptorSize(input, offset) {
  return input.readUInt32LE(offset) === 0x08074b50 ? 16 : 12
}

function readEntry(archive, entry) {
  const input = archive.input
  const nameLength = input.readUInt16LE(entry.localOffset + 26)
  const extraLength = input.readUInt16LE(entry.localOffset + 28)
  const start = entry.localOffset + 30 + nameLength + extraLength
  const packed = input.subarray(start, start + entry.compressedSize)
  let data
  if (entry.method === 0) data = Buffer.from(packed)
  else if (entry.method === 8) data = inflateRawSync(packed)
  else throw new Error(`不支持的 ZIP 压缩方式：${entry.method}`)
  if (data.length !== entry.size || crc32(data) !== entry.crc) throw new Error(`ZIP 条目校验失败：${entry.name}`)
  return data
}

export function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) crc = TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}