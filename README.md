# Goose Slack Agents

在一個私人 Slack 頻道中，讓 `Goose-Codex` 和 `Goose-Claude` 各用自己的 Bot 身分回覆。單一橋接器接收頻道訊息，用 SQLite 記錄討論串。Goose 只在點名或啟用協作時呼叫模型。

| Agent | Goose provider | 帳號 |
| --- | --- | --- |
| Goose-Codex | `chatgpt_codex` | 橋接器專用 Goose 設定中的 ChatGPT Plus 瀏覽器登入 |
| Goose-Claude | `claude-acp` | 相同系統帳戶內，原版 Claude Code 登入的個人 Claude 訂閱 |

這個版本供一位真人操作。服務用 Slack 使用者 ID 驗證真人，用兩組 Bot token 發言。Goose 子程序使用獨立的設定、工作目錄和受限的環境變數。預設只處理對話、方案與審查，每輪停用 Goose 的預設擴充套件，工作目錄在 `.data`。Claude ACP 仍使用 Claude Code 自身的工具與權限模型，這個配置沒有提供 OS 層級沙箱。Anthropic 對第三方工具的可用性及扣款方式取決於帳號與服務端規則。 [Anthropic 第三方工具登入](https://support.claude.com/en/articles/13189465-log-in-to-your-claude-account)

## 本機設定

### 數位辦公室

從本專案目錄執行 `npm run office`，在瀏覽器開啟 [Goose Office](http://127.0.0.1:4178/)。服務只監聽本機，使用現有 Goose 的 Claude ACP 與 ChatGPT Codex 訂閱登入。像素辦公室由 Canvas 在瀏覽器繪製，可以在只有 CPU 的電腦使用。每次實際規劃、委派及審閱都會使用所選主管的訂閱額度。

在交辦台選 Claude、Codex 或雙主管，送出任務後可在同一討論串追問。Claude 帶研究員 Mira 和審閱員 Theo，Codex 帶工程師 Finn 和測試員 Nova。子代理是獨立的 Goose 回合，沿用該組主管的訂閱。主管可親自回覆，或選擇員工、分派事項並審閱成果。「執行：」開頭的網頁交辦可使用本機工具，兩位主管在網頁上的主機工作依序執行。

對話支援 Markdown 粗體、清單、表格、連結與程式碼。任務執行時可展開工作紀錄查看各回合、Goose 回傳的工具事件和耗時；完成後紀錄仍可查看。已授權的本機任務可將產出放進該任務的 `.data/office-files` 子資料夾，用 `[成果檔名](office-file:成果檔名)` 回傳下載連結。常用圖片、影片與音訊格式也會在對話裡提供預覽。

交辦台的「附件」支援 PNG、JPEG、WebP、PDF、TXT、Markdown、CSV 和 JSON。也可在訊息欄直接貼上截圖。一次最多 5 個檔案，單張圖片 7 MB、其他附件 10 MB，合計 20 MB。主管會收到圖片、擷取的文件文字，以及掃描 PDF 的部分頁面。送出的原檔可在任務對話下載。

「引用」可在本機搜尋舊任務的訊息。一次最多引用四則片段，送出時會保存片段，並在對話中提供原任務入口。引用內容作為資料交給主管。

在「任務紀錄 → 記憶與技能」選成員即可新增提案、核准、退回或封存。主管與員工也能在回覆時提出建議，待使用者核准。核准的記憶只給指定成員使用，技能須符合目前交辦的觸發詞才會載入。

「分工」可指定一位審閱主管、最多六個工序、各自的負責人和前置工序。主管也可在規劃時自行建立分工。跨組且互不依賴的純對話工序可並行，同一模型服務依序接單。使用本機工具的工序依序執行。失敗時，「分工看板」可以重試未完成的工序。服務重啟會接續純對話分工。執行中曾中斷的本機工序先標記待確認，保留完成的成果。

交辦台初始選定 Opus 5.5 · Medium 和 GPT-6.2 Sol · XHigh，之後會記住你在該瀏覽器選擇的模型與 Effort。若本機尚未偵測到原生 Codex 訂閱登入或模型不支援 XHigh，GPT-6.2 Sol 會顯示並使用 High。

若本機原生 Codex 已用 ChatGPT 帳號登入，交辦台會顯示該模型實際支援、且 Goose 尚未支援的 `xhigh` 和 `max`。選擇這些等級時會用原生 Codex 處理此次交辦，包括分派、審閱與圖片。需要本機工具的交辦可寫入專案工作目錄和成果目錄。 [Codex 推理強度設定](https://learn.chatgpt.com/docs/config-file/config-reference)

可使用路徑中的 Codex CLI、以 `OFFICE_CODEX_BIN` 指定執行檔，或在專案安裝已驗證的版本：

```powershell
npm install --prefix .tools/office-codex --save-exact @openai/codex@0.171.0
node .tools/office-codex/node_modules/@openai/codex/bin/codex.js login
```

重新開啟登入面板並按「重新檢查」即可更新可用的 Effort。

任務與對話存於 `.data/office.sqlite`。任務紀錄的 Slack 頁籤會讀取現有橋接器已存到本機的近期討論串。網頁交辦及回覆保存在辦公室；要繼續從 Slack 收訊，另開終端執行原有的 `npm start`。可用 `OFFICE_PORT` 更改網頁服務埠。

首次使用時，點右上角的「登入」→「開始設定」。系統會沿用現有 Goose CLI 和 `npm ci` 安裝的官方 Claude Code。缺少相容的執行檔時，系統會將官方版本安裝到專案狀態目錄。兩個授權頁面會依序開啟，已有登入設定的帳號會跳過。

請在官方授權頁面使用自己的訂閱帳號。授權後，登入面板會自動檢查狀態。關閉面板後可隨時再開，也可按「取消設定」。若作業系統不支援自動安裝，或授權需要其他步驟，可展開「手動登入」。登入狀態檢查不會送出模型請求。

需要 Node.js 24 以上、Goose CLI、Claude Code CLI。專案以 Goose 1.60.2 及 `npm ci` 安裝的 ACP adapter 為基準。Windows 可以把官方 Goose ZIP 解壓到 `.tools/goose`，或把 `goose.exe` 加入 `PATH`。也可在 `.env` 用 `GOOSE_BIN` 指定完整路徑。 [Goose 官方發行版](https://github.com/aaif-goose/goose/releases/tag/v1.60.2)

```powershell
npm ci
Copy-Item .env.example .env
npm run configure -- codex
```

在 Goose 選擇 **Configure Providers → ChatGPT Codex**，用自己的 ChatGPT Plus 在瀏覽器登入。原版 Codex CLI 的登入不會填入這個 Goose profile。Claude 端使用已在原版 Claude Code 登入的 Claude 訂閱。若回報登入到期，執行 `claude auth login` 重新登入。

可以在 `.env` 以 `GOOSE_CODEX_MODEL` 或 `GOOSE_CLAUDE_MODEL` 指定完整模型 ID。`GOOSE_CLAUDE_EFFORT` 會把指定的推理強度傳給 Claude Code，留空時使用 Claude Code 的設定。編輯 `.env` 後重新啟動橋接器即可套用設定。 [Claude Code 模型設定](https://code.claude.com/docs/en/model-config)

「執行：」預設從本專案的根目錄開始。用 `GOOSE_WORK_DIR` 指定其他起始目錄時，可以填絕對路徑或相對本專案的路徑。檔案與命令的實際存取範圍由啟動橋接器的系統帳號權限決定。

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
| Slack 原生點名 `@頻道 報數` 或 `@這裡 報數` | 在訊息開頭選擇 `@頻道` 或 `@這裡`，效果同 `@all`，會叫到兩位 Agent。Slack 也會依該點名設定通知頻道成員。 |
| `@all 一起完成這個方案` | 開啟該 thread 的自主回覆。Claude 先回答，Codex 讀取 Claude 回覆後接力，每次觸發最多四輪。開頭也可用「協作」或「接力」。 |
| `!auto on` / `!auto off` | 開啟或關閉所在 thread 的自主回覆。 |
| `!stop` | 關閉所在 thread 的自主回覆，停止執行中的模型程序並清掉排隊工作。已送出的 Slack 回覆會保留。 |

每個任務開一個 thread，後續留言、點名與停止指令都發在同一串。模型只收到該 thread 的首則與近期文字。Slack 補抓以 API 能讀取的內容為準，讀取失敗時使用 SQLite 記錄。重新啟動會保留已儲存的對話和自主模式設定。中斷的工作可以用一則新訊息再次啟動。

`npm test` 會用模擬 Agent 驗證訊息隔離、雙點名、四輪上限、停止、編輯與刪除、冷啟動讀取和 Goose 輸出解析。測試不呼叫 Slack 或模型服務。
