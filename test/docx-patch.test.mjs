import assert from 'node:assert/strict'
import test from 'node:test'
import { readDocx, patchDocx } from '../dsh/docx.js'
import { createZip, readZipEntries } from '../dsh/zip.js'

const mainXml = `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="仿宋"/><w:sz w:val="32"/></w:rPr><w:t>正文原文</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>表头</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>内容</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="2098" w:bottom="1984" w:left="1587" w:right="1474"/></w:sectPr></w:body></w:document>`

function fixture() {
  return createZip([
    ['[Content_Types].xml', '<Types/>'],
    ['word/document.xml', mainXml],
    ['word/header1.xml', '<w:hdr>Header</w:hdr>'],
    ['word/media/image1.png', Buffer.from([0, 1, 2, 3, 255])],
    ['word/_rels/document.xml.rels', '<Relationships><Relationship Id="rId1" Target="media/image1.png"/></Relationships>']
  ], { dataDescriptor: true })
}

test('中央目录读取支持 data descriptor 与图片、关系部件', async () => {
  const original = fixture()
  const entries = readZipEntries(original)
  assert.equal(entries.get('word/header1.xml').toString(), '<w:hdr>Header</w:hdr>')
  assert.deepEqual(entries.get('word/media/image1.png'), Buffer.from([0, 1, 2, 3, 255]))
  const model = await readDocx(original)
  assert.equal(model.paragraphs.length, 1)
  assert.equal(model.paragraphs[0].id, 'p0')
  assert.deepEqual(model.tables[0].headers, ['表头', '内容'])
  assert.deepEqual(model.tables[0].rows, [])
})

test('docx 补丁只改指定段落，其他压缩包部件原样保留', async () => {
  const original = fixture()
  const model = await readDocx(original)
  model.paragraphs[0].text = '正文修改'
  model.paragraphs[0].font = '仿宋_GB2312'
  const output = await patchDocx(original, model)
  const before = readZipEntries(original)
  const after = readZipEntries(output)
  for (const name of before.keys()) {
    if (name !== 'word/document.xml') assert.deepEqual(after.get(name), before.get(name), `${name} should be preserved`)
  }
  const xml = after.get('word/document.xml').toString()
  assert.match(xml, /正文修改/)
  assert.match(xml, /w:eastAsia="仿宋_GB2312"/)
  assert.match(xml, /<w:tbl>/)
  assert.match(xml, /表头/)
})

test('页码、红头和版记写入并可再次读取', async () => {
  const { writeDocx } = await import('../dsh/docx.js')
  const bytes = await writeDocx({
    page: { widthMm: 210, heightMm: 297, top: 37, bottom: 35, left: 28, right: 26, pageNumber: { start: 1 } },
    header: { text: '机关文件', color: 'FF0000' },
    footer: { text: '抄送：办公室' },
    paragraphs: [{ role: 'title', text: '关于测试的通知', font: '方正小标宋简体', size: 22, align: 'center' }]
  })
  const entries = readZipEntries(bytes)
  assert.match(entries.get('word/document.xml').toString(), /w:pgNumType w:start="1"/)
  assert.match(entries.get('word/header1.xml').toString(), /机关文件/)
  assert.match(entries.get('word/header1.xml').toString(), /FF0000/)
  assert.match(entries.get('word/footer1.xml').toString(), /抄送：办公室/)
  const back = await readDocx(bytes)
  assert.equal(back.paragraphs[0].text, '关于测试的通知')
})

test('无修改补丁时文档正文 XML 保持完全相同', async () => {
  const original = fixture()
  const model = await readDocx(original)
  const output = await patchDocx(original, model)
  assert.equal(readZipEntries(output).get('word/document.xml').toString(), mainXml)
})