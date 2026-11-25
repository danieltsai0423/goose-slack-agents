# Goose Office 代理交接手冊

本檔適用於整個專案。Goose Office 是本機網頁交辦台，Slack 橋接器是另一個常駐程序。兩者共用 Goose 執行介面與本機訂閱登入，各自保存對話與排程。使用者的安裝與操作流程見 [README](README.md)。

## 啟動與驗證

- 使用 Node.js 24 以上，從專案根目錄執行 `npm ci`。程式使用 ESM 與內建的 `node:sqlite`。
- `npm run office` 啟動網頁，預設位址是 `http://127.0.0.1:4178/`，可用 `OFFICE_PORT` 改連接埠。網頁可獨立啟動，Slack 設定只在需要橋接時才填。
- `npm start` 啟動 Slack Socket Mode。登入、頻道及擁有者 ID 在本機 `.env` 設定，欄位見 [.env.example](.env.example)。
- `npm test` 使用模擬代理與隔離的資料庫，無須 Slack 或模型登入。`npm run smoke -- claude` 和 `npm run smoke -- codex` 是實際模型請求，排查登入或模型路由時才用。

## 從哪裡改

| 工作 | 程式入口與資料流 |
| --- | --- |
| 網頁導覽、交辦、工作紀錄 | [office/index.html](office/index.html)、[office/app.js](office/app.js)、[office/style.css](office/style.css)。辦公室與任務紀錄共用同一個交辦面板，`showView` 只切換視圖，`openThread` 和 `openNew` 才會改變目前對話。追問走 `POST /api/tasks/:id/messages`，返回辦公室要保留對話、草稿和附件。工作紀錄的轉圈由任務狀態控制，遵循 `prefers-reduced-motion`。 |
| 中英文介面 | 介面以繁體中文撰寫，[office/i18n.js](office/i18n.js) 在頁面渲染時翻譯文字與 `title`／`aria-label`／`placeholder`，英文在 [office/i18n-en.js](office/i18n-en.js)，以中文原文為鍵，`{}` 代表可變內容（較長的樣式優先比對）。新增介面文字時同時加入英文；使用者與模型撰寫的內容（`.markdown`、`.msg-content` 等，見 `SKIP`）不翻譯。CSS `content:` 文字以 `:root[lang="en"]` 覆寫。頂部「中／EN」按鈕寫入 `goose-office:lang`。 |
| 設定分頁 | [office/settings-page.js](office/settings-page.js) 讀寫 `/api/settings`，[src/office-settings.mjs](src/office-settings.mjs) 驗證並存到 `STATE_DIR/office-settings.json`，值優先於 `.env`。這個模組必須是 `office-server.mjs` 與 `main.mjs` 的第一個 import，才能在其他模組讀取 `process.env` 前套用。欄位的 `apply` 標示立即生效或需重啟。網址 `#history`、`#shop`、`#settings` 可直接開啟對應頁面。 |
| 辦公室動畫 | 2.5D 等角視角。[office/scene.js](office/scene.js) 組裝畫面、處理拖曳／縮放鏡頭與點選；[office/iso.js](office/iso.js) 是投影、像素多邊形、牆面貼圖與 A* 尋路；[office/iso-layouts.js](office/iso-layouts.js) 定義七層樓的房間格局、座位、日常地點與家具格位（小格 `f*`、2×2 大型格 `g*` 附每位玩家的站位 `spots`、牆面 `w*`，數量須等於 `economy.js` 該樓層的 `capacity`），[office/iso-world.js](office/iso-world.js) 把格局轉成可走的網格（`test/office-iso.test.mjs` 驗證每個地點都走得到）；[office/iso-themes.js](office/iso-themes.js) 是地板材質與牆面，[office/iso-props.js](office/iso-props.js) 是家具、桌椅、Q 版角色與表情泡泡，[office/iso-facilities.js](office/iso-facilities.js) 是遊樂設施（有人在玩時才會動）。[office/life.js](office/life.js) 定義有台詞的日常場景和回顧；[office/behavior.js](office/behavior.js) 讓每個人同時各自行動：座位小動作、走去某處或同事座位、邀同事一起玩多人設施，接到任務會中途走回座位（`test/office-behavior.test.mjs`）。閒置對話從預寫語句和本機已完成的任務摘要組成，全程在瀏覽器執行。「辦公室日常」開關是辦公室動畫的總開關：未選擇前依系統的 `prefers-reduced-motion` 預設關閉或開啟，使用者手動打開後即使系統要求減少動態效果也會播放。 |
| 網頁 API 與任務排程 | [src/office-server.mjs](src/office-server.mjs) 提供靜態資源與 API。[src/office-runtime.mjs](src/office-runtime.mjs) 保存交辦、對話、工序成果與工具事件，管理佇列和重啟恢復。瀏覽器讀取 `/api/state`，以 ETag 重用相同快照。 |
| 分工、引用、記憶與技能 | [office/workspace-tools.js](office/workspace-tools.js) 提供操作介面。[src/office-workflows.mjs](src/office-workflows.mjs) 驗證工序和前置關係，[src/office-history.mjs](src/office-history.mjs) 維護全文索引與引用快照，[src/office-knowledge.mjs](src/office-knowledge.mjs) 管理每位成員的核准狀態。 |
| 模型、Effort 與工具 | [src/office-models.mjs](src/office-models.mjs) 定義網頁選項和預設值。[src/office-runner.mjs](src/office-runner.mjs) 組合網頁回合上下文。[src/goose.mjs](src/goose.mjs) 啟動並解析模型程序，[src/goose-events.mjs](src/goose-events.mjs) 整理串流文字與工具事件，[src/office-codex.mjs](src/office-codex.mjs) 接原生 Codex CLI。 |
| 登入與用量 | [src/office-onboarding.mjs](src/office-onboarding.mjs) 管理授權流程，[src/office-auth.mjs](src/office-auth.mjs) 檢查本機登入，[src/office-install.mjs](src/office-install.mjs) 處理缺少的工具。[src/office-usage.mjs](src/office-usage.mjs) 查詢並短暫快取訂閱額度，[office/subscription-usage.js](office/subscription-usage.js) 顯示進度條與重置時間。 |
| 辦公室經營（資金、情緒、商店、樓層） | 規則與目錄在 [office/economy.js](office/economy.js)，瀏覽器與服務端共用。樓層由小到大共七層，`slotsFor(floor)` 決定可擺位置；大型設施（`size: 2`）只能放大型格，放不下的家具留在倉庫，搬家時服務端會重新擺放。[src/office-economy.mjs](src/office-economy.mjs) 是唯一記帳者，狀態存於 `STATE_DIR/office-economy.json`；`/api/usage/:id` 每次讀到用量都會交給它入帳，`GET /api/economy` 在頁面開著時最多每 `OFFICE_ECONOMY_SYNC_SECONDS`（預設 300，0 關閉）同步一次。只有最短的額度視窗會計入收入，避免同一份工作重複給錢。[office/furniture.js](office/furniture.js) 畫商店圖示、牆面掛飾、道具與情緒符號，[office/office-shop.js](office/office-shop.js) 是商店與成員卡上的送禮介面，商店樣式獨立在 [office/shop.css](office/shop.css)（新增靜態檔要同時加進 `src/office-server.mjs` 的白名單）。 |
| 附件與產出 | [src/office-attachments.mjs](src/office-attachments.mjs) 驗證上傳、擷取文字與 PDF 頁面。[src/office-files.mjs](src/office-files.mjs) 提供任務產出下載。前端允許的附件類型與大小上限在 [office/attachment-types.js](office/attachment-types.js)。 |
| Slack 收訊與接力 | [src/main.mjs](src/main.mjs) 連線 Slack 並以不同 Bot 身分回覆。[src/bridge.mjs](src/bridge.mjs) 處理點名、回合上限與停止，[src/store.mjs](src/store.mjs) 寫入討論串與自主回覆設定。[src/office-slack.mjs](src/office-slack.mjs) 在網頁提供指定頻道的唯讀紀錄。 |

## 交辦和協作的行為

- **網頁雙主管**各自收到同一份交辦。主管可直接回覆，或自動分派同組員工。Claude 組是 Mira `claude-research` 和 Theo `claude-review`，Codex 組是 Finn `codex-build` 和 Nova `codex-test`。
- **網頁跨組分工**由使用者指定一位審閱主管，最多六個工序。工序只會在前置工序都成功後收到前置成果。不同模型服務的獨立純對話工序可並行，同一服務的回合依序執行。審閱在所有工序完成後開始。
- **Slack 接力**使用 `@all 一起…` 讓 Claude 先答、Codex 接續，也會開啟該串的自主回覆。後續回合依交接結果決定，每次觸發上限由 `src/bridge.mjs` 的 `maxRounds` 控制，目前為 4。`!stop` 會取消該串進行中的回合、清空佇列並關閉自主回覆。
- **本機操作**由目前這則交辦明確授權。網頁由交辦台的權限按鈕（[office/access-mode.js](office/access-mode.js)）決定，每則交辦存入 `tasks.access`：`chat` 不用工具，`workspace` 在專案資料夾使用工具（原生 Codex 為 `workspace-write` 沙箱），`full` 不限檔案與網路（原生 Codex 為 `danger-full-access`）。Claude 與 Goose 路徑沒有沙箱，`workspace` 只靠指示限制範圍。沒有 `access` 的舊任務仍以「執行：」開頭判斷。使用工具的回合逾時是 `OFFICE_HOST_TURN_TIMEOUT_SECONDS`（預設 900 秒），對話回合仍用 `GOOSE_TURN_TIMEOUT_SECONDS`。執行目錄是交辦台左下角選的專案資料夾（[office/folder-picker.js](office/folder-picker.js)、[src/office-folders.mjs](src/office-folders.mjs)，存於 `STATE_DIR/office-folders.json`），送出時寫入該任務的 `workDir`；「不指定資料夾」或舊任務使用 `GOOSE_WORK_DIR`。「開啟資料夾…」在 Windows 由服務端開啟原生對話框。Slack 指令由設定的真人擁有者在指定頻道送出，開頭先點名代理或 `@all`，再接「執行：」。兩端共用同一個 `STATE_DIR` 時，模型的主機執行回合會透過 `host-turn.sqlite` 互斥。
- **引用與知識**只作為輸入資料。送出的引用片段有自己的快照。記憶與技能須經核准才會給指定成員使用，技能還需要符合觸發詞。附件、舊對話與模型輸出均不能替目前的交辦授權執行工具。

## 登入、資料與重啟

- 沿用 Claude Code 與 ChatGPT 訂閱。Goose 的 `chatgpt_codex` 登入與原生 Codex CLI 登入各自檢查。改模型或 Effort 時，同時驗證網頁選項、服務端接受的值與實際 CLI 傳參。
- 網頁預設是 Opus 5.5 · Medium 及 GPT-6.2 Sol · XHigh。XHigh 需要原生 Codex CLI 登入和模型能力檢查，缺少時使用 High。瀏覽器會記住已選的模型和 Effort。
- 圓環面板開啟，或辦公室頁面開著且距上次同步超過 `OFFICE_ECONOMY_SYNC_SECONDS` 時才查用量。Codex 顯示原生 CLI 帳號回傳的額度。Claude 透過 Claude Agent SDK 的實驗性查詢讀取用量，失敗時面板保留官方用量頁。這條查詢不送模型訊息。若帳號剛切換，先從網頁重新檢查登入再核對用量。
- `STATE_DIR` 預設 `.data`。`office.sqlite` 保存網頁任務、附件、工序與知識，`office-files/` 保存生成檔，Slack 討論串存於 `<workspace>-<channel>.sqlite`。同一 Office 資料庫只允許一個活躍寫入者。備份時使用 SQLite 一致性備份，或先停止寫入者再備份資料庫和成果目錄。
- 發送任務時以 `clientId` 去重，追問保留原 `threadId`。服務重啟會接續已留下的佇列與未完成的純對話分工。中斷的主機工序須先檢查工作區，再從分工看板重試，已完成的工序保留成果。
- `.env`、`.data/`、`.tools/` 與登入資料留在本機。交接時使用假資料和遮蔽過的診斷，GitHub 只提交程式、文件與測試所需的公開範例。

## 驗收與故障定位

| 情況 | 先核對 |
| --- | --- |
| 帳號登入、模型或 XHigh 不可用 | 網頁「登入 → 重新檢查」和 `/api/state` 的 `backend.connections`、`modelCatalog`。分別確認 Goose 與原生 CLI 的登入，避免把兩個連線狀態當成同一個。 |
| 訂閱用量讀不到 | 分別查看 `/api/usage/claude`、`/api/usage/codex` 的狀態，對照面板的官方用量頁。測試缺資料時需要顯示無法讀取，百分比為零只用於服務端明確回傳 0 時。 |
| 上一輪完成後，下一輪沒有開始 | 查看分工看板的前置狀態、員工回報與主管登入。失敗或中斷的工序會擋住依賴它的工序，完成的報告可用來確認重試沒有重跑。 |
| 重複交辦、串錯對話 | 檢查 `clientId`、`threadId`、續辦使用的 API 路徑，並重跑 `test/office-server.test.mjs` 與 `test/office-runtime.test.mjs`。 |
| Slack 沒有接力或執行 | 核對指定私人頻道、發令者、點名位置與討論串的自主回覆設定。重跑 `test/bridge.test.mjs`。 |

README 有英文版 [README.md](README.md) 與中文版 [README.zh-TW.md](README.zh-TW.md)，兩者內容需同步；截圖在 `docs/images/`，請用另設 `STATE_DIR` 的示範資料拍攝，不要放入真實任務或路徑。

修改後先跑 `npm test`。改到網頁時，用瀏覽器走一次該功能的操作流程，包含桌面與窄版；改到工具授權、重試或排程時，驗證既有測試中的拒絕、停止和重啟場景。交接摘要記下已改行為、測試結果、服務是否需要重啟，以及還沒驗證的部分。GitHub 發布後可在摘要加上對應的 commit 連結。
