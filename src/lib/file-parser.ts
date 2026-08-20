const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["pdf", "docx", "txt", "md", "rtf"]);

export async function extractResumeText(file: File) {
  if (file.size > MAX_BYTES) throw new Error("That file exceeds the 10 MB limit.");
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED.has(extension)) throw new Error("Use a PDF, DOCX, TXT, MD, or RTF resume.");
  if (extension === "txt" || extension === "md") return file.text();
  if (extension === "rtf")
    return (await file.text())
      .replace(/\\'[0-9a-f]{2}/gi, " ")
      .replace(/\\[a-z]+\d* ?/gi, " ")
      .replace(/[{}]/g, " ");
  if (extension === "pdf") return extractPdf(await file.arrayBuffer());
  return extractDocx(await file.arrayBuffer());
}

function extractPdf(buffer: ArrayBuffer) {
  const raw = new TextDecoder("latin1").decode(buffer);
  const literal = [...raw.matchAll(/\(([^()]{2,300})\)\s*Tj/g)].map((match) => match[1]);
  const arrays = [...raw.matchAll(/\[((?:\([^()]{1,200}\)\s*)+)\]\s*TJ/g)].flatMap((match) =>
    [...match[1].matchAll(/\(([^()]+)\)/g)].map((part) => part[1]),
  );
  const text = [...literal, ...arrays]
    .join(" ")
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\n/g, " ");
  if (text.trim().length < 40)
    throw new Error(
      "This PDF appears scanned or uses unsupported compression. Try a text-based PDF, DOCX, or TXT file.",
    );
  return text;
}

async function extractDocx(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let offset = 0;
  let documentData: Uint8Array | null = null;
  let method = 0;
  while (offset < bytes.length - 30) {
    if (read32(bytes, offset) !== 0x04034b50) {
      offset += 1;
      continue;
    }
    const currentMethod = read16(bytes, offset + 8);
    const size = read32(bytes, offset + 18);
    const nameLength = read16(bytes, offset + 26);
    const extraLength = read16(bytes, offset + 28);
    const name = new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + nameLength));
    const start = offset + 30 + nameLength + extraLength;
    if (name === "word/document.xml") {
      documentData = bytes.slice(start, start + size);
      method = currentMethod;
      break;
    }
    offset = start + size;
  }
  if (!documentData) throw new Error("DOCX text could not be found.");
  const xmlBytes = method === 0 ? documentData : await inflate(documentData);
  return new TextDecoder()
    .decode(xmlBytes)
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function inflate(data: Uint8Array) {
  if (!("DecompressionStream" in window))
    throw new Error("This browser cannot decompress DOCX files locally. Use TXT or a text-based PDF.");
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
function read16(bytes: Uint8Array, at: number) {
  return bytes[at] | (bytes[at + 1] << 8);
}
function read32(bytes: Uint8Array, at: number) {
  return (read16(bytes, at) | (read16(bytes, at + 2) << 16)) >>> 0;
}
