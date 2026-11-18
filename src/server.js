import { InputError, limits } from "./model.js";
import { renderFile } from "./render-file.js";
import { mcpTools } from "./mcp.js";
import { publicMcp, publicFile } from "./public-endpoints.js";
import { publicMcpPath, publicDownloadPath } from "./public-config.js";

const privateHeaders = {"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
const plain = (message,status) => new Response(message,{status,headers:{"Content-Type":"text/plain; charset=utf-8",...privateHeaders}});
const validationError = (message,status) => Response.json({error:message},{status,headers:privateHeaders});
const encoded = (filename) => encodeURIComponent(filename).replace(/['()*]/g,(ch) => `%${ch.charCodeAt(0).toString(16)}`);
const disposition = (filename,format) => `attachment; filename="proposal.${format}"; filename*=UTF-8''${encoded(filename)}`;

async function readJson(request) {
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
    throw new InputError("請以 JSON 提交資料。");
  }
  const body = request.body;
  if (!body) throw new InputError("請提供 JSON 內容。");
  if (Number(request.headers.get("Content-Length") || 0) > limits.request) throw new InputError("草稿超過 10 MB。");
  let size = 0;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const chunks = [];
  try {
    for (;;) {
      const {value,done} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limits.request) {
        await reader.cancel();
        throw new InputError("草稿超過 10 MB。");
      }
      chunks.push(decoder.decode(value,{stream:true}));
    }
    chunks.push(decoder.decode());
    return JSON.parse(chunks.join(""));
  } catch (err) {
    if (err instanceof InputError) throw err;
    throw new InputError("JSON 格式有誤。");
  }
}

let fontPromise;
async function loadFont(request,env) {
  fontPromise ??= (async () => {
    const path = new URL("/assets/Iansui-Regular.ttf",request.url);
    const response = await env.ASSETS.fetch(new Request(path));
    if (!response.ok) throw new Error("PDF font asset unavailable");
    return new Uint8Array(await response.arrayBuffer());
  })().catch((error) => {
    fontPromise = undefined;
    throw error;
  });
  return fontPromise;
}

export default {
  async fetch(request,env,ctx) {
    const url = new URL(request.url);
    try {
      const render = (draft,format) => renderFile(draft,format,() => loadFont(request,env));
      if (url.pathname === publicMcpPath || url.pathname === "/mcp") return await publicMcp(request,env,ctx,readJson,render);
      if (url.pathname.startsWith(publicDownloadPath)) {
        return await publicFile(request,env.EXPORTS,url.pathname.slice(publicDownloadPath.length));
      }
      if (url.pathname === "/api/mcp-tools" && request.method === "GET") return Response.json({tools:mcpTools},{headers:privateHeaders});
      if (url.pathname === "/api/export") {
        if (request.method !== "POST") return new Response(null,{status:405,headers:{Allow:"POST"}});
        const origin = request.headers.get("Origin");
        if (origin && origin !== url.origin) return plain("來源不符。",403);
        const payload = await readJson(request);
        const file = await render(payload?.draft,payload?.format);
        return new Response(file.bytes,{headers:{"Content-Type":file.mimeType,"Content-Disposition":disposition(file.filename,file.format),...privateHeaders}});
      }
      if (request.method !== "GET" && request.method !== "HEAD") return plain("找不到這個頁面。",404);
      if (["/","/comparison","/mcp-docs"].includes(url.pathname)) {
        return await env.ASSETS.fetch(new Request(new URL("/",url),request));
      }
      return await env.ASSETS.fetch(request);
    } catch (error) {
      if (error instanceof InputError) return validationError(error.message,400);
      console.error("Proposal Studio request failed",url.pathname,error.message);
      return validationError("暫時無法產生文件，請稍後再試。",500);
    }
  },
};
