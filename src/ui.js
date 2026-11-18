import { icon } from "./icons.js";
import { exampleDraft } from "./demo.js";
import { readSaved, saveDraft } from "./drafts.js";
import { buildDocument, emptyDraft, funding, limits, proposedFilename, readDraft, validateProposal } from "./model.js";
import { paper, placeDocument } from "./layout.js";
import { publicExportMinutes, publicMcpUrl } from "./public-config.js";
import { editableSections, sectionLabel, smallNumerals, sources, templateList, templates } from "./templates.js";

const app = document.querySelector("#app");
document.querySelector(".skip-link").addEventListener("click",(event) => {
  const main = document.querySelector("#main");
  if (!main) return;
  event.preventDefault();
  main.tabIndex = -1;
  main.focus();
});
const utility = document.querySelector("#utility");
const toast = document.querySelector("#toast");
const draftFile = document.querySelector("#draft-file");
const base = new URL("./",import.meta.url);
const routes = {edit:"",compare:"#comparison",mcp:"#mcp-docs"};
const viewUrl = (view) => new URL(routes[view],base).href;
const assetUrl = (path) => new URL(path,base).href;
const nav = [["edit","編輯文件","file"],["compare","格式比對","columns"],["mcp","MCP 介面","plug"]];
const tabs = [["cover","封面資料"],["body","正文章節"],["assets","表格與圖片"]];
const getView = () => Object.keys(routes).find((view) => routes[view] === location.hash) ?? "edit";
const esc = (text = "") => String(text).replace(/[&<>"']/g,(c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const nfmt = new Intl.NumberFormat("zh-TW");
const state = {view:getView(), key:"course", tab:"cover", section:"abstract", table:"schedule", page:0, draft:null, layout:null, example:true,
  menu:false, output:null, saveStatus:"範例草稿"};
let layoutTimer,toastTimer,navRevision;
const timers = new Map();
const current = () => templates[state.key];
const labels = () => [
  ...(current().front ?? []).map(({key,title}) => [key,title]),
  ...current().sections.flatMap((chapter,i) => [
    [chapter.key,sectionLabel(current(),chapter,i)],
    ...chapter.children.map(({key,title},j) => [key,`　${smallNumerals[j]}、${title}`]),
  ]),
];
const option = (value,label,selected) => `<option value="${esc(value)}"${selected ? " selected" : ""}>${esc(label)}</option>`;
const disabled = (condition) => condition ? " disabled" : "";
const btnIcon = (name,action,title,attributes="") =>
  `<button type="button" class="icon-button" data-action="${action}" aria-label="${title}" title="${title}" ${attributes}>${icon(name,17)}</button>`;

function tell(message,error = false) {
  toast.hidden = false;
  toast.classList.toggle("error",error);
  toast.innerHTML = `${icon(error ? "file" : "check",17)}<span>${esc(message)}</span>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; },4600);
}

function saveIndicator() {
  const label = document.querySelector("#save-label");
  if (label) label.textContent = state.saveStatus;
}
async function writeDraft(key,example,draft) {
  try {
    await saveDraft(key,{draft,example});
    if (key === state.key && draft === state.draft) {
      state.saveStatus = example ? "範例草稿" : "已儲存到此瀏覽器";
      saveIndicator();
    }
  } catch {
    if (key === state.key && draft === state.draft) {
      state.saveStatus = "瀏覽器儲存失敗";
      saveIndicator();
    }
  }
}
function queueSave() {
  const {key,draft,example} = state;
  clearTimeout(timers.get(key));
  timers.set(key,setTimeout(() => {
    timers.delete(key);
    writeDraft(key,example,draft);
  },240));
}
function update(section) {
  state.example = false;
  state.saveStatus = "儲存中…";
  saveIndicator();
  queueSave();
  if (section) state.section = section;
  queueLayout();
}

async function selectTemplate(key, showEditor = true) {
  if (!Object.hasOwn(templates,key)) return;
  const revision = (navRevision ?? 0)+1;
  navRevision = revision;
  if (state.draft && timers.has(state.key)) {
    clearTimeout(timers.get(state.key));
    timers.delete(state.key);
    await writeDraft(state.key,state.example,state.draft);
  }
  let record;
  try { record = await readSaved(key); } catch { /* JSON 仍可備份 */ }
  if (navRevision !== revision) return;
  state.key = key;
  try { state.draft = record ? readDraft(record.draft,{preserve:true}) : exampleDraft(key); }
  catch { state.draft = exampleDraft(key); record = null; }
  state.example = record?.example ?? true;
  state.saveStatus = state.example ? "範例草稿" : "已儲存到此瀏覽器";
  state.tab = "cover";
  state.section = editableSections(current())[0].key;
  state.table = current().tables[0].id;
  state.page = 0;
  state.menu = false;
  try { localStorage.setItem("proposal-studio:active",key); } catch { /* no storage */ }
  if (showEditor && state.view !== "edit") changeView("edit");
  else render();
}

function changeView(view,push = true) {
  if (push && state.view !== view) history.pushState({}, "",viewUrl(view));
  state.view = view;
  state.menu = false;
  render();
  window.scrollTo(0,0);
}

function sidebar() {
  return `<aside class="sidebar${state.menu ? " revealed" : ""}" aria-label="工作台選單">
    <a class="brand" href="${esc(viewUrl("edit"))}" data-view="edit"><img src="${esc(assetUrl("assets/mark.svg"))}" width="39" height="39" alt="">
      <div><strong>計畫書工作台</strong><span>Proposal Studio</span></div></a>
    <div class="sidebar-content">
      <div class="nav-heading">工作區</div>
      <nav class="nav-list">${nav.map(([view,label,glyph]) =>
        `<a href="${esc(viewUrl(view))}" data-view="${view}" class="side-item${state.view === view ? " current" : ""}"${state.view === view ? ' aria-current="page"' : ""}>${icon(glyph,17)}<span>${label}</span></a>`).join("")}</nav>
      <div class="nav-heading template-heading">文件模板</div>
      <div class="nav-list template-list">${templateList.map(({key,name,icon:glyph}) =>
        `<button class="side-item template-item${state.key === key ? " selected" : ""}" data-template="${key}" aria-pressed="${state.key === key}">
          ${icon(glyph,17)}<span>${name}</span>${state.key === key ? icon("chevron",14) : ""}</button>`).join("")}</div>
    </div>
    <a class="sources-short" href="${esc(viewUrl("compare"))}" data-view="compare">${icon("layers",19)}
      <span><strong>模板格式來源</strong><small>8 份附件的交叉比對</small></span>${icon("chevron",14)}</a>
  </aside>`;
}

function heading() {
  if (state.view === "compare") return `<div class="page-heading"><div><h1>格式比對</h1><p>檢視 8 份附件的篇章順序、圖表與頁碼規則。</p></div>
    <a class="button primary" href="${esc(viewUrl("edit"))}" data-view="edit">回到編輯器 ${icon("arrow",17)}</a></div>`;
  if (state.view === "mcp") return `<div class="page-heading"><div><h1>MCP 介面</h1><p>讓支援 MCP 的工具取得欄位、檢查草稿並產生文件。</p></div></div>`;
  return `<div class="page-heading"><div><h1>計畫書編輯器</h1><p>填寫章節、預覽版面，下載 Word 或 PDF。</p></div>
    <div class="heading-actions">
      <div class="draft-dropdown">
        <button class="button neutral" type="button" data-action="draft-menu" aria-expanded="false" aria-controls="draft-actions">草稿${icon("down",14)}</button>
        <div id="draft-actions" class="popover" hidden>
          <button data-action="blank">${icon("plus",16)}空白草稿</button>
          <button data-action="example">${icon("file",16)}載入範例</button>
          <hr><button data-action="backup">${icon("download",16)}下載草稿 JSON</button>
          <button data-action="import">${icon("file",16)}匯入草稿 JSON</button>
        </div>
      </div>
      <button class="button word" data-action="word" ${disabled(state.output)}>${icon("file",17)}<span>${state.output === "docx" ? "產生中…" : "匯出 Word"}</span></button>
      <button class="button primary" data-action="pdf" ${disabled(state.output)}>${icon("download",17)}<span>${state.output === "pdf" ? "產生中…" : "匯出 PDF"}</span></button>
    </div></div>`;
}

function editorHeader() {
  const {icon:glyph,name,kind} = current();
  return `<div class="template-header"><div class="template-tile">${icon(glyph,25)}</div>
    <div class="template-title"><div class="kind">${kind}</div><h2>${name}</h2></div>
    <button class="button check-button" data-action="check-draft">${icon("clipboard",16)}<span>檢查草稿</span></button>
  </div><div class="tabbar" role="tablist" aria-label="編輯區">${tabs.map(([key,label]) =>
    `<button type="button" role="tab" id="tab-${key}" aria-controls="editor-tabpanel" aria-selected="${state.tab === key}" tabindex="${state.tab === key ? "0" : "-1"}" data-tab="${key}">${label}</button>`).join("")}</div>`;
}

function renderCover() {
  const rows = current().fields.map(({key,label,placeholder,required},index) => {
    const value = state.draft.fields[key];
    const attr = `id="field-${key}" data-field="${key}" placeholder="${esc(placeholder)}" maxlength="${key === "members" ? 200 : 100}"`;
    return `<label class="form-field${current().key === "course" && index >= 4 ? " half" : ""}" for="field-${key}">
      <span>${esc(label)}${required ? '<span class="required" aria-hidden="true">*</span>' : ""}</span>
      ${key === "members" ? `<textarea rows="2" ${attr}>${esc(value)}</textarea>` : `<input type="text" ${attr} value="${esc(value)}">`}
    </label>`;
  });
  return `<div class="subheading"><div><h3>封面資料</h3><p>依模板順序排入文件封面。</p></div><span class="subtle-label"><span class="required">*</span> 建議填寫</span></div>
    <div class="field-grid">${rows.join("")}</div>
    <details class="settings"><summary>${icon("file",16)}文件設定${icon("down",14)}</summary>
      <div class="settings-content">${[["contents","章節目錄"],["figureIndex","圖目錄"],["tableIndex","表目錄"]].map(([key,label]) =>
        `<label><input type="checkbox" data-option="${key}"${state.draft.options[key] ? " checked" : ""}${disabled(key === "contents" && current().contents)}>${label}</label>`).join("")}</div>
    </details>`;
}

function renderBody() {
  const spec = editableSections(current()).find(({key}) => key === state.section);
  const entries = labels();
  const position = entries.findIndex(([key]) => key === spec.key);
  const value = state.draft.sections[spec.key];
  return `<div class="subheading"><div><h3>正文章節</h3><p>章節依模板排列，填寫後即時更新預覽。</p></div><span class="subtle-label">${position+1} / ${entries.length}</span></div>
    <label class="form-field"><span>目前章節</span><select id="section-picker" data-picker="section">
      ${entries.map(([key,title]) => option(key,title,key === spec.key)).join("")}
    </select></label>
    <div class="writer"><label class="form-field"><span>${esc(spec.title)}</span><textarea id="section-text" data-section="${spec.key}" rows="13" maxlength="${limits.section}" placeholder="${esc(spec.prompt)}">${esc(value)}</textarea></label>
      <div class="writer-meta"><span>用 <code>##</code> 或 <code>###</code> 開頭建立小節標題</span><span id="char-count">${nfmt.format(value.length)} 字</span></div></div>
    <div class="section-actions">
      <button class="button neutral compact" data-action="section-prev"${disabled(position === 0)}>${icon("left",15)}上一章</button>
      <button class="button neutral compact" data-action="section-next"${disabled(position === entries.length-1)}>下一章${icon("chevron",15)}</button>
    </div>`;
}

function renderAssets() {
  const t = current().tables.find(({id}) => id === state.table);
  const rows = state.draft.tables[t.id];
  const places = [...(current().coverImage ? [["cover","封面圖片"]] : []), ...labels()];
  const general = current().sections.find(({key}) => ["method","design","architecture"].includes(key))?.key ?? current().sections[0].key;
  return `<div class="subheading"><div><h3>文件表格</h3><p>表格會放入對應章節。</p></div></div>
    <label class="form-field"><span>表格類型</span><select id="table-picker" data-picker="table">
      ${current().tables.map(({id,title}) => option(id,title,id === state.table)).join("")}</select></label>
    <div class="rows">${rows.length ? rows.map((row,i) => `<div class="row-card"><div class="row-title"><strong>第 ${i+1} 列</strong>
      ${btnIcon("trash","remove-row",`移除第 ${i+1} 列`,`data-index="${i}"`)}</div>
      <div class="row-grid">${t.columns.map(({key,label,type,width}) => {
        const attrs = `data-cell="${key}" data-index="${i}"`;
        const value = esc(row[key]);
        return `<label class="form-field"><span>${label}</span>
          ${type === "number" ? `<input type="number" min="0" max="1000000000" step="any" inputmode="decimal" ${attrs} value="${value}" placeholder="0">` :
            width >= 28 ? `<textarea rows="2" maxlength="${limits.cell}" ${attrs}>${value}</textarea>` :
            `<input type="text" maxlength="${limits.cell}" ${attrs} value="${value}">`}
        </label>`;
      }).join("")}</div></div>`).join("") : '<div class="empty-rows">目前沒有資料列。</div>'}</div>
    <button class="button neutral compact" data-action="add-row" ${disabled(rows.length >= limits.rows)}>${icon("plus",16)}新增資料列</button>
    ${t.id === "budget" ? '<div class="funding" id="funding"></div>' : ""}
    <div class="asset-divider"></div>
    <div class="subheading"><div><h3>圖片</h3><p>加入流程圖、照片或甘特圖，並設定圖說。</p></div></div>
    <div class="picture-uploader"><label class="form-field"><span>放置位置</span><select id="image-place">${places.map(([key,title]) => option(key,title,key === general)).join("")}</select></label>
      <label class="button neutral compact file-button">${icon("image",16)}上傳圖片<input type="file" id="image-file" accept="image/png,image/jpeg"${disabled(state.draft.images.length >= limits.images)}></label></div>
    <div class="pictures">${state.draft.images.map((picture,i) => `<div class="picture-row"><img src="${esc(picture.data)}" alt="">
      <div><span>${esc(places.find(([key]) => key === picture.section)?.[1] ?? "")}</span>
      <input type="text" aria-label="圖片 ${i+1} 圖說" data-image-caption="${i}" maxlength="220" placeholder="輸入圖說" value="${esc(picture.caption)}"></div>
      ${btnIcon("trash","remove-image",`移除圖片 ${i+1}`,`data-index="${i}"`)}</div>`).join("")}</div>`;
}

function editPanel() {
  return `<section class="panel edit-panel" aria-label="編輯文件" id="edit-panel">
    ${editorHeader()}<div id="editor-tabpanel" role="tabpanel" aria-labelledby="tab-${state.tab}" class="panel-body">
      ${state.tab === "body" ? renderBody() : state.tab === "assets" ? renderAssets() : renderCover()}
    </div></section>`;
}
function paperMarkup() {
  return '<div class="paper-frame"><div class="paper" inert aria-hidden="true"></div></div>';
}
function previewPanel() {
  return `<section class="panel preview-panel" aria-label="文件預覽">
    <div class="preview-header"><div class="preview-name">${icon("file",18)}<h2>文件預覽</h2></div>
      <div class="view-actions"><span class="paper-type">A4 直式</span>${btnIcon("expand","zoom","放大預覽")}</div></div>
    <div class="paper-stage">${paperMarkup()}</div>
    <div class="paper-footer"><div class="page-nav">${btnIcon("left","page-prev","上一頁")}</div>
      <span class="page-status" aria-live="polite"></span><div class="page-nav">${btnIcon("chevron","page-next","下一頁")}</div>
    </div>
  </section>`;
}
function drawPreview() {
  const page = state.layout?.pages[state.page];
  if (!page) return;
  const elements = document.querySelectorAll(".paper");
  const items = page.items.map((item) => {
    const pos = `left:${item.x}px;top:${item.y}px`;
    if (item.kind === "text") return `<span class="paper-text" style="${pos};font-size:${item.size}px;color:${item.color};font-weight:${item.bold ? 650 : 400}">${esc(item.text)}</span>`;
    if (item.kind === "image") return `<img style="${pos};width:${item.width}px;height:${item.height}px" src="${esc(item.image.data)}" alt="">`;
    if (item.kind === "box") return `<i class="paper-box" style="${pos};width:${item.width}px;height:${item.height}px;background:${item.fill};border-color:${item.stroke}"></i>`;
    return `<i class="paper-leader" style="${pos};width:${item.width}px"></i>`;
  }).join("");
  for (const element of elements) {
    element.style.backgroundColor = page.background;
    element.innerHTML = items;
  }
  for (const element of document.querySelectorAll(".page-status")) {
    const type = {cover:"封面",front:"前置頁",contents:"目錄",figures:"圖目錄",tables:"表目錄",body:"正文",appendix:"附件"}[page.part];
    element.innerHTML = `<span>${type}</span><span class="page-separator"></span><strong>${state.page+1} <span>/</span> ${state.layout.pages.length}</strong>`;
  }
  for (const button of document.querySelectorAll('button[data-action="page-prev"]')) button.disabled = state.page <= 0;
  for (const button of document.querySelectorAll('button[data-action="page-next"]')) button.disabled = state.page >= state.layout.pages.length-1;
  scalePages();
}

const resize = new ResizeObserver(scalePages);
function scalePages() {
  for (const frame of document.querySelectorAll(".paper-frame")) {
    frame.style.setProperty("--page-scale",frame.clientWidth/paper.width);
  }
}

function syncLayout() {
  try {
    state.layout = placeDocument(buildDocument(readDraft(state.draft)));
    state.page = Math.max(0,Math.min(state.page,state.layout.pages.length-1));
    drawPreview();
  } catch { /* 使用最後一份有效的畫面 */ }
}
function gotoAnchor(id) {
  const label = state.layout?.pageNumbers[id];
  const index = state.layout?.pages.findIndex((page) => page.label === label && ["body","appendix"].includes(page.part));
  if (index >= 0) state.page = index;
  if (label === "" && current().front?.some((s) => s.key === id)) state.page = current().front.findIndex((s) => s.key === id)+1;
}
function queueLayout() {
  clearTimeout(layoutTimer);
  layoutTimer = setTimeout(syncLayout,140);
}
function showTableSummary() {
  const target = document.querySelector("#funding");
  if (!target) return;
  try {
    const funds = funding(readDraft(state.draft));
    target.innerHTML = `<span>政府補助 <b>${nfmt.format(funds.grant)}</b></span><span>公司自籌 <b>${nfmt.format(funds.own)}</b></span>
      <span>總經費 <b>${nfmt.format(funds.total)}</b> 千元</span>`;
  } catch { target.textContent = "請確認表格內的數字。"; }
}

const comparison = [
  ["course","校系、年度、題目、成員與指導老師","摘要 → 動機、問題、文獻 → 方法 → 時程、分工 → 自評與後續","時程、分工、參考文獻","12 點標楷體。原範例註記 5–10 頁，正文每頁至少 300 字。"],
  ["contest-project","競賽年度、群別、作品名稱、關鍵詞、封面圖片","摘要 → 動機、課程關聯 → 方法 → 成果、討論、結論 → 參考資料、附錄","時程、驗證、分工、競賽日誌","先列目錄，依稿件產生圖表目錄，正文起編阿拉伯數字。"],
  ["contest-creative","競賽年度、群別、作品名稱、關鍵詞、封面圖片","創意動機 → 特色 → 發想、設計原理 → 操作、製作歷程 → 附錄","時程、驗證、分工、日誌、參考資料","正文七章，前置目錄用羅馬數字。"],
  ["guidance","申請方案、計畫名稱、輔導雙方、執行期間","申請紀錄、摘要、目錄 → 公司概況至附件共十章","查核、效益、人力、經費、材料、委託、交付驗收等","橘色封面，從目錄編頁。50 頁上限（附件除外）。金額以新臺幣千元呈現。"],
];

function comparePage() {
  return `<div class="content-stack">
    <section class="panel comparison-panel"><div class="content-heading"><div class="template-tile">${icon("columns",23)}</div>
      <div><h2>四種模板的差異</h2><p>各模板共享 A4 直式排版，依用途保留原有的章節重點。</p></div></div>
      <div class="comparison-scroll" tabindex="0" aria-label="模板格式比對表"><table class="comparison-table">
        <thead><tr><th scope="col">模板</th><th scope="col">封面重點</th><th scope="col">章節順序</th><th scope="col">常用表格</th><th scope="col">排版規則</th></tr></thead>
        <tbody>${comparison.map(([key,...cells]) => `<tr><th scope="row"><button data-template="${key}">${templates[key].name}${icon("arrow",14)}</button></th>${cells.map((item) => `<td>${esc(item)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table></div>
    </section>
    <section class="panel evidence-panel"><div class="content-heading"><div class="template-tile">${icon("layers",22)}</div>
      <div><h2>附件格式來源</h2><p>比對封面、目錄、正文及附錄的實際排列。</p></div></div>
      <div class="evidence-grid">${sources.map(([name,format,summary]) => `<article class="evidence-card">
        <div class="evidence-kind">${icon("file",15)}${esc(format)}</div><h3>${esc(name)}</h3><p>${esc(summary)}</p>
      </article>`).join("")}</div>
    </section>
    <section class="panel format-notes"><h2>匯出時的排版</h2><ul>
      <li>Word 包含可編輯的標題與表格、標楷體正文及目錄頁碼欄位。修改內容後，可選取全文並更新欄位。</li>
      <li>PDF 內嵌繁體中文芫荽字型，並依實際分頁產生目錄、圖表目錄與頁碼。</li>
      <li>輔導計畫保留十大章節與主要表格。欄位與欄寬依網頁編輯與 A4 匯出重新配置。</li>
      <li>競賽專題組保留參考資料章；附件中的木光記把相關資料併入附錄。圖表目錄可依需要開啟。</li>
    </ul></section>
  </div>`;
}

const interfaces = [
  ["list_proposal_templates","列出模板","取得可用模板的代號和用途。",{}],
  ["get_proposal_template","讀取模板","取得封面、章節、表格欄位及空白草稿。",{template:"course"}],
  ["validate_proposal","檢查草稿","回傳缺漏欄位、章節、加總警示和 PDF 頁數。",{draft:{template:"course",fields:{title:"專題題目"}}}],
  ["export_proposal","產生文件",`匯出 Word 或 PDF，回傳 ${publicExportMinutes} 分鐘內有效的下載連結。`,{format:"pdf",draft:{template:"course",fields:{title:"專題題目"},sections:{abstract:"輸入計畫摘要。"}}}],
];
let toolIndex = 1;
const endpoint = () => new URL(__PROPOSAL_MCP_URL__ || publicMcpUrl,base).href;
const toolCall = () => JSON.stringify({
  jsonrpc:"2.0",id:1,method:"tools/call",params:{name:interfaces[toolIndex][0],arguments:interfaces[toolIndex][3],
    _meta:{
      "io.modelcontextprotocol/protocolVersion":"2026-07-28",
      "io.modelcontextprotocol/clientInfo":{name:"proposal-client",version:"1.0.0"},
      "io.modelcontextprotocol/clientCapabilities":{},
    },
  },
},null,2);

function mcpPage() {
  return `<div class="content-stack">
    <section class="panel mcp-endpoint"><div class="content-heading"><div class="template-tile">${icon("plug",24)}</div><div>
      <h2>公開連線端點</h2><p>在支援 Streamable HTTP 的 MCP 客戶端加入這個網址。</p>
      </div></div><div class="endpoint"><span>POST</span><code>${esc(endpoint())}</code>
      <button class="button neutral compact" data-action="copy-endpoint">${icon("copy",16)}複製網址</button></div>
    </section>
    <section class="panel mcp-tools"><div class="content-heading"><div class="template-tile">${icon("code",23)}</div>
      <div><h2>可呼叫的工具</h2><p>先讀取指定模板，再檢查或匯出同一份草稿。</p></div></div>
      <div class="tool-grid">${interfaces.map(([name,label,description],i) => `<button class="tool-card${i === toolIndex ? " chosen" : ""}" data-tool="${i}" aria-pressed="${i === toolIndex}">
        <strong>${label}</strong><code>${name}</code><span>${description}</span></button>`).join("")}</div>
    </section>
    <section class="panel mcp-example"><div class="content-heading"><div><h2>JSON-RPC 呼叫範例</h2>
      <p>建議傳送 <code>MCP-Protocol-Version: 2026-07-28</code> 與 <code>Content-Type: application/json</code>。</p></div>
      <button class="button neutral compact" data-action="copy-request">${icon("copy",16)}複製 JSON</button></div>
      <pre tabindex="0"><code>${esc(toolCall())}</code></pre>
      <a class="text-link" href="${esc(assetUrl("mcp-tools.json"))}" target="_blank" rel="noopener">檢視工具的 JSON Schema ${icon("external",15)}</a>
    </section>
  </div>`;
}

function render() {
  const pageTitle = state.view === "edit" ? "編輯文件" : nav.find(([key]) => key === state.view)[1];
  app.innerHTML = `${sidebar()}${state.menu ? '<button class="mobile-overlay" data-action="side-menu" aria-label="關閉選單"></button>' : ""}
    <main class="workspace" id="main">
      <div class="topbar">${btnIcon("menu","side-menu","切換側邊選單")}<div class="breadcrumb"><span>工作區</span>${icon("chevron",13)}<strong>${pageTitle}</strong></div>
        ${state.view === "edit" ? `<div class="save-status"><i></i><span id="save-label">${esc(state.saveStatus)}</span></div>` : ""}</div>
      <div class="main-frame">${heading()}${state.view === "edit" ? `<div class="editor-grid">${editPanel()}${previewPanel()}</div>
        <div class="workspace-note">${icon("file",15)}<span>${esc(current().note)}</span></div>`
        : state.view === "compare" ? comparePage() : mcpPage()}</div></main>`;
  resize.disconnect();
  for (const frame of document.querySelectorAll(".paper-frame")) resize.observe(frame);
  if (state.view === "edit") {
    syncLayout();
    showTableSummary();
  }
}

function refreshEditor(focus) {
  const p = document.querySelector("#edit-panel");
  if (p) p.outerHTML = editPanel();
  if (focus) document.querySelector(focus)?.focus();
  showTableSummary();
  drawPreview();
}
function selectSection(key,focus = false) {
  state.section = key;
  gotoAnchor(key);
  refreshEditor(focus ? "#section-text" : "#section-picker");
}
function selectTab(key,focus = false) {
  state.tab = key;
  if (key === "cover") state.page = 0;
  if (key === "body") gotoAnchor(state.section);
  if (key === "assets") {
    const table = current().tables.find(({id}) => id === state.table);
    gotoAnchor(table.after);
  }
  refreshEditor(focus ? `#tab-${key}` : "");
}

function dialog(title,body,className = "") {
  if (utility.open) utility.close();
  utility.className = className;
  utility.setAttribute("aria-labelledby","dialog-title");
  utility.innerHTML = `<div class="dialog-heading"><h2 id="dialog-title">${esc(title)}</h2>${btnIcon("close","close-dialog","關閉")}</div>${body}`;
  utility.showModal();
}

function checkDraft() {
  try {
    const result = validateProposal(state.draft);
    const fields = result.missingFields.map(({label}) => label);
    const sections = result.missingSections.map(({title}) => title);
    const warnings = [...result.warnings,...(state.layout?.warnings ?? [])];
    const messages = [
      ["待填封面欄位",fields],["待填章節",sections],["格式提醒",warnings],
    ].filter(([,items]) => items.length);
    dialog("草稿檢查",`<div class="dialog-content">${messages.length ?
      messages.map(([label,items]) => `<div class="check-group"><h3>${label}</h3><ul>${items.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></div>`).join("") :
      `<p class="check-success">${icon("check",18)}填寫的欄位和版面已通過本次檢查。</p>`}
      <p class="check-note">目前 PDF 預覽共 ${state.layout?.pages.length ?? 0} 頁，空白草稿也可匯出。</p></div>`);
  } catch (error) { tell(error.message,true); }
}

function openLargePreview() {
  dialog("文件預覽",`<div class="large-paper-stage">${paperMarkup()}</div><div class="paper-footer">
    ${btnIcon("left","page-prev","上一頁")}<span class="page-status"></span>${btnIcon("chevron","page-next","下一頁")}</div>`,"preview-dialog");
  resize.observe(utility.querySelector(".paper-frame"));
  drawPreview();
}

function popover(open) {
  const p = document.querySelector("#draft-actions");
  const b = document.querySelector('[data-action="draft-menu"]');
  if (!p || !b) return;
  p.hidden = !open;
  b.setAttribute("aria-expanded",String(open));
}

function saveAs(blob,name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url),8000);
}

let fontPromise;
function loadBrowserFont() {
  fontPromise ??= fetch(assetUrl("assets/Iansui-Regular.ttf")).then((response) => {
    if (!response.ok) throw new Error("PDF 字型載入失敗，請重新整理後再試。");
    return response.arrayBuffer();
  }).then((buffer) => new Uint8Array(buffer)).catch((error) => {
    fontPromise = undefined;
    throw error;
  });
  return fontPromise;
}

async function download(format) {
  if (state.output) return;
  let draft;
  try { draft = readDraft(state.draft); }
  catch (error) { tell(error.message,true); return; }
  state.output = format;
  const updateActions = () => {
    const existing = document.querySelector(".page-heading");
    if (existing && state.view === "edit") existing.outerHTML = heading();
  };
  updateActions();
  try {
    const {renderFile} = await import("./render-file.js");
    const file = await renderFile(draft,format,loadBrowserFont);
    saveAs(new Blob([file.bytes],{type:file.mimeType}),file.filename);
    tell(`${format === "pdf" ? "PDF" : "Word"} 已下載。`);
  } catch (error) { tell(error.message || "匯出失敗，請稍後再試。",true); }
  finally { state.output = null; updateActions(); }
}

async function paste(text,message) {
  try { await navigator.clipboard.writeText(text); tell(message); }
  catch { dialog("手動複製",`<div class="dialog-content"><textarea class="copy-fallback" readonly rows="6">${esc(text)}</textarea></div>`); }
}

function replaceDraft(draft,example) {
  state.draft = draft;
  state.key = draft.template;
  state.example = example;
  state.saveStatus = example ? "範例草稿" : "儲存中…";
  state.tab = "cover";
  state.table = current().tables[0].id;
  state.section = editableSections(current())[0].key;
  state.page = 0;
  try { localStorage.setItem("proposal-studio:active",state.key); } catch { /* no storage */ }
  queueSave();
  render();
}

function resetDraft(example) {
  const model = example ? exampleDraft(state.key) : emptyDraft(state.key);
  if (!state.example && !confirm("將替換目前模板的草稿。要繼續嗎？")) return;
  replaceDraft(model,example);
  tell(example ? "已載入範例。" : "已開啟空白草稿。");
}

async function uploadPicture(input) {
  const file = input.files?.[0];
  if (!file) return;
  const place = document.querySelector("#image-place").value;
  const targetDraft = state.draft;
  if (place === "cover" && targetDraft.images.some((image) => image.section === "cover")) {
    tell("封面已有一張圖片，請先移除它。",true);
    input.value = "";
    return;
  }
  if (file.size > 24 * 1024 * 1024 || !["image/png","image/jpeg"].includes(file.type)) {
    tell("請上傳 24 MB 以內的 JPEG 或 PNG。",true);
    input.value = "";
    return;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1,limits.imageEdge/Math.max(bitmap.width,bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1,Math.round(bitmap.width*scale));
    canvas.height = Math.max(1,Math.round(bitmap.height*scale));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    bitmap.close();
    let quality = .88;
    let data = canvas.toDataURL(file.type,quality);
    const maxLength = Math.ceil(limits.imageBytes/3)*4;
    if (data.length > maxLength && file.type === "image/png") data = canvas.toDataURL("image/jpeg",quality);
    while (data.length > maxLength && quality > .24) {
      quality -= .12;
      data = canvas.toDataURL("image/jpeg",quality);
    }
    if (data.length > maxLength) throw new Error("圖片無法縮到合適大小，請先縮小圖片。");
    if (state.draft !== targetDraft) return;
    if (targetDraft.images.length >= limits.images ||
      (place === "cover" && targetDraft.images.some((image) => image.section === "cover"))) {
      throw new Error("圖片數量已達上限。");
    }
    targetDraft.images.push({section:place,data,width:canvas.width,height:canvas.height,caption:""});
    update();
    syncLayout();
    if (place === "cover") state.page = 0;
    else gotoAnchor(place);
    refreshEditor();
    tell("已加入圖片。");
  } catch (error) { tell(error.message || "無法讀取這張圖片。",true); input.value = ""; }
}

app.addEventListener("input",(event) => {
  const el = event.target;
  const {field,section,cell,index,imageCaption} = el.dataset;
  if (field) state.draft.fields[field] = el.value;
  else if (section) {
    state.draft.sections[section] = el.value;
    document.querySelector("#char-count").textContent = `${nfmt.format(el.value.length)} 字`;
  } else if (cell) {
    state.draft.tables[state.table][Number(index)][cell] = el.value;
    showTableSummary();
  } else if (imageCaption !== undefined) state.draft.images[Number(imageCaption)].caption = el.value;
  else return;
  update();
});
app.addEventListener("change",(event) => {
  const el = event.target;
  if (el.dataset.option) {
    state.draft.options[el.dataset.option] = el.checked;
    update();
  } else if (el.dataset.picker === "section") selectSection(el.value);
  else if (el.dataset.picker === "table") {
    state.table = el.value;
    gotoAnchor(current().tables.find(({id}) => id === el.value).after);
    refreshEditor("#table-picker");
  } else if (el.id === "image-file") uploadPicture(el);
});
draftFile.addEventListener("change",async () => {
  const file = draftFile.files[0];
  draftFile.value = "";
  if (!file) return;
  try {
    if (file.size > limits.request) throw new Error("草稿超過 10 MB。");
    const draft = readDraft(JSON.parse(await file.text()),{preserve:true});
    const saved = draft.template === state.key && !state.example;
    const existing = await readSaved(draft.template).catch(() => null);
    if ((saved || (existing && !existing.example)) && !confirm("匯入會替換同一模板的草稿。要繼續嗎？")) return;
    replaceDraft(draft,false);
    tell("草稿已匯入。");
  } catch (error) { tell(error instanceof SyntaxError ? "讀不到有效的草稿 JSON。" : error.message,true); }
});

document.addEventListener("click",(event) => {
  const elem = event.target.closest("[data-action],[data-view],[data-template],[data-tab],[data-tool]");
  if (!event.target.closest(".draft-dropdown")) popover(false);
  if (!elem) return;
  if (elem.dataset.view) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button) return;
    event.preventDefault();
    changeView(elem.dataset.view);
    return;
  }
  if (elem.dataset.template) {
    if (state.key !== elem.dataset.template || state.view !== "edit") selectTemplate(elem.dataset.template);
    else if (state.menu) { state.menu = false; render(); }
    return;
  }
  if (elem.dataset.tab) { selectTab(elem.dataset.tab,true); return; }
  if (elem.dataset.tool !== undefined) {
    toolIndex = Number(elem.dataset.tool);
    render();
    document.querySelector(`[data-tool="${toolIndex}"]`).focus({preventScroll:true});
    return;
  }
  const {action,index} = elem.dataset;
  switch (action) {
    case "page-prev": state.page = Math.max(0,state.page-1); drawPreview(); break;
    case "page-next": state.page = Math.min(state.layout.pages.length-1,state.page+1); drawPreview(); break;
    case "zoom": openLargePreview(); break;
    case "close-dialog": utility.close(); break;
    case "side-menu": state.menu = !state.menu; render(); break;
    case "draft-menu": popover(elem.getAttribute("aria-expanded") === "false"); break;
    case "blank": popover(false); resetDraft(false); break;
    case "example": popover(false); resetDraft(true); break;
    case "import": popover(false); draftFile.click(); break;
    case "backup":
      popover(false);
      saveAs(new Blob([JSON.stringify(state.draft,null,2)],{type:"application/json"}),proposedFilename(state.draft,"json"));
      tell("已下載草稿 JSON。");
      break;
    case "check-draft": checkDraft(); break;
    case "word": download("docx"); break;
    case "pdf": download("pdf"); break;
    case "section-prev":
    case "section-next": {
      const list = labels();
      const idx = list.findIndex(([key]) => key === state.section);
      const next = list[idx + (action === "section-prev" ? -1 : 1)];
      if (next) selectSection(next[0],true);
      break;
    }
    case "add-row":
      state.draft.tables[state.table].push(Object.fromEntries(current().tables.find(({id}) => id === state.table).columns.map(({key}) => [key,""])));
      update();
      refreshEditor(`.row-card:last-child [data-cell]`);
      break;
    case "remove-row": state.draft.tables[state.table].splice(Number(index),1); update(); refreshEditor(); break;
    case "remove-image": state.draft.images.splice(Number(index),1); update(); refreshEditor(); break;
    case "copy-endpoint": paste(endpoint(),"已複製連線網址。"); break;
    case "copy-request": paste(toolCall(),"已複製呼叫範例。"); break;
  }
});

document.addEventListener("keydown",(event) => {
  const tab = event.target.closest("[data-tab]");
  if (tab && ["ArrowLeft","ArrowRight","Home","End"].includes(event.key)) {
    event.preventDefault();
    const index = tabs.findIndex(([key]) => key === state.tab);
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length-1
      : (index + (event.key === "ArrowRight" ? 1 : tabs.length-1)) % tabs.length;
    selectTab(tabs[next][0],true);
  }
  if (event.key === "Escape") popover(false);
});

function syncAddress() {
  const view = getView();
  if (view !== state.view) changeView(view,false);
}
window.addEventListener("popstate",syncAddress);
window.addEventListener("hashchange",syncAddress);
window.addEventListener("pagehide",() => {
  if (state.draft && timers.has(state.key)) writeDraft(state.key,state.example,state.draft);
});
utility.addEventListener("click",(event) => { if (event.target === utility) utility.close(); });

let preferred = "course";
try { preferred = localStorage.getItem("proposal-studio:active") || "course"; } catch { /* no storage */ }
selectTemplate(Object.hasOwn(templates,preferred) ? preferred : "course",false);
