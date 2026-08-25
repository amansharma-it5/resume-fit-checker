const MAX_BYTES = 10 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 2 * 1024 * 1024;
const ALLOWED = new Set(["pdf", "docx", "txt", "md", "rtf"]);

export type ImportFormat = "pdf" | "docx" | "text" | "rtf";
export interface ImportBlock {
  id: string;
  text: string;
  sourceRef: string;
}
export interface ExtractedResumeDocument {
  format: ImportFormat;
  fileName: string;
  text: string;
  blocks: ImportBlock[];
  links: string[];
  warnings: string[];
}

const SAFE_LINK = /^(https?:\/\/|mailto:|tel:)/i;

export function normalizeImportText(value: string) {
  return value
    .split("\0")
    .join("")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v]+/g, " ")
    .replace(/[ \u00a0]+\n/g, "\n")
    .replace(/\n[ \u00a0]+/g, "\n")
    .replace(/([^\n])\n(?=[a-z,;:)])/g, "$1 ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_EXTRACTED_CHARS);
}

export function safeImportedLink(value: string) {
  const cleaned = [...value.trim()].filter((character) => character.charCodeAt(0) >= 32).join("");
  if (!SAFE_LINK.test(cleaned)) return "";
  try {
    const url = new URL(cleaned, "https://resume-lab.local");
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? cleaned : "";
  } catch {
    return "";
  }
}

function extensionOf(name: string) {
  return name.trim().toLowerCase().split(".").pop() || "";
}

function assertFile(file: File) {
  if (!file.size) throw new Error("That file is empty.");
  if (file.size > MAX_BYTES) throw new Error("That file exceeds the 10 MB local import limit.");
  const extension = extensionOf(file.name);
  if (!ALLOWED.has(extension)) throw new Error("Use a PDF, DOCX, TXT, MD, or RTF resume.");
  if (file.type && /html|javascript|executable/i.test(file.type))
    throw new Error("That file type is not a supported resume document.");
  return extension;
}

function splitBlocks(text: string) {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((text, index) => ({ id: `block-${index + 1}`, text, sourceRef: `block ${index + 1}` }));
}
function collectLinks(text: string) {
  return [
    ...new Set((text.match(/(?:https?:\/\/|mailto:|tel:)[^\s<>()]+/gi) || []).map(safeImportedLink).filter(Boolean)),
  ];
}
function makeDocument(
  format: ImportFormat,
  fileName: string,
  raw: string,
  warnings: string[] = [],
): ExtractedResumeDocument {
  const text = normalizeImportText(raw);
  if (!text) throw new Error("No usable text was found. Review a text-based PDF, DOCX, or TXT file instead.");
  if (raw.length > MAX_EXTRACTED_CHARS)
    warnings.push("Extraction was limited to 2 MB of text for safe local processing.");
  return { format, fileName, text, blocks: splitBlocks(text), links: collectLinks(text), warnings };
}

export async function extractResumeDocument(file: File): Promise<ExtractedResumeDocument> {
  const extension = assertFile(file);
  if (extension === "txt" || extension === "md") return makeDocument("text", file.name, await readText(file));
  if (extension === "rtf") return makeDocument("rtf", file.name, stripRtf(await readText(file)));
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (extension === "pdf") return makeDocument("pdf", file.name, extractPdf(bytes));
  return makeDocument("docx", file.name, await extractDocx(bytes));
}

export async function extractResumeText(file: File) {
  return (await extractResumeDocument(file)).text;
}

async function readText(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (decoded.includes("\uFFFD") && file.type && !/^text\//i.test(file.type))
    throw new Error("This text file uses an unsupported encoding. Save it as UTF-8 and try again.");
  return decoded;
}
function stripRtf(value: string) {
  return value
    .replace(/\\'[0-9a-f]{2}/gi, " ")
    .replace(/\\[a-z]+-?\d* ?/gi, " ")
    .replace(/[{}]/g, " ");
}

function extractPdf(bytes: Uint8Array) {
  const raw = new TextDecoder("latin1").decode(bytes);
  if (!raw.startsWith("%PDF-")) throw new Error("This file is not a valid PDF document.");
  const literal = [...raw.matchAll(/\(([^()]{2,500})\)\s*Tj/g)].map((match) => match[1]);
  const arrays = [...raw.matchAll(/\[((?:\([^()]{1,500}\)\s*)+)\]\s*TJ/g)].flatMap((match) =>
    [...match[1].matchAll(/\(([^()]+)\)/g)].map((part) => part[1]),
  );
  const text = [...literal, ...arrays]
    .join("\n")
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n");
  if (normalizeImportText(text).length < 40)
    throw new Error(
      "This PDF appears image-only, encrypted, or uses unsupported compression. OCR is required; try a text-based PDF, DOCX, or TXT file.",
    );
  return text;
}

interface ZipEntry {
  name: string;
  method: number;
  compressed: Uint8Array;
  uncompressedSize: number;
}
async function extractDocx(bytes: Uint8Array) {
  if (bytes.length < 4 || read32(bytes, 0) !== 0x04034b50) throw new Error("This file is not a valid DOCX archive.");
  const entries = readZipEntries(bytes);
  if (entries.some((entry) => /(^|\/)vbaProject\.bin$/i.test(entry.name)))
    throw new Error("Macro-enabled documents are not supported for local import.");
  const document = entries.find((entry) => entry.name === "word/document.xml");
  if (!document) throw new Error("DOCX document content could not be found.");
  const xml = new TextDecoder().decode(await unzip(document));
  if (!/<w:document\b/i.test(xml)) throw new Error("DOCX document content is malformed.");
  return docxXmlToText(xml);
}
function readZipEntries(bytes: Uint8Array): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;
  const decoder = new TextDecoder();
  while (offset + 30 <= bytes.length && entries.length < 200) {
    if (read32(bytes, offset) !== 0x04034b50) {
      offset += 1;
      continue;
    }
    const flags = read16(bytes, offset + 6),
      method = read16(bytes, offset + 8),
      compressedSize = read32(bytes, offset + 18),
      uncompressedSize = read32(bytes, offset + 22),
      nameLength = read16(bytes, offset + 26),
      extraLength = read16(bytes, offset + 28);
    const nameStart = offset + 30,
      dataStart = nameStart + nameLength + extraLength;
    if (flags & 0x08) throw new Error("This DOCX archive uses unsupported streamed entries.");
    if (dataStart + compressedSize > bytes.length || uncompressedSize > MAX_EXTRACTED_CHARS)
      throw new Error("This DOCX contains an unsafe or oversized document entry.");
    const name = decoder.decode(bytes.slice(nameStart, nameStart + nameLength));
    if (name.includes("..") || name.startsWith("/") || name.includes("\\"))
      throw new Error("This DOCX contains an unsafe archive path.");
    entries.push({ name, method, compressed: bytes.slice(dataStart, dataStart + compressedSize), uncompressedSize });
    offset = dataStart + compressedSize;
  }
  if (!entries.length || entries.length >= 200)
    throw new Error("This DOCX archive is malformed or has too many entries.");
  return entries;
}
async function unzip(entry: ZipEntry) {
  if (entry.method === 0) return entry.compressed;
  if (entry.method !== 8 || !("DecompressionStream" in window))
    throw new Error("This browser cannot safely decompress this DOCX locally. Use TXT or a text-based PDF.");
  const stream = new Blob([entry.compressed as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const data = new Uint8Array(await new Response(stream).arrayBuffer());
  if (data.length > MAX_EXTRACTED_CHARS || (entry.uncompressedSize && data.length !== entry.uncompressedSize))
    throw new Error("This DOCX entry could not be safely extracted.");
  return data;
}
function docxXmlToText(xml: string) {
  return decodeXml(xml)
    .replace(/<w:tab[^>]*\/>/gi, "\t")
    .replace(/<w:br[^>]*\/>/gi, "\n")
    .replace(/<\/w:p>\s*<\/w:tc>/gi, " | ")
    .replace(/<\/w:p>/gi, "\n")
    .replace(/<\/w:tr>/gi, "\n")
    .replace(/<\/w:tc>/gi, "")
    .replace(/<[^>]+>/g, "");
}
function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
function read16(bytes: Uint8Array, at: number) {
  return bytes[at] | (bytes[at + 1] << 8);
}
function read32(bytes: Uint8Array, at: number) {
  return (read16(bytes, at) | (read16(bytes, at + 2) << 16)) >>> 0;
}
