import { createZip, readZipEntries, replaceZipEntries } from './zip.js'
import { inferRole } from './roles.js'

export async function readDocx(bytes) {
  const entries = readZipEntries(bytes)
  const xmlBytes = entries.get('word/document.xml')
  if (!xmlBytes) throw new Error('docx 文件没有正文 XML')
  const xml = decoder().decode(xmlBytes)
  const section = xml.match(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/)?.[0] ?? ''
  const paragraphsXml = blocksOutsideTables(xml, /<w:p\b[\s\S]*?<\/w:p>/g)
  const paragraphs = paragraphsXml.map((paragraphXml, index) => ({ ...readParagraph(paragraphXml), id: `p${index}` }))
  const page = {
    widthMm: twipToMm(attr(section, 'w:pgSz', 'w:w')),
    heightMm: twipToMm(attr(section, 'w:pgSz', 'w:h')),
    top: twipToMm(attr(section, 'w:pgMar', 'w:top')),
    bottom: twipToMm(attr(section, 'w:pgMar', 'w:bottom')),
    left: twipToMm(attr(section, 'w:pgMar', 'w:left')),
    right: twipToMm(attr(section, 'w:pgMar', 'w:right'))
  }
  const originalParagraphs = paragraphs.map(({ xmlOriginal, original, id }) => ({ id, xml: xmlOriginal, original }))
  return {
    page,
    paragraphs: paragraphs.map(({ xmlOriginal, original, ...paragraph }) => paragraph),
    tables: readTables(xml),
    meta: {
      source: 'docx',
      originalPage: page,
      originalParagraphs: paragraphs.map(({ xmlOriginal, original, id }) => ({ id, xml: xmlOriginal, original }))
    }
  }
}

export async function writeDocx(model) {
  const prepared = applyDocumentParts(model)
  const sourceBytes = prepared?.meta?.sourceBytes
  if (sourceBytes) return patchDocx(Buffer.from(sourceBytes, 'base64'), prepared)
  const body = [
    (prepared.paragraphs ?? []).map(writeParagraph).join(''),
    (prepared.tables ?? []).map(writeTable).join(''),
    writeSection(prepared.page ?? {}, prepared.meta?.parts ?? [])
  ].join('')
  const entries = [
    ['[Content_Types].xml', contentTypes(prepared.meta?.parts ?? [])],
    ['_rels/.rels', rootRels()],
    ['word/document.xml', documentXml(body)],
    ['word/_rels/document.xml.rels', documentRels(prepared.meta?.parts ?? [])],
    ...(prepared.meta?.parts ?? [])
  ]
  return createZip(entries)
}

export async function patchDocx(bytes, model) {
  const entries = readZipEntries(bytes)
  const source = entries.get('word/document.xml')
  if (!source) throw new Error('docx 中没有正文')
  const xml = decoder().decode(source)
  return replaceZipEntries(bytes, new Map([['word/document.xml', Buffer.from(patchDocumentXml(xml, model))]]))
}

function blocksOutsideTables(xml, expression) {
  const withoutTables = xml.replace(/<w:tbl\b[\s\S]*?<\/w:tbl>/g, table => ' '.repeat(table.length))
  return [...withoutTables.matchAll(expression)].map(match => match[0])
}

function readParagraph(xml) {
  const text = [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map(match => decodeXml(match[1])).join('')
  const font = attr(xml, 'w:rFonts', 'w:eastAsia') || attr(xml, 'w:rFonts', 'w:ascii') || ''
  const size = Number(attr(xml, 'w:sz', 'w:val') || 0) / 2
  const align = attr(xml, 'w:jc', 'w:val') || 'left'
  const indent = Number(attr(xml, 'w:ind', 'w:firstLine') || 0)
  const roleInfo = inferRole(text, align, size)
  return {
    role: roleInfo.role, level: roleInfo.level, text, font, size, align,
    firstLineIndent: indent ? Math.round(indent / 480) : 0,
    lineSpacing: Number(attr(xml, 'w:spacing', 'w:line') || 0) / 20 || undefined,
    xmlOriginal: xml,
    original: { text, font, size, align, firstLineIndent: indent ? Math.round(indent / 480) : 0 }
  }
}

function readTables(xml) {
  return [...xml.matchAll(/<w:tbl\b[\s\S]*?<\/w:tbl>/g)].map(match => readTable(match[0]))
}

function readTable(xml) {
  const rows = [...xml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].map(row =>
    [...row[0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)].map(cell =>
      [...cell[0].matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map(text => decodeXml(text[1])).join('')
    )
  )
  return { headers: rows[0] ?? [], rows: rows.slice(1) }
}

function patchDocumentXml(xml, model) {
  const paragraphById = new Map((model.paragraphs ?? []).map(item => [item.id, item]))
  const originalById = new Map((model.meta?.originalParagraphs ?? []).map(item => [item.id, item]))
  const tables = model.tables ?? []
  let paragraphIndex = 0
  let tableIndex = 0
  let output = ''
  let offset = 0
  for (const table of xml.matchAll(/<w:tbl\b[\s\S]*?<\/w:tbl>/g)) {
    output += patchParagraphs(xml.slice(offset, table.index), paragraphById, originalById, () => paragraphIndex++)
    output += patchTable(table[0], tables[tableIndex] ?? readTable(table[0]))
    tableIndex += 1
    offset = table.index + table[0].length
  }
  output += patchParagraphs(xml.slice(offset), paragraphById, originalById, () => paragraphIndex++)
  return output
}

function patchParagraphs(xml, paragraphs, originals, nextIndex) {
  return xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, paragraphXml => {
    const id = `p${nextIndex()}`
    const paragraph = paragraphs.get(id)
    const original = originals.get(id)?.original
    return paragraph && original ? patchParagraph(paragraphXml, paragraph, original) : paragraphXml
  })
}

function patchParagraph(xml, paragraph, original) {
  let next = xml
  if (paragraph.text !== original.text && /<w:t\b/.test(next)) {
    let first = true
    next = next.replace(/(<w:t\b[^>]*>)[\s\S]*?(<\/w:t>)/g, (_match, open, close) => {
      if (!first) return `${open}${close}`
      first = false
      return `${open}${escapeXml(paragraph.text)}${close}`
    })
  }
  if (paragraph.font !== original.font || paragraph.size !== original.size) {
    next = next.replace(/<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/g, run => patchRunProperties(run, paragraph))
  }
  if (paragraph.align !== original.align && /<w:jc\b[^>]*\/>/.test(next)) {
    next = next.replace(/<w:jc\b[^>]*\/>/, `<w:jc w:val="${escapeXml(paragraph.align)}"/>`)
  }
  if (paragraph.firstLineIndent !== original.firstLineIndent && /<w:ind\b[^>]*\/>/.test(next)) {
    next = next.replace(/<w:ind\b[^>]*\/>/, `<w:ind w:firstLine="${Math.round(Number(paragraph.firstLineIndent) * 480)}"/>`)
  }
  return next
}

function patchRunProperties(xml, paragraph) {
  let next = xml
  if (paragraph.font !== undefined && /<w:rFonts\b[^>]*\/>/.test(next)) {
    const value = escapeXml(paragraph.font)
    next = next.replace(/<w:rFonts\b[^>]*\/>/, `<w:rFonts w:eastAsia="${value}" w:ascii="${value}" w:hAnsi="${value}"/>`)
  }
  if (paragraph.size !== undefined) {
    const value = Math.round(Number(paragraph.size) * 2)
    next = next.replace(/<w:sz\b[^>]*\/>/, `<w:sz w:val="${value}"/>`).replace(/<w:szCs\b[^>]*\/>/, `<w:szCs w:val="${value}"/>`)
  }
  return next
}

function patchTable(xml, table) {
  const values = [table.headers ?? [], ...(table.rows ?? [])].flat()
  let index = 0
  return xml.replace(/<w:t\b([^>]*)>[\s\S]*?<\/w:t>/g, (_match, attributes) => {
    const value = values[index++]
    return value == null ? `<w:t${attributes}></w:t>` : `<w:t${attributes}>${escapeXml(value)}</w:t>`
  })
}

function writeParagraph(item) {
  const font = escapeXml(item.font ?? '')
  const size = Math.round(Number(item.size ?? 16) * 2)
  const indent = item.firstLineIndent ? `<w:ind w:firstLine="${Math.round(item.firstLineIndent * 480)}"/>` : ''
  return `<w:p><w:pPr><w:jc w:val="${escapeXml(item.align ?? 'left')}"/>${indent}</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="${font}" w:ascii="${font}"/><w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${escapeXml(item.text ?? '')}</w:t></w:r></w:p>`
}

function writeTable(table) {
  return `<w:tbl>${[table.headers ?? [], ...(table.rows ?? [])].map(row => `<w:tr>${row.map(cell => `<w:tc><w:p><w:r><w:t>${escapeXml(cell)}</w:t></w:r></w:p></w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`
}

function writeSection(page, parts = []) {
  const twips = value => Math.round(Number(value || 0) * 56.7)
  const pageNumber = page.pageNumber
    ? `<w:pgNumType w:start="${Number(page.pageNumber.start || 1)}"/>`
    : ''
  const refs = parts.map(([name], index) => {
    const type = name.includes('header') ? 'hdr' : 'ftr'
    return `<w:${type}Reference w:type="default" r:id="rId${index + 2}"/>`
  }).join('')
  return `<w:sectPr>${refs}${pageNumber}<w:pgSz w:w="${twips(page.widthMm ?? 210)}" w:h="${twips(page.heightMm ?? 297)}"/><w:pgMar w:top="${twips(page.top)}" w:bottom="${twips(page.bottom)}" w:left="${twips(page.left)}" w:right="${twips(page.right)}"/></w:sectPr>`
}

function headerFooter(kind, text, color) {
  const colorXml = color ? `<w:color w:val="${escapeXml(color)}"/>` : ''
  return `<?xml version="1.0" encoding="UTF-8"?><w:${kind} xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:rPr>${colorXml}</w:rPr><w:t>${escapeXml(text)}</w:t></w:r></w:p></w:${kind}>`
}

export function applyDocumentParts(model) {
  const next = structuredClone(model)
  const parts = []
  if (next.header?.text) parts.push(['word/header1.xml', headerFooter('hdr', next.header.text, next.header.color)])
  if (next.footer?.text) parts.push(['word/footer1.xml', headerFooter('ftr', next.footer.text, next.footer.color)])
  next.meta = { ...(next.meta ?? {}), parts }
  return next
}

function documentXml(body) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`
}

function contentTypes(parts = []) {
  const overrides = parts.map(([name]) => {
    const type = name.includes('header') ? 'header' : 'footer'
    return `<Override PartName="/${name}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${type}+xml"/>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>${overrides}</Types>`
}

function documentRels(parts = []) {
  const rels = parts.map(([name], index) => {
    const type = name.includes('header') ? 'header' : 'footer'
    return `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${name.replace('word/', '')}"/>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`
}

function rootRels() {
  return '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
}

function attr(xml, tag, name) {
  const tagText = xml.match(new RegExp(`<${tag}\\b[^>]*>`))?.[0] ?? ''
  return tagText.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? ''
}

function twipToMm(value) { return value ? Math.round(Number(value) / 56.7) : 0 }
function escapeXml(value) { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]) }
function decodeXml(value) { return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&') }
function decoder() { return new TextDecoder('utf-8') }