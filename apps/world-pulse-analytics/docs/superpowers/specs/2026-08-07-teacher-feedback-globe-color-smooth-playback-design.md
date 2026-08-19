# 老師 8/7 回饋:地球儀顏色通道 + 播放動畫平滑化 — 設計文件

日期:2026-08-07
範圍:gapminder-bubble-globe-app

## 背景

老師看過「全球發展泡泡圖 + 地球儀」後給了兩點回饋:

1. 地球儀改 choropleth 沒問題,但地圖顏色只能呈現「區域/洲別」,無法呈現
   「顏色」通道裡可選的其他變項(人均所得、平均餘命等)。
2. 動態散布圖隨時間變動時,點的移動要更連續平滑——目前看起來像一張一張
   散布圖輪播,不連續。

根因:

- `WorldGlobe.tsx` 的 `polygonCapColor` 寫死 `capColorFor(d.region, …)`,
  完全沒接 `state.channels.color`;散布圖已有的連續色階機制
  (`makeColorNormalizer` + `rampColor`,channels.ts)沒有接到地球儀。
- 播放是 `AppStateContext` 的 `setInterval` 每 400ms 跳一個整數年,
  散布圖每年直接重繪新位置,零過渡。

## 決策(使用者已確認)

- 動畫採**方案 B:資料內插連續年份**(rAF 驅動小數年份,逐指標線性內插),
  而非 CSS transition 補間。
- 地球儀顏色**跟隨散布圖同一個「顏色」通道選單**,不另設獨立選單。

## 功能 1:地球儀 choropleth 跟隨「顏色」通道

- App 把 `records` 傳給 `WorldGlobe`(目前只傳 `countries`)。
- 上色邏輯抽成 `globePoints.ts` 的純函式(可測):
  - 顏色通道=「區域」→ 維持現行洲別色,行為完全不變。
  - 顏色通道=指標 → 用散布圖同一套青綠色階(深淺模式各自 ramp)按當年值
    塗色;該年缺值國家塗中性「無資料」灰。
  - 既有互動不變:focus 灰化優先、hover/選取描邊、裝飾地形固定灰。
- 顏色走 accessor 重指定(不重建 3D 網格),accessor 依賴加上
  `channels.color` 與當年值 map;播放中顏色吃內插值連續變化。
- 圖例:控制列色條圖例本來就共用,不動。
- 加值:顏色為指標時,hover 標籤多顯示該指標當年值。

## 功能 2:播放動畫連續平滑化(資料內插)

- 播放迴圈改 `requestAnimationFrame`,以每秒 2.5 年(總時長不變=400ms/年)
  連續推進小數年份,到 YEAR_MAX(2050)停止。
  推進邏輯抽純函式 `advancePlayback(year, dtSec, yearsPerSec)`(playback.ts)。
- 新 `src/lib/interpolateRecords.ts`:
  - `buildYearIndex(records)` → `Map<geo, Map<year, YearRecord>>`,
    WeakMap 快取讓多元件共用。
  - `interpolateRecord(index, geo, year)`:整數年回原始紀錄;小數年對前後
    兩年逐指標線性內插;任一側缺值 → 該指標 null(不捏造,泡泡照現行規則
    隱藏);推估值旗標取 floor 年。
- 元件:
  - `BubbleChart`:`yearRecordByGeo` 改吃內插紀錄。
  - 年份浮水印/年份數字/滑桿/年份輸入框:顯示 `Math.floor`,輸入輸出仍整數。
  - `RacingBarChart`:查表年份取 `Math.floor`(平滑化不在本次範圍,
    既有 CSS transition 保留)。
- 效能備案(先不做,實測卡才啟用):dispatch 降 30fps、地球儀顏色每 0.2 年
  更新一次。

## 驗證

- 單元測試:內插(整數年原樣/中點內插/缺值 null/邊界)、advancePlayback
  (推進/到頂停止)、地球儀填色(區域模式不變/指標色階/缺值灰/灰化優先)。
- 既有 vitest 全綠 + tsc + build。
- Playwright:切顏色通道看地球儀變色、播放中兩幀確認泡泡位置落在整數年
  之間(內插生效)、深色模式色階。

## 不做

- Racing bars 平滑化、播放速度調整 UI、地球儀獨立圖例。

## 前置

工作樹上有 8/7 未提交的 anchorT 滾輪縮放錨點修正(含測試):先跑全套測試,
綠了獨立 commit(不加 Claude co-author),再開始本設計的實作。
