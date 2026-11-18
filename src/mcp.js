import { buildDocument, emptyDraft, getTemplate, InputError, readDraft, validateProposal } from "./model.js";
import { placeDocument } from "./layout.js";
import { templateList } from "./templates.js";

const modern = "2026-07-28";
const legacyVersions = ["2025-11-25","2025-06-18","2025-03-26"];
const supportedVersions = [modern,...legacyVersions];
const serverInfo = {name:"proposal-studio",title:"計畫書工作台",version:"1.0.0"};
const capabilities = {tools:{}};
const templateKey = {type:"string",enum:templateList.map((template) => template.key)};
const draft = {
  type:"object",required:["template"],additionalProperties:false,
  description:"各模板可填欄位請先以 get_proposal_template 查詢。草稿中的文字為繁體中文或自由文字。空白欄位可省略。",
  properties:{
    version:{type:"integer",const:1},template:templateKey,
    fields:{type:"object",description:"封面欄位，鍵名以模板回傳為準。",additionalProperties:{type:"string"}},
    sections:{type:"object",description:"章節正文。用換行分段，## 與 ### 可建立次級標題。",additionalProperties:{type:"string"}},
    tables:{type:"object",description:"表格 ID 對應列陣列，每列依欄位 key 提供文字或數字。",
      additionalProperties:{type:"array",items:{type:"object",additionalProperties:{type:["string","number"]}}}},
    images:{type:"array",description:"選用 JPEG 或 PNG；section 是章節 key，競賽封面使用 cover。",items:{type:"object",
      required:["section","data","width","height"],properties:{section:{type:"string"},caption:{type:"string"},data:{type:"string"},
        width:{type:"integer"},height:{type:"integer"}},additionalProperties:false}},
    options:{type:"object",properties:{contents:{type:"boolean"},figureIndex:{type:"boolean"},tableIndex:{type:"boolean"}},additionalProperties:false},
  },
};
const schema = (properties, required = []) => ({type:"object", properties, required, additionalProperties:false});
const specs = [
  {name:"list_proposal_templates",title:"列出計畫書模板",description:"取得四種模板的 ID 和適用情境。",inputSchema:schema({}),
    annotations:{readOnlyHint:true,openWorldHint:false}},
  {name:"get_proposal_template",title:"讀取模板欄位",description:"回傳指定模板的封面、章節、表格與可填寫的空白草稿。",inputSchema:schema({template:templateKey},["template"]),
    annotations:{readOnlyHint:true,openWorldHint:false}},
  {name:"validate_proposal",title:"檢查計畫書",description:"檢查草稿結構、缺漏欄位、比重與 PDF 頁數。",inputSchema:schema({draft},["draft"]),
    annotations:{readOnlyHint:true,openWorldHint:false}},
  {name:"export_proposal",title:"匯出計畫書",description:"匯出 Word 或 PDF，回傳限時下載連結。草稿有空白時仍可匯出。",
    inputSchema:schema({draft,format:{type:"string",enum:["docx","pdf"]}},["draft","format"]),
    annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false}},
];

const headers = {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const reply = (id,result,version) => Response.json({jsonrpc:"2.0",id,result},{
  headers:{...headers,...(version && {"MCP-Protocol-Version":version})},
});
const error = (id,code,message,status=200,data) =>
  Response.json({jsonrpc:"2.0",id,error:{code,message,...(data && {data})}},{status,headers});
const resultText = (payload, description = JSON.stringify(payload,null,2)) => ({
  resultType:"complete",structuredContent:payload,content:[{type:"text",text:description}],
});

async function call(name,args,exportFile) {
  const template = ({key,name,kind,introduction}) => ({key,name,kind,introduction});
  if (name === "list_proposal_templates") return resultText({templates:templateList.map(template)});
  if (name === "get_proposal_template") {
    const spec = getTemplate(args.template);
    return resultText({template:template(spec),fields:spec.fields,front:spec.front ?? [],sections:spec.sections,tables:spec.tables,
      options:{requiredContents:spec.contents,supportsCoverImage:spec.coverImage},formatNote:spec.note,blankDraft:emptyDraft(spec.key)});
  }
  if (name === "validate_proposal") {
    const model = readDraft(args.draft);
    const validation = validateProposal(model);
    const layout = placeDocument(buildDocument(model));
    return resultText({...validation,pdfPages:layout.pages.length,warnings:[...validation.warnings,...layout.warnings]});
  }
  const file = await exportFile(args.draft,args.format);
  const {url,filename,mimeType,expiresAt,bytes,warnings,path} = file;
  const result = resultText({url,filename,mimeType,expiresAt,bytes,warnings,...(path && {path})},
    [`已產生 ${filename}。`,path ? `檔案路徑：${path}` : `[下載檔案](${url})`,...warnings].join("\n"));
  result.content.push({type:"resource_link",name:filename,uri:url,mimeType,description:"生成的計畫書"});
  return result;
}

export async function handleMcp(request, readJson, exportFile) {
  if (request.method !== "POST") return new Response(null,{status:405,headers:{Allow:"POST"}});
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return new Response("Origin forbidden",{status:403});
  let envelope;
  try {
    envelope = await readJson(request);
  } catch (e) {
    return error(null,-32700,e.message,400);
  }
  return dispatchMcp(envelope,request.headers.get("MCP-Protocol-Version"),exportFile);
}

export async function dispatchMcp(envelope,versionHeader,exportFile) {
  const {id,method,params,jsonrpc} = envelope ?? {};
  if (!envelope || jsonrpc !== "2.0" || typeof method !== "string" || (id !== undefined && typeof id !== "string" && typeof id !== "number")) {
    return error(null,-32600,"Invalid Request",400);
  }

  if (id === undefined) return new Response(null,{status:202});
  const version = versionHeader
    ?? envelope._meta?.["io.modelcontextprotocol/protocolVersion"]
    ?? params?._meta?.["io.modelcontextprotocol/protocolVersion"];
  if (version && !supportedVersions.includes(version) && method !== "server/discover" && method !== "initialize") {
    return error(id,-32022,"Unsupported protocol version",400,{supported:supportedVersions,requested:version});
  }
  if (method === "server/discover") return reply(id,{supportedVersions,serverInfo,capabilities},modern);
  if (method === "initialize") {
    const requested = params?.protocolVersion;
    const protocolVersion = legacyVersions.includes(requested) ? requested : legacyVersions[0];
    return reply(id,{protocolVersion,serverInfo,capabilities},protocolVersion);
  }
  const selected = version ?? legacyVersions[1];
  if (method === "ping") return reply(id,{},selected);
  if (method === "tools/list") return reply(id,{...(selected === modern && {resultType:"complete"}),tools:specs},selected);
  if (method !== "tools/call") return error(id,-32601,"Method not found");
  if (!specs.some((tool) => tool.name === params?.name)) return error(id,-32602,"Unknown tool");
  const args = params?.arguments ?? {};
  if (!args || typeof args !== "object" || Array.isArray(args)) return error(id,-32602,"Invalid tool arguments");
  let result;
  try {
    result = await call(params.name,args,exportFile);
    if (selected !== modern) delete result.resultType;
    if (selected === "2025-03-26") {
      delete result.structuredContent;
      result.content = result.content.filter((item) => item.type === "text");
    }
  } catch (e) {
    if (!(e instanceof InputError)) console.error("MCP tool failed",e.message);
    result = {isError:true,content:[{type:"text",text:e instanceof InputError ? e.message : "暫時無法完成這個操作，請稍後重試。"}],
      ...(selected === modern && {resultType:"complete"})};
  }
  return reply(id,result,selected);
}

export { specs as mcpTools };
