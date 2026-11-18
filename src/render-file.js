import { buildDocument, InputError, proposedFilename, readDraft, validateProposal } from "./model.js";
import { placeDocument } from "./layout.js";

export const mimeTypes = {
  pdf:"application/pdf",
  docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function renderFile(input,format,loadFont) {
  if (typeof format !== "string" || !Object.hasOwn(mimeTypes,format)) throw new InputError("請選擇 docx 或 pdf。");
  const draft = readDraft(input);
  const doc = buildDocument(draft);
  const layout = placeDocument(doc);
  let bytes;
  if (format === "docx") {
    const {exportWord} = await import("./word-export.js");
    bytes = await exportWord(doc,layout);
  } else {
    const {exportPdf} = await import("./pdf-export.js");
    bytes = await exportPdf(doc,layout,await loadFont());
  }
  return {bytes,format,mimeType:mimeTypes[format],filename:proposedFilename(draft,format),
    warnings:[...validateProposal(draft).warnings,...(format === "pdf" ? layout.warnings : [])]};
}
