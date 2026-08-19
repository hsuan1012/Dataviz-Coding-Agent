# Gapminder 散布圖功能對齊鄉鎮圖集 — 設計文件

日期：2026-07-31
狀態：已與使用者確認定案

## 目標

把 township-drilldown-app（臺灣鄉鎮統計圖集）散布圖的全部互動功能移植到
gapminder-bubble-globe-app 的泡泡圖，行為與鄉鎮版對齊。採「做法 A」：
移植鄉鎮版已驗證的模組架構（通道設定檔、選取 reducer、caption 純函式庫），
適配 Gapminder 的資料模型。

## 已確認的範圍決策

| 決策點 | 定案 |
|---|---|
| 新指標 | 加「兒童死亡率」「總生育率」兩個（來源：Gapminder fasttrack 開放資料），共 5 指標 |
| 地球儀 | 雙向連動：高亮/灰化、點擊 toggle、懸停雙向預覽（對應鄉鎮版迷你地圖角色） |
| 選取語意 | 兩層分工：左側勾選清單＝顯示範圍（不動）；框選＝高亮聚焦層，互不干擾 |
| 排名卡 | 三張固定競賽長條卡改為四張通道連動卡（X/Y/顏色/大小 各全球前 5） |

## 1. 資料層（ETL）

- 從 Gapminder fasttrack repo（open-numbers/ddf--gapminder--fasttrack）下載兩個
  datapoints CSV：
  - `child_mortality_0_5_year_olds_dying_per_1000_born`（兒童死亡率，每千活產）
  - `children_per_woman_total_fertility`（總生育率，婦女平均生育數）
- 下載檔存進專案內 `data-src/` 並連同下載腳本一起進 git（fasttrack datapoints
  CSV 各約 1–2MB，可版控；如實際超過 10MB 改為 .gitignore + 下載腳本重建）。
- `scripts/prepare-data.js` 以 geo+year join 併入，`YearRecord` 新增
  `childMortality: number | null`、`fertility: number | null`（缺值＝null，
  不做推估旗標——fasttrack 無 projection 欄位，一律視為觀測值）。
- 防呆比照現行慣例：join 覆蓋率檢查（2000 年至少 150 國兩指標皆有值）、
  總筆數異常即 `process.exit(1)`，錯誤訊息說明可能原因。

## 2. 通道系統

- 新增 `src/lib/channels.ts` 設定檔，5 個指標各帶：
  key、中文名、單位、刻度型式（log/linear）、domain（跨全年份固定，播放時可比較）、
  數值格式化函式。
  - 所得：log、餘命：linear、人口：log、兒童死亡率：linear、生育率：linear。
  - 既有指標沿用現行固定 domain（Gapminder 慣例刻度）；新指標 domain 由
    ETL 掃全年份 min/max 產出。
- 四個通道：X 軸、Y 軸、大小 從 5 指標選；顏色 ＝「區域」＋ 5 指標。
- 顏色連續模式：青綠 sequential 色階（比照鄉鎮版連續色階慣例，淺→深＝低→高）
  + 圖上色條；「區域」模式維持現行洲別分類色。
- X=Y 防呆：X 與 Y 下拉互相禁用對方已選指標（disabled option，非事後擋）。
- 換通道時 scale/軸/排名卡全部跟著切。

## 3. 選取層（focus reducer）

- 新增 focus 選取 reducer（TDD，獨立於既有勾選清單 selection）：
  - 「選取」「清除」互斥模式鈕（同時只有一個 active，再按一次關閉）。
  - 選取模式：拖曳框選累加；清除模式：拖曳框選累減。
  - 單擊泡泡加入、雙擊泡泡移除（任何模式下皆可）。
  - 選中泡泡描邊；有選取時未選泡泡灰階淡化。
  - 不設「清空」鈕（使用者 7/31 明確要求移除；清除靠「清除」模式框選與雙擊）。
  - 框選拖曳不得觸發瀏覽器原生文字選取（SVG 加 user-select: none，7/31 使用者實測回報）。
  - 選取名單以 geo 集合保存：跨年份、換通道、播放中皆保留。
  - 框選視覺：虛線透明框（比照鄉鎮版 7/30 定版）。
- 勾選清單取消勾選某國時，若該國在 focus 名單內則一併移出（顯示範圍優先）。

## 4. 地球儀雙向連動

- 有 focus 選取時：未選國家點位灰化，選中國家維持原色並放大。
- 點地球儀點位：toggle 該國加入/移除 focus 名單。
- 懸停雙向預覽：泡泡 hover ↔ 地球儀點 hover 互相描邊/放大提示。

## 5. 圖例

- 泡泡圖卡右上：
  - 大小通道嵌套同心圓圖例，標兩個代表值（比照鄉鎮版）。
  - 顏色連續模式時顯示色階色條（含 min/max 標籤）。
  - 顏色＝區域時維持現行洲別點列圖例。

## 6. 狀態式 caption

- 圖下方動態文字（純函式庫 + 測試）：
  - 第一句：目前通道配置說明（每顆泡泡代表一國，越靠右代表「X指標」越高⋯⋯）。
  - 第二句：選取狀態（「已選 N 國：⋯⋯操作提示⋯⋯」／未選時顯示框選教學）。
- 文案結構比照鄉鎮版 scatterCaption。

## 7. 排名卡

- 現有三張 RacingBarChart 卡改為四張通道連動卡：
  X 軸／Y 軸／顏色／大小 目前指標的全球前 5。
- 沿用現有長條動畫（含「從 0 長出」進場、播放時逐年重排）與中文國名。
- 顏色通道＝「區域」時，該卡顯示「顏色通道＝區域，無排名數值」佔位文案。
- 排名對象＝全部國家（不受勾選清單與 focus 選取影響），與鄉鎮版「全國前 5」語意一致。

## 版面

- 維持單螢幕（h-screen）不出頁面捲軸。
- 四通道下拉列放頁首標題「全球發展泡泡圖 + 地球儀」同一行的最右邊（7/31 使用者指定，比照鄉鎮版頁首通道列）；「選取/清除」鈕留在泡泡圖卡上。
- 排名卡由三張變四張：同排四欄，必要時字級/間距微調以維持不溢出。

## 測試與驗證

- TDD：focus reducer、channels 設定/防呆、caption 文案、ETL transform join。
- verify 腳本（Playwright 實跑 dev server）：
  1. 框選累加/累減、單擊加、雙擊減、描邊與灰化。
  2. 地球儀點擊 toggle 與雙向 hover。
  3. 換通道：軸/刻度/色條/排名卡跟著切、X=Y 禁用。
  4. 播放中選取保留。
  5. 單螢幕不出捲軸回歸（1536×781）。
- 全綠門檻：tsc、vitest、build、verify 全過才算完成。

## 不做的事（YAGNI）

- 不做鄉鎮版的下鑽（Gapminder 無層級）。
- 不做死因 optgroup 類的指標分組（5 個指標不需要）。
- 不動左側勾選清單的既有行為。
- 不做新指標的 projection 旗標。
