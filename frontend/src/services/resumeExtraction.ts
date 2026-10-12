
import { strFromU8, Unzip, UnzipInflate, UnzipPassThrough } from "fflate";

const MAX_RESUME_TEXT_LENGTH = 30000;
const MAX_RESUME_FILE_BYTES = 5 * 1024 * 1024;
const MAX_PDF_PAGES = 100;
const MAX_DOCX_XML_BYTES = 10 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 5000;
const WORD_NAMESPACE =
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export async function extractResumeText(file: File): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  let text: string;
  if (extension !== "pdf" && extension !== "docx") {
    throw new Error("Choose a PDF or DOCX resume file.");
  }
  if (file.size > MAX_RESUME_FILE_BYTES) {
    throw new Error("Choose a resume file no larger than 5 MB.");
  }

  try {
    if (extension === "pdf") {
      const [pdfjs, workerModule] = await Promise.all([
        import("pdfjs-dist"),
        import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
      ]);
      pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(await file.arrayBuffer()),
      });
      try {
        const pdf = await loadingTask.promise;
        if (pdf.numPages > MAX_PDF_PAGES) {
          throw new Error(
            `This PDF has more than ${MAX_PDF_PAGES} pages. Choose a shorter resume.`,
          );
        }
        const pages: string[] = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const content = await page.getTextContent();
          pages.push(
            content.items
              .map((item) => ("str" in item ? item.str : ""))
              .filter(Boolean)
              .join(" "),
          );
        }
        text = pages.join("\n").trim();
      } finally {
        await loadingTask.destroy();
      }
    } else {
      const archive = new Uint8Array(await file.arrayBuffer());
      const xmlBytes = await extractDocxDocument(archive);
      const document = new DOMParser().parseFromString(
        strFromU8(xmlBytes),
        "application/xml",
      );
      if (document.getElementsByTagName("parsererror").length > 0) {
        throw new Error("The DOCX document XML is invalid.");
      }
      text = Array.from(
        document.getElementsByTagNameNS(WORD_NAMESPACE, "p"),
      )
        .map((paragraph) =>
          Array.from(
            paragraph.getElementsByTagNameNS(WORD_NAMESPACE, "t"),
          )
            .map((node) => node.textContent ?? "")
            .join(""),
        )
        .filter(Boolean)
        .join("\n")
        .trim();
    }
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith("This PDF has") ||
        error.message.startsWith("This DOCX has"))
    ) {
      throw error;
    }
    throw new Error(
      `Could not extract text from this ${extension?.toUpperCase() ?? "resume"} file. Check that it is a readable, text-based file and try again.`,
      { cause: error },
    );
  }

  if (!text) {
    throw new Error(
      "No readable text was found. This may be a scanned image; paste your resume text into the context field instead.",
    );
  }
  if (text.length > MAX_RESUME_TEXT_LENGTH) {
    throw new Error(
      "The extracted resume text exceeds 30,000 characters. Choose a shorter resume or paste a focused excerpt.",
    );
  }
  return text;
}

function extractDocxDocument(data: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const unzipper = new Unzip();
    unzipper.register(UnzipPassThrough);
    unzipper.register(UnzipInflate);
    let entries = 0;
    let documentFound = false;

    unzipper.onfile = (file) => {
      entries += 1;
      if (entries > MAX_ZIP_ENTRIES) {
        reject(new Error("This DOCX has too many archive entries to process."));
        return;
      }
      if (file.name !== "word/document.xml") return;
      documentFound = true;
      if (file.originalSize !== undefined && file.originalSize > MAX_DOCX_XML_BYTES) {
        reject(new Error("This DOCX has too much uncompressed document data to process."));
        file.terminate();
        return;
      }

      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      file.ondata = (error, chunk, final) => {
        if (error) {
          reject(new Error("The DOCX document could not be decompressed.", {
            cause: error,
          }));
          return;
        }
        totalBytes += chunk.length;
        if (totalBytes > MAX_DOCX_XML_BYTES) {
          reject(new Error("This DOCX has too much uncompressed document data to process."));
          file.terminate();
          return;
        }
        chunks.push(chunk);
        if (final) {
          const document = new Uint8Array(totalBytes);
          let offset = 0;
          for (const part of chunks) {
            document.set(part, offset);
            offset += part.length;
          }
          resolve(document);
        }
      };
      try {
        file.start();
      } catch (error) {
        reject(new Error("The DOCX compression format could not be read.", {
          cause: error,
        }));
      }
    };

    try {
      unzipper.push(data, true);
    } catch (error) {
      reject(new Error("The DOCX archive is invalid or unsupported.", {
        cause: error,
      }));
      return;
    }
    if (!documentFound) {
      reject(new Error("The DOCX archive does not contain readable document text."));
    }
  });
}
