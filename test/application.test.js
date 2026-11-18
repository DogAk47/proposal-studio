import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { exampleDraft } from "../src/demo.js";
import { readDraft, buildDocument, emptyDraft, funding, validateProposal } from "../src/model.js";
import { placeDocument, paper } from "../src/layout.js";
import { templateList } from "../src/templates.js";

const {default:app} = await import("../dist/server/index.js");
const font = await readFile(new URL("../public/assets/Iansui-Regular.ttf",import.meta.url));
const origin = "https://proposal.test";
const files = new Map();
const bucket = {
  async list() { return {objects:[...files.keys()].map((key) => ({key}))}; },
  async get(key) { return files.get(key); },
  async put(key,body,metadata) { files.set(key,{body,...metadata}); },
  async delete(keys) { for (const key of [keys].flat()) files.delete(key); },
};
const env = {EXPORTS:bucket,ASSETS:{async fetch() { return new Response(font); }}};
const waitUntil = (pending) => pending.catch(() => {});
const post = (path,body,version = "2026-07-28") => app.fetch(new Request(origin+path,{method:"POST",
  headers:{"Content-Type":"application/json","MCP-Protocol-Version":version},body:JSON.stringify(body)}),env,{waitUntil});
const mcp = (method,params,version) => post("/mcp",{jsonrpc:"2.0",id:1,method,params},version);
const call = (name,args) => mcp("tools/call",{name,arguments:args});
const fixture = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGP8uquBARtgwio6aCUAt+YCP0i5I+cAAAAASUVORK5CYII=";

test("all four templates produce real Word and A4 PDF files through the website API",async () => {
  for (const {key} of templateList) {
    const draft = exampleDraft(key);
    const model = readDraft(draft);
    const layout = placeDocument(buildDocument(model));
    const word = await post("/api/export",{draft,format:"docx"});
    assert.equal(word.status,200);
    assert.match(word.headers.get("Content-Type"),/wordprocessingml/);
    assert.equal(Buffer.from(await word.arrayBuffer()).subarray(0,4).toString("hex"),"504b0304");

    const pdf = await post("/api/export",{draft,format:"pdf"});
    assert.equal(pdf.status,200);
    const doc = await PDFDocument.load(await pdf.arrayBuffer());
    assert.equal(doc.getTitle(),draft.fields.title);
    assert.equal(doc.getPageCount(),layout.pages.length);
    assert.ok(doc.getPages().every((page) => Math.abs(page.getWidth()-paper.width) < 0.1));
    if (key === "guidance") {
      assert.equal(layout.pages[0].background,"#F5BA80");
      assert.equal(layout.pages.find((page) => page.part === "contents").label,"1");
      assert.equal(layout.pages.at(-1).part,"appendix");
      assert.ok(layout.pageNumbers.appendix);
    }
  }
});

test("a blank form can be exported and has explicit missing fields",async () => {
  const draft = emptyDraft("course");
  const check = validateProposal(draft);
  assert.equal(check.ready,false);
  assert.ok(check.missingFields.some(({key}) => key === "title"));
  const result = await post("/api/export",{draft,format:"pdf"});
  assert.equal(result.status,200);
});

test("table rows, figure captions, and long CJK paragraphs paginate within A4",async () => {
  const draft = exampleDraft("contest-project");
  draft.options.tableIndex = true;
  draft.sections.method = "你的繁體中文實作文字。".repeat(510);
  draft.images = [{section:"cover",data:fixture,width:8,height:8},{section:"method",caption:"原型照片",data:fixture,width:8,height:8}];
  draft.tables.tests = Array.from({length:28},(_,i) => ({item:`驗證項目 ${i+1}`,method:"同時記錄取樣值及反應時間。".repeat(10),result:"通過"}));
  const layout = placeDocument(buildDocument(readDraft(draft)));
  const parts = layout.pages.map(({part}) => part);
  assert.ok(parts.includes("figures") && parts.includes("tables"));
  assert.ok(layout.pageNumbers["figure-1"]);
  const tables = layout.pages.flatMap(({items}) => items).filter((item) => item.kind === "box");
  assert.ok(tables.length >= 110);
  assert.ok(tables.every((item) => item.y+item.height <= paper.height));
  assert.equal((await post("/api/export",{draft,format:"docx"})).status,200);
  assert.equal((await post("/api/export",{draft,format:"pdf"})).status,200);
});

test("subsidies and self-funding are rounded and the unit totals agree",() => {
  const d = emptyDraft("guidance");
  d.fields.title = "驗證";
  d.tables.budget = [{grant:12.5,own:3.2,item:"第一筆"},{grant:"3.7",own:"0.8",item:"第二筆"}];
  const normalized = readDraft(d);
  assert.deepEqual(funding(normalized),{grant:17,own:4,total:21});
  assert.deepEqual(buildDocument(normalized).body.find(({id}) => id === "table-budget").rows.at(-1),["合計","17","4","21","-"]);
});

test("MCP discovers tools, validates a draft, and provides working file links",async () => {
  const discovered = await (await mcp("server/discover",{})).json();
  assert.ok(discovered.result.supportedVersions.includes("2026-07-28"));
  const established = await (await mcp("initialize",{protocolVersion:"2025-11-25"},"2025-11-25")).json();
  assert.equal(established.result.protocolVersion,"2025-11-25");
  const capabilities = await (await mcp("tools/list",{})).json();
  assert.equal(capabilities.result.tools.length,4);
  const decision = await (await call("get_proposal_template",{template:"guidance"})).json();
  assert.equal(decision.result.structuredContent.sections.length,10);
  const check = await (await call("validate_proposal",{draft:exampleDraft("course")})).json();
  assert.equal(check.result.structuredContent.ready,true);
  for (const format of ["pdf","docx"]) {
    const response = await (await call("export_proposal",{draft:exampleDraft("course"),format})).json();
    assert.equal(response.result.isError,undefined,JSON.stringify(response));
    const file = response.result.structuredContent;
    const downloaded = await app.fetch(new Request(file.url),env,{waitUntil});
    assert.equal(downloaded.status,200);
    assert.equal(downloaded.headers.get("Content-Type"),file.mimeType);
    assert.equal((await downloaded.arrayBuffer()).byteLength,file.bytes);
    assert.ok(new Date(file.expiresAt) > new Date());
  }
});

test("MCP and HTTP present actionable validation errors",async () => {
  const result = await (await call("get_proposal_template",{template:"__proto__"})).json();
  assert.equal(result.result.isError,true);
  const invalid = await post("/api/export",{draft:{template:"missing"},format:"docx"});
  assert.equal(invalid.status,400);
  const d = emptyDraft("course");
  d.images.push({section:"method",data:fixture,width:16,height:8});
  const image = await post("/api/export",{draft:d,format:"pdf"});
  assert.match((await image.json()).error,/圖片/);
  assert.equal(image.status,400);
});


test("Public MCP clients can export and fetch a short-lived document without account headers",async () => {
  const req=(method,params,version="2025-06-18")=>post("/public-mcp",{jsonrpc:"2.0",id:7,method,params},version);
  const init=await (await req("initialize",{protocolVersion:"2025-06-18"})).json();
  assert.equal(init.result.protocolVersion,"2025-06-18");
  const contents=await (await req("tools/list",{})).json();
  assert.equal(contents.result.tools.length,4);
  assert.equal(contents.result.resultType,undefined);
  const mcp=await (await req("tools/call",{name:"export_proposal",arguments:{format:"pdf",draft:exampleDraft("course")}})).json();
  assert.equal(mcp.result.isError,undefined);
  const file=mcp.result.structuredContent;
  assert.ok(new URL(file.url).pathname.startsWith("/mcp-files/"));
  assert.ok(new Date(file.expiresAt).getTime()-Date.now() <= 30*60000);
  const response=await app.fetch(new Request(file.url),env,{waitUntil});
  assert.equal(response.status,200);
  assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0,5).toString(),"%PDF-");
  const head=await app.fetch(new Request(file.url,{method:"HEAD"}),env,{waitUntil});
  assert.equal(head.status,200);
  assert.equal((await head.arrayBuffer()).byteLength,0);
});
