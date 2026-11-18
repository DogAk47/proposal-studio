# 計畫書工作台

提供期末專題、競賽專題組、競賽創意組、輔導計畫四種模板。網站可編輯封面、章節、表格和圖片，預覽 A4 版面，匯出 Word（.docx）及 PDF。

## 上架 GitHub Pages

1. 在 GitHub 建立新的公開儲存庫，例如 `proposal-studio`。上傳解壓縮後的專案內容，確認 GitHub 顯示 `docs/index.html`。
2. 開啟儲存庫的 **Settings → Pages**。來源選 **Deploy from a branch**，分支選 `main`，目錄選 `/docs`，儲存。
3. 部署完成後，在 Pages 設定頁開啟網站。第一次更新原始碼時，執行 `npm ci` 和 `npm run build`，再提交更新的 `docs/`。

`docs/` 已建置。Word 和 PDF 由瀏覽器產出，草稿存在該網站的瀏覽器儲存區。要跨裝置或從原工作台搬移草稿，可在草稿選單匯出及匯入 JSON。

[GitHub Pages 發布來源說明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## 使用公開 MCP

在支援 Streamable HTTP 的 MCP 客戶端新增以下網址。匯出後取得 30 分鐘內有效的下載連結。

```text
https://proposal-studio.dogak47.chatgpt.site/public-mcp
```

例如使用 Codex CLI 時，可執行以下指令。

```sh
codex mcp add proposal-studio --url https://proposal-studio.dogak47.chatgpt.site/public-mcp
```

公開端點接受相容客戶端的請求。若透過 ChatGPT 網頁使用自訂 MCP，請依 ChatGPT 帳號方案與工作區權限設定。 [Codex MCP 說明](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) · [ChatGPT 自訂 MCP 說明](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt)

| 工具 | 輸入重點 | 產出 |
| --- | --- | --- |
| `list_proposal_templates` | 空物件 | 可用模板名稱與代號 |
| `get_proposal_template` | `template` | 封面、章節、表格欄位及空白草稿 |
| `validate_proposal` | `draft` | 欄位缺漏、PDF 頁數及格式提醒 |
| `export_proposal` | `draft`、`format`（`docx` 或 `pdf`） | 匯出檔案與下載位置 |

## 自行執行網站及 MCP

安裝 Node.js 22 以上，在專案目錄執行 `npm ci`。

- 執行 `npm run serve` 後可開啟 `http://127.0.0.1:3000/`，本機的 HTTP MCP 端點為 `http://127.0.0.1:3000/mcp`。
- 使用支援 stdio 的 MCP 客戶端時，以 `node` 執行 `scripts/mcp-stdio.mjs` 的絕對路徑。可設定 `PROPOSAL_OUTPUT_DIR` 指定匯出資料夾，預設使用系統暫存資料夾。STDIO 工具回傳生成檔案的本機路徑。
- 若自行託管遠端 MCP，在支援 Node.js 的 HTTPS 主機上執行 `npm run serve`，設定 `HOST=0.0.0.0`、平台提供的 `PORT` 和 `SITE_PUBLIC_URL`（例如 `https://mcp.example.com`）。連線使用公開網址的 `/mcp`。這個 Node 伺服器的限時檔案存於程序記憶體，重啟會清除。
- `npm test` 會重新建置並測試四種模板與 MCP。若要把網站「MCP 介面」頁改成自己託管的網址，建置前設定 `PROPOSAL_MCP_URL`。

### STDIO 客戶端設定範例

把 `args` 裡的路徑換成解壓縮後檔案的位置。Windows 路徑可使用 `C:/...` 格式。

```json
{
  "mcpServers": {
    "proposal-studio": {
      "command": "node",
      "args": ["/absolute/path/proposal-studio/scripts/mcp-stdio.mjs"]
    }
  }
}
```

### 版面及來源

網站的「格式比對」列出 8 份參考文件的章節與章法。Word 正文設定標楷體，PDF 內嵌芫荽字型。不同 Word 閱讀程式可能有不同分頁，編輯完成後可更新目錄頁碼。輔導計畫主要表格已依 A4 重排。
