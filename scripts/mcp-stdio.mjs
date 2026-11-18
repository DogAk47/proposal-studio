import { createInterface } from "node:readline";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { dispatchMcp } from "../src/mcp.js";
import { renderFile } from "../src/render-file.js";
import { limits } from "../src/model.js";

let version;
let font;
const output = resolve(process.env.PROPOSAL_OUTPUT_DIR || join(tmpdir(),"proposal-studio-exports"));
const generate = async (draft,format) => {
  const file = await renderFile(draft,format,() => (font ??= readFile(new URL("../public/assets/Iansui-Regular.ttf",import.meta.url))));
  const directory = join(output,crypto.randomUUID());
  await mkdir(directory,{recursive:true});
  const path = join(directory,`文件-${file.filename}`);
  await writeFile(path,file.bytes,{flag:"wx"});
  return {url:pathToFileURL(path).href,path,filename:file.filename,mimeType:file.mimeType,bytes:file.bytes.byteLength,warnings:file.warnings};
};
const input = createInterface({input:process.stdin,crlfDelay:Infinity,terminal:false});
for await (const line of input) {
  if (!line.trim()) continue;
  let envelope;
  try {
    if (Buffer.byteLength(line) > limits.request) throw new Error("草稿超過 10 MB。");
    envelope = JSON.parse(line);
  } catch {
    process.stdout.write(JSON.stringify({jsonrpc:"2.0",id:null,error:{code:-32700,message:"無法讀取這筆 JSON 請求。"}})+"\n");
    continue;
  }
  const response = await dispatchMcp(envelope,version,generate);
  if (response.status === 202) continue;
  const message = await response.json();
  if (envelope.method === "initialize") version = message.result?.protocolVersion;
  process.stdout.write(JSON.stringify(message)+"\n");
}
