import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { parse } from "yaml";
// dsh/zip.js
const TABLE = /* @__PURE__ */ new Uint32Array(256);
for (let index = 0; index < TABLE.length; index += 1) {
	let value = index;
	for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1;
	TABLE[index] = value >>> 0;
}
const EOCD = 0x6054b50;
const CENTRAL = 33639248;
const LOCAL = 67324752;
function createZip(entries, { dataDescriptor = false } = {}) {
	const locals = [];
	const centrals = [];
	let offset = 0;
	for (const [name, content] of entries) {
		const nameBytes = Buffer.from(name);
		const data = Buffer.from(content);
		const packed = deflateRawSync(data);
		const crc = crc32(data);
		const flags = 2048 | (dataDescriptor ? 8 : 0);
		const local = Buffer.alloc(30);
		local.writeUInt32LE(LOCAL, 0);
		local.writeUInt16LE(20, 4);
		local.writeUInt16LE(flags, 6);
		local.writeUInt16LE(8, 8);
		if (!dataDescriptor) {
			local.writeUInt32LE(crc, 14);
			local.writeUInt32LE(packed.length, 18);
			local.writeUInt32LE(data.length, 22);
		}
		local.writeUInt16LE(nameBytes.length, 26);
		locals.push(local, nameBytes, packed);
		if (dataDescriptor) {
			const descriptor = Buffer.alloc(16);
			descriptor.writeUInt32LE(0x8074b50, 0);
			descriptor.writeUInt32LE(crc, 4);
			descriptor.writeUInt32LE(packed.length, 8);
			descriptor.writeUInt32LE(data.length, 12);
			locals.push(descriptor);
		}
		const central = Buffer.alloc(46);
		central.writeUInt32LE(CENTRAL, 0);
		central.writeUInt16LE(20, 4);
		central.writeUInt16LE(20, 6);
		central.writeUInt16LE(flags, 8);
		central.writeUInt16LE(8, 10);
		central.writeUInt32LE(crc, 16);
		central.writeUInt32LE(packed.length, 20);
		central.writeUInt32LE(data.length, 24);
		central.writeUInt16LE(nameBytes.length, 28);
		central.writeUInt32LE(offset, 42);
		centrals.push(central, nameBytes);
		offset += local.length + nameBytes.length + packed.length + (dataDescriptor ? 16 : 0);
	}
	return finishZip(locals, centrals, offset, entries.length);
}
function readZipEntries(bytes) {
	const archive = parseZip(bytes);
	return new Map([...archive.entries].map(([name, entry]) => [name, readEntry(archive, entry)]));
}
function replaceZipEntries(bytes, replacements) {
	const archive = parseZip(bytes);
	const locals = [];
	const centrals = [];
	let outputOffset = 0;
	for (const entry of archive.entries.values()) {
		const replacement = replacements.get(entry.name);
		const localOffset = entry.localOffset;
		const localNameLength = archive.input.readUInt16LE(localOffset + 26);
		const localExtraLength = archive.input.readUInt16LE(localOffset + 28);
		const localStart = localOffset + 30;
		const dataStart = localStart + localNameLength + localExtraLength;
		const originalLocalEnd = dataStart + entry.compressedSize;
		const name = archive.input.subarray(localStart, localStart + localNameLength);
		let descriptorLength = entry.flags & 8 ? descriptorSize(archive.input, originalLocalEnd) : 0;
		if (entry.flags & 8 && replacement) descriptorLength = 0;
		const localExtra = archive.input.subarray(localStart + localNameLength, dataStart);
		const centralExtraStart = entry.centralOffset + 46 + entry.nameLength;
		const centralExtra = archive.input.subarray(centralExtraStart, centralExtraStart + entry.extraLength);
		const commentStart = centralExtraStart + entry.extraLength;
		const comment = archive.input.subarray(commentStart, commentStart + entry.commentLength);
		let localHeader;
		let centralHeader;
		let payload;
		if (replacement) {
			const data = Buffer.from(replacement);
			const method = entry.method === 0 ? 0 : 8;
			payload = method === 0 ? data : deflateRawSync(data);
			const crc = crc32(data);
			localHeader = Buffer.from(archive.input.subarray(localOffset, localStart));
			localHeader.writeUInt16LE((entry.flags | 2048) & -9, 6);
			localHeader.writeUInt16LE(method, 8);
			localHeader.writeUInt32LE(crc, 14);
			localHeader.writeUInt32LE(payload.length, 18);
			localHeader.writeUInt32LE(data.length, 22);
			centralHeader = Buffer.from(archive.input.subarray(entry.centralOffset, entry.centralOffset + 46));
			centralHeader.writeUInt16LE((entry.flags | 2048) & -9, 8);
			centralHeader.writeUInt16LE(method, 10);
			centralHeader.writeUInt32LE(crc, 16);
			centralHeader.writeUInt32LE(payload.length, 20);
			centralHeader.writeUInt32LE(data.length, 24);
		} else {
			localHeader = archive.input.subarray(localOffset, localStart);
			payload = archive.input.subarray(dataStart, originalLocalEnd + descriptorLength);
			centralHeader = Buffer.from(archive.input.subarray(entry.centralOffset, entry.centralOffset + 46));
		}
		const localOffsetOut = outputOffset;
		locals.push(localHeader, name, localExtra, payload);
		outputOffset += localHeader.length + name.length + localExtra.length + payload.length;
		centralHeader.writeUInt32LE(localOffsetOut, 42);
		centrals.push(centralHeader, name, centralExtra, comment);
	}
	const centralSize = centrals.reduce((sum, chunk) => sum + chunk.length, 0);
	return finishZip(locals, centrals, outputOffset, archive.entries.size, centralSize);
}
function finishZip(locals, centrals, offset, entryCount, knownCentralSize) {
	const centralSize = knownCentralSize ?? centrals.reduce((sum, chunk) => sum + chunk.length, 0);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(EOCD, 0);
	end.writeUInt16LE(entryCount, 8);
	end.writeUInt16LE(entryCount, 10);
	end.writeUInt32LE(centralSize, 12);
	end.writeUInt32LE(offset, 16);
	return Buffer.concat([
		...locals,
		...centrals,
		end
	]);
}
function parseZip(bytes) {
	const input = Buffer.from(bytes);
	if (input.length < 22) throw new Error("不是有效的 docx/ZIP 文件");
	let end = -1;
	for (let offset = input.length - 22; offset >= Math.max(0, input.length - 22 - 65535); offset -= 1) if (input.readUInt32LE(offset) === EOCD) {
		end = offset;
		break;
	}
	if (end < 0) throw new Error("不是有效的 docx/ZIP 文件");
	const count = input.readUInt16LE(end + 10);
	const centralSize = input.readUInt32LE(end + 12);
	const centralEnd = input.readUInt32LE(end + 16) + centralSize;
	let centralOffset = input.readUInt32LE(end + 16);
	const entries = /* @__PURE__ */ new Map();
	for (let index = 0; index < count; index += 1) {
		if (centralOffset + 46 > input.length || input.readUInt32LE(centralOffset) !== CENTRAL) throw new Error("ZIP 中央目录损坏");
		const flags = input.readUInt16LE(centralOffset + 8);
		const method = input.readUInt16LE(centralOffset + 10);
		const crc = input.readUInt32LE(centralOffset + 16);
		const compressedSize = input.readUInt32LE(centralOffset + 20);
		const size = input.readUInt32LE(centralOffset + 24);
		const nameLength = input.readUInt16LE(centralOffset + 28);
		const extraLength = input.readUInt16LE(centralOffset + 30);
		const commentLength = input.readUInt16LE(centralOffset + 32);
		const localOffset = input.readUInt32LE(centralOffset + 42);
		const nameStart = centralOffset + 46;
		const name = input.subarray(nameStart, nameStart + nameLength).toString(flags & 2048 ? "utf8" : "latin1");
		if (localOffset + 30 > input.length || input.readUInt32LE(localOffset) !== LOCAL) throw new Error(`ZIP 本地条目损坏：${name}`);
		entries.set(name, {
			name,
			flags,
			method,
			crc,
			compressedSize,
			size,
			localOffset,
			centralOffset,
			nameLength,
			extraLength,
			commentLength
		});
		centralOffset += 46 + nameLength + extraLength + commentLength;
	}
	if (centralOffset > centralEnd) throw new Error("ZIP 中央目录越界");
	return {
		input,
		entries
	};
}
function descriptorSize(input, offset) {
	return input.readUInt32LE(offset) === 0x8074b50 ? 16 : 12;
}
function readEntry(archive, entry) {
	const input = archive.input;
	const nameLength = input.readUInt16LE(entry.localOffset + 26);
	const extraLength = input.readUInt16LE(entry.localOffset + 28);
	const start = entry.localOffset + 30 + nameLength + extraLength;
	const packed = input.subarray(start, start + entry.compressedSize);
	let data;
	if (entry.method === 0) data = Buffer.from(packed);
	else if (entry.method === 8) data = inflateRawSync(packed);
	else throw new Error(`不支持的 ZIP 压缩方式：${entry.method}`);
	if (data.length !== entry.size || crc32(data) !== entry.crc) throw new Error(`ZIP 条目校验失败：${entry.name}`);
	return data;
}
function crc32(bytes) {
	let crc = 0xffffffff;
	for (const byte of bytes) crc = TABLE[(crc ^ byte) & 255] ^ crc >>> 8;
	return (crc ^ 0xffffffff) >>> 0;
}
// dsh/roles.js
/** 段落角色识别。docx 读取与 Markdown 解析共用，避免两套规则分叉。 */
const HEADINGS = [
	[/^(?:一|二|三|四|五|六|七|八|九|十)、/, "heading1"],
	[/^（[一二三四五六七八九十]+）/, "heading2"],
	[/^[0-9]+[.、]/, "heading3"],
	[/^（[0-9]+）/, "heading4"]
];
function inferRole(text, align = "left", size = 0) {
	const value = String(text ?? "").trim();
	if (!value) return { role: "empty" };
	if (align === "center" && size >= 20 || /^(关于|关于.*的).{1,40}(通知|报告|请示|意见|方案|办法)$/.test(value)) return { role: "title" };
	for (const [pattern, role] of HEADINGS) if (pattern.test(value)) return {
		role,
		level: Number(role.slice(-1))
	};
	if (/^(?:附件(?:[：:]|\d)|（此件公开发布）)/.test(value)) return { role: "attachment" };
	if (/^抄送[:：]/.test(value)) return { role: "cc" };
	if (/^(?:印发机关|印发日期|印发份数)[:：]/.test(value) || /^印发/.test(value)) return { role: "colophon" };
	if (/(?:发|字|办|函|厅)[〔\[【]\d{4}[〕\]】]\d+号/.test(value)) return { role: "documentNumber" };
	if (/^签发人[:：]/.test(value)) return { role: "issuer" };
	if (/^(?:[\u4e00-\u9fff、]{1,12}[:：]|各有关单位[:：])$/.test(value) || /[:：]$/.test(value)) return { role: "recipient" };
	if (/\d{4}年\d{1,2}月\d{1,2}日$/.test(value)) return { role: "date" };
	if (align === "right" && value.length <= 40) return { role: "signature" };
	if (align == null && value.length <= 30 && !/[。！？]$/.test(value)) return { role: "signature" };
	return { role: "body" };
}
// dsh/docx.js
async function readDocx(bytes) {
	const xmlBytes = readZipEntries(bytes).get("word/document.xml");
	if (!xmlBytes) throw new Error("docx 文件没有正文 XML");
	const xml = decoder().decode(xmlBytes);
	const section = xml.match(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/)?.[0] ?? "";
	const paragraphs = blocksOutsideTables(xml, /<w:p\b[\s\S]*?<\/w:p>/g).map((paragraphXml, index) => ({
		...readParagraph(paragraphXml),
		id: `p${index}`
	}));
	const page = {
		widthMm: twipToMm(attr(section, "w:pgSz", "w:w")),
		heightMm: twipToMm(attr(section, "w:pgSz", "w:h")),
		top: twipToMm(attr(section, "w:pgMar", "w:top")),
		bottom: twipToMm(attr(section, "w:pgMar", "w:bottom")),
		left: twipToMm(attr(section, "w:pgMar", "w:left")),
		right: twipToMm(attr(section, "w:pgMar", "w:right"))
	};
	paragraphs.map(({ xmlOriginal, original, id }) => ({
		id,
		xml: xmlOriginal,
		original
	}));
	return {
		page,
		paragraphs: paragraphs.map(({ xmlOriginal, original, ...paragraph }) => paragraph),
		tables: readTables(xml),
		meta: {
			source: "docx",
			originalPage: page,
			originalParagraphs: paragraphs.map(({ xmlOriginal, original, id }) => ({
				id,
				xml: xmlOriginal,
				original
			}))
		}
	};
}
async function writeDocx(model) {
	const prepared = applyDocumentParts(model);
	const sourceBytes = prepared?.meta?.sourceBytes;
	if (sourceBytes) return patchDocx(Buffer.from(sourceBytes, "base64"), prepared);
	const body = [
		(prepared.paragraphs ?? []).map(writeParagraph).join(""),
		(prepared.tables ?? []).map(writeTable).join(""),
		writeSection(prepared.page ?? {}, prepared.meta?.parts ?? [])
	].join("");
	return createZip([
		["[Content_Types].xml", contentTypes(prepared.meta?.parts ?? [])],
		["_rels/.rels", rootRels()],
		["word/document.xml", documentXml(body)],
		["word/_rels/document.xml.rels", documentRels(prepared.meta?.parts ?? [])],
		...prepared.meta?.parts ?? []
	]);
}
async function patchDocx(bytes, model) {
	const source = readZipEntries(bytes).get("word/document.xml");
	if (!source) throw new Error("docx 中没有正文");
	const xml = decoder().decode(source);
	return replaceZipEntries(bytes, /* @__PURE__ */ new Map([["word/document.xml", Buffer.from(patchDocumentXml(xml, model))]]));
}
function blocksOutsideTables(xml, expression) {
	return [...xml.replace(/<w:tbl\b[\s\S]*?<\/w:tbl>/g, (table) => " ".repeat(table.length)).matchAll(expression)].map((match) => match[0]);
}
function readParagraph(xml) {
	const text = [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((match) => decodeXml(match[1])).join("");
	const font = attr(xml, "w:rFonts", "w:eastAsia") || attr(xml, "w:rFonts", "w:ascii") || "";
	const size = Number(attr(xml, "w:sz", "w:val") || 0) / 2;
	const align = attr(xml, "w:jc", "w:val") || "left";
	const indent = Number(attr(xml, "w:ind", "w:firstLine") || 0);
	const roleInfo = inferRole(text, align, size);
	return {
		role: roleInfo.role,
		level: roleInfo.level,
		text,
		font,
		size,
		align,
		firstLineIndent: indent ? Math.round(indent / 480) : 0,
		lineSpacing: Number(attr(xml, "w:spacing", "w:line") || 0) / 20 || void 0,
		xmlOriginal: xml,
		original: {
			text,
			font,
			size,
			align,
			firstLineIndent: indent ? Math.round(indent / 480) : 0
		}
	};
}
function readTables(xml) {
	return [...xml.matchAll(/<w:tbl\b[\s\S]*?<\/w:tbl>/g)].map((match) => readTable(match[0]));
}
function readTable(xml) {
	const rows = [...xml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].map((row) => [...row[0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)].map((cell) => [...cell[0].matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((text) => decodeXml(text[1])).join("")));
	return {
		headers: rows[0] ?? [],
		rows: rows.slice(1)
	};
}
function patchDocumentXml(xml, model) {
	const paragraphById = new Map((model.paragraphs ?? []).map((item) => [item.id, item]));
	const originalById = new Map((model.meta?.originalParagraphs ?? []).map((item) => [item.id, item]));
	const tables = model.tables ?? [];
	let paragraphIndex = 0;
	let tableIndex = 0;
	let output = "";
	let offset = 0;
	for (const table of xml.matchAll(/<w:tbl\b[\s\S]*?<\/w:tbl>/g)) {
		output += patchParagraphs(xml.slice(offset, table.index), paragraphById, originalById, () => paragraphIndex++);
		output += patchTable(table[0], tables[tableIndex] ?? readTable(table[0]));
		tableIndex += 1;
		offset = table.index + table[0].length;
	}
	output += patchParagraphs(xml.slice(offset), paragraphById, originalById, () => paragraphIndex++);
	return output;
}
function patchParagraphs(xml, paragraphs, originals, nextIndex) {
	return xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraphXml) => {
		const id = `p${nextIndex()}`;
		const paragraph = paragraphs.get(id);
		const original = originals.get(id)?.original;
		return paragraph && original ? patchParagraph(paragraphXml, paragraph, original) : paragraphXml;
	});
}
function patchParagraph(xml, paragraph, original) {
	let next = xml;
	if (paragraph.text !== original.text && /<w:t\b/.test(next)) {
		let first = true;
		next = next.replace(/(<w:t\b[^>]*>)[\s\S]*?(<\/w:t>)/g, (_match, open, close) => {
			if (!first) return `${open}${close}`;
			first = false;
			return `${open}${escapeXml(paragraph.text)}${close}`;
		});
	}
	if (paragraph.font !== original.font || paragraph.size !== original.size) next = next.replace(/<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/g, (run) => patchRunProperties(run, paragraph));
	if (paragraph.align !== original.align && /<w:jc\b[^>]*\/>/.test(next)) next = next.replace(/<w:jc\b[^>]*\/>/, `<w:jc w:val="${escapeXml(paragraph.align)}"/>`);
	if (paragraph.firstLineIndent !== original.firstLineIndent && /<w:ind\b[^>]*\/>/.test(next)) next = next.replace(/<w:ind\b[^>]*\/>/, `<w:ind w:firstLine="${Math.round(Number(paragraph.firstLineIndent) * 480)}"/>`);
	return next;
}
function patchRunProperties(xml, paragraph) {
	let next = xml;
	if (paragraph.font !== void 0 && /<w:rFonts\b[^>]*\/>/.test(next)) {
		const value = escapeXml(paragraph.font);
		next = next.replace(/<w:rFonts\b[^>]*\/>/, `<w:rFonts w:eastAsia="${value}" w:ascii="${value}" w:hAnsi="${value}"/>`);
	}
	if (paragraph.size !== void 0) {
		const value = Math.round(Number(paragraph.size) * 2);
		next = next.replace(/<w:sz\b[^>]*\/>/, `<w:sz w:val="${value}"/>`).replace(/<w:szCs\b[^>]*\/>/, `<w:szCs w:val="${value}"/>`);
	}
	return next;
}
function patchTable(xml, table) {
	const values = [table.headers ?? [], ...table.rows ?? []].flat();
	let index = 0;
	return xml.replace(/<w:t\b([^>]*)>[\s\S]*?<\/w:t>/g, (_match, attributes) => {
		const value = values[index++];
		return value == null ? `<w:t${attributes}></w:t>` : `<w:t${attributes}>${escapeXml(value)}</w:t>`;
	});
}
function writeParagraph(item) {
	const font = escapeXml(item.font ?? "");
	const size = Math.round(Number(item.size ?? 16) * 2);
	const indent = item.firstLineIndent ? `<w:ind w:firstLine="${Math.round(item.firstLineIndent * 480)}"/>` : "";
	return `<w:p><w:pPr><w:jc w:val="${escapeXml(item.align ?? "left")}"/>${indent}</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="${font}" w:ascii="${font}"/><w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${escapeXml(item.text ?? "")}</w:t></w:r></w:p>`;
}
function writeTable(table) {
	return `<w:tbl>${[table.headers ?? [], ...table.rows ?? []].map((row) => `<w:tr>${row.map((cell) => `<w:tc><w:p><w:r><w:t>${escapeXml(cell)}</w:t></w:r></w:p></w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`;
}
function writeSection(page, parts = []) {
	const twips = (value) => Math.round(Number(value || 0) * 56.7);
	const pageNumber = page.pageNumber ? `<w:pgNumType w:start="${Number(page.pageNumber.start || 1)}"/>` : "";
	return `<w:sectPr>${parts.map(([name], index) => {
		return `<w:${name.includes("header") ? "hdr" : "ftr"}Reference w:type="default" r:id="rId${index + 2}"/>`;
	}).join("")}${pageNumber}<w:pgSz w:w="${twips(page.widthMm ?? 210)}" w:h="${twips(page.heightMm ?? 297)}"/><w:pgMar w:top="${twips(page.top)}" w:bottom="${twips(page.bottom)}" w:left="${twips(page.left)}" w:right="${twips(page.right)}"/></w:sectPr>`;
}
function headerFooter(kind, text, color) {
	return `<?xml version="1.0" encoding="UTF-8"?><w:${kind} xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:rPr>${color ? `<w:color w:val="${escapeXml(color)}"/>` : ""}</w:rPr><w:t>${escapeXml(text)}</w:t></w:r></w:p></w:${kind}>`;
}
function applyDocumentParts(model) {
	const next = structuredClone(model);
	const parts = [];
	if (next.header?.text) parts.push(["word/header1.xml", headerFooter("hdr", next.header.text, next.header.color)]);
	if (next.footer?.text) parts.push(["word/footer1.xml", headerFooter("ftr", next.footer.text, next.footer.color)]);
	next.meta = {
		...next.meta ?? {},
		parts
	};
	return next;
}
function documentXml(body) {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
}
function contentTypes(parts = []) {
	return `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>${parts.map(([name]) => {
		return `<Override PartName="/${name}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${name.includes("header") ? "header" : "footer"}+xml"/>`;
	}).join("")}</Types>`;
}
function documentRels(parts = []) {
	return `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${parts.map(([name], index) => {
		const type = name.includes("header") ? "header" : "footer";
		return `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${name.replace("word/", "")}"/>`;
	}).join("")}</Relationships>`;
}
function rootRels() {
	return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/></Relationships>";
}
function attr(xml, tag, name) {
	return (xml.match(new RegExp(`<${tag}\\b[^>]*>`))?.[0] ?? "").match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? "";
}
function twipToMm(value) {
	return value ? Math.round(Number(value) / 56.7) : 0;
}
function escapeXml(value) {
	return String(value).replace(/[&<>"']/g, (char) => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		"\"": "&quot;",
		"'": "&apos;"
	})[char]);
}
function decodeXml(value) {
	return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}
function decoder() {
	return new TextDecoder("utf-8");
}
// dsh/account.js
const ACTIONS = {
	polish: 1,
	deai: 1,
	analyze: 2,
	draft: 2
};
const DEFAULT_GRANT = 20;
async function loadAccount(dataRoot) {
	const stored = await readJson$1(join(dataRoot, "account.json"));
	return {
		name: stored?.name || "本地账号",
		balance: Number.isFinite(stored?.balance) ? stored.balance : DEFAULT_GRANT,
		ledger: Array.isArray(stored?.ledger) ? stored.ledger.slice(0, 20) : []
	};
}
async function chargeAccount(dataRoot, action) {
	const cost = ACTIONS[action];
	if (!cost) throw new Error("未知的积分操作");
	const account = await loadAccount(dataRoot);
	if (account.balance < cost) throw new Error(`积分不足，需要 ${cost}，剩余 ${account.balance}`);
	const next = {
		...account,
		balance: account.balance - cost,
		ledger: [{
			action,
			cost,
			at: (/* @__PURE__ */ new Date()).toISOString()
		}, ...account.ledger].slice(0, 20)
	};
	await writeAccount(dataRoot, next);
	return {
		balance: next.balance,
		cost
	};
}
async function refundAccount(dataRoot, action) {
	const cost = ACTIONS[action];
	if (!cost) throw new Error("未知的积分操作");
	const account = await loadAccount(dataRoot);
	const next = {
		...account,
		balance: account.balance + cost,
		ledger: [{
			action,
			cost: -cost,
			at: (/* @__PURE__ */ new Date()).toISOString()
		}, ...account.ledger].slice(0, 20)
	};
	await writeAccount(dataRoot, next);
	return {
		balance: next.balance,
		refunded: cost
	};
}
async function writeAccount(dataRoot, account) {
	await mkdir(dataRoot, { recursive: true });
	const target = join(dataRoot, "account.json");
	const temporary = `${target}.${process.pid}.tmp`;
	await writeFile(temporary, JSON.stringify(account));
	try {
		await rename(temporary, target);
	} catch (error) {
		await unlink(temporary).catch(() => {});
		throw error;
	}
}
async function readJson$1(file) {
	try {
		return JSON.parse(await readFile(file, "utf8"));
	} catch {
		return null;
	}
}
// dsh/semantic.js
/** 要素语义校验（GB/T 9704-2012）：文号、成文日期、发文机关署名 */
const DOC_NO_RE = /〔([^〕]{1,20})〕(\d{1,4})号/g;
const BAD_BRACKET_RE = /[\(\[【]\s*(\d{1,4})\s*[\)\]】]\s*(\d{1,4})\s*号/g;
const DATE_FULL_RE = /(\d{4})年(\d{1,2})月(\d{1,2})日/g;
const DATE_NO_DAY_RE = /(\d{4})年(\d{1,2})月(?!\d)/g;
const DATE_DASH_RE = /\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/g;
const DATE_CN_DIGIT_RE = /[〇零一二三四五六七八九十]{2,4}年[一二三四五六七八九十]{1,3}月/;
function checkSemantic(model) {
	const issues = [];
	const paragraphs = model?.paragraphs ?? [];
	for (let index = 0; index < paragraphs.length; index++) {
		const paragraph = paragraphs[index];
		const text = String(paragraph?.text ?? "").trim();
		if (!text || paragraph.role === "title") continue;
		issues.push(...checkDocNumber(text, index));
		issues.push(...checkDate(text, index, paragraph.role));
		if (paragraph.role === "signature") issues.push(...checkSignature(text, index));
	}
	return issues;
}
function checkDocNumber(text, index) {
	const issues = [];
	for (const match of text.matchAll(DOC_NO_RE)) {
		const yearPart = match[1];
		if (!/^\d{4}$/.test(yearPart)) issues.push(semanticIssue("CHK-S001", "文号格式校验", "P1", "7.2.2", index, match[0], "例：××发〔2026〕1号", `文号年份应为 4 位阿拉伯数字，当前为「${yearPart}」`));
		else if (match[2].startsWith("0")) issues.push(semanticIssue("CHK-S001", "文号格式校验", "P1", "7.2.2", index, match[0], `例：……〔2026〕${Number(match[2])}号`, "发文顺序号前不应补零"));
	}
	for (const match of text.matchAll(BAD_BRACKET_RE)) issues.push(semanticIssue("CHK-S001", "文号格式校验", "P1", "7.2.2", index, match[0], "改为六角括号：××发〔2026〕1号", "发文字号年份应使用六角括号〔〕"));
	return issues;
}
function checkDate(text, index, role) {
	const issues = [];
	for (const match of text.matchAll(DATE_DASH_RE)) issues.push(semanticIssue("CHK-S002", "成文日期格式校验", "P1", "7.3.6", index, match[0], "改为 YYYY年M月D日", "成文日期应用汉字“年月日”，不宜用短横线或点号"));
	for (const match of text.matchAll(DATE_NO_DAY_RE)) issues.push(semanticIssue("CHK-S002", "成文日期格式校验", "P1", "7.3.6", index, match[0], "补全日，如 2026年11月25日", "成文日期应标全年、月、日"));
	if (DATE_CN_DIGIT_RE.test(text)) issues.push(semanticIssue("CHK-S002", "成文日期格式校验", "P1", "7.3.6", index, text.slice(0, 24), "改为阿拉伯数字年月日", "成文日期应使用阿拉伯数字"));
	for (const match of text.matchAll(DATE_FULL_RE)) {
		const year = Number(match[1]);
		const month = Number(match[2]);
		const day = Number(match[3]);
		const now = (/* @__PURE__ */ new Date()).getFullYear();
		if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1970 || year > now + 1) issues.push(semanticIssue("CHK-S003", "成文日期合理性校验", "P2", "7.3.6", index, match[0], "核对成文日期", "成文日期年月日不合理"));
	}
	if (role === "date" && !DATE_FULL_RE.test(text) && !DATE_DASH_RE.test(text)) {
		DATE_FULL_RE.lastIndex = 0;
		if (!/(\d{4})年(\d{1,2})月(\d{1,2})日/.test(text)) issues.push(semanticIssue("CHK-S002", "成文日期格式校验", "P1", "7.3.6", index, text, "例：2026年11月25日", "成文日期段落格式不完整"));
	}
	return issues;
}
function checkSignature(text, index) {
	if (text.length < 2) return [semanticIssue("CHK-S004", "发文机关署名完整性校验", "P2", "7.3.5", index, text, "补充完整发文机关名称", "发文机关署名过短或不完整")];
	return [];
}
function semanticIssue(ruleId, name, severity, standardRef, paragraphIndex, original, fix, message) {
	return {
		id: ruleId,
		rule_id: ruleId,
		severity,
		name,
		field: "semantic",
		original,
		fix,
		suggestion: fix,
		message,
		standard_ref: standardRef,
		paragraphIndex,
		selected: true
	};
}
// dsh/types.js
/** 22 种公文文种元数据 */
const DOCUMENT_TYPES = [
	{
		id: "notice",
		name: "通知",
		category: "政府机关",
		description: "发布、传达要求下级机关执行和有关单位周知或执行的事项。"
	},
	{
		id: "report",
		name: "报告",
		category: "政府机关",
		description: "向上级机关汇报工作、反映情况、回复上级询问。"
	},
	{
		id: "request",
		name: "请示",
		category: "政府机关",
		description: "向上级机关请求指示、批准。"
	},
	{
		id: "letter",
		name: "函",
		category: "政府机关",
		description: "不相隶属机关之间商洽工作、询问和答复问题。"
	},
	{
		id: "minutes",
		name: "纪要",
		category: "政府机关",
		description: "记载会议主要情况和议定事项。"
	},
	{
		id: "meeting",
		name: "会议纪要",
		category: "政府机关",
		description: "会议情况与议定事项的纪要写法。"
	},
	{
		id: "decision",
		name: "决定",
		category: "政府机关",
		description: "对重要事项作出决策和部署。"
	},
	{
		id: "resolution",
		name: "决议",
		category: "政府机关",
		description: "会议讨论通过的重大决策事项。"
	},
	{
		id: "opinion",
		name: "意见",
		category: "政府机关",
		description: "对重要问题提出见解和处理办法。"
	},
	{
		id: "bulletin",
		name: "通报",
		category: "政府机关",
		description: "表彰先进、批评错误、传达重要精神或情况。"
	},
	{
		id: "announcement",
		name: "通告",
		category: "政府机关",
		description: "在一定范围内公布应当遵守或周知的事项。"
	},
	{
		id: "notice_public",
		name: "公告",
		category: "政府机关",
		description: "向国内外宣布重要事项或法定事项。"
	},
	{
		id: "communique",
		name: "公报",
		category: "政府机关",
		description: "公布重要决定或重大事项。"
	},
	{
		id: "command",
		name: "命令",
		category: "政府机关",
		description: "公布行政法规和规章、宣布施行重大强制性措施。"
	},
	{
		id: "reply",
		name: "批复",
		category: "政府机关",
		description: "答复下级机关请示事项。"
	},
	{
		id: "instruction",
		name: "指示",
		category: "其他常用",
		description: "对下级机关布置工作、阐明工作活动指导原则。"
	},
	{
		id: "bill",
		name: "议案",
		category: "其他常用",
		description: "各级人民政府按法律程序向同级人大提请审议事项。"
	},
	{
		id: "regulation",
		name: "制度",
		category: "其他常用",
		description: "规范性管理制度类文稿。"
	},
	{
		id: "summary",
		name: "总结",
		category: "其他常用",
		description: "对一定时期工作进行回顾和分析。"
	},
	{
		id: "work_plan",
		name: "工作方案",
		category: "其他常用",
		description: "对专项工作作出安排部署。"
	},
	{
		id: "technical_proposal",
		name: "技术方案",
		category: "其他常用",
		description: "技术路线与实施方案说明。"
	},
	{
		id: "table_sign",
		name: "桌签",
		category: "其他常用",
		description: "会议桌签样式文稿。"
	}
];
const TYPE_ALIASES = [
	["会议纪要", "meeting"],
	["技术方案", "technical_proposal"],
	["工作方案", "work_plan"],
	["通知", "notice"],
	["报告", "report"],
	["请示", "request"],
	["批复", "reply"],
	["函", "letter"],
	["纪要", "minutes"],
	["决定", "decision"],
	["决议", "resolution"],
	["意见", "opinion"],
	["通报", "bulletin"],
	["通告", "announcement"],
	["公告", "notice_public"],
	["公报", "communique"],
	["命令", "command"],
	["指示", "instruction"],
	["议案", "bill"],
	["制度", "regulation"],
	["总结", "summary"],
	["桌签", "table_sign"]
];
function listTypes() {
	return DOCUMENT_TYPES.map((item) => ({
		...item,
		enabled: true
	}));
}
// dsh/rules.js
function detectType(filename) {
	const name = String(filename ?? "");
	return TYPE_ALIASES.find(([word]) => name.includes(word))?.[1] ?? "notice";
}
function parseRules(text) {
	const rules = parse(String(text ?? ""), { uniqueKeys: true });
	if (rules == null) return {};
	if (typeof rules !== "object" || Array.isArray(rules)) throw new Error("规则文件根节点必须为对象");
	return rules;
}
function mergeRules(common, specific) {
	return {
		...common,
		...specific,
		common: deepMerge(common.common ?? {}, specific.common ?? {}),
		structure: specific.structure?.length ? specific.structure : common.structure ?? [],
		check_rules: [...common.check_rules ?? [], ...specific.check_rules ?? []],
		fix_rules: [...common.fix_rules ?? [], ...specific.fix_rules ?? []]
	};
}
function deepMerge(base, extra) {
	const out = { ...base };
	for (const [key, value] of Object.entries(extra)) if (value && typeof value === "object" && !Array.isArray(value) && base[key] && typeof base[key] === "object") out[key] = {
		...base[key],
		...value
	};
	else out[key] = value;
	return out;
}
function checkModel(model, rules) {
	const expected = rules.common ?? {};
	const issues = [];
	const page = model.page ?? {};
	const margin = expected.page ?? {};
	if (page.widthMm !== expected.page?.width_mm || page.heightMm !== expected.page?.height_mm) issues.push(issue("page-size", "P0", "页面尺寸", "page.size", pageLabel(page), "改为 A4", "公文用 A4", "7.1"));
	if ([
		page.top,
		page.bottom,
		page.left,
		page.right
	].some((value, index) => value !== [
		margin.margin_top_mm,
		margin.margin_bottom_mm,
		margin.margin_left_mm,
		margin.margin_right_mm
	][index])) issues.push(issue("page-margin", "P1", "页边距", "page.margin", pageMarginLabel(page), "按标准页边距修复", "页边距按 GB/T 9704", "7.1"));
	for (const paragraph of model.paragraphs ?? []) {
		const role = paragraph.role;
		if (role === "title") {
			if (paragraph.font !== expected.title?.font) issues.push(issue("title-font", "P0", "标题字体", "title.font", paragraph.text, `改为${expected.title?.font}`, "标题使用方正小标宋简体", "7.3.2", paragraph));
			if (paragraph.align !== expected.title?.align) issues.push(issue("title-align", "P1", "标题对齐", "title.align", paragraph.text, "改为居中", "标题居中", "7.3.2", paragraph));
			if (expected.title?.size_pt && paragraph.size !== expected.title.size_pt) issues.push(issue("title-size", "P1", "标题字号", "title.size", paragraph.text, `改为${expected.title.size_pt}磅`, "标题字号不符", "7.3.2", paragraph));
		}
		if (role === "body") {
			if (paragraph.font !== expected.body?.font) issues.push(issue("body-font", "P0", "正文字体", "body.font", paragraph.text, `改为${expected.body?.font}`, "正文使用仿宋", "7.3.3", paragraph));
			if (paragraph.size !== expected.body?.size_pt) issues.push(issue("body-size", "P0", "正文字号", "body.size", paragraph.text, "改为三号", "正文使用三号字", "7.3.3", paragraph));
		}
		if (role.startsWith("heading")) {
			const heading = expected[role] ?? expected.heading ?? {};
			if (heading.font && paragraph.font !== heading.font) issues.push(issue(`${role}-font`, "P2", "层次标题字体", `${role}.font`, paragraph.text, `改为${heading.font}`, "层次标题字体不符", "7.3.3", paragraph));
			if (heading.size_pt && paragraph.size !== heading.size_pt) issues.push(issue(`${role}-size`, "P2", "层次标题字号", `${role}.size`, paragraph.text, `改为${heading.size_pt}磅`, "层次标题字号不符", "7.3.3", paragraph));
			continue;
		}
		if (role === "heading" && expected.heading?.font && paragraph.font !== expected.heading.font) issues.push(issue("heading-font", "P2", "层次标题字体", "heading.font", paragraph.text, `改为${expected.heading.font}`, "层次标题字体不符", "7.3.3", paragraph));
		for (const field of [
			"font",
			"size_pt",
			"align"
		]) {
			const configured = expected[role]?.[field];
			const actual = field === "size_pt" ? paragraph.size : paragraph[field];
			if (configured != null && actual !== configured) issues.push(issue(`${role}-${field === "size_pt" ? "size" : field}`, field === "font" ? "P0" : "P1", `${roleName(role)}${field === "font" ? "字体" : field === "size_pt" ? "字号" : "对齐"}`, `${role}.${field}`, paragraph.text, `改为${configured}`, `${roleName(role)}格式不符`, "7.3.3", paragraph));
		}
	}
	const roles = new Set((model.paragraphs ?? []).map((item) => item.role));
	for (const role of rules.structure ?? []) if (!roles.has(role)) issues.push(issue(`missing-${role}`, "P1", "结构", `structure.${role}`, `缺少${roleName(role)}`, `补充${roleName(role)}`, `文种应包含${roleName(role)}`, "7.3"));
	for (const rule of rules.check_rules ?? []) {
		if (!rule?.id || issues.some((item) => item.id === rule.id || item.rule_id === rule.id)) continue;
		if (rule.field === "ending.check") {
			const text = [...model.paragraphs ?? []].reverse().find((item) => item.role === "body")?.text ?? "";
			if (text && !/特此通知|特此报告|请批复|此复|为荷/.test(text)) issues.push(issue(rule.id, rule.severity || "P2", rule.name || rule.id, rule.field, text.slice(0, 40), rule.expected || "补充规范结语", rule.message || "结语不规范", rule.standard_ref || ""));
		}
	}
	issues.push(...checkSemantic(model));
	return issues;
}
function applyFixes(model, rules, selected = null) {
	const allow = selected ? new Set(selected) : null;
	const next = structuredClone(model);
	next.meta = {
		...next.meta ?? {},
		type: next.type || next.meta?.type
	};
	const page = rules.common?.page ?? {};
	const actions = new Set((rules.fix_rules ?? []).map((item) => item.action));
	if (actions.has("page") && (!allow || allow.has("page-size") || allow.has("page-margin"))) next.page = {
		widthMm: page.width_mm,
		heightMm: page.height_mm,
		top: page.margin_top_mm,
		bottom: page.margin_bottom_mm,
		left: page.margin_left_mm,
		right: page.margin_right_mm
	};
	for (const paragraph of next.paragraphs ?? []) {
		if (paragraph.role === "title" && actions.has("title") && (!allow || allow.has("title-font") || allow.has("title-align") || allow.has("title-size"))) {
			paragraph.font = rules.common?.title?.font;
			paragraph.size = rules.common?.title?.size_pt;
			paragraph.align = rules.common?.title?.align;
		}
		if (paragraph.role === "body" && actions.has("body") && (!allow || allow.has("body-font") || allow.has("body-size"))) {
			paragraph.font = rules.common?.body?.font;
			paragraph.size = rules.common?.body?.size_pt;
			paragraph.line = rules.common?.body?.line_pt;
			paragraph.firstLineIndent = rules.common?.body?.first_indent_chars;
		}
		const role = paragraph.role ?? "";
		if (role.startsWith("heading") && actions.has(role) && (!allow || allow.has(`${role}-font`) || allow.has(`${role}-size`))) {
			const heading = rules.common?.[role] ?? rules.common?.heading ?? {};
			paragraph.font = heading.font || paragraph.font;
			paragraph.size = heading.size_pt || paragraph.size;
		}
	}
	return next;
}
function parseMarkdown(markdown, type = "notice") {
	const lines = String(markdown ?? "").replace(/\r\n/g, "\n").split("\n");
	const paragraphs = [];
	const tables = [];
	let index = 0;
	while (index < lines.length) {
		const text = lines[index].trim();
		if (!text) {
			index += 1;
			continue;
		}
		if (text.includes("|") && index + 1 < lines.length && /^\|?\s*:?-{3,}/.test(lines[index + 1].trim())) {
			const headers = splitRow(text);
			index += 2;
			const rows = [];
			while (index < lines.length && lines[index].includes("|")) rows.push(splitRow(lines[index++].trim()));
			tables.push({
				headers,
				rows
			});
			paragraphs.push({
				role: "body",
				text: `[表格 ${headers.join(" / ")}]`,
				font: "仿宋_GB2312",
				size: 16,
				align: "left",
				tableIndex: tables.length - 1
			});
			continue;
		}
		const heading = text.match(/^(#{1,6})\s+(.*)$/);
		if (heading) {
			const level = heading[1].length;
			paragraphs.push(level === 1 ? {
				role: "title",
				text: stripMd(heading[2]),
				font: "方正小标宋简体",
				size: 22,
				align: "center"
			} : {
				role: `heading${Math.min(level - 1, 4)}`,
				headingLevel: Math.min(level - 1, 4),
				text: stripMd(heading[2]),
				font: level === 2 ? "黑体" : "楷体_GB2312",
				size: 16,
				align: "left"
			});
			index += 1;
			continue;
		}
		const list = text.match(/^[-*+]\s+(.*)$/);
		if (list) {
			paragraphs.push({
				role: "body",
				text: list[2],
				font: "仿宋_GB2312",
				size: 16,
				align: "justify",
				line: 28,
				firstLineIndent: 2
			});
			index += 1;
			continue;
		}
		paragraphs.push(roleFromText(stripMd(text), null));
		index += 1;
	}
	return {
		type,
		page: standardPage(),
		paragraphs,
		tables,
		meta: {
			type,
			layoutProfile: "formal"
		}
	};
}
function sampleModel(type, name) {
	const title = name || "示例公文";
	return {
		type,
		page: standardPage(),
		paragraphs: [
			{
				role: "title",
				text: title,
				font: "方正小标宋简体",
				size: 22,
				align: "center"
			},
			{
				role: "recipient",
				text: "各有关单位：",
				font: "仿宋",
				size: 16,
				align: "left"
			},
			{
				role: "body",
				text: "　　现将有关事项通知如下。",
				font: "仿宋",
				size: 16,
				align: "justify",
				line: 28,
				firstLineIndent: 2
			},
			{
				role: "body",
				text: "　　特此通知。",
				font: "仿宋",
				size: 16,
				align: "justify",
				line: 28,
				firstLineIndent: 2
			},
			{
				role: "signature",
				text: "发文机关名称",
				font: "仿宋",
				size: 16,
				align: "right"
			},
			{
				role: "date",
				text: "2026年11月25日",
				font: "仿宋",
				size: 16,
				align: "right"
			}
		],
		tables: [],
		meta: {
			type,
			layoutProfile: "formal"
		}
	};
}
function splitRow(line) {
	return line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => stripMd(cell.trim()));
}
function stripMd(text) {
	return String(text).replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1").replace(/`([^`]+)`/g, "$1");
}
function roleFromText(text, align = "left") {
	const value = String(text ?? "").trim();
	const role = inferRole(value, align).role;
	const heading = /^heading([1-4])$/.exec(role);
	if (heading) {
		const level = Number(heading[1]);
		return {
			role,
			headingLevel: level,
			text: value,
			font: level === 1 ? "黑体" : level === 2 ? "楷体_GB2312" : "仿宋_GB2312",
			size: 16,
			align: "left"
		};
	}
	const styled = {
		title: {
			font: "方正小标宋简体",
			size: 22,
			align: "center"
		},
		issuer: {
			font: "楷体_GB2312",
			size: 16,
			align: "right"
		},
		date: {
			font: "仿宋_GB2312",
			size: 16,
			align: "right"
		},
		signature: {
			font: "仿宋_GB2312",
			size: 16,
			align: "right"
		}
	}[role];
	if (styled) return {
		role,
		text: value,
		...styled
	};
	if (role === "body") return {
		role,
		text: value,
		font: "仿宋_GB2312",
		size: 16,
		align: "justify",
		line: 28,
		firstLineIndent: 2
	};
	return {
		role,
		text: value,
		font: "仿宋_GB2312",
		size: 16,
		align: "left"
	};
}
function standardPage() {
	return {
		widthMm: 210,
		heightMm: 297,
		top: 37,
		bottom: 35,
		left: 28,
		right: 26
	};
}
function issue(id, severity, name, field, original, fix, message, standardRef = "", paragraph = null) {
	return {
		id,
		rule_id: id,
		severity,
		name,
		field,
		original: String(original ?? "").slice(0, 120),
		fix,
		suggestion: fix,
		message: message || fix,
		standard_ref: standardRef,
		paragraphIndex: paragraph ? void 0 : void 0,
		selected: true
	};
}
function pageLabel(page) {
	return `${page.widthMm || "?"}×${page.heightMm || "?"}mm`;
}
function pageMarginLabel(page) {
	return `上${page.top} 下${page.bottom} 左${page.left} 右${page.right}`;
}
function roleName(role) {
	return {
		title: "标题",
		recipient: "主送机关",
		body: "正文",
		signature: "署名",
		date: "成文日期",
		heading: "层次标题",
		heading1: "一级标题",
		heading2: "二级标题",
		heading3: "三级标题",
		heading4: "四级标题",
		documentNumber: "发文字号",
		attachment: "附件说明",
		issuer: "签发人",
		colophon: "版记",
		cc: "抄送"
	}[role] ?? role;
}
// dsh/dark-bid.js
/** 暗标/敏感信息扫描：身份证、手机、邮箱、银行卡 */
const MOBILE_RE = /(?<!\d)1[3-9]\d{9}(?!\d)/g;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const BANK_RE = /(?<!\d)(?:\d[ -]*?){16,19}(?!\d)/g;
const ID_RE = /(?<!\d)[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx](?!\d)/g;
function scanDarkBid(model) {
	const hits = [];
	const paragraphs = model?.paragraphs ?? [];
	for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex++) {
		const text = String(paragraphs[paragraphIndex]?.text ?? "");
		if (!text) continue;
		for (const match of text.matchAll(ID_RE)) {
			if (!validId18(match[0])) continue;
			hits.push(hit("id", match[0], maskKeepEnds(match[0], 4, 4), paragraphIndex, text));
		}
		for (const match of text.matchAll(MOBILE_RE)) hits.push(hit("mobile", match[0], maskKeepEnds(match[0], 3, 4), paragraphIndex, text));
		for (const match of text.matchAll(EMAIL_RE)) hits.push(hit("email", match[0], maskEmail(match[0]), paragraphIndex, text));
		for (const match of text.matchAll(BANK_RE)) {
			const digits = match[0].replace(/\D/g, "");
			if (digits.length < 16 || digits.length > 19) continue;
			if (/^1[3-9]\d{9}$/.test(digits)) continue;
			hits.push(hit("bank", match[0], maskKeepEnds(digits, 4, 4), paragraphIndex, text));
		}
	}
	return hits;
}
function redactDarkBid(model, selected = null) {
	const allow = selected ? new Set(selected.map(String)) : null;
	const next = structuredClone(model);
	const hits = scanDarkBid(next);
	for (const item of hits) {
		const key = `${item.type}:${item.excerpt}:${item.paragraphIndex}`;
		if (allow && !allow.has(key) && !allow.has(item.excerpt)) continue;
		const paragraph = next.paragraphs[item.paragraphIndex];
		if (!paragraph) continue;
		paragraph.text = paragraph.text.split(item.excerpt).join(item.mask);
	}
	return {
		model: next,
		hits
	};
}
function hit(type, excerpt, mask, paragraphIndex, text) {
	const start = Math.max(0, text.indexOf(excerpt) - 8);
	return {
		type,
		excerpt,
		mask,
		paragraphIndex,
		context: text.slice(start, start + excerpt.length + 16)
	};
}
function maskKeepEnds(value, head, tail) {
	const text = String(value).replace(/\s/g, "");
	if (text.length <= head + tail) return "*".repeat(text.length);
	return text.slice(0, head) + "*".repeat(text.length - head - tail) + text.slice(-tail);
}
function maskEmail(value) {
	const [user, domain] = String(value).split("@");
	if (!domain) return "***";
	return `${user.length <= 2 ? "*".repeat(user.length) : `${user[0]}***${user.slice(-1)}`}@${domain}`;
}
/** GB 11643 校验位 */
function validId18(value) {
	const id = String(value).toUpperCase();
	if (!/^\d{17}[\dX]$/.test(id)) return false;
	const weights = [
		7,
		9,
		10,
		5,
		8,
		4,
		2,
		1,
		6,
		3,
		7,
		9,
		10,
		5,
		8,
		4,
		2
	];
	const codes = "10X98765432";
	let sum = 0;
	for (let i = 0; i < 17; i++) sum += Number(id[i]) * weights[i];
	return codes[sum % 11] === id[17];
}
// dsh/format-extract.js
/** 从 DocumentModel 提取版式，生成可保存的规则 YAML 草稿 */
function extractFormat(model, options = {}) {
	const paragraphs = model?.paragraphs ?? [];
	const title = paragraphs.find((item) => item.role === "title") ?? paragraphs[0];
	const body = paragraphs.find((item) => item.role === "body") ?? paragraphs.find((item) => item.role !== "title");
	const page = model?.page ?? {};
	const name = String(options.name ?? "导入模板").trim() || "导入模板";
	const id = safeId$1(options.id || name);
	const common = {
		page: {
			width_mm: page.widthMm || 210,
			height_mm: page.heightMm || 297,
			margin_top_mm: page.top || 37,
			margin_bottom_mm: page.bottom || 35,
			margin_left_mm: page.left || 28,
			margin_right_mm: page.right || 26
		},
		title: {
			font: title?.font || "方正小标宋简体",
			size_pt: title?.size || 22,
			align: title?.align || "center"
		},
		body: {
			font: body?.font || "仿宋",
			size_pt: body?.size || 16,
			line_pt: body?.line || 28,
			first_indent_chars: 2
		}
	};
	const structure = uniqueRoles(paragraphs);
	const yaml = toYaml({
		name,
		title_prefix: name,
		structure,
		common,
		check_rules: [{
			id: "title-font",
			name: "标题字体",
			severity: "P0",
			field: "title.font",
			expected: common.title.font,
			message: `标题使用${common.title.font}`
		}, {
			id: "body-font",
			name: "正文字体",
			severity: "P0",
			field: "body.font",
			expected: common.body.font,
			message: `正文使用${common.body.font}`
		}],
		fix_rules: [
			{
				id: "fix-page",
				action: "page"
			},
			{
				id: "fix-title",
				action: "title"
			},
			{
				id: "fix-body",
				action: "body"
			}
		]
	});
	return {
		id,
		name,
		description: String(options.description ?? `从文档提取的${name}格式`),
		category: "自定义",
		structure,
		common,
		rules: yaml
	};
}
function uniqueRoles(paragraphs) {
	const roles = [];
	for (const item of paragraphs) if (item?.role && !roles.includes(item.role)) roles.push(item.role);
	return roles.length ? roles : [
		"title",
		"body",
		"signature",
		"date"
	];
}
function toYaml(value, indent = 0) {
	const pad = "  ".repeat(indent);
	if (Array.isArray(value)) {
		if (!value.length) return `${pad}[]\n`;
		return value.map((item) => {
			if (item && typeof item === "object" && !Array.isArray(item)) {
				const entries = Object.entries(item);
				if (!entries.length) return `${pad}- {}\n`;
				const [firstKey, firstVal] = entries[0];
				return `${pad}- ${firstKey}: ${formatScalar(firstVal)}\n` + entries.slice(1).map(([key, val]) => {
					if (val && typeof val === "object") return `${pad}  ${key}:\n${toYaml(val, indent + 2)}`;
					return `${pad}  ${key}: ${formatScalar(val)}\n`;
				}).join("");
			}
			return `${pad}- ${formatScalar(item)}\n`;
		}).join("");
	}
	if (value && typeof value === "object") return Object.entries(value).map(([key, val]) => {
		if (val && typeof val === "object") return `${pad}${key}:\n${toYaml(val, indent + 1)}`;
		return `${pad}${key}: ${formatScalar(val)}\n`;
	}).join("");
	return `${pad}${formatScalar(value)}\n`;
}
function formatScalar(value) {
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	const text = String(value ?? "");
	if (/[:#\n]|^\s|\s$/.test(text)) return JSON.stringify(text);
	return text;
}
function safeId$1(value) {
	const raw = String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
	if (!raw || !/^[a-z0-9_-]+$/.test(raw)) throw new Error("模板标识不正确");
	return raw.slice(0, 48);
}
// dsh/store.js
async function loadRules(packageRoot, dataRoot, type) {
	const common = parseRules(await readFile(join(packageRoot, "rules", "_common.yaml"), "utf8"));
	let id = "notice";
	try {
		id = safeId(type || "notice");
	} catch {
		id = "notice";
	}
	const fallback = await readOptional(join(packageRoot, "rules", `${id}.yaml`)) ?? await readOptional(join(packageRoot, "rules", "notice.yaml"));
	const override = await readOptional(join(dataRoot, "rules", `${id}.yaml`));
	if (!fallback) throw new Error(`没有${type}的规则`);
	return mergeRules(common, parseRules(override ?? fallback));
}
async function listTemplates(packageRoot, dataRoot) {
	return [...JSON.parse(await readFile(join(packageRoot, "templates", "catalog.json"), "utf8")), ...await readJson(join(dataRoot, "templates.json"), [])];
}
async function saveTemplate(dataRoot, input) {
	const name = String(input?.name ?? "").trim();
	const id = normalizeId(input?.id, name);
	if (!name) throw new Error("模板需要名称");
	const file = join(dataRoot, "templates.json");
	const templates = await readJson(file, []);
	if (templates.some((item) => item.id === id)) throw new Error("模板已存在");
	const template = {
		id,
		name,
		description: String(input.description ?? ""),
		category: String(input.category ?? "自定义"),
		builtin: false
	};
	await mkdir(dataRoot, { recursive: true });
	await writeFile(file, JSON.stringify([...templates, template], null, 2));
	if (input.rules) {
		await mkdir(join(dataRoot, "rules"), { recursive: true });
		await writeFile(join(dataRoot, "rules", `${id}.yaml`), String(input.rules));
	}
	return template;
}
async function updateTemplateRules(packageRoot, dataRoot, id, rulesText) {
	const templateId = safeId(id);
	if (!(await listTemplates(packageRoot, dataRoot)).some((item) => item.id === templateId)) throw new Error("模板不存在");
	await mkdir(join(dataRoot, "rules"), { recursive: true });
	await writeFile(join(dataRoot, "rules", `${templateId}.yaml`), String(rulesText ?? ""));
	return {
		id: templateId,
		saved: true
	};
}
async function deleteUserTemplate(dataRoot, id) {
	const templateId = safeId(id);
	const file = join(dataRoot, "templates.json");
	const templates = await readJson(file, []);
	const next = templates.filter((item) => item.id !== templateId);
	if (next.length === templates.length) throw new Error("只能删除自定义模板");
	await writeFile(file, JSON.stringify(next, null, 2));
	try {
		await unlink(join(dataRoot, "rules", `${templateId}.yaml`));
	} catch {}
	return {
		id: templateId,
		deleted: true
	};
}
async function listHistory(dataRoot) {
	return readJson(join(dataRoot, "history.json"), []);
}
async function rememberDocument(dataRoot, entry) {
	const file = join(dataRoot, "history.json");
	const history = await readJson(file, []);
	const item = {
		id: entry.id,
		name: entry.name,
		type: entry.type,
		status: entry.status || "checked",
		issues: entry.issues ?? entry.issueCount ?? 0,
		issueCount: entry.issues ?? entry.issueCount ?? 0,
		at: (/* @__PURE__ */ new Date()).toISOString()
	};
	const next = [item, ...history.filter((row) => row.id !== item.id)].slice(0, 50);
	await mkdir(dataRoot, { recursive: true });
	await writeFile(file, JSON.stringify(next, null, 2));
	return next;
}
async function updateHistoryStatus(dataRoot, id, status, extras = {}) {
	const file = join(dataRoot, "history.json");
	const next = (await readJson(file, [])).map((item) => item.id === id ? {
		...item,
		status,
		...extras,
		at: (/* @__PURE__ */ new Date()).toISOString()
	} : item);
	await writeFile(file, JSON.stringify(next, null, 2));
	return next;
}
async function getStats(dataRoot) {
	const history = await listHistory(dataRoot);
	return {
		documents: history.length,
		checks: history.filter((item) => ["checked", "optimized"].includes(item.status) || item.issues != null).length,
		issues: history.reduce((sum, item) => sum + Number(item.issueCount ?? item.issues ?? 0), 0),
		optimized: history.filter((item) => item.status === "optimized").length
	};
}
async function availableRuleCount(packageRoot) {
	return (await readdir(join(packageRoot, "rules"))).filter((name) => name.endsWith(".yaml") && !name.startsWith("_")).length;
}
async function saveJobBundle(dataRoot, job, source = null) {
	const id = safeJobId(job.id);
	const dir = join(dataRoot, "jobs");
	await mkdir(dir, { recursive: true });
	const staged = [];
	const commit = async (name, bytes) => {
		const temporary = join(dir, `${name}.${process.pid}.tmp`);
		await writeFile(temporary, bytes);
		staged.push([temporary, join(dir, name)]);
	};
	await commit(`${id}.json`, JSON.stringify(job));
	if (source) await commit(`${id}.docx`, source);
	const committed = [];
	try {
		for (const [temporary, target] of staged) {
			await rename(temporary, target);
			committed.push(target);
		}
	} catch (error) {
		await Promise.all(committed.map((target) => unlink(target).catch(() => {})));
		await Promise.all(staged.map(([temporary]) => unlink(temporary).catch(() => {})));
		throw error;
	}
	return job;
}
async function saveJob(dataRoot, job) {
	return saveJobBundle(dataRoot, job);
}
async function loadJob(dataRoot, id) {
	const job = await readJson(join(dataRoot, "jobs", `${safeJobId(id)}.json`), null);
	if (!job) throw new Error("请先完成校审");
	return job;
}
async function loadJobSource(dataRoot, id) {
	try {
		return await readFile(join(dataRoot, "jobs", `${safeJobId(id)}.docx`));
	} catch {
		return null;
	}
}
function documentTypeList() {
	return listTypes();
}
async function readOptional(file) {
	try {
		return await readFile(file, "utf8");
	} catch {
		return null;
	}
}
async function readJson(file, fallback) {
	try {
		return JSON.parse(await readFile(file, "utf8"));
	} catch {
		return fallback;
	}
}
function normalizeId(id, name) {
	const raw = String(id ?? "").trim().toLowerCase();
	if (raw) return safeId(raw);
	const fromName = String(name ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
	return fromName && /^[a-z0-9_-]+$/.test(fromName) ? fromName : `tpl-${Date.now().toString(36)}`;
}
function safeId(value) {
	const raw = String(value ?? "").trim().toLowerCase();
	if (!/^[a-z0-9_-]+$/.test(raw)) throw new Error("模板标识不正确");
	return raw;
}
function safeJobId(value) {
	const raw = String(value ?? "").trim();
	if (!/^[a-zA-Z0-9._-]+$/.test(raw)) throw new Error("作业标识不正确");
	return raw;
}
// dsh/index.js
const name = "taichi-dsh-official-doc";
const inject = ["connection"];
const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
function apply(ctx, config) {
	const root = typeof config?.root === "string" ? config.root : join(PACKAGE_ROOT, "data");
	const routes = [
		[
			"POST",
			"/api/plugin/taichi_official_doc/check",
			(body) => check(root, body)
		],
		[
			"GET",
			"/api/plugin/taichi_official_doc/job",
			(_body, request) => getJob(root, request)
		],
		[
			"POST",
			"/api/plugin/taichi_official_doc/fix",
			(body) => fix(root, body)
		],
		[
			"POST",
			"/api/plugin/taichi_official_doc/dark-bid",
			(body) => darkBid(root, body)
		],
		[
			"POST",
			"/api/plugin/taichi_official_doc/dark-bid/redact",
			(body) => darkBidRedact(root, body)
		],
		[
			"POST",
			"/api/plugin/taichi_official_doc/markdown",
			(body) => markdownDownload(body)
		],
		[
			"POST",
			"/api/plugin/taichi_official_doc/markdown/preview",
			(body) => markdownPreview(body)
		],
		[
			"POST",
			"/api/plugin/taichi_official_doc/markdown/download",
			(body) => markdownDownload(body)
		],
		[
			"GET",
			"/api/plugin/taichi_official_doc/templates",
			() => listTemplates(PACKAGE_ROOT, root)
		],
		[
			"POST",
			"/api/plugin/taichi_official_doc/templates/save",
			(body) => saveTemplate(root, body)
		],
		[
			"POST",
			"/api/plugin/taichi_official_doc/templates/create",
			(body) => saveTemplate(root, body)
		],
		[
			"POST",
			"/api/plugin/taichi_official_doc/templates/extract",
			(body) => extractTemplate(body)
		],
		[
			"POST",
			"/api/plugin/taichi_official_doc/templates/apply",
			(body) => applyTemplate(PACKAGE_ROOT, root, body)
		],
		[
			"POST",
			"/api/plugin/taichi_official_doc/templates/rules",
			(body) => updateTemplateRules(PACKAGE_ROOT, root, body?.id, body?.rules)
		],
		[
			"POST",
			"/api/plugin/taichi_official_doc/templates/delete",
			(body) => deleteUserTemplate(root, body?.id)
		],
		[
			"GET",
			"/api/plugin/taichi_official_doc/history",
			() => listHistory(root)
		],
		[
			"GET",
			"/api/plugin/taichi_official_doc/stats",
			() => getStats(root)
		],
		[
			"GET",
			"/api/plugin/taichi_official_doc/types",
			() => documentTypeList()
		],
		[
			"GET",
			"/api/plugin/taichi_official_doc/meta",
			async () => ({
				version: JSON.parse(await readFile(join(PACKAGE_ROOT, "package.json"), "utf8")).version,
				rules: await availableRuleCount(PACKAGE_ROOT),
				account: await loadAccount(root)
			})
		],
		[
			"GET",
			"/api/plugin/taichi_official_doc/account",
			() => loadAccount(root)
		],
		[
			"POST",
			"/api/plugin/taichi_official_doc/account/charge",
			(body) => chargeAccount(root, body?.action)
		],
		[
			"POST",
			"/api/plugin/taichi_official_doc/account/refund",
			(body) => refundAccount(root, body?.action)
		],
		[
			"GET",
			"/api/plugin/taichi_official_doc/preview",
			(_body, request) => previewJob(root, request)
		]
	];
	for (const [method, path, handle] of routes) ctx.connection.fetch.register({
		path,
		methods: [method],
		requestBody: "buffered",
		async fetch(request) {
			try {
				const body = method === "GET" ? void 0 : await readBody(request);
				const payload = await handle(body, request);
				return Response.json(payload, { headers: { "cache-control": "no-store" } });
			} catch (error) {
				const message = error instanceof Error ? error.message : "处理失败";
				return Response.json({ error: message }, {
					status: 400,
					headers: { "cache-control": "no-store" }
				});
			}
		}
	});
}
async function readBody(request) {
	if (!request?.json) return void 0;
	try {
		return await request.json();
	} catch {
		return;
	}
}
function queryId(request) {
	try {
		return new URL(request.url, "http://local").searchParams.get("id");
	} catch {
		return null;
	}
}
const MAX_UPLOAD_BYTES = 8388608;
async function check(root, body) {
	const type = body?.type || detectType(body?.filename);
	const model = await modelFrom(body);
	model.type = type;
	model.meta = {
		...model.meta ?? {},
		type,
		layoutProfile: model.meta?.layoutProfile || "formal"
	};
	const issues = checkModel(model, await loadRules(PACKAGE_ROOT, root, type));
	const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	const source = body?.bytes ? uploadBytes(body.bytes) : null;
	await saveJobBundle(root, {
		id,
		model,
		type,
		filename: body?.filename || "公文.docx",
		issues
	}, source);
	await rememberDocument(root, {
		id,
		name: body?.filename || "未命名",
		type,
		issues: issues.length,
		status: "checked"
	});
	return {
		id,
		type,
		issues,
		model: previewDto(model)
	};
}
async function getJob(root, request) {
	const id = queryId(request);
	if (!id) throw new Error("缺少作业 id");
	const job = await loadJob(root, id);
	return {
		id: job.id,
		type: job.type,
		filename: job.filename,
		issues: job.issues ?? checkModel(job.model, await loadRules(PACKAGE_ROOT, root, job.type)),
		model: previewDto(job.model)
	};
}
async function previewJob(root, request) {
	const id = queryId(request);
	if (!id) throw new Error("缺少作业 id");
	return previewDto((await loadJob(root, id)).model);
}
async function fix(root, body) {
	const job = await loadJob(root, body?.id);
	const source = await loadJobSource(root, job.id);
	const rules = await loadRules(PACKAGE_ROOT, root, job.type);
	const fixed = applyFixes(job.model, rules, Array.isArray(body?.issues) ? body.issues : null);
	await saveJob(root, {
		...job,
		model: fixed,
		issues: checkModel(fixed, rules)
	});
	await updateHistoryStatus(root, job.id, "optimized");
	return {
		filename: String(job.filename || "公文.docx").replace(/\.docx$/i, "") + "-已修复.docx",
		bytes: source ? await patchDocx(source, fixed) : await writeDocx(fixed),
		model: previewDto(fixed)
	};
}
async function darkBid(root, body) {
	return { hits: scanDarkBid(body?.id ? (await loadJob(root, body.id)).model : await modelFrom(body)) };
}
async function darkBidRedact(root, body) {
	const job = body?.id ? await loadJob(root, body.id) : null;
	const source = job ? await loadJobSource(root, job.id) : null;
	const { model: next, hits } = redactDarkBid(job?.model ?? await modelFrom(body), body?.selected);
	if (job) await saveJob(root, {
		...job,
		model: next
	});
	return {
		hits,
		filename: String(job?.filename || body?.filename || "公文.docx").replace(/\.docx$/i, "") + "-已脱敏.docx",
		bytes: source ? await patchDocx(source, next) : await writeDocx(next),
		model: previewDto(next)
	};
}
function markdownPreview(body) {
	const text = String(body?.markdown ?? "");
	if (!text.trim()) throw new Error("Markdown 不能为空");
	return { model: previewDto(parseMarkdown(text, body?.type || "notice")) };
}
async function markdownDownload(body) {
	const text = String(body?.markdown ?? "");
	if (!text.trim() && !body?.model) throw new Error("Markdown 不能为空");
	const model = body?.model ? hydrateModel(body.model) : parseMarkdown(text, body?.type || "notice");
	return {
		model: previewDto(model),
		filename: `${typeLabel(body?.type || model.type)}-草稿.docx`,
		bytes: await writeDocx(model)
	};
}
async function extractTemplate(body) {
	return extractFormat(await modelFrom(body), {
		name: body?.name,
		id: body?.id,
		description: body?.description
	});
}
async function applyTemplate(packageRoot, dataRoot, body) {
	const id = body?.id || "notice";
	const meta = (await listTemplates(packageRoot, dataRoot)).find((item) => item.id === id) || {
		id,
		name: id
	};
	let model;
	try {
		const rules = await loadRules(packageRoot, dataRoot, id);
		model = sampleModel(id, `${meta.name}（示例）`);
		model = applyFixes(model, rules);
	} catch {
		model = sampleModel(id, `${meta.name}（示例）`);
	}
	return {
		filename: `${meta.name || id}-模板.docx`,
		bytes: await writeDocx(model),
		model: previewDto(model)
	};
}
async function modelFrom(body) {
	if (body?.model) return hydrateModel(body.model);
	if (body?.markdown) return parseMarkdown(body.markdown, body.type);
	if (!body?.bytes) throw new Error("请上传 docx");
	const name = String(body.filename ?? "");
	if (/\.(doc|wps)$/i.test(name)) throw new Error("请先另存为 .docx 后再上传（本插件不内嵌 doc/wps 转换）");
	return readDocx(uploadBytes(body.bytes));
}
function uploadBytes(value) {
	const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
	if (bytes.length > 8388608) throw new Error("文件超过 8 MiB");
	return bytes;
}
function hydrateModel(model) {
	return {
		type: model.type,
		page: model.page,
		paragraphs: model.paragraphs ?? [],
		tables: model.tables ?? [],
		meta: model.meta ?? { type: model.type }
	};
}
function previewDto(model) {
	const { originalParagraphs: _originalParagraphs, originalPage: _originalPage, ...meta } = model.meta ?? {};
	return {
		type: model.type,
		page: model.page,
		paragraphs: model.paragraphs ?? [],
		tables: model.tables ?? [],
		meta
	};
}
function typeLabel(type) {
	return documentTypeList().find((item) => item.id === type)?.name || "公文";
}
export { MAX_UPLOAD_BYTES, apply, inject, name };
