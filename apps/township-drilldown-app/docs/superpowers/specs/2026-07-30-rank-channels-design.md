# 首頁排名格：北/中/南/東·離島 → X/Y/顏色/大小四通道

## 背景

使用者要求：首頁（全國層）「北中南東離島」四分區排名長條圖，改成對應散布圖上方 X/Y/顏色/大小
四個下拉通道，各自出一個長條圖。

## 範圍

僅全國層（`view.level === "nation"`）。縣/村里下鑽層級維持現狀（單一指標前五名，沿用既有
`indicator`／`deathCause` props）——這是本次需求明確範圍（使用者確認）。

## 設計

**資料層**（`src/lib/data.ts`）：新增 `nationTop(values, meta, ind, year, n=5): RankRow[]`，
全國前 N 名、不分區（`townScopeTop` 拿掉縣市過濾的版本）。

**`RegionRank.tsx`（全國層分支）**：4 個格子改為對應通道，順序＝ X／Y／顏色／大小（同
`ScatterControls` 下拉順序）：
- 標題＝`${角色}（${該通道目前指標名稱}）`，例：`X軸（死亡率）`、`Y軸（平均所得）`、
  `顏色（人口密度）`、`大小（診所醫事人力）`（沿用 Scatter 圖例既有全形括號寫法）。
- 各自 `nationTop(values, meta, dataKey, year, 5)` + 各自 `rankMaxTown(values, meta, dataKey)`
  （四個指標數值範圍互不相關，長條尺度不能共用）。
- 長條顏色維持依每列自己的**區域**上色（`RankList` 不變）——分組軸雖改成指標，區域資訊仍有
  參考價值。
- 顏色通道＝`"region"`（無數值可排名）時，該格保留版位，內容改顯示提示文字
  「顏色通道＝區域，無排名數值」（沿用既有「死亡率無村里資料」的寫法風格，不做排名清單）。

**串接**：`RegionRank` 新增必填 `channels: ScatterChannels` prop。`TasteShell.tsx` 傳入既有
`scatter` state；`directionA/Shell.tsx`（目前未掛載、僅為編譯保留的舊殼）比照傳入其既有
`scatter`，維持型別正確、不改動其邏輯。

## 測試影響

- `src/lib/data.test.ts`：新增 `nationTop` 單元測試。
- `scripts/verify-drilldown.mjs`、`scripts/verify-designs.mjs`：既有「四分區排名格」計數/結構
  斷言（`.rank-box` 數量、每列 DOM 結構）不受影響，僅更新過期的「北/中/南/東·離島」註解／
  PASS 訊息文字。
- `scripts/verify-merged.mjs`：其 `.rank-box` 斷言發生在縣層下鑽情境（`townScopeTop` 分支），
  不受本次變更影響，免動。
- 新增一項全國層斷言：4 格標題依序＝目前 X/Y/顏色/大小 通道名稱；切換 X 下拉後對應格標題
  跟著變。

## 不做（YAGNI）

- 不改動縣/村里下鑽層級的排名格（維持單一指標前五名）。
- 不做「顏色＝區域時格子整個消失、版面動態變 3 欄」——保留版位＋提示文字即可（使用者確認）。
