import { inflateRawSync, deflateRawSync } from 'node:zlib'

export async function readDocx(bytes) {
  const files = unzip(bytes)
  const xml = files.get('word/document.xml')
  if (!xml) throw new Error('docx 中没有正文')
  const text = decoder().decode(xml)
  const sect = text.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/)?.[0] ?? ''
  return {
    page: {
      widthMm: twipToMm(attr(sect, 'w:pgSz', 'w:w')),
      heightMm: twipToMm(attr(sect, 'w:pgSz', 'w:h')),
      top: twipToMm(attr(sect, 'w:pgMar', 'w:top')),
      bottom: twipToMm(attr(sect, 'w:pgMar', 'w:bottom')),
      left: twipToMm(attr(sect, 'w:pgMar', 'w:left')),
      right: twipToMm(attr(sect, 'w:pgMar', 'w:right'))
    },
    paragraphs: [...text.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map(match => readParagraph(match[0])).filter(item => item.text),
    tables: [],
    meta: {}
  }
}

export async function writeDocx(model) {
  const page = model.page ?? {}
  const files = new Map([
    ['[Content_Types].xml', contentTypes()],
    ['_rels/.rels', rootRels()],
    ['word/document.xml', documentXml(model.paragraphs ?? [], page, model.tables ?? [])],
    ['word/_rels/document.xml.rels', documentRels()]
  ])
  return zip(files)
}

function readParagraph(xml) {
  const text = [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map(item => decodeXml(item[1])).join('')
  const font = attr(xml, 'w:rFonts', 'w:eastAsia') || attr(xml, 'w:rFonts', 'w:ascii') || ''
  const size = Number(attr(xml, 'w:sz', 'w:val') || 0) / 2
  const align = attr(xml, 'w:jc', 'w:val') || 'left'
  const indent = Number(attr(xml, 'w:ind', 'w:firstLine') || 0)
  return {
    role: inferRole(text, align, size),
    text,
    font,
    size,
    align,
    firstLineIndent: indent ? Math.round(indent / 480) : 0,
    lineSpacing: Number(attr(xml, 'w:spacing', 'w:line') || 0) / 20 || undefined
  }
}

function inferRole(text, align, size) {
  if (align === 'center' && size >= 22) return 'title'
  if (/：$/.test(text)) return 'recipient'
  if (/\d{4}年\d{1,2}月\d{1,2}日$/.test(text)) return 'date'
  if (align === 'right') return 'signature'
  return 'body'
}

function unzip(bytes) {
  const input = Buffer.from(bytes)
  if (input.length < 22 || input.readUInt32LE(0) !== 0x04034b50) throw new Error('文件不是有效的 docx')
  const files = new Map()
  let offset = 0
  while (offset + 30 <= input.length && input.readUInt32LE(offset) === 0x04034b50) {
    const method = input.readUInt16LE(offset + 8)
    const compressedSize = input.readUInt32LE(offset + 18)
    const nameLength = input.readUInt16LE(offset + 26)
    const extraLength = input.readUInt16LE(offset + 28)
    const start = offset + 30 + nameLength + extraLength
    const name = input.subarray(offset + 30, offset + 30 + nameLength).toString('utf8')
    const data = input.subarray(start, start + compressedSize)
    files.set(name, method === 0 ? Buffer.from(data) : inflateRawSync(data))
    offset = start + compressedSize
  }
  return files
}

function zip(files) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const [name, content] of files) {
    const data = Buffer.from(content)
    const compressed = deflateRawSync(data)
    const nameBytes = Buffer.from(name)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(8, 8)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    locals.push(local, nameBytes, compressed)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(8, 10)
    central.writeUInt32LE(compressed.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBytes.length, 28)
    central.writeUInt32LE(offset, 42)
    centrals.push(central, nameBytes)
    offset += local.length + nameBytes.length + compressed.length
  }
  const centralSize = centrals.reduce((sum, item) => sum + item.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(files.size, 8)
  end.writeUInt16LE(files.size, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, ...centrals, end])
}

function documentXml(paragraphs, page, tables = []) {
  const body = paragraphs.map(paragraph => {
    if (paragraph.tableIndex != null && tables[paragraph.tableIndex]) {
      return tableXml(tables[paragraph.tableIndex])
    }
    const indent = paragraph.firstLineIndent
      ? `<w:ind w:firstLine="${Math.round(Number(paragraph.firstLineIndent) * 480)}"/>`
      : ''
    const spacing = paragraph.line
      ? `<w:spacing w:line="${Math.round(Number(paragraph.line) * 20)}" w:lineRule="exact"/>`
      : ''
    return `
    <w:p><w:pPr><w:jc w:val="${escapeXml(paragraph.align || 'left')}"/>${indent}${spacing}</w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="${escapeXml(paragraph.font || '仿宋')}" w:hAnsi="${escapeXml(paragraph.font || '仿宋')}" w:eastAsia="${escapeXml(paragraph.font || '仿宋')}" w:cs="${escapeXml(paragraph.font || '仿宋')}"/>
    <w:sz w:val="${Math.round((paragraph.size || 16) * 2)}"/><w:szCs w:val="${Math.round((paragraph.size || 16) * 2)}"/></w:rPr>
    <w:t xml:space="preserve">${escapeXml(paragraph.text || '')}</w:t></w:r></w:p>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}
    <w:sectPr><w:pgSz w:w="${mmToTwip(page.widthMm)}" w:h="${mmToTwip(page.heightMm)}"/>
    <w:pgMar w:top="${mmToTwip(page.top)}" w:bottom="${mmToTwip(page.bottom)}" w:left="${mmToTwip(page.left)}" w:right="${mmToTwip(page.right)}"/>
    </w:sectPr></w:body></w:document>`
}

function tableXml(table) {
  const rows = [table.headers ?? [], ...(table.rows ?? [])]
  const tr = rows.map(row => `<w:tr>${(row.length ? row : ['']).map(cell =>
    `<w:tc><w:p><w:r><w:t xml:space="preserve">${escapeXml(cell)}</w:t></w:r></w:p></w:tc>`
  ).join('')}</w:tr>`).join('')
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr>${tr}</w:tbl>`
}

function documentRels() {
  return `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`
}
function contentTypes() {
  return `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
}
function rootRels() {
  return `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
}
function attr(xml, tag, name) {
  return (xml.match(new RegExp(`<${tag}\\b[^>]*>`))?.[0] ?? '').match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? ''
}
function twipToMm(value) { return value ? Math.round(Number(value) / 56.7) : 0 }
function mmToTwip(value) { return Math.round((Number(value) || 0) * 56.7) }
function escapeXml(value) { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]) }
function decodeXml(value) { return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&') }
function decoder() { return new TextDecoder('utf-8') }