import { editableSections, sectionLabel, smallNumerals, templates } from "./templates.js";

export const limits = { field:1000, section:35000, text:155000, cell:1500, rows:120, images:16, imageBytes:460000, imageEdge:1600, request:10 * 1024 * 1024 };

export class InputError extends Error {}

export function getTemplate(key) {
  const template = typeof key === "string" && Object.hasOwn(templates, key) && templates[key];
  if (!template) throw new InputError("請選擇有效的模板。");
  return template;
}

export function emptyDraft(key) {
  const template = getTemplate(key);
  return {
    version:1, template:key,
    fields:Object.fromEntries(template.fields.map(({key}) => [key, ""])),
    sections:Object.fromEntries(editableSections(template).map(({key}) => [key, ""])),
    tables:Object.fromEntries(template.tables.map(({id}) => [id, []])),
    images:[],
    options:{contents:template.contents, figureIndex:template.contents, tableIndex:false},
  };
}

function object(value, label) {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new InputError(`${label}應是物件。`);
  return value;
}

function string(value, max, label, preserve = false) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.length > max) throw new InputError(`${label}須為 ${max.toLocaleString("zh-TW")} 字元以內的文字。`);
  const clean = value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  return preserve ? clean : clean.trim();
}

function readNumber(value, label, preserve) {
  const raw = typeof value === "number" ? String(value) : string(value, 20, label, preserve);
  if (raw.trim() && (!/^\d+(?:\.\d+)?$/.test(raw.trim()) || Number(raw) > 1e9)) {
    throw new InputError(`${label}須為 0 至 10 億之間的數字。`);
  }
  return raw;
}

export function readDraft(value, { preserve = false } = {}) {
  const input = object(value, "草稿");
  if (input.version !== undefined && input.version !== 1) throw new InputError("這份草稿的版本目前無法讀取。");
  const model = emptyDraft(input.template);
  const template = getTemplate(model.template);
  const fields = object(input.fields, "封面資料");
  const sections = object(input.sections, "正文");
  const tables = object(input.tables, "表格");
  const options = object(input.options, "文件設定");
  const definition = editableSections(template);
  let totalLength = 0;

  for (const f of template.fields) {
    const value = string(fields[f.key], f.key === "members" ? 200 : 100, f.label, preserve);
    model.fields[f.key] = preserve ? value : value.replace(/\s*\n\s*/g, f.key === "members" ? "、" : " ");
    totalLength += model.fields[f.key].length;
  }
  for (const s of definition) {
    model.sections[s.key] = string(sections[s.key], limits.section, s.title, preserve);
    totalLength += model.sections[s.key].length;
  }
  for (const t of template.tables) {
    const raw = tables[t.id] ?? [];
    if (!Array.isArray(raw) || raw.length > limits.rows) throw new InputError(`${t.title}最多支援 ${limits.rows} 列。`);
    model.tables[t.id] = raw.map((row) => {
      const rowData = object(row, t.title);
      return Object.fromEntries(t.columns.map(({key, label, type}) => {
        const cell = type === "number" ? readNumber(rowData[key], label, preserve) : string(rowData[key], limits.cell, label, preserve);
        totalLength += cell.length;
        return [key, cell];
      }));
    });
  }
  if (totalLength > limits.text) throw new InputError("草稿的文字已超過 155,000 字元。");
  for (const key of Object.keys(model.options)) {
    if (typeof options[key] === "boolean") model.options[key] = options[key];
  }
  if (template.contents) model.options.contents = true;

  const images = input.images ?? [];
  if (!Array.isArray(images) || images.length > limits.images) throw new InputError(`每份文件最多可放 ${limits.images} 張圖片。`);
  const places = new Set(definition.map(({key}) => key));
  if (template.coverImage) places.add("cover");
  let hasCover = false;
  model.images = images.map((record, index) => {
    const image = object(record,"圖片");
    if (!places.has(image.section)) throw new InputError("圖片指定的章節不存在。");
    if (image.section === "cover" && hasCover) throw new InputError("封面只能放一張圖片。");
    hasCover ||= image.section === "cover";
    const {width, height, data} = image;
    if (!Number.isInteger(width) || !Number.isInteger(height) || Math.min(width,height) < 1 ||
        Math.max(width,height) > limits.imageEdge || typeof data !== "string" ||
        data.length > Math.ceil(limits.imageBytes / 3) * 4 + 25 ||
        !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(data)) {
      throw new InputError(`圖片需為 JPEG 或 PNG，且長邊不超過 ${limits.imageEdge} px。`);
    }
    return {id:`image-${index + 1}`,section:image.section,caption:string(image.caption,220,"圖說",preserve),width,height,data};
  });
  return model;
}

export function presentRows(model, key) {
  return model.tables[key].filter((row) => Object.values(row).some((value) => value.trim().length));
}

const moneyKeys = new Set(["revenue","subsidy","cost","price","grant","own"]);
function moneyAmount(value) {
  return value === "" ? "" : String(Math.round(Number(value)));
}

export function funding(model) {
  const rows = presentRows(model,"budget");
  const grant = rows.reduce((sum, row) => sum + Number(moneyAmount(row.grant)), 0);
  const own = rows.reduce((sum, row) => sum + Number(moneyAmount(row.own)), 0);
  return {grant,own,total:grant + own};
}

export function validateProposal(input) {
  const draft = readDraft(input);
  const template = getTemplate(draft.template);
  const missingFields = template.fields.filter(({required,key}) => required && !draft.fields[key]).map(({key,label}) => ({key,label}));
  const missingSections = [...(template.front ?? [])];
  const populated = (s) => draft.sections[s.key].trim() || draft.images.some((img) => img.section === s.key) ||
    template.tables.some((t) => t.after === s.key && presentRows(draft,t.id).length);
  const missing = [...missingSections, ...template.sections.flatMap((s) => s.children.length ? s.children : [s])]
    .filter((s) => !populated(s)).map(({key,title}) => ({key,title}));
  const warnings = [];
  for (const [id, column, title] of [["team","share","分工比重"],["workTimeline","weight","時程權重"]]) {
    if (!draft.tables[id]) continue;
    const values = presentRows(draft,id).map((r) => r[column]).filter(Boolean);
    const sum = values.reduce((total, n) => total + Number(n),0);
    if (values.length && Math.abs(sum - 100) > 0.001) warnings.push(`${title}合計為 ${Number(sum.toFixed(3))}%，請確認是否應為 100%。`);
  }
  return {ready:!missingFields.length && !missing.length,missingFields,missingSections:missing,warnings};
}

function bodyBlocks(content, baseKey) {
  const blocks = [];
  for (const [index, raw] of content.split("\n").entries()) {
    const line = raw.trim();
    if (!line) continue;
    const heading = /^(#{2,3})\s+(\S.*)$/.exec(line);
    if (heading && heading[2].length <= 240) blocks.push({type:"heading",id:`${baseKey}-${index}`,text:heading[2],level:heading[1].length});
    else blocks.push({type:"paragraph",text:line});
  }
  return blocks;
}

function tableContent(model, template, spec) {
  const rows = presentRows(model,spec.id);
  const columns = [...spec.columns];
  const guidance = template.key === "guidance";
  const isFunding = spec.id === "budget";
  const isPurchase = spec.id === "materials" || spec.id === "services";
  const projectCells = (row) => columns.map(({key}) =>
    (guidance && moneyKeys.has(key) ? moneyAmount(row[key]) : row[key]) || (guidance ? "-" : ""));
  const mapped = rows.map(projectCells);
  if (isFunding || isPurchase) {
    const valueAt = (row) => isFunding
      ? Number(moneyAmount(row.grant)) + Number(moneyAmount(row.own))
      : Math.round(Number(row.price) * Number(row.quantity));
    columns.splice(isFunding ? 3 : columns.length, 0, {key:"total",label:isFunding ? "小計" : "總價",width:isFunding ? 19 : 10});
    for (const [index,row] of rows.entries()) mapped[index].splice(isFunding ? 3 : mapped[index].length,0,String(valueAt(row)));
    if (rows.length) {
      const total = mapped[0].map(() => "-");
      total[0] = "合計";
      if (isFunding) {
        const funds = funding(model);
        total.splice(1,3,String(funds.grant),String(funds.own),String(funds.total));
      } else total[total.length - 1] = String(rows.reduce((sum,row) => sum + valueAt(row),0));
      mapped.push(total);
    }
  }
  return {type:"table",id:`table-${spec.id}`,title:spec.title,columns,rows:mapped.length ? mapped : [columns.map(() => "-")]};
}

export function buildDocument(model) {
  const template = getTemplate(model.template);
  const absent = template.key === "guidance" ? "無" : "〔待填寫〕";
  const cover = {
    variant:template.key,
    background:template.key === "guidance" ? "#F5BA80" : "#FFFFFF",
    title:template.coverTitle,
    fields:template.fields,
    data:model.fields,
    image:model.images.find((picture) => picture.section === "cover"),
  };
  const figures = [];
  const tables = [];
  const contents = [];

  function buildSection(s, prefix, level, inContents, children = []) {
    const heading = {type:"heading",id:s.key,text:`${prefix}${s.title}`,level};
    if (inContents) contents.push(heading);
    const text = bodyBlocks(model.sections[s.key],s.key);
    if (inContents) contents.push(...text.filter((block) => block.type === "heading" && block.level <= 2));
    const art = model.images.filter((image) => image.section === s.key).map((image) => {
      const index = figures.length + 1;
      const block = {type:"image",id:`figure-${index}`,image,caption:`圖 ${index}${image.caption ? `　${image.caption}` : ""}`};
      figures.push(block);
      return block;
    });
    const grids = template.tables.filter((t) => t.after === s.key && (t.required || presentRows(model,t.id).length)).map((spec) => {
      const block = tableContent(model,template,spec);
      block.caption = `表 ${tables.length + 1}　${block.title}`;
      tables.push(block);
      return block;
    });
    const needsPlaceholder = !text.length && !art.length && !grids.length && !children.length;
    return [heading,...text,...(needsPlaceholder ? [{type:"paragraph",text:absent,placeholder:true}] : []),...grids,...art];
  }

  const front = (template.front ?? []).map((section) => {
    const blocks = buildSection(section,"",1,false);
    if (section.key === "summary") {
      const {grant,own,total} = funding(model);
      const entries = [
        ["輔導計畫名稱",model.fields.title || "-"],["計畫期程",model.fields.period || "-"],
        ["輔導單位",model.fields.provider || "-"],["受輔導單位",model.fields.recipient || "-"],
        ["政府補助／公司自籌／總經費（千元）",presentRows(model,"budget").length ? `${grant} ／ ${own} ／ ${total}` : "-"],
      ];
      blocks.splice(1,0,{type:"table",id:"summary-grid",columns:[{label:"項目",width:36},{label:"內容",width:64}],rows:entries});
    }
    return blocks;
  });

  const body = [];
  const appendix = [];
  for (const [index,s] of template.sections.entries()) {
    const destination = template.key === "guidance" && s.key === "appendix" ? appendix : body;
    const label = sectionLabel(template,s,index);
    destination.push(...buildSection(s,label.slice(0,label.length - s.title.length),1,true,s.children));
    for (const [i,child] of s.children.entries()) {
      destination.push(...buildSection(child,`${smallNumerals[i]}、`,2,true));
    }
  }
  return {template,cover,front,body,appendix,contents,figures,tables,options:model.options};
}

export function proposedFilename(draft, format) {
  const title = [...draft.fields.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g," ").replace(/^[. ]+|[. ]+$/g,"")].slice(0,72).join("");
  return `${title || getTemplate(draft.template).name}.${format}`;
}
