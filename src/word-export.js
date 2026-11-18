import {
  AlignmentType, BookmarkStart, BookmarkEnd, BorderStyle, Document, Footer, Header, HeadingLevel, HorizontalPositionRelativeFrom,
  ImageRun, LeaderType, NumberFormat, Packer, PageNumber, Paragraph, SectionType, ShadingType,
  SimpleField, Tab, TabStopType, Table, TableCell, TableLayoutType, TableRow, TextRun, VerticalPositionRelativeFrom, WidthType,
} from "docx";
import { decodeImage } from "./images.js";
import { measure, paper } from "./layout.js";

const points = (n) => Math.round(n * 20);
const bank = (id) => `proposal_${id.replace(/[^A-Za-z0-9_]/g,"_")}`;
const headingLevels = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3];
const warmPaper = "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGP8uquBARtgwio6aCUAt+YCP0i5I+cAAAAASUVORK5CYII=";
const border = {style:BorderStyle.SINGLE,color:"BDC3BD",size:4};
const tableBorders = {top:border,bottom:border,left:border,right:border,insideHorizontal:border,insideVertical:border};

export async function exportWord(doc, layout) {
  const [top,right,bottom,left] = doc.template.margin.map(points);
  const pageWidth = points(paper.width);
  const textWidth = pageWidth - (left + right);
  const font = {ascii:"Times New Roman",hAnsi:"Times New Roman",eastAsia:"Noto Serif CJK TC",hint:"eastAsia"};
  const bodyFont = {...font,eastAsia:doc.template.bodyFont};
  const baseSize = doc.template.fontSize * 2;
  const run = (text,options = {}) => new TextRun({text,font,language:{value:"zh-TW",eastAsia:"zh-TW"},color:"202322",size:baseSize,...options});
  let bookmarkId = 0;
  const bookmark = (id,child) => {
    const numeric = ++bookmarkId;
    return [new BookmarkStart(bank(id),numeric),child,new BookmarkEnd(numeric)];
  };
  const spacing = (before,after,line = 370) => ({before:points(before),after:points(after),line,lineRule:"atLeast"});
  const numberedFooter = () => new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,
    children:[new TextRun({font,size:20,children:[PageNumber.CURRENT]})]})]});
  const blankFooter = () => new Footer({children:[new Paragraph("")]});
  const blankHeader = () => new Header({children:[new Paragraph("")]});
  const pageProps = (pageNumbers) => ({type:SectionType.NEXT_PAGE,page:{
    size:{width:pageWidth,height:points(paper.height),orientation:"portrait"},
    margin:{top,right,bottom,left,header:points(18),footer:points(31)},
    ...(pageNumbers && {pageNumbers}),
  }});
  const makeSection = (children,{numbered = false, numbers, header} = {}) => ({
    properties:pageProps(numbers),footers:{default:numbered ? numberedFooter() : blankFooter()},
    ...(header && {headers:{default:header}}),children,
  });

  function illustration(image,maxWidth,maxHeight) {
    const {bytes,type} = decodeImage(image);
    const scale = Math.min(maxWidth/image.width,maxHeight/image.height) * (4/3);
    return new ImageRun({data:bytes,type,transformation:{width:Math.round(image.width*scale),height:Math.round(image.height*scale)},
      altText:{title:image.caption || "作品圖片",description:image.caption || "作品圖片",name:"作品圖片"}});
  }

  function cover() {
    const {image,data,title,variant} = doc.cover;
    const centered = (text,size,before = 0,after = 0,bold = false) => new Paragraph({alignment:AlignmentType.CENTER,
      spacing:spacing(before,after,points(size+5)),children:[run(text,{size:size*2,bold})]});
    const get = (key,hint) => data[key] || `〔${hint}〕`;
    const fields = (rows,before,after) => {
      const estimatedLines = (size) => rows.reduce((sum,[label,value]) =>
        sum + Math.ceil(measure(label+value,size)/(textWidth/20-105)),0);
      const compact = estimatedLines(14) > 9;
      const size = compact ? 11 : 14;
      return rows.map(([label,value],index) => new Paragraph({
        indent:{left:points(45),right:points(35)},
        spacing:spacing(index ? 0 : compact ? before/2 : before,index === rows.length-1 ? after : 10,points(size+6)),
        children:[run(`${label}：`,{bold:true,size:size*2}),run(value,{size:size*2})],
      }));
    };
    if (variant === "course") return [
      centered(get("institution","學校與系所"),19,29,17,true),
      centered(title,25,0,0,true),
      ...fields([["年度",get("term","學年度與報告階段")],["題目",get("title","專題題目")],
        ["成員",get("members","成員與學號")],["指導老師",get("advisor","指導老師")]],148,0),
      new Paragraph({alignment:AlignmentType.RIGHT,spacing:spacing(117,0,370),children:[run(get("date","文件日期"),{size:26})]}),
    ];
    if (variant === "guidance") return [
      centered(get("program","申請方案名稱"),19,41,15,true),
      centered(title,27,0,0,true),
      ...fields([["計畫名稱",get("title","輔導計畫名稱")],["輔導單位",get("provider","輔導單位")],
        ["受輔導單位",get("recipient","受輔導單位")],["執行期間",get("period","執行期間")]],112,39),
      ...(data.organizer ? [centered(`主辦單位：${data.organizer}`,12,0,5)] : []),
      ...(data.agency ? [centered(`委辦單位：${data.agency}`,12,0,5)] : []),
      centered(get("date","文件日期"),13,29),
    ];
    return [
      centered(`全國高級中等學校專業群科 ${get("year","年度")} 年`,17,23,3,true),
      centered("專題實作及創意競賽",17,0,15,true),
      centered(title,23,0,0,true),
      ...(image ? [new Paragraph({alignment:AlignmentType.CENTER,spacing:spacing(27,0),
        children:[illustration(image,380,215)]})] : []),
      ...fields([["群別",get("category","參賽群別")],["作品名稱",get("title","作品名稱")],["關鍵詞",get("keywords","關鍵詞")]],image ? 41 : 158,0),
    ];
  }

  function caption(id, text, center = false) {
    return new Paragraph({alignment:center ? AlignmentType.CENTER : AlignmentType.LEFT,keepNext:!center,
      spacing:spacing(6,5,320),children:bookmark(id,run(text,{bold:!center,size:23}))});
  }

  function entryRows(rows) {
    return rows.map((entry) => {
      const indent = entry.level === 2 ? points(18) : 0;
      return new Paragraph({indent:{left:indent},spacing:spacing(0,1,390),
        tabStops:[{type:TabStopType.RIGHT,position:textWidth - indent,leader:LeaderType.DOT}],
        children:[run(entry.text,{bold:!indent}),new TextRun({children:[new Tab()]}),new SimpleField(`PAGEREF ${bank(entry.id)} \\h`,layout.pageNumbers[entry.id] || "–")],
      });
    });
  }

  function wordIndex(title,entries) {
    return [
      new Paragraph({alignment:AlignmentType.CENTER,keepNext:true,spacing:spacing(0,22,440),children:[run(title,{size:34,bold:true})]}),
      ...entryRows(entries),
    ];
  }

  function grid(block) {
    const all = block.columns.reduce((sum,col) => sum + col.width,0);
    const widths = block.columns.map((col) => Math.round(textWidth * col.width / all));
    function row(values, isHeader) {
      return new TableRow({tableHeader:isHeader,cantSplit:isHeader,children:values.map((v,index) => new TableCell({
        width:{size:widths[index],type:WidthType.DXA},
        shading:isHeader ? {type:ShadingType.CLEAR,fill:"F1F3EE"} : undefined,
        margins:{left:120,right:120,top:100,bottom:100},
        children:v.split("\n").map((line) => new Paragraph({spacing:spacing(0,0,298),children:[run(line,{size:21,bold:isHeader})]})),
      }))});
    }
    const table = new Table({layout:TableLayoutType.FIXED,width:{size:textWidth,type:WidthType.DXA},columnWidths:widths,
      borders:tableBorders,rows:[row(block.columns.map((c) => c.label),true),...block.rows.map((r) => row(r,false))]});
    return [
      ...(block.caption ? [caption(block.id,block.caption)] : []),table,new Paragraph({spacing:spacing(0,0,150),children:[run("",{size:10})]}),
    ];
  }

  function blocks(content) {
    return content.flatMap((block) => {
      if (block.type === "heading") {
        const size = [30,26,24][block.level-1];
        return new Paragraph({heading:headingLevels[block.level-1],keepNext:true,
          spacing:spacing(block.level === 1 ? 13 : 7,4,points(size/2+6)),
          children:bookmark(block.id,run(block.text,{bold:true,size})),
        });
      }
      if (block.type === "table") return grid(block);
      if (block.type === "image") return [
        new Paragraph({alignment:AlignmentType.CENTER,keepNext:true,spacing:spacing(7,0),
          children:[illustration(block.image,textWidth / 20,310)]}),
        caption(block.id,block.caption,true),
      ];
      return new Paragraph({spacing:spacing(0,4),indent:block.placeholder ? undefined : {firstLine:points(doc.template.fontSize*2)},
        children:[run(block.text,{font:bodyFont,color:block.placeholder ? "666A65" : "202322"})]});
    });
  }

  const coverHeader = doc.cover.variant === "guidance" ? new Header({
    children:[new Paragraph({children:[new ImageRun({
      type:"png",data:Uint8Array.from(atob(warmPaper),(char) => char.charCodeAt(0)),
      transformation:{width:Math.ceil(paper.width*4/3),height:Math.ceil(paper.height*4/3)},
      floating:{horizontalPosition:{relative:HorizontalPositionRelativeFrom.PAGE,offset:0},
        verticalPosition:{relative:VerticalPositionRelativeFrom.PAGE,offset:0},behindDocument:true,allowOverlap:true},
      altText:{title:"橘色封面",description:"橘色封面",name:"橘色封面"},
    })]})],
  }) : null;

  const sections = [makeSection(cover(),{header:coverHeader})];
  if (coverHeader) sections.push(...doc.front.map((content) => makeSection(blocks(content),{header:blankHeader()})));
  else sections.push(...doc.front.map((content) => makeSection(blocks(content))));
  const guidance = doc.template.key === "guidance";
  const roman = NumberFormat.LOWER_ROMAN;
  const decimal = NumberFormat.DECIMAL;
  const indexes = [];
  if (doc.options.contents) indexes.push(wordIndex("目錄",doc.contents));
  if (doc.options.figureIndex && doc.figures.length) indexes.push(wordIndex("圖目錄",doc.figures.map(({id,caption}) => ({id,text:caption}))));
  if (doc.options.tableIndex && doc.tables.length) indexes.push(wordIndex("表目錄",doc.tables.map(({id,caption}) => ({id,text:caption}))));
  for (const [i,index] of indexes.entries()) {
    sections.push(makeSection(index,{numbered:true,numbers:{...(i === 0 && {start:1}),formatType:guidance ? decimal : roman}}));
  }
  sections.push(makeSection(blocks(doc.body),{numbered:true,numbers:{...(guidance && indexes.length ? {} : {start:1}),formatType:decimal}}));
  if (doc.appendix.length) sections.push(makeSection(blocks(doc.appendix),{numbered:true,numbers:{formatType:decimal}}));

  const document = new Document({
    title:doc.cover.data.title || doc.template.name,subject:doc.template.name,
    features:{updateFields:true},
    styles:{default:{document:{run:{font:bodyFont,size:baseSize},paragraph:{spacing:spacing(0,4)}}}},
    sections,
  });
  return new Uint8Array(await Packer.toArrayBuffer(document));
}
