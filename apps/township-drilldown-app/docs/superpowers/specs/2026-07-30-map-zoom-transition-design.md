# 地圖層級切換 Zoom In/Out 動畫（老師建議）

## 背景

老師建議：點選台灣地圖上的縣市（下鑽）時，應有 zoom in / zoom out 效果。目前三層下鑽
（全國→縣市→鄉鎮→村里）切換是瞬間重繪——每層各自用 `d3.geoMercator().fitSize()` /
`fitExtent()` 重新 fit 資料範圍到同一個 800×900 viewBox，藉此讓小範圍（金門、單一鄉鎮）
也能填滿畫面；但這代表每層的 viewBox 座標系彼此不同，層級切換時沒有任何動畫、感覺是硬切。

## 範圍與行為規則

- 適用全部三層切換（全國↔縣市↔鄉鎮↔村里），雙方向皆有動畫。
- **只有「view 層級深度實際改變」時才觸發**：nation=0、county=1、town=2，新深度 > 舊深度
  ＝zoom in，新深度 < 舊深度＝zoom out，深度不變（換指標／年份／主題／框選／懸停）
  **完全不觸發**——Choropleth 目前單一大 `useEffect` 的依賴陣列（geo/counties/villages/
  values/meta/indicator/ind.key/deathCause/year/t/view/level/breaks/onView/
  selectedVillage/onSelectVillage/selectedTowns/onHoverCounty）會在這些情況下都重跑，
  必須用 ref 記錄前一個 view、比較深度後才決定要不要放動畫，避免「切 X 軸畫面也跳一下」。
- 縮放中心點：真實點擊地圖上的路徑（縣市/鄉鎮）＝以點擊座標為中心；麵包屑點擊、網址深連結
  直接進入、瀏覽器上一頁/下一頁、初始載入等無點擊座標的情境＝固定以容器正中央為中心。
- `prefers-reduced-motion: reduce`：跳過動畫，維持現行的瞬間切換（沿用專案既有慣例）。

## 技術架構：幽靈分身疊圖淡出淡入（不改動現有 D3 繪圖邏輯）

**問題**：同一個 `<svg>` 只有一組 `viewBox`，各層座標系不同；若在共用 viewBox 底下讓舊內容
淡出、同時把 viewBox 換成新層的值，舊內容會瞬間扭曲（座標系被重新解讀）。

**解法**：不共用座標系，改用「複製品＋CSS transform」：

1. 偵測到層級深度改變時，觸發動畫前，先 `ref.current.cloneNode(true)` 複製目前的
   `<svg>` 整份（含 viewBox、所有 path），絕對定位疊在原本的 `<svg>`正上方，
   `pointer-events: none`（`cloneNode` 本就不會複製 JS 事件監聽器，額外設定純為保險與清晰）。
2. 底下真正的 `<svg ref>` 完全不改動繪圖程式碼，照現有邏輯瞬間換成新層內容
   （新的 viewBox、新的 path）。
3. 對「複製品」與「真實 svg 外層容器」分別套用 CSS transition（`transform: scale()`、
   `opacity`），`transform-origin` 設為縮放中心點（點擊座標或容器中心的百分比座標）：
   - Zoom in：複製品 `scale(1)→scale(1.08)`、`opacity 1→0`；真實內容
     `scale(0.92)→scale(1)`、`opacity 0→1`。
   - Zoom out：方向相反（複製品縮小淡出，真實內容從放大狀態縮回並淡入）。
4. 動畫時長 750ms、`cubic-bezier` 對應 easeCubicInOut（沿用本專案既有動畫語彙，
   如散布圖泡泡補間、排名長條同款節奏）。動畫結束後移除複製品節點。
5. 並發保護：若使用者連續快速下鑽（動畫尚未跑完又觸發下一次），立即移除任何殘留的
   舊複製品，重新開始一組新的動畫（「最後一個動作贏」，不堆疊、不排隊）。

此法的優點：完全不需要重構 Choropleth.tsx 內部已通過 156+ 項驗證的繪圖程式碼
（縣級聚合、inset 框、疊加層、村里 lazy load 等邏輯零風險），純粹加一層獨立的視覺效果。

## 測試影響

- 新增純函式測試（若有可抽取的邏輯，例如「深度比較→方向判斷」）。
- `verify-drilldown.mjs` 等既有 Playwright 腳本中，下鑽點擊後等待時間過短
  （目前 120–300ms）的地方，需拉長到 ≥850ms（動畫 750ms＋緩衝）才斷言地圖 DOM 狀態，
  避免斷言時動畫尚未結束。
- 新增 `verify-map-zoom.mjs`（或併入既有腳本）：驗證「換指標/年份/主題/框選時地圖不觸發
  縮放動畫」（此為本功能最容易犯錯之處，須明確回歸檢查）、「點縣市/鄉鎮觸發 zoom in、
  麵包屑回上層觸發 zoom out」、「reduced-motion 下瞬間切換無殘留分身節點」。

## 不做（YAGNI）

- 不做精確邊界框縮放（如 D3 經典 zoomable map 的 bbox-to-bbox 變換）——已在 brainstorming
  階段權衡，因跨層麵包屑跳轉（如村里→全國）難以定義精確中繼 bbox，且複雜度/風險不成比例。
- 不改動散布圖／排名面板的既有動畫時序（不受本功能影響，維持瞬間更新）。
- 不做「動畫進行中鎖定其他互動」的機制（並發保護已用「最後動作贏」取代排隊/鎖定）。
