import { handleMcp } from "./mcp.js";
import { InputError } from "./model.js";
import { publicDownloadPath, publicExportMinutes } from "./public-config.js";

const prefix = "public-proposals/";
const ttl = publicExportMinutes * 60 * 1000;
const headers = {"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};
const pattern = /^(\d{13})-[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\.(docx|pdf)$/;
const contentType = {
  docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf:"application/pdf",
};
const encoding = (name) => encodeURIComponent(name).replace(/['()*]/g,(ch) => `%${ch.charCodeAt(0).toString(16)}`);
const recent = new Map();

function takeExportSlot(client, now) {
  const id = client || "shared";
  let window = recent.get(id);
  if (!window || window.until <= now) {
    if (recent.size >= 2048) recent.delete(recent.keys().next().value);
    window = {count:0,until:now+60000};
    recent.set(id,window);
  }
  if (window.count >= 18) throw new InputError("目前匯出較頻繁，請稍候一分鐘再試。");
  window.count++;
}

async function clearExpired(bucket, now) {
  const {objects} = await bucket.list({prefix,limit:24});
  const expired = objects.filter(({key}) => Number(key.slice(prefix.length,prefix.length+13)) + ttl <= now);
  if (expired.length) await bucket.delete(expired.map(({key}) => key));
}

export function publicMcp(request,env,ctx,readJson,render) {
  return handleMcp(request,readJson,async (draft,format) => {
    const bucket = env.EXPORTS;
    if (!bucket) throw new Error("Export storage is unavailable");
    const client = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Proposal-Client");
    takeExportSlot(client,Date.now());
    const {bytes,filename,mimeType,warnings} = await render(draft,format);
    const now = Date.now();
    const id = `${now}-${crypto.randomUUID()}.${format}`;
    await bucket.put(prefix+id,bytes,{customMetadata:{filename:encoding(filename)}});
    ctx.waitUntil(clearExpired(bucket,now).catch(() => {}));
    const base = env.SITE_PUBLIC_URL || request.url;
    return {url:new URL(publicDownloadPath+id,base).href,filename,mimeType,bytes:bytes.byteLength,
      expiresAt:new Date(now+ttl).toISOString(),warnings};
  });
}

export async function publicFile(request,bucket,id) {
  const match = pattern.exec(id);
  if (!match || !bucket) return new Response("找不到檔案。",{status:404,headers});
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null,{status:405,headers:{...headers,Allow:"GET, HEAD"}});
  }
  const key = prefix+id;
  if (Number(match[1])+ttl <= Date.now()) {
    await bucket.delete(key);
    return new Response("連結已過期，請重新匯出。",{status:410,headers});
  }
  const file = await bucket.get(key);
  if (!file) return new Response("找不到檔案。",{status:404,headers});
  const format = match[2];
  const filename = file.customMetadata?.filename ?? `proposal.${format}`;
  return new Response(request.method === "HEAD" ? null : file.body,{headers:{
    ...headers,"Content-Type":contentType[format],
    "Content-Disposition":`attachment; filename="proposal.${format}"; filename*=UTF-8''${filename}`,
  }});
}
