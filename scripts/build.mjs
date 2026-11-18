import { build } from "esbuild";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { mcpTools } from "../src/mcp.js";

const common = {bundle:true,target:"es2022",legalComments:"eof",charset:"utf8",logLevel:"warning",platform:"browser",minify:true};
await mkdir("docs",{recursive:true});
await rm("docs/chunks",{recursive:true,force:true});
await Promise.all([
  cp("public","docs",{recursive:true}),
  writeFile("docs/.nojekyll",""),
  writeFile("docs/mcp-tools.json",JSON.stringify({tools:mcpTools},null,2)+"\n"),
  build({...common,entryPoints:{app:"src/ui.js"},outdir:"docs",format:"esm",splitting:true,chunkNames:"chunks/[name]-[hash]",
    define:{__PROPOSAL_MCP_URL__:JSON.stringify(process.env.PROPOSAL_MCP_URL ?? "")}}),
  build({...common,entryPoints:["src/server.js"],outfile:"dist/server/index.js",format:"esm"}),
]);
