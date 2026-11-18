import { latinWidths } from "./font-metrics.js";

export const paper = { width:595.28, height:841.89 };
const tone = { text:"#202322", muted:"#636763", rule:"#BDC3BD", fill:"#F1F3EE" };
const tokenPattern = /[^\S\n]+|[A-Za-z0-9][A-Za-z0-9._:/+%#@\-]*|[^\n]/gu;

export function measure(text, size) {
  let units = 0;
  for (const character of text) units += latinWidths[character] ?? 1;
  return units * size;
}

function wrap(text, width, size) {
  const lines = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    let used = 0;
    function flush() {
      lines.push(line.trimEnd());
      line = "";
      used = 0;
    }
    const tokens = paragraph.match(tokenPattern) ?? [];
    for (const token of tokens) {
      if (!line && !token.trim()) continue;
      const weight = measure(token,size);
      if (used + weight > width && line) {
        flush();
        if (!token.trim()) continue;
      }
      if (weight > width) {
        for (const char of token) {
          const charWidth = measure(char,size);
          if (used + charWidth > width && line) flush();
          line += char;
          used += charWidth;
        }
      } else {
        line += token;
        used += weight;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

function write(page, text, x, y, size, options = {}) {
  if (!text) return;
  const {width, center, right, bold, color} = options;
  const offset = width ? Math.max(0,width - measure(text,size)) : 0;
  page.items.push({kind:"text",text,x:x + (center ? offset/2 : right ? offset : 0),y,size,bold:Boolean(bold),color:color ?? tone.text});
}

function imageSize(image, maxWidth, maxHeight) {
  const scale = Math.min(maxWidth / image.width,maxHeight / image.height);
  return {width:scale * image.width,height:scale * image.height};
}

function createCover(cover) {
  const {variant,data,title,image} = cover;
  const page = {part:"cover",label:"",background:cover.background,items:[]};
  const sectionWidth = paper.width - 152;
  const left = 76;

  const centerLines = (text,size,y,bold) => {
    const lines = wrap(text,sectionWidth,size);
    for (const [i,line] of lines.entries()) write(page,line,left,y + i * (size + 6),size,{width:sectionWidth,center:true,bold});
    return y + lines.length * (size + 6);
  };
  function display(key, placeholder) {
    return data[key] || placeholder;
  }
  function rowList(rows,top,end,x = 110,available = paper.width - 210) {
    const labelWidth = 83;
    let size = 14;
    const wrapRows = () => rows.map(([,text]) => wrap(text,available-labelWidth,size));
    let linesByRow = wrapRows();
    const totalHeight = () => linesByRow.reduce((sum,lines) => sum + lines.length * size * 1.5 + size * .7,0);
    while (totalHeight() > end-top && size > 8) {
      --size;
      linesByRow = wrapRows();
    }
    let y = top;
    for (const [row,[label]] of rows.entries()) {
      write(page,`${label}：`,x,y,size,{bold:true});
      const lines = linesByRow[row];
      for (const [i,line] of lines.entries()) write(page,line,x+labelWidth,y+i*size*1.5,size);
      y += lines.length * size * 1.5 + size * .7;
    }
  }

  if (variant === "course") {
    const introEnd = centerLines(display("institution","〔學校與系所〕"),19,99,true);
    centerLines(title,25,introEnd + 22,true);
    rowList([
      ["年度",display("term","〔學年度與報告階段〕")],["題目",display("title","〔專題題目〕")],
      ["成員",display("members","〔成員與學號〕")],["指導老師",display("advisor","〔指導老師〕")],
    ],351,713);
    write(page,display("date","〔文件日期〕"),left,727,13,{width:sectionWidth,right:true});
    return page;
  }

  if (variant === "guidance") {
    const introEnd = centerLines(display("program","〔申請方案名稱〕"),19,108,true);
    centerLines(title,27,introEnd+24,true);
    rowList([
      ["計畫名稱",display("title","〔輔導計畫名稱〕")],["輔導單位",display("provider","〔輔導單位〕")],
      ["受輔導單位",display("recipient","〔受輔導單位〕")],["執行期間",display("period","〔執行期間〕")],
    ],327,610,99,paper.width - 198);
    let credits = 627;
    if (data.organizer) credits = centerLines(`主辦單位：${data.organizer}`,11,credits,false)+5;
    if (data.agency) centerLines(`委辦單位：${data.agency}`,11,credits,false);
    centerLines(display("date","〔文件日期〕"),13,744,false);
    return page;
  }

  const headerEnd = centerLines(`全國高級中等學校專業群科 ${display("year","〔年度〕")} 年\n專題實作及創意競賽`,17,90,true);
  const titleEnd = centerLines(title,23,headerEnd+15,true);
  if (image) {
    const size = imageSize(image,380,237);
    page.items.push({kind:"image",image,x:(paper.width-size.width)/2,y:titleEnd+32+(237-size.height)/2,...size});
  }
  rowList([
    ["群別",display("category","〔參賽群別〕")],["作品名稱",display("title","〔作品名稱〕")],
    ["關鍵詞",display("keywords","〔關鍵詞〕")],
  ],image ? Math.max(520,titleEnd+280) : 411,785);
  return page;
}

export function placeDocument(doc) {
  const [top,right,bottom,left] = doc.template.margin;
  const width = paper.width - right - left;
  const limit = paper.height - bottom;
  const font = doc.template.fontSize;
  const anchors = new Map();
  const books = [];

  function group(part) {
    const pages = [];
    let page;
    let y;
    function next() {
      page = {part, label:"",background:"#FFFFFF",items:[]};
      pages.push(page);
      y = top;
    }
    function fit(height) {
      if (y + height > limit && y > top) next();
    }
    function text(line,x,size,options) {
      write(page,line,x,y,size,options);
    }
    function commonHeading(block) {
      const size = block.level === 1 ? 15 : block.level === 2 ? 13 : 12;
      const gap = y === top ? 0 : block.level === 1 ? 13 : 7;
      const lines = wrap(block.text,width,size);
      fit(gap + lines.length * (size + 6) + 25);
      y += y === top ? 0 : gap;
      anchors.set(block.id,page);
      for (const line of lines) {
        fit(size + 6);
        text(line,left,size,{bold:true});
        y += size + 6;
      }
      y += 4;
    }
    function paragraph(block) {
      const firstIndent = block.placeholder ? 0 : font * 2;
      const lines = wrap(block.text,width - firstIndent,font);
      if (lines.length >= 2 && lines.length * 18.5 > limit-y && limit-y < 37) fit(37);
      for (const [i,line] of lines.entries()) {
        fit(18.5);
        text(line,left + (i === 0 ? firstIndent : 0),font,{color:block.placeholder ? tone.muted : tone.text});
        y += 18.5;
      }
      y += 4;
    }
    function drawGrid(block) {
      const gutter = 6;
      const size = 10.7;
      const lineHeight = 15;
      const weights = block.columns.reduce((sum,col) => sum+col.width,0);
      const sizes = block.columns.map((col) => width * col.width / weights);
      const split = (row) => row.map((value,i) => wrap(value,sizes[i] - 2*gutter,size));
      const header = split(block.columns.map((col) => col.label));
      const headerHeight = Math.max(...header.map((cell) => cell.length))*lineHeight + gutter*2;
      const cap = block.caption ? wrap(block.caption,width,11.5) : [];
      fit(16 * cap.length + headerHeight + lineHeight + gutter*2 + 10);
      y += 5;
      anchors.set(block.id,page);
      for (const line of cap) {
        text(line,left,11.5,{bold:true});
        y += 16;
      }
      function drawRow(cells,begin,lineCount,isHeader) {
        const rowHeight = lineCount * lineHeight + gutter*2;
        let x = left;
        for (const [index,cell] of cells.entries()) {
          page.items.push({kind:"box",x,y,width:sizes[index],height:rowHeight,fill:isHeader ? tone.fill : "#FFFFFF",stroke:tone.rule});
          for (let i = 0; i < lineCount && i + begin < cell.length; i++) {
            write(page,cell[i+begin],x+gutter,y+gutter+i*lineHeight,size,{bold:isHeader});
          }
          x += sizes[index];
        }
        y += rowHeight;
      }
      const repeatHeader = () => drawRow(header,0,Math.round((headerHeight-2*gutter)/lineHeight),true);
      repeatHeader();
      for (const row of block.rows) {
        const cells = split(row);
        const count = Math.max(...cells.map((cell) => cell.length));
        let start = 0;
        const roomOnFreshPage = Math.floor((limit-top-headerHeight-2*gutter)/lineHeight);
        if (count <= roomOnFreshPage && y + count * lineHeight + 2*gutter > limit) {
          next();
          repeatHeader();
        }
        while (start < count) {
          const room = Math.floor((limit-y-2*gutter)/lineHeight);
          if (room < 1) {
            next();
            repeatHeader();
            continue;
          }
          const chunk = Math.min(count-start,room);
          drawRow(cells,start,chunk,false);
          start += chunk;
        }
      }
      y += 9;
    }
    function drawImage(block) {
      const cap = wrap(block.caption,width,11.5);
      const size = imageSize(block.image,width,310);
      fit(size.height + 17 * cap.length + 22);
      y += 7;
      anchors.set(block.id,page);
      page.items.push({kind:"image",image:block.image,x:left+(width-size.width)/2,y,...size});
      y += size.height + 8;
      for (const line of cap) {
        text(line,left,11.5,{width,center:true});
        y += 17;
      }
      y += 6;
    }
    function index(title, entries) {
      const size = 12;
      text(title,left,17,{width,center:true,bold:true});
      y += 44;
      for (const entry of entries) {
        const indent = entry.level === 2 ? 18 : 0;
        const numberSpace = 30;
        const lines = wrap(entry.text,width - indent - numberSpace - 14,size);
        fit(lines.length * 20);
        for (const [i,line] of lines.entries()) {
          text(line,left + indent,size,{bold:!indent});
          if (i === lines.length - 1) {
            const start = left + indent + measure(line,size) + 8;
            const span = Math.max(0,left + width - numberSpace - start);
            page.items.push({kind:"leader",x:start,y:y+11,width:span,target:entry.id,end:left+width,size});
          }
          y += 20;
        }
      }
    }
    function blocks(entries) {
      for (const block of entries) {
        if (block.type === "heading") commonHeading(block);
        else if (block.type === "paragraph") paragraph(block);
        else if (block.type === "table") drawGrid(block);
        else if (block.type === "image") drawImage(block);
      }
    }
    next();
    books.push({part,pages});
    return {pages,blocks,index};
  }

  for (const blocks of doc.front) group("front").blocks(blocks);
  const indexes = [];
  if (doc.options.contents) indexes.push(group("contents"));
  if (doc.options.figureIndex && doc.figures.length) indexes.push(group("figures"));
  if (doc.options.tableIndex && doc.tables.length) indexes.push(group("tables"));
  const body = group("body");
  body.blocks(doc.body);
  if (doc.appendix.length) group("appendix").blocks(doc.appendix);
  let indexNum = 0;
  if (doc.options.contents) indexes[indexNum++].index("目錄",doc.contents);
  if (doc.options.figureIndex && doc.figures.length) indexes[indexNum++].index("圖目錄",doc.figures.map(({id,caption}) => ({id,text:caption})));
  if (doc.options.tableIndex && doc.tables.length) indexes[indexNum].index("表目錄",doc.tables.map(({id,caption}) => ({id,text:caption})));

  const result = [createCover(doc.cover),...books.flatMap(({pages}) => pages)];
  let roman = 0;
  let pageNumber = 0;
  const toRoman = (n) => "x".repeat(Math.floor(n / 10)) + ["","i","ii","iii","iv","v","vi","vii","viii","ix"][n%10];
  for (const page of result) {
    if (page.part === "cover" || page.part === "front") continue;
    else if (doc.template.key === "guidance" || page.part === "body" || page.part === "appendix") page.label = String(++pageNumber);
    else page.label = toRoman(++roman);
    write(page,page.label,left,paper.height-37,10,{center:true,width});
  }

  for (const page of result) {
    for (const item of [...page.items]) {
      if (item.kind !== "leader") continue;
      const label = anchors.get(item.target)?.label || "–";
      write(page,label,item.end-25,item.y-11,item.size,{width:25,right:true});
    }
  }

  const warnings = [];
  if (doc.template.key === "course" && (result.length < 5 || result.length > 10)) {
    warnings.push(`這份 PDF 共 ${result.length} 頁。期末範例建議 5–10 頁。`);
  }
  if (doc.template.key === "guidance" && result.filter((page) => page.part !== "appendix").length > 50) {
    warnings.push("輔導計畫的頁數超過 50 頁上限（不含附件）。");
  }
  return {pages:result,warnings,pageNumbers:Object.fromEntries([...anchors].map(([id,page]) => [id,page.label]))};
}
