# 散布圖「放大鏡」框選縮放 + 使用說明彈窗

## 背景

使用者提供 Gapminder Bubbles 工具截圖，要求散布圖控制列的「選取」左邊新增一顆放大鏡圖示按鈕，
框選要放大的泡泡範圍。實作過程中經多輪使用者回饋修正，另外也在同一輪加了「使用說明」彈窗
（取代原本圖表下方常駐的操作說明文字）。

## 放大鏡設計（最終版，共五輪修正）

- 圖例列新增「🔍」圖示按鈕（清除左邊、選取左邊），三者互斥（`Scatter.tsx` 的
  `mode: "select" | "clear" | "zoom" | null`），工具開關（不因單次拖曳自動退出）。
- 「放大」模式拖曳框選＝把框選矩形的螢幕座標透過 `x.invert()`/`y.invert()` 換算回資料值，
  設成新的 X/Y 軸 domain（`zoomX: [number,number] | null`、`zoomY` 同）；`x`/`y` scale 的
  `useMemo` 改吃 `zoomX ?? safeDomain(domAll[xKey], xKey)`（Y 同理）。純視覺縮放，不影響
  `selected` 名單、不進 App reducer。
- **人口密度（symlog）軸支援縮放（方案 A，第二輪修正）**：原規劃因 `logTicks`/`makeScale`
  的 log 分支是手調死的固定值（`[0,5000,10000,20000,40000]`、domain 下界固定 0），縮放時這條
  軸不會正確收窄，一度改成「誠實停用」；後續改為**縮放時該軸暫時改用線性刻度**
  （`xEffectivelyLog = xIsLog && !zoomX`，`yEffectivelyLog` 同理，`xTicks`/`x` scale 都改吃
  這個值而非原始 `xIsLog`）——縮放範圍一還原就變回原本的固定對數刻度，完全不影響「完整範圍」
  時的既有邏輯與外觀。
- **三種還原手勢統一（第三輪修正）**：雙擊圖表空白處（`ev.target` 不是 `circle`）、
  單純點空白處（無拖曳的 brush `!ev.selection` 分支）、再次點擊已開啟的放大鏡按鈕，三者
  效果一致＝清空 `zoomX`/`zoomY` 並把 `mode` 退回 `null`。點空白處/再點按鈕這兩個手勢
  對「選取」「清除」模式也適用（比照退出模式，但不清空 `selected` 名單——名單沒有
  「原本樣子」可還原，只有放大有）。
- 切 X 或 Y 下拉（`xKey`/`yKey` 改變）時自動清空縮放（舊範圍對新指標無意義）；切顏色/大小
  通道、切年份、下鑽（點縣市/鄉鎮）都**不**清空縮放——Scatter 本身不隨下鑽篩選資料點
  （一律畫全國 368 鄉鎮，下鑽只影響 `selected` 高亮），故「下鑽換一批資料」的顧慮不成立，
  這點與原規劃不同。
- **泡泡不跑出 X/Y 軸（第四輪修正，使用者回饋）**：縮放後軸外的泡泡經比例尺外插會跑到
  軸線外側。修法＝在 `<defs>` 加 `<clipPath id="scatter-plot-clip">`（矩形＝軸線範圍，不含
  PAD 留白），`g.dots` 套用 `clip-path`，縮放範圍外的泡泡在軸線邊界被乾淨裁掉。
- 圖示按鈕樣式沿用 `.scatter-select-toggle` 共用 CSS（`aria-pressed` 開關視覺）。

## 使用說明彈窗設計（同輪追加，共六輪修正）

- 原本在圖表下方常駐顯示的白話解說＋操作提示文字，改成「使用說明」按鈕（清除右邊，樣式
  同選取/清除），點下彈出小視窗，內容含白話解說段落＋四點條列操作說明（`<ul>` 明指
  `listStyleType: "disc"`，因 Tailwind preflight 預設歸零 list-style）。
- 彈窗背景刻意用 `t.accentSoft`（淡色調）而非 `t.surface`，跟底下的白色卡片區分開來。
- **定位踩了三輪坑（教訓見下）**：一度定案＝彈窗掛在「使用說明」按鈕所在的按鈕列
  （`.scatter-select-controls`，`position:relative`）之下，`top: calc(100% + 8px)`（貼在
  按鈕列下方，不遮住按鈕）、`right: 0`（右緣對齊「使用說明」——它是列裡最後一顆按鈕）、
  `width: min(320px, 60vw)`（實測寬版面下往左安全邊界只有 ~343px，320px 留一點餘裕）。
- **第六輪修正（使用者要求「每點盡量同一行」）**：320px 塞不下最長列點（~32 字，約需
  ~420px）。改回 `left: 0`（對齊按鈕列本身左緣，即放大鏡按鈕左緣）、`width: min(520px,
  70vw)`——用 `getBoundingClientRect()` 實測兩種視窗寬度（1500px/1100px）下，按鈕列左緣
  往右到卡片邊界都有 ~690-740px 安全邊界，遠比往左的 ~343px 寬裕。代價＝彈窗右緣不再
  對齊「使用說明」按鈕本身（犧牲第五輪的視覺對齊要求），換取列點單行可讀性；五個列點
  （含「已選 N 鄉鎮」動態行）在兩種視窗寬度下都量測確認為單行。
- **第七輪修正（使用者截圖標示偏好位置）**：使用者在自己的截圖上用灰色色塊標出「希望彈窗
  浮在圖表右上角、泡泡較稀疏處」，而非第六輪的左上角（那裡泡泡較密集，擋到較多資料）。
  單純把 `left:0` 換成 `right:0` 治標不治本——`.scatter-select-controls` 沒換行時右緣本來就
  貼齊 `legend-row` 右緣，但**換行後獨佔一行時**只跟按鈕本身一樣窄（右緣只到「使用說明」
  按鈕右緣，往左安全邊界只有 ~343px，回到第一輪的坑）。真正的修法＝幫
  `.scatter-select-controls` 加 `flexGrow: 1`：換行後獨佔一行時，flex-grow 會把它撐滿整個
  `legend-row` 的寬度（沒換行、跟顏色/大小圖例共用一行時，`justify-content: space-between`
  本來就已達到同樣效果，加 flexGrow 不影響這個情境，按鈕本身視覺位置也不受影響，因為
  `.scatter-select-controls` 內部沒設 `justify-content`，預設 flex-start 讓按鈕仍緊靠自己
  左緣）。撐滿後 `right: 0` 就能對齊到接近整個 plot 的右緣，往左安全邊界擴大到
  ~690-740px，`top: calc(100% + 8px)` 維持不變（仍在按鈕列下方，不擋按鈕），視覺上彈窗
  浮在圖表右上角的稀疏區——同時滿足「單行列點」與「不擋密集資料/按鈕」兩個要求。
- **第八輪修正（8/3，改用 React Portal 徹底解決）**：使用者實測回報按鈕列右緣跟 X 軸終點
  之間仍有一段大空白，且改用另一個姊妹專案（gapminder-bubble-globe-app 的
  ChannelControls.tsx，同款使用說明鈕的移植來源）截圖要求「就是這樣」。該姊妹專案的版面
  單純（控制列本來就是唯一貼右緣的 flex 子項），用同一套「`position:relative` 父容器 +
  `position:absolute` 彈窗 `right:0`」就完全夠用；但本專案 `legend-row` 有換行邏輯，前七輪
  的 flexGrow hack 雖然理論上算式自洽（`plotScale` 恆為 1，`legend-row` 右緣理論上該貼齊
  X 軸終點），大範圍視窗尺寸掃描（1180–1920 寬、640–1080 高多組合）也量不出異常——但使用者
  实测瀏覽器仍出現落差，判斷是「相對按鈕列絕對定位」這條路徑對外層卡片鏈上某層
  `overflow-hidden`（`.col-span-8 ... overflow-hidden`，100dvh 鎖屏設計必要，不能拿掉）
  過度敏感，不同瀏覽器/渲染時機下安全邊界不夠穩定。**根本解法＝改用 `createPortal` 把彈窗
  整個渲染到 `document.body`**：用 `controlsRef.getBoundingClientRect()` 量測按鈕列座標，
  換算成 `position: fixed` 的 `top`/`right`（`top: rect.bottom + 8`、
  `right: window.innerWidth - rect.right`），監聽 `resize` 即時更新。Portal 後的節點完全跳出
  原本 DOM 位置的所有祖先 `overflow`/`clip` 限制，不管卡片鏈裡有幾層 overflow-hidden 都
  不受影響；同時仍維持「內容常駐 DOM、只切 `display:block/none`」不變（不是開啟時才掛載），
  保留既有 verify 腳本直讀 `.scatter-caption`/`.mini-count`/`.mini-hint` 的 `textContent`
  介面不用改。寬度放寬到 `min(450px, 90vw)`（不再受卡片安全邊界限制，只需顧及瀏覽器視窗），
  陰影加強為 `0 12px 32px -8px`、`zIndex: 100`（portal 到 body 後應該蓋過所有東西）。

### 定位除錯教訓（供 skill 參考）

此按鈕列（`.scatter-select-controls`）在圖例列版面擠壓時會**自己換行**成獨立一行，這時
`justify-content: space-between` 對「只剩一個元素的換行列」沒有作用（沒有第二個元素可以
「之間留白」），該元素會退回 flex-start——即按鈕列的左緣會等於外層 `legend-row` 的左緣，
**不是**視覺上看起來「靠右」的位置。這導致：
1. 第一版用 `right: 0` 展開彈窗（假設按鈕列在最右側）→ 實際往左超出外層卡片的
   `overflow: hidden` 邊界，彈窗左側文字被裁掉一截（「每顆泡泡代」被裁成「代表一個鄉鎮」）。
2. 改 `left: 0` 往右展開＋加大寬度後，換到另一種（較窄的）視窗寬度時改成右側被裁。
3. 確認：不能憑印象/單一視窗寬度判斷 flex 容器內元素的實際位置，要**用
   `getBoundingClientRect()` 實際量測**（含比對外層 `overflow: hidden` 祖先的邊界）才能
   正確抓出安全的絕對定位錨點與寬度上限；多種視窗寬度都要各自量測驗證，不能只測一種。
4. **即使算式自洽、大範圍量測也測不出異常，「相對某祖先絕對定位」仍可能在使用者實際瀏覽器
   環境下出問題**（第八輪）：`plotScale` 恆為 1 這件事在程式碼裡可以證明，開發機掃了
   1180–1920 寬 × 640–1080 高多組尺寸也複製不出使用者回報的落差，但問題依然存在。當「絕對
   定位＋量測安全邊界」這條路線反覆修正多輪仍不穩定，且該定位節點的祖先鏈上有一層
   `overflow-hidden` 是別的需求（100dvh 鎖屏）刻意留著、不能拿掉時，該考慮**跳出這條路線**
   ——用 `createPortal` 把浮動內容整個搬到 `document.body`，用測量到的座標換算成
   `position: fixed`，直接繞開所有祖先的 overflow/clip，而不是繼續在「相對定位＋安全邊界」
   裡打轉。

## 測試影響

- `scripts/verify-scatter-zoom.mjs`（新增，25 項）：三模式互斥、拖曳縮放/線性刻度切換、
  三種還原手勢（再點按鈕/雙擊空白/點空白無拖曳）、裁切區存在性、切通道/年份/X 下拉的
  還原規則、雙擊泡泡不誤觸還原。
- `scripts/verify-scatter.mjs`：新增使用說明按鈕存在/預設收合/內容/列點樣式/彈窗落在
  瀏覽器視窗內共 5 項；8/3 改 portal 後選擇子從 `div[style*='position: absolute']` 改
  `div[style*='position: fixed']`，邊界檢查從「落在 `.chart-scatter` 卡片內」改成「落在
  `window.innerWidth` 視窗內」（portal 到 body 後不再受卡片邊界限制）。
- `scripts/verify-brush-play.mjs`／`verify-merged.mjs`／`verify-scatter-causes.mjs`：
  `.scatter-select-toggle:not(.sel-clear)` 選擇子在三顆鈕（含放大鏡）情境下會同時選到
  多顆、炸 strict mode，改用專屬 class `.scatter-mode-select`／`.scatter-zoom-toggle`。

## 不做（YAGNI）

- 不做獨立「重置縮放」按鈕（三種還原手勢已足夠）。
- 不做縮放狀態持久化（跨頁面重整不保留）。
- 不影響 `selected` 選取名單或主地圖高亮。
