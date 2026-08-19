# 散布圖縮放改成滑鼠滾輪（取代放大鏡框選）

## 背景

老師看過 app 後回饋：「放大縮小用滑鼠 scrolling 來控制會比較直覺，不用另外再設一個放大的按鈕」。
現行 [scatter-zoom 設計](2026-07-31-scatter-zoom-design.md) 是「放大」toggle 按鈕開啟後拖曳框選
範圍縮放，三種手勢還原（雙擊空白／點空白無拖曳／再點按鈕）。本次把這個互動整個換成滾輪縮放，
拿掉「放大」這個模式與按鈕。

## 決策摘要（brainstorming 確認）

- 錨點：以滑鼠游標位置為中心縮放（游標下的資料值縮放後仍在游標下）。
- 選取／清除模式的拖曳框選功能保留，不受影響；滾輪縮放獨立運作，兩者不衝突（滾輪不會誤觸
  brush 的 mousedown/drag）。
- 還原手勢：只保留雙擊空白處還原，不另加「還原」按鈕。
- 縮放範圍限制：縮小不超過全域範圍（等於全域時直接回到 `zoomX/zoomY = null`，和現有「還原」
  邏輯共用一套狀態）；放大有下限（domain 寬度不小於全域的 5%，避免縮到看不到任何點）。
- 使用說明彈窗內文同步更新（見下）。

## 設計

### 移除
- `mode` 型別從 `"select" | "clear" | "zoom" | null` 拿掉 `"zoom"`。
- 「放大」toggle 按鈕（`.scatter-zoom-toggle`）整顆拿掉；`zoomMode` 變數、brush handler 裡
  `mode === "zoom"` 分支、按鈕點擊時「再次點擊=還原」的邏輯一併移除。
- 使用說明彈窗列點「按『放大』開啟後，拖曳框選要放大的範圍；再按一次或點空白處還原。」整條拿掉，
  改成描述滾輪縮放的新列點（例如：「在圖表上滾動滑鼠滾輪可縮放，雙擊空白處還原。」）。

### 新增：滾輪縮放
- SVG 上掛 `wheel` event listener（`{ passive: false }` + `preventDefault()`，避免整頁跟著捲動）。
- 事件流程：
  1. 用目前的 `x`/`y` scale，把滾輪事件當下的游標螢幕座標（`ev.offsetX/offsetY`，扣掉 margin）
     反推成資料值 `(xv, yv)`——這個值是縮放的錨點，縮放後仍要落在游標正下方。
  2. 依 `ev.deltaY` 正負決定放大（往上滾）或縮小（往下滾），固定係數（如 `factor = 1.2`）。
  3. 分別對 X、Y 現有 domain（`zoomX ?? safeDomain(domAll[xKey], xKey)`，Y 同理）以錨點
     `xv`/`yv` 為中心縮放寬度：新左界 `xv - (xv - lo) / factor`（放大時 factor>1 讓分母變大、
     寬度變小；縮小時 factor<1 或直接用倒數），新右界同理。
  4. Clamp：
     - 縮小方向：新 domain 若已包含（或超出）全域 `safeDomain(domAll[xKey], xKey)`，直接把
       `zoomX`（或 `zoomY`）設回 `null`（symlog 軸也會自動切回既有的固定對數刻度，沿用
       7/31 設計裡 `xEffectivelyLog = xIsLog && !zoomX` 的邏輯，不用改）。
     - 放大方向：新 domain 寬度不得小於全域寬度的 5%，超過就 clamp 在 5% 那個寬度（錨點仍固定
       在游標位置，只是不再繼續縮小範圍）。
  5. X、Y 兩軸獨立判斷、獨立設定（沿用既有 `zoomX`/`zoomY` state，不新增 state）。
- 與既有邏輯共用：切 X/Y 下拉清空縮放、切顏色/大小通道/年份/下鑽不清空縮放——這些規則本次不動，
  沿用 7/31 設計原封不動的部分。
- 雙擊空白處還原：現有 `dblclick.zoomReset` 邏輯不變，只是不再需要 `setMode((m) => (m === "zoom" ? null : m))`
  這行（沒有 zoom 模式可退了）。

### 不做（YAGNI）
- 不做獨立「重置縮放」按鈕（雙擊已足夠，brainstorming 已確認）。
- 不做縮放狀態持久化。
- 不影響 `selected` 選取名單或主地圖高亮。
- 不改選取／清除的按鈕與拖曳框選邏輯本身。
- 不處理觸控裝置的 pinch-zoom（滑鼠 wheel 事件為主，這個 app 目前沒有行動版適配需求）。

## 追加:縮放後可拖曳平移(8/4,使用者實測後追加)

使用者在 localhost 實測滾輪縮放後回饋：「放大後要可以在散佈圖用滑鼠上下左右拖移」。釐清後確認
縮放機制本身(游標錨點、軸範圍縮窄、泡泡大小不變)完全符合預期，不需更動；只是額外需要「縮放後
可以拖曳平移目前的檢視範圍」這個新手勢。

### 決策摘要

- 觸發時機：只在「選取」「清除」都未開啟時（`mode === null`，目前的空白工具狀態）才能拖曳平移；
  兩模式開啟時,拖曳空白處維持原行為(方框選取/清除),不受影響。
- 只平移「目前有縮放」的那一軸：X/Y 各自獨立,`zoomX`/`zoomY` 是 `null`(全範圍)的那一軸拖曳時
  不受影響(沒有東西可平移);兩軸都是 `null` 時,拖曳空白處完全無反應(比照縮放前的既有行為)。
- Clamp：平移不能超出全域範圍(拖到底就停住,不會露出資料範圍以外的空白)。
- 游標樣式：可平移時(至少一軸有縮放)顯示 `grab`,拖曳中顯示 `grabbing`,提供可拖曳的視覺提示。

### 設計

- **`panDomain` 純函式**(`src/lib/scatterZoom.ts`,比照 `zoomDomain` 同檔案):
  `panDomain(current: [number,number], full: [number,number], delta: number): [number,number]`——
  把 `current` 平移 `delta`(資料值位移量,可正可負),超出 `full` 邊界時平移量會被 clamp(貼齊邊界,
  寬度不變),與 `zoomDomain` 的邊界 clamp 邏輯完全相同,可抽一個共用的內部(不 export)輔助函式
  `clampToFull(lo, hi, fullLo, fullHi)` 給兩者共用,避免重複。
- **`Scatter.tsx` 拖曳平移**:在既有的框選 `useEffect`(`g.brush`)裡,`if (!mode)` 分支目前是
  完全拆掉 overlay、直接 return——改成:只要 `zoomX || zoomY` 有一軸為真,就在 `bg`(復用同一個
  `<g class="brush">` 容器)裡手動 append 一個透明背景 `<rect>`(覆蓋整個 `[0,0]~[W,H]`,比照
  d3.brush 的 overlay 概念),掛 `d3.drag()`:
  - `start`:記錄 `{ px, py, xDomain: zoomX, yDomain: zoomY }`(游標起點座標用 `ev.x`/`ev.y`,
    d3.drag 預設就是相對容器的座標,與現有 brush 的 `ev.selection` 同一套座標系,不需要額外轉換)。
  - `drag`:算 `dxPx = ev.x - start.px`、`dyPx = ev.y - start.py`;只在 `start.xDomain` 非 null
    時才動 `zoomX`(`start.yDomain` 同理動 `zoomY`)——用目前的 `x`/`y` scale 的
    `range()` 換算「每像素對應多少資料值」,再乘上位移量、取負號(拖曳方向與資料值位移方向相反,
    比照「抓著內容拖曳」的直覺:往右拖=看到範圍往左移=domain 下界變小),丟給 `panDomain` 算出
    新的 `zoomX`/`zoomY` 並直接 `setZoomX`/`setZoomY`(跟滾輪縮放一樣每個 tick 都即時 setState,
    不用額外的 CSS transform 預覽層——這個 App 的資料量小、既有的滾輪縮放已經證明每次事件都
    setState 夠流暢,拖曳同理)。**方向的正負號屬於容易搞反的地方,實作完務必在瀏覽器裡實際拖幾次
    確認方向符合直覺(往右拖=看到的內容跟著往右移),不符合就直接把該軸的正負號反過來,不用照抄
    這裡的推導。**
  - `end`:清空拖曳起點狀態。
  - 拖曳中(`dots.raise()` 已有的機制不變)泡泡本身的 hover/click/dblclick 不受影響——因為
    透明背景 rect 疊在泡泡下方,從泡泡本身按下滑鼠會被泡泡的既有事件先接住,不會誤觸平移。
  - 游標樣式:rect 平時 `cursor: grab`(僅在 `zoomX || zoomY` 為真時),拖曳中 `cursor: grabbing`。
- **使用說明彈窗**:滾輪縮放那條列點文字補一句平移說明,例如:
  「滑鼠移到圖上滾動滾輪可縮放；縮放後可拖曳平移；雙擊空白處還原。」

### 測試影響

- `src/lib/scatterZoom.test.ts` 新增 `panDomain` 的單元測試(比照 `zoomDomain` 的邊界 clamp
  案例:一般範圍內平移、左邊界 clamp、右邊界 clamp)。
- `scripts/verify-scatter-zoom.mjs` 新增:未縮放時拖曳空白處無反應(比照現有行為不變)、縮放後
  拖曳可平移(軸刻度隨拖曳方向改變)、平移會 clamp 在全域邊界(拖到底不會再往外跑)、選取/清除
  模式開啟時拖曳空白處仍是方框選取/清除(不受這次改動影響)。

## 測試影響

- `scripts/verify-scatter-zoom.mjs`：整份改寫。現行 25 項多數是「點放大按鈕→拖曳框選」流程，
  改成用 Playwright `mouse.wheel(deltaX, deltaY)` 模擬滾輪事件，驗證：游標錨點在縮放前後
  資料值不變、放大/縮小方向正確、縮小到全域自動還原（zoomX/zoomY 變 null、symlog 軸切回對數
  刻度）、放大有下限不會縮到 0、雙擊空白處還原仍正常、選取/清除模式下滾輪縮放仍可用且不影響
  brush 選取結果。
- `scripts/verify-scatter.mjs`：使用說明彈窗內容檢查那條列點的文字要跟著改。
- `scripts/verify-brush-play.mjs`／`verify-merged.mjs`／`verify-scatter-causes.mjs`：這些腳本裡
  對 `.scatter-zoom-toggle` 的選擇子／互斥檢查如果還在，需要拿掉或改成兩顆按鈕（選取/清除）的
  互斥檢查。
