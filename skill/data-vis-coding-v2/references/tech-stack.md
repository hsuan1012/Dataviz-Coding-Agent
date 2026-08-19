# 技術選型與專案骨架

團隊標準技術棧，採用它以利跨專案維護與重用。

## 技術棧

- **前端框架**：React + Tailwind CSS
- **建置工具**：Vite
- **視覺化套件**：
  - **Chart.js**（搭 `react-chartjs-2`）—— 常見標準圖表：長條、折線、圓餅、散點。開箱即用、程式少。
  - **D3.js** —— 高度客製或特殊互動：choropleth 地圖、sankey、sunburst、treemap、chord、waterfall。彈性大但要自己畫。
  - **globe.gl** —— 3D 地球儀（國家層級點位/連線視覺化，非 choropleth）。匯出是**工廠函式**：
    `Globe()(containerElement)`（先呼叫 `Globe()` 拿掛載函式，再傳容器），不是 `new Globe(el)`。
    `pointLabel` 可回 HTML 字串，方便做兩行式（中/英）標籤。
- **（選用）後端**：FastAPI + SQLite —— 需要伺服器端資料查詢/彙整時才加。純前端 + 本地資料檔（CSV/JSON/GeoJSON）能解決的，就不必上後端。

## Chart.js vs D3.js 怎麼選

| 情況 | 選 |
|---|---|
| 長條/折線/圓餅/散點，標準互動（hover tooltip、legend toggle） | **Chart.js** |
| 地圖、階層、網路/流量圖，或要精細控制每個視覺元素與過場動畫 | **D3.js** |
| 兩者都行、想快 | Chart.js |

Chart.js 無內建地圖 —— choropleth 一律走 D3.js（搭 `topojson-client` 解析邊界，`d3-geo` 投影）。

## 專案骨架（Vite + React）

```
my-viz-app/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── styleDictionary.js      ← 從本 skill 的 assets/ 複製進來
│   ├── components/
│   │   └── XxxChart.jsx         ← 每個圖一個元件，import 樣式字典
│   └── data/
│       └── dataset.csv          ← 或 .json / .geojson
```

## 依賴清單（依需求取用）

```jsonc
{
  "dependencies": {
    "react": "^19",
    "react-dom": "^19",
    "chart.js": "^4",
    "react-chartjs-2": "^5",
    // choropleth / 進階圖才需要：
    "d3": "^7",
    "topojson-client": "^3"
  },
  "devDependencies": {
    "vite": "latest",
    "@vitejs/plugin-react": "latest",
    "tailwindcss": "^4",
    "@tailwindcss/vite": "^4",
    // 驗證用：
    "vitest": "latest",
    "playwright": "latest"
  }
}
```

## 元件實作要點（兩階段落地）

- 元件只負責「畫什麼」的內容邏輯；「長怎樣」全部 `import` 自 `styleDictionary.js`。
- **字級紀律（type scale，對齊 Material 3 的 type scale 觀念）**：元件內禁止出現裸數字
  `fontSize`——一律從 `typography.sizes` 取具名字級（`sizes.body`、`sizes.legend`…）。
  需要新字級時**先進字典命名再用**（想清楚它扮演什麼角色：是 caption？是 hint？），
  不准臨場冒一個 12.5。實測教訓：迭代中途加說明文字/提示章這類小元件時最容易犯——
  一天內冒出 12、12.5、13.5 三個孤兒字級，事後才發現全該是同一個角色。間距同理
  （`spacing.*`），但字級是重災區。
- **元件層 tokens（第三層，對齊 Material 3 的 ref→sys→comp 架構）**：樣式字典除了
  primitive（色值）與 semantic（`accent`/`textMuted`）兩層，再放一個 `components` 節——
  「這類元件長什麼樣」的決策（圓角、tooltip 內距…）集中命名：`panel`/`button`/`control`/
  `pill`/`tooltip`/`bar`/`swatch` 各配 `radius` 等屬性，元件內禁止裸數字 `borderRadius`。
  實測教訓：不設這層時，一個成熟 app 累積出 **7 種圓角散落 21 處**（同是卡片有的 8 有的
  10），每處單看都合理；tooltip 樣式在兩個圖表元件各複製一份，改一邊必忘另一邊。
  第三層就是把「這是一顆膠囊」講一次、處處引用。
- 資料透過 prop 傳入（例如 `<BarChart rows={rows} />`），元件內不內嵌大筆資料。
- 互動回呼（hover/filter/click）要真的改變顯示狀態並綁到資料，不是裝飾。
- Chart.js 的 `options` 裡的 color/font 一律引樣式字典的值（`colors.text`、`typography.fontFamily`、`typography.sizes.title` 等）。
- **Flex/Grid 子項目的 `min-height/min-width: auto` 陷阱：任何「單螢幕鎖版面不捲動」
  （`h-screen` + `flex`/`grid` 巢狀）的設計，子孫層級沒有逐一加 `min-h-0`
  （橫向同理 `min-w-0`），內容多的時候會把容器撐開，`h-screen`/固定高度形同虛設，
  版面在特定資料量下突然爆版。** 這個坑同一個 app 可能在不同層級各中一次（外層
  三欄版一次、內部子元件重構又一次），凡是宣稱「整頁鎖高不捲動」的版面，先無腦
  逐層加 `min-h-0`，別等爆版才回頭查。

## API 型資料來源的兩段式 ETL（實測歸納）

資料來自 API（而非下載檔）時，把「抓」與「算」分開，raw 落地成檔案：

1. **階段一 fetch_raw**：逐期逐頁抓、每頁存一個 JSON 檔（不進版控）。
   要件：**可續抓**（已存在的頁跳過）、**快取頁驗證後才複用**（截斷/壞檔刪除
   重抓，否則一個壞檔讓續抓永久卡死）、**原子寫入**（先寫 .tmp 再 replace，
   中斷不留半個檔）、完整性驗證（累計列數 == API 宣稱的 totalDataSize）。
2. **階段二 seed**：從本地 raw 解析聚合＋硬檢核＋寫 DB。重建 DB 不需重抓。
3. 禮貌性間隔（0.5–1s）+ 有限重試；先抓最小的資料集驗通路再全量。
4. **來源 CSV 若帶 UTF-8 BOM，解析前要先剝除。** `d3.csvParse`（以及大多數 CSV
   parser）不會自動去除 BOM，會讓第一欄位的 key 變成帶 BOM 字元的字串，導致每一列
   對應到該欄的值都讀成 `undefined`——症狀常誤判成「資料本身缺這欄」。讀檔字串先
   `.replace(/^﻿/, "")` 再丟進 parser。
5. **國家/地區/語言名稱一律用平台內建 API 即時算，不要手刻對照表。**
   `Intl.DisplayNames(["zh-Hant"], {type:"region"})` 配資料裡的 ISO 3166-1 alpha-2
   碼即可即時轉繁中國名——零手誤風險、免維護一份可能過期的 195 國翻譯表，且
   locale 一換就自動對。同類需求（貨幣名、語言名）先查 `Intl.*` 有沒有現成的。

## React 資料驅動 app 的狀態工程要點（code review 實測歸納）

資料視覺化 app 的前端 bug 多半不在圖，而在「切換資料時的狀態」。四個必查：

1. **fetch 競態**：切換年度/資料集的 effect 要有 stale 旗標或 AbortController
   （cleanup 函式設 `stale = true`，回應到達時檢查），否則慢的舊請求會覆蓋新資料，
   標題與圖表錯置且無錯誤提示。
2. **錯誤狀態要可復原、範圍要小**：error 侷限在圖表區塊、控制列（選單/分頁）常駐，
   且**再次切換即清除重試**——error 一設不清 + 頂層 early-return 會讓一次網路抖動
   永久卡死整個 app。載入中同理：只換圖表區，別整頁 unmount（select 會失焦、畫面閃爍）。
3. **UI 狀態跨資料切換要「安全解析」**：下鑽/選取的實體名稱在新資料裡可能不存在
   （改制、換資料來源），用 `resolve(root, selected) → 找嘸退回頂層` 的純函式處理，
   **render 過程不可 throw**（無 error boundary 時 = 整棵樹卸載白屏）。
4. **hover 是最熱路徑**：tooltip 狀態放 App 頂層時，圖表元件要 `React.memo`
   隔離（props 保持穩定參照），否則每個 mousemove 都全 App 重渲染。
5. **API 對「空資料庫/未初始化」要回明確空值**（如空清單），不可讓聚合計算對空集合
   取索引丟 500；前端對空清單顯示可操作的指引（「請先執行 seed」）。同一資源的
   不同查詢分支（合計 vs 單月）對空資料的行為要**一致**（都 404 或都空值，
   別一邊 200+[] 一邊 404）。
6. **多資料鍵的檢視要「資料帶標籤」**：快取資料 set 進 state 時帶上其所屬鍵
   （期間/實體），render 只認「標籤與目前選擇相符」的資料——否則切換檢視時
   effect 尚未跑的首幀會用舊鍵資料配新標題渲染出錯置的一幀。
7. **改寫範本程式時，保留範本的回歸測試**（空 DB、分級邊界這類）：實測 review
   兩度抓到「複製範本但刪了測試、守衛路徑裸奔」。

## 啟動與檢視

- `npm install` → `npm run dev` 起本地伺服器。
- 用 Playwright（見 `verification.md`）截圖與自動操作驗證，不要只憑「應該會動」。

## 雙主題與字型（方向 A）

- 雙主題 token：以 `themes.{light,dark}` 為單一來源；React 用 context `useTokens()`／`useTheme()` 取當前主題；預設跟隨 `prefers-color-scheme`，提供手動切換，並同步 `document.documentElement.dataset.theme`。
- 樣式改讀 token（inline style 或 CSS 變數），不用寫死顏色 util。
- 字型兩情境：一般 app 用 `@fontsource/*` 自帶（離線、免手動子集）；Artifact（CSP）情境用 `@font-face` data URI 內嵌。標題襯線（思源宋體）、內文黑體。
- 數據一律 `font-variant-numeric: tabular-nums`（欄位對齊）。
- **Windows Chrome 對國旗類 emoji（Unicode regional indicator 組合，如 🇹🇼）常渲染
  失敗、直接顯示成兩個字母（如「TW」）而非旗子圖案**——這是該平台的字型限制，不是
  程式錯誤。若目標環境含 Windows，先預期這個限制：不依賴國旗 emoji 傳達資訊（改用
  國家全名/色塊/圖示庫），或明確告知使用者這是已知平台限制而非 bug。
