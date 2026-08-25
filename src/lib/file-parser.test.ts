import { describe, expect, it } from "vitest";
import { extractResumeDocument } from "./file-parser";

function localFile(name: string, content: Uint8Array | string, type = "application/octet-stream") {
  const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
  return {
    name,
    type,
    size: bytes.length,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  } as unknown as File;
}

function storedZipEntry(name: string, content: string) {
  const fileName = new TextEncoder().encode(name);
  const data = new TextEncoder().encode(content);
  const header = new Uint8Array(30 + fileName.length + data.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint32(18, data.length, true);
  view.setUint32(22, data.length, true);
  view.setUint16(26, fileName.length, true);
  header.set(fileName, 30);
  header.set(data, 30 + fileName.length);
  return header;
}

describe("local file extraction", () => {
  it("keeps UTF-8 text, blocks, and safe links local", async () => {
    const document = await extractResumeDocument(
      localFile(
        "résumé.txt",
        "Avery Mörgan\r\nhttps://example.test/work\r\n\r\nEXPERIENCE\r\n- Built APIs",
        "text/plain",
      ),
    );
    expect(document.format).toBe("text");
    expect(document.text).toContain("Avery Mörgan");
    expect(document.blocks).toHaveLength(2);
    expect(document.links).toEqual(["https://example.test/work"]);
  });

  it("extracts a genuine stored DOCX paragraph and table cells without executing document content", async () => {
    const xml =
      "<w:document><w:body><w:p><w:r><w:t>Avery Morgan</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Example Systems</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Engineer</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>";
    const document = await extractResumeDocument(localFile("resume.docx", storedZipEntry("word/document.xml", xml)));
    expect(document.format).toBe("docx");
    expect(document.text).toContain("Avery Morgan");
    expect(document.text).toContain("Example Systems | Engineer");
  });

  it("rejects malformed, renamed, and image-only documents with privacy-safe errors", async () => {
    await expect(
      extractResumeDocument(localFile("resume.docx", "<html>not a docx</html>", "text/html")),
    ).rejects.toThrow("not a supported");
    await expect(extractResumeDocument(localFile("resume.pdf", "%PDF-1.7\nstream\nendstream"))).rejects.toThrow(
      "OCR is required",
    );
    await expect(extractResumeDocument(localFile("resume.pdf", "not a pdf"))).rejects.toThrow("not a valid PDF");
  });

  it("rejects unsafe archive paths and never treats document text as code", async () => {
    const unsafe = storedZipEntry("../word/document.xml", "<w:document><w:body/></w:document>");
    await expect(extractResumeDocument(localFile("resume.docx", unsafe))).rejects.toThrow("unsafe archive path");
  });
});
