import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("GitHub Pages reads its own subdirectory assets and bundles local export engines",async () => {
  const base = new URL("../docs/",import.meta.url);
  const html = await readFile(new URL("index.html",base),"utf8");
  for (const ref of ["./app.js","./style.css","./assets/mark.svg"]) assert.ok(html.includes(`"${ref}"`));
  const entry = await readFile(new URL("app.js",base),"utf8");
  assert.match(entry,/chunks\/render-file-/);
  assert.doesNotMatch(entry,/\/api\/export/);
  const tools=JSON.parse(await readFile(new URL("mcp-tools.json",base),"utf8"));
  assert.equal(tools.tools.length,4);
});

test("STDIO MCP negotiates legacy protocol and exports to a real local file",async () => {
  const outputDir=await mkdtemp(join(tmpdir(),"proposal-test-"));
  try {
    const calls=[
      {id:1,method:"initialize",params:{protocolVersion:"2025-03-26",clientInfo:{name:"qa",version:"1"},capabilities:{}}},
      {method:"notifications/initialized"},
      {id:2,method:"tools/list"},
      {id:3,method:"export-not-supported"},
      {id:4,method:"tools/call",params:{name:"export_proposal",arguments:{draft:{template:"course",fields:{title:"搬移版測試"}},format:"pdf"}}},
    ].map((call) => JSON.stringify({jsonrpc:"2.0",...call})).join("\n")+"\n";
    const run=spawnSync(process.execPath,["scripts/mcp-stdio.mjs"],{
      input:calls,encoding:"utf8",timeout:15000,env:{...process.env,PROPOSAL_OUTPUT_DIR:outputDir},
    });
    assert.equal(run.status,0,run.stderr);
    const results=run.stdout.trim().split("\n").map(JSON.parse);
    assert.equal(results.length,4);
    assert.equal(results[0].result.protocolVersion,"2025-03-26");
    assert.equal(results[1].result.tools.length,4);
    assert.equal(results[2].error.code,-32601);
    const path = results[3].result.content[0].text.split("檔案路徑：")[1].split("\n")[0];
    assert.ok(path.startsWith(outputDir));
    assert.equal((await readFile(path)).subarray(0,5).toString(),"%PDF-");
  } finally { await rm(outputDir,{force:true,recursive:true}); }
});
