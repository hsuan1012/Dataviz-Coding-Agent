---
name: data-vis-coding-v2
description: >-
  建立「互動式資料視覺化應用」的完整工作流程 skill。從一份資料（CSV/JSON/GeoJSON）與需求出發，
  走完 規格釐清 → 資料處理 → 圖表選型 → 元件實作 → 多層次驗證，產出「可運作、能互動、數值正確、
  風格一致」的 React + Tailwind + Chart.js/D3 前端。核心是「內容與樣式分離」兩階段設計，並以實際
  執行 + 數值校驗取代臆測，避免資料錯置與視覺幻覺。
  Use whenever the user wants to build or scaffold an interactive data-visualization app / dashboard
  / chart / choropleth or geographic map / scatter or bubble plot / treemap / sunburst / sankey /
  heatmap — any runnable, data-driven interactive frontend. Trigger even when they just hand over a
  dataset and a goal without naming a chart type (e.g.「把這份資料做成可以互動的視覺化」「做個 dashboard」
  「build a viz app」). Do NOT use for: adjusting or restyling an EXISTING chart (colors, labels) → the
  dataviz skill; a single static chart image (one matplotlib PNG); pure data cleaning/analysis whose
  output is numbers or insights, not an app; explaining or teaching viz concepts; or debugging an
  existing app / learning a framework.
---

# data-vis-coding

引導你把「一份資料 + 一個需求」變成一個**可運作、數值正確、風格一致的互動式視覺化應用**。相較原版，本 v2 另外能**一鍵 scaffold 專案骨架**（`scripts/scaffold.py`，純前端或全端、套方向 A 雙主題），並在動手前用 **layout picker**（`assets/layout-picker-template.html`）讓使用者先選版面。

這個 skill 的方法論來自一份研究計畫：互動式視覺化應用開發門檻高（橫跨資料處理、前端、視覺設計、測試），且不同人產出的樣式與程式風格不一致，難以維護重用。這個 skill 就是用一套固定的流程與樣式規範，讓每次產出都一致、可信。

## 三個核心原則（先讀，這決定你所有決策）

1. **內容與樣式分離（避免 style drift）** — 先決定「畫什麼」，再套用固定的樣式字典決定「長怎樣」。絕不在元件裡寫死 hex 色碼、字級或間距，一律從樣式字典讀取。這是整個 skill 最重要的紀律。
2. **執行取代臆測（避免視覺幻覺 hallucination）** — 資料的欄位、型態、統計量、圖形對應數值，一律靠**實際讀檔與執行程式**得到，不要憑檔名或印象猜。做出來的圖要「真的對」，不是「看起來對」。
3. **人機協作** — 需求意圖與美學決策保留給人確認；資料處理、元件實作、測試修正才是你自動化發揮的地方。遇到需求模糊或美學取捨，主動問，別自己腦補。

## 兩階段設計（本 skill 的骨架）

```
使用者需求 + 資料
      │
      ▼  階段一：內容決策 (Content) —— 決定「畫什麼」
      │     圖表型態、欄位對應 (x/y/顏色)、需要的互動 (hover/filter/zoom)
      ▼
      │  階段二：樣式套用 (Style) —— 決定「長怎樣」
      │     套用固定的 styleDictionary（色碼、字型、尺寸），不寫死任何樣式
      ▼
   可運作的互動式視覺化應用  →  多層次驗證  →（失敗則自我修正）
```

階段一產出一份**內容規格**（畫什麼），階段二拿它加上樣式字典生成程式碼。兩者分開，樣式才不會每次生成都漂移。

## 標準流程（照這個順序做）

1. **釐清需求** — 確認：要傳達的關鍵訊息、目標讀者、要哪些互動。需求若含糊，先問人再動手（見「原則 3」）。產出一份簡短的內容規格。
2. **讀資料、做摘要** — 用工具**實際讀檔**（別猜）。回報：欄位、每欄型態（number/date/string/geo）、缺失值、列數、前幾列樣本。資料型態決定選圖，所以這步一定要靠執行得到。
3. **選版面 + 選圖表型態** — 先選版面：讀 `references/layout-options.md`，依資料形狀挑 3–4 種版面，改 `assets/layout-picker-template.html` 發成 Artifact 讓使用者在對話中回覆選定（無 Artifact 工具時 fallback 到 AskUserQuestion + ASCII wireframe）。再依資料型態與內容規格挑圖，規則見 `references/chart-selection.md`。美學或多種合理選項並存時，提出建議讓人拍板。
4. **技術選型** — 標準圖表（長條/折線/圓餅/散點）用 **Chart.js**；高度客製或特殊互動（choropleth 地圖、sankey、sunburst、treemap、chord）用 **D3.js**。專案骨架與依賴見 `references/tech-stack.md`。開新專案可用 `scripts/scaffold.py` 一鍵生成套方向 A 雙主題的骨架（純前端預設 / `--fullstack` 加後端 / `--charts d3|chartjs|recharts`）。
5. **實作元件（兩階段落地）** — 依內容規格 + 樣式字典產出 React 元件。**所有顏色/字型/尺寸都從 `assets/styleDictionary.js` import，禁止寫死**。互動回呼（hover/filter/click）要真的接上資料。
6. **多層次驗證** — 依 `references/verification.md` 逐層驗：程式層 → 資料層 → 互動層 → 視覺層 → 人工審查。全通過才算達標。
7. **自我修正迴路** — 驗證失敗時，讀錯誤訊息，找出根因（別亂改），修正後**重跑驗證**。重複直到通過或需要人介入。

各階段的細節（誰負責、AI 適合度、實作要點）見 `references/workflow.md`。

## 樣式字典：視覺規範的單一來源

`assets/styleDictionary.js` 是所有視覺元件的**單一事實來源**（single source of truth），
三層結構對齊 Material 3 的 ref→sys→comp：primitive（色值/字級表）→ semantic（`accent`、
`textMuted`）→ component（`components.panel/pill/tooltip…`）。使用方式：

- 建立新 app 時，把 `styleDictionary.js` 複製進專案（例如 `src/styleDictionary.js`）。
- 每個圖表元件 `import { colors, categoricalPalette, sequentialScale, typography, spacing, components } from './styleDictionary.js'`。
- 字級只從 `typography.sizes` 取、圓角只從 `components.*.radius` 取，元件內禁止裸數字
  （驗證層有 grep 檢查，見 references/verification.md ④）。
- 要改整體風格，只改字典一處，所有圖一起變 —— 這正是「避免 style drift」的機制。

配色語意：`categoricalPalette` 給多類別（長條/圓餅/多系列折線）；`sequentialScale` 給數值漸層（heatmap、choropleth 地圖）。順序固定，確保同份資料每次生成顏色一致。

## 反面模式（看到就停下來）

- 在元件裡寫死 `#2563eb`、`fontSize: 14`、`padding: 16` —— 應該全從樣式字典來。
- 沒讀檔就假設欄位名或型態 —— 一定要先實際讀資料摘要。
- 圖生出來沒驗證就說「完成」—— 至少要過程式層與資料層。
- 需求模糊時自己猜關鍵訊息或硬選一種圖 —— 先問人。
- choropleth 地圖硬塞給 Chart.js —— Chart.js 無內建地圖支援，用 D3.js（見 tech-stack）。

## 參考檔

需要時再讀，別一次全載入：

- `references/workflow.md` — 8 階段工作流程細節、各階段負責角色與 AI 適合度、layout picker 步驟、用 scaffold 開新專案。
- `references/chart-selection.md` — 資料型態 → 圖表型態的選型規則（含地理欄位/中文縣市鄉鎮偵測）。
- `references/tech-stack.md` — React + Tailwind + Vite 專案骨架、Chart.js vs D3.js 選用、依賴清單。
- `references/verification.md` — 五層驗證（程式/資料/互動/視覺/人工）怎麼做，含 Playwright 互動驗證。
- `references/layout-options.md` — 9 種標準版面 catalog + 四大設計原則，配 picker 模板選版面。
- `assets/styleDictionary.js` — 樣式字典，複製進專案使用。
- `assets/layout-picker-template.html` — layout picker 模板，改造後發成 Artifact 讓使用者先選版面（方向 A 配色）。
- `scripts/scaffold.py` — 一鍵生成專案骨架（純前端預設 / `--fullstack` 加後端 / `--charts` 變體 / 套方向 A 雙主題）。
