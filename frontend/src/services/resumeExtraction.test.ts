import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { extractResumeText } from "./resumeExtraction";

const WORD_NAMESPACE =
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

function docxFile(xml: string) {
  const bytes = zipSync({
    "word/document.xml": strToU8(xml),
  });
  const file = new File(["docx"], "resume.docx");
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  Object.defineProperty(file, "arrayBuffer", {
    value: () => Promise.resolve(buffer),
  });
  return file;
}

describe("extractResumeText", () => {
  it("extracts paragraphs from DOCX document XML", async () => {
    const file = docxFile(
      `<w:document xmlns:w="${WORD_NAMESPACE}"><w:body><w:p><w:r><w:t>Built scalable APIs.</w:t></w:r></w:p><w:p><w:r><w:t>Improved latency.</w:t></w:r></w:p></w:body></w:document>`,
    );

    await expect(extractResumeText(file)).resolves.toBe(
      "Built scalable APIs.\nImproved latency.",
    );
  });

  it("explains when a selected DOCX has no readable text", async () => {
    const file = docxFile(
      `<w:document xmlns:w="${WORD_NAMESPACE}"><w:body><w:p /></w:body></w:document>`,
    );

    await expect(extractResumeText(file)).rejects.toThrow(
      "No readable text was found.",
    );
  });

  it("rejects formats that the setup does not support", async () => {
    const file = new File(["text"], "resume.txt");

    await expect(extractResumeText(file)).rejects.toThrow(
      "Choose a PDF or DOCX resume file.",
    );
  });
});
