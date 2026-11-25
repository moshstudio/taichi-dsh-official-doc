import JSZip from 'jszip'

const XML = 'application/xml'

export async function readDocx(bytes) {
  let zip
  try { zip = await JSZip.loadAsync(bytes) } catch { throw new Error('文件不是有效的 docx') }
  const document = zip.file('word/document.xml')
  if (!document) throw new Error('docx 中没有正文')
  const xml = await document.async('string')
  const sect = xml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/)?.[0] ?? ''
  const page = {
    widthMm: emuToMm(attr(sect, 'w:pgSz', 'w:w')),
    heightMm: emuToMm(attr(sect, 'w:pgSz', 'w:h')),
    top: emuToMm(attr(sect, 'w:pgMar', 'w:top')),
    bottom: emuToMm(attr(sect, 'w:pgMar', 'w:bottom')),
    left: emuToMm(attr(sect, 'w:pgMar', 'w:left')),
    right: emuToMm(attr(sect, 'w:pgMar', 'w:right'))
  }
  const paragraphs = [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map(match => readParagraph(match[0]))
    .filter(item => item.text)
  return { page, paragraphs }
}

export async function writeDocx(model) {
  const zip = new JSZip()
  const page = model.page ?? {}
  zip.file('[Content_Types].xml', contentTypes())
  zip.folder('_rels')?.file('.rels', rootRels())
  zip.folder('word')?.file('document.xml', documentXml(model.paragraphs ?? [], page))
  zip.folder('word')?.folder('_rels')?.file('document.xml.rels', '')
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

function readParagraph(xml) {
  const text = [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map(item => decode(item[1])).join('')
  const font = attr(xml, 'w:rFonts', 'w:eastAsia') || attr(xml, 'w:rFonts', 'w:ascii') || ''
  const size = Number(attr(xml, 'w:sz', 'w:val') || 0) / 2
  const align = attr(xml, 'w:jc', 'w:val') || 'left'
  return { role: inferRole(text, align, size), text, font, size, align }
}

function inferRole(text, align, size) {
  if (align === 'center' && size >= 22) return 'title'
  if (/：$/.test(text)) return 'recipient'
  if (/\d{4}年\d{1,2}月\d{1,2}日$/.test(text)) return 'date'
  if (align === 'right') return 'signature'
  return 'body'
}

function documentXml(paragraphs, page) {
  const body = paragraphs.map(paragraph => `
    <w:p>
      <w:pPr><w:jc w:val="${escape(paragraph.align || 'left')}"/></w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="${escape(paragraph.font || '仿宋')}" w:eastAsia="${escape(paragraph.font || '仿宋')}"/>
        <w:sz w:val="${Math.round((paragraph.size || 16) * 2)}"/></w:rPr>
        <w:t xml:space="preserve">${escape(paragraph.text || '')}</w:t>
      </w:r>
    </w:p>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>${body}
        <w:sectPr>
          <w:pgSz w:w="${mmToTwip(page.widthMm)}" w:h="${mmToTwip(page.heightMm)}"/>
          <w:pgMar w:top="${mmToTwip(page.top)}" w:bottom="${mmToTwip(page.bottom)}" w:left="${mmToTwip(page.left)}" w:right="${mmToTwip(page.right)}"/>
        </w:sectPr>
      </w:body>
    </w:document>`
}

function contentTypes() {
  return `<?xml version="1.0" encoding="UTF-8"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="${XML}"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    </Types>`
}

function rootRels() {
  return `<?xml version="1.0" encoding="UTF-8"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
    </Relationships>`
}

function attr(xml, tag, name) {
  const element = xml.match(new RegExp(`<${tag}\\b[^>]*>`))?.[0] ?? ''
  return element.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? ''
}
function emuToMm(value) { return value ? Math.round(Number(value) / 56.7) : 0 }
function mmToTwip(value) { return Math.round((Number(value) || 0) * 56.7) }
function escape(value) { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]) }
function decode(value) { return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&') }