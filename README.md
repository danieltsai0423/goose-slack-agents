# Goose Slack Agents

在一個私人 Slack 頻道中，讓 `Goose-Codex` 和 `Goose-Claude` 各用自己的 Bot 身分回覆。單一橋接器接收頻道訊息，用 SQLite 記錄討論串。Goose 只在點名或啟用協作時呼叫模型。

| Agent | Goose provider | 帳號 |
| --- | --- | --- |
| Goose-Codex | `chatgpt_codex` | 橋接器專用 Goose 設定中的 ChatGPT Plus 瀏覽器登入 |
| Goose-Claude | `claude-acp` | 相同系統帳戶內，原版 Claude Code 登入的個人 Claude 訂閱 |

這個版本供一位真人操作。服務用 Slack 使用者 ID 驗證真人，用兩組 Bot token 發言。Goose 子程序使用獨立的設定、工作目錄和受限的環境變數。預設只處理對話、方案與審查，每輪停用 Goose 的預設擴充套件，工作目錄在 `.data`。Claude ACP 仍使用 Claude Code 自身的工具與權限模型，這個配置沒有提供 OS 層級沙箱。Anthropic 對第三方工具的可用性及扣款方式取決於帳號與服務端規則。 [Anthropic 第三方工具登入](https://support.claude.com/en/articles/13189465-log-in-to-your-claude-account)

## 本機設定

需要 Node.js 24 以上、Goose CLI、Claude Code CLI。專案以 Goose 1.60.2 及 `npm ci` 安裝的 ACP adapter 為基準。Windows 可以把官方 Goose ZIP 解壓到 `.tools/goose`，或把 `goose.exe` 加入 `PATH`。也可在 `.env` 用 `GOOSE_BIN` 指定完整路徑。 [Goose 官方發行版](https://github.com/aaif-goose/goose/releases/tag/v1.60.2)

```powershell
npm ci
Copy-Item .env.example .env
npm run configure -- codex
```

在 Goose 選擇 **Configure Providers → ChatGPT Codex**，用自己的 ChatGPT Plus 在瀏覽器登入。原版 Codex CLI 的登入不會填入這個 Goose profile。Claude 端使用已在原版 Claude Code 登入的 Claude 訂閱。若回報登入到期，執行 `claude auth login` 重新登入。

可以在 `.env` 以 `GOOSE_CODEX_MODEL` 或 `GOOSE_CLAUDE_MODEL` 指定完整模型 ID。`GOOSE_CLAUDE_EFFORT` 會把指定的推理強度傳給 Claude Code，留空時使用 Claude Code 的設定。編輯 `.env` 後重新啟動橋接器即可套用設定。 [Claude Code 模型設定](https://code.claude.com/docs/en/model-config)

以下可在設定 Slack 前執行，每個 smoke test 各跑一次模型請求：

```powershell
npm run smoke -- codex
npm run smoke -- claude
```

## Slack 設定

1. 在同一個 Slack workspace 建立私人頻道，例如 `#agent-lab`。選下列方式建立兩個 App。
   - **用 API**　從 [Slack App 管理頁](https://api.slack.com/apps) 的 **Your App Configuration Tokens** 為目標 workspace 產生短效 token，在本機 `.env.slack-setup` 裡填 `SLACK_MANIFEST_TOKEN=...`，然後執行 `npm run slack:setup`。指令先驗證兩個 manifest，再建立 App 並顯示安裝頁面。App ID 保存在本機 `.data/slack-setup`，重跑會沿用已建立的 App。完成後可清除 `.env.slack-setup` 裡的短效 token。 [Slack Manifest API](https://docs.slack.dev/app-manifests/configuring-apps-with-app-manifests/)
   - **用 Slack 管理頁**　選 **Create New App → From a manifest**，分別匯入 [Codex manifest](slack/codex.json) 和 [Claude manifest](slack/claude.json)。
2. 在 Slack 確認安裝兩個 App，各自把 **Bot User OAuth Token** (`xoxb-…`) 填到 `.env` 的對應變數。
3. 在 **Goose-Codex** App 的 Basic Information 建立有 `connections:write` 的 App-Level Token (`xapp-…`)，填入 `SLACK_CODEX_APP_TOKEN`。這個 App 透過 Socket Mode 接收私人頻道訊息。Goose-Claude 使用自己的 Bot token 回覆。
4. 把兩個 App 都加入私人頻道。在 `.env` 填入該頻道的 ID 和你自己的 Slack member ID。請把 `.env` 保留在本機。
5. 執行 `npm start`，看到已連線後，在頻道送出 `@all 各自介紹你能怎麼協助我`。

## 用法

| 指令 | 行為 |
| --- | --- |
| 普通訊息 | 記錄脈絡。該 thread 開啟自主回覆後，兩個 Agent 會判斷是否有值得補充的內容。判斷本身會使用模型額度。 |
| Slack 原生點名 `@Goose-Claude` 或 `@Goose-Codex` | 呼叫被點名的 Agent。兩個名字一起點則平行回答。 |
| `@all 各自比較這兩個方案` | 兩個 Agent 平行讀取同一份快照，各自回覆。`@all` 直接打成文字。 |
| `@all 一起完成這個方案` | 開啟該 thread 的自主回覆。Claude 先回答，Codex 讀取 Claude 回覆後接力，每次觸發最多四輪。開頭也可用「協作」或「接力」。 |
| `!auto on` / `!auto off` | 開啟或關閉所在 thread 的自主回覆。 |
| `!stop` | 關閉所在 thread 的自主回覆，停止執行中的模型程序並清掉排隊工作。已送出的 Slack 回覆會保留。 |

每個任務開一個 thread，後續留言、點名與停止指令都發在同一串。模型只收到該 thread 的首則與近期文字。Slack 補抓以 API 能讀取的內容為準，讀取失敗時使用 SQLite 記錄。重新啟動會保留已儲存的對話和自主模式設定。中斷的工作可以用一則新訊息再次啟動。

`npm test` 會用模擬 Agent 驗證訊息隔離、雙點名、四輪上限、停止、編輯與刪除、冷啟動讀取和 Goose 輸出解析。測試不呼叫 Slack 或模型服務。
