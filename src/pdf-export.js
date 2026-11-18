import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, pushGraphicsState, popGraphicsState, rgb, setLineWidth, setStrokingColor, setTextRenderingMode, TextRenderingMode } from "pdf-lib";
import { decodeImage } from "./images.js";
import { paper } from "./layout.js";
import { InputError } from "./model.js";

const palette = new Map();
function pdfColor(hex) {
  if (!palette.has(hex)) {
    const n = Number.parseInt(hex.slice(1),16);
    palette.set(hex,rgb((n >>> 16)/255, ((n >>> 8) & 255)/255, (n & 255)/255));
  }
  return palette.get(hex);
}

export async function exportPdf(doc, layout, fontBytes) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(doc.cover.data.title || doc.template.name);
  pdf.setSubject(doc.template.name);
  pdf.setLanguage("zh-TW");
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes,{subset:true});
  const charset = new Set(font.getCharacterSet());
  const absent = new Set();
  for (const page of layout.pages) {
    for (const item of page.items) {
      if (item.kind !== "text") continue;
      for (const character of item.text) {
        if (!charset.has(character.codePointAt(0))) absent.add(character);
      }
    }
  }
  if (absent.size) {
    throw new InputError(`PDF 字型無法顯示「${[...absent].slice(0,8).join(" ")}」。請換用相近字元或匯出 Word。`);
  }

  const images = new Map();
  for (const plan of layout.pages) {
    const page = pdf.addPage([paper.width,paper.height]);
    if (plan.background !== "#FFFFFF") {
      page.drawRectangle({x:0,y:0,width:paper.width,height:paper.height,color:pdfColor(plan.background)});
    }
    for (const item of plan.items) {
      if (item.kind === "text") {
        const options = {font,color:pdfColor(item.color),x:item.x,y:paper.height-item.y-item.size*.83,size:item.size};
        if (item.bold) page.pushOperators(pushGraphicsState(),setLineWidth(.23),setStrokingColor(options.color),setTextRenderingMode(TextRenderingMode.FillAndOutline));
        page.drawText(item.text,options);
        if (item.bold) page.pushOperators(popGraphicsState());
      } else if (item.kind === "box") {
        page.drawRectangle({x:item.x,y:paper.height-item.y-item.height,width:item.width,height:item.height,
          color:pdfColor(item.fill),borderColor:pdfColor(item.stroke),borderWidth:.46});
      } else if (item.kind === "leader") {
        const y = paper.height-item.y;
        page.drawLine({start:{x:item.x,y},end:{x:item.x+item.width,y},dashArray:[.7,2],thickness:.56,color:pdfColor("#7A7F79")});
      } else if (item.kind === "image") {
        const id = item.image.id;
        if (!images.has(id)) {
          try {
            const {type,bytes} = decodeImage(item.image);
            const image = type === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
            images.set(id,image);
          } catch {
            throw new InputError("有圖片無法讀取，請重新上傳 JPEG 或 PNG。");
          }
        }
        page.drawImage(images.get(id),{x:item.x,y:paper.height-item.y-item.height,width:item.width,height:item.height});
      }
    }
  }
  return pdf.save();
}
