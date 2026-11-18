import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { Readable, pipeline } from "node:stream";
import { fileURLToPath } from "node:url";
import app from "../src/server.js";
import { InputError } from "../src/model.js";
import { publicExportMinutes } from "../src/public-config.js";

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3000);
const publicOrigin = process.env.SITE_PUBLIC_URL ? new URL(process.env.SITE_PUBLIC_URL).origin : null;
const root = fileURLToPath(new URL("../docs/",import.meta.url));
const mount = (process.env.PROPOSAL_BASE_PATH || "").replace(/\/$/,"");
const types = {".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".html":"text/html; charset=utf-8",
  ".json":"application/json; charset=utf-8",".svg":"image/svg+xml",".ttf":"font/ttf",".txt":"text/plain; charset=utf-8"};
const assets = {async fetch(request) {
  const path = decodeURIComponent(new URL(request.url).pathname);
  if (!path.startsWith("/")) return new Response("Not found",{status:404});
  const file = resolve(root,`.${path === "/" ? "/index.html" : path}`);
  if (!file.startsWith(resolve(root)+sep)) return new Response("Not found",{status:404});
  try {
    const bytes = await readFile(file);
    return new Response(request.method === "HEAD" ? null : bytes,{headers:{"Content-Type":types[extname(file)] ?? "application/octet-stream"}});
  } catch {
    return new Response("Not found",{status:404});
  }
}};
const files = new Map();
const capacity = 64 * 1024 * 1024;
let totalBytes = 0;
function remove(key) {
  const file = files.get(key);
  if (file) totalBytes -= file.body.byteLength;
  files.delete(key);
}
const bucket = {
  async get(key) { return files.get(key); },
  async put(key,body,metadata) {
    const now = Date.now();
    for (const [id,file] of files) if (file.expires <= now) remove(id);
    if (totalBytes + body.byteLength > capacity || files.size >= 128) throw new InputError("下載區容量暫滿，請稍後再試。");
    files.set(key,{body,expires:now+publicExportMinutes*60000,...metadata});
    totalBytes += body.byteLength;
  },
  async delete(keys) { for (const key of [keys].flat()) remove(key); },
  async list({prefix,limit}) {
    return {objects:[...files.keys()].filter((key) => key.startsWith(prefix)).sort().slice(0,limit).map((key) => ({key}))};
  },
};
const loopback = new Set(["localhost","127.0.0.1","[::1]"]);
createServer(async (incoming,outgoing) => {
  try {
    const base = publicOrigin || new URL(`http://${incoming.headers.host || "localhost"}`).origin;
    if (!publicOrigin && !loopback.has(new URL(base).hostname)) {
      outgoing.writeHead(403).end("Set SITE_PUBLIC_URL to serve from a public hostname.");
      return;
    }
    const url = new URL(incoming.url,base);
    if (url.origin !== base) { outgoing.writeHead(400).end(); return; }
    const headers = new Headers(incoming.headers);
    headers.delete("CF-Connecting-IP");
    headers.set("X-Proposal-Client",incoming.socket.remoteAddress ?? "local");
    const request = new Request(url,{method:incoming.method,headers,
      ...(!["GET","HEAD"].includes(incoming.method) && {body:Readable.toWeb(incoming),duplex:"half"})});
    let response;
    if (mount && url.pathname.startsWith(mount+"/") && ["GET","HEAD"].includes(request.method)) {
      const local = new URL(url.pathname.slice(mount.length),base);
      response = await assets.fetch(new Request(local,request));
    } else {
      response = await app.fetch(request,{ASSETS:assets,EXPORTS:bucket,SITE_PUBLIC_URL:publicOrigin},
        {waitUntil:(promise) => promise.catch((error) => console.error(error.message))});
    }
    outgoing.writeHead(response.status,Object.fromEntries(response.headers));
    if (response.body) pipeline(Readable.fromWeb(response.body),outgoing,() => {});
    else outgoing.end();
  } catch (error) {
    console.error(error.message);
    outgoing.writeHead(500).end("Server error");
  }
}).listen(port,host,() => console.log(`Proposal Studio listening on ${publicOrigin || `http://127.0.0.1:${port}`}`));
