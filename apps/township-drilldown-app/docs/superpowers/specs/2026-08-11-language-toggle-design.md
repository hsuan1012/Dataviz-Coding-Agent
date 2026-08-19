# 中英文語言切換 — 設計文件

日期：2026-08-11
狀態：使用者已核准設計，進入實作

## 背景與目標

比照 `全球發展泡泡圖 + 地球儀`（gapminder-bubble-globe-app）8/4 已上線的語言切換機制，為 `township-drilldown-app` 加上中/英文切換按鈕。目前上線的是 `designs/taste/Shell.tsx`（Bento 版面）；`designs/directionA/Shell.tsx` 為隱藏備用殼，未被使用（`App.tsx` 的 `t.design === "taste" ? TasteShell : DirectionAShell`，且沒有任何入口把 `t.design` 設回非 taste），本次不動它與其專屬元件（`MiniMap`、`DesignSwitch`、`TabBar`、`TitleToggle`）。

## 1. 機制架構

新增：
- `src/lib/i18n.ts` — `Language = "zh" | "en"`、`Dict` 型別、`translations: Record<Language, Dict>`，唯一真相來源。
- `src/state/LanguageContext.tsx` — `LanguageProvider`（純 `useState`，不持久化，reload 回中文，寫法對齊 `useTokens.tsx` 的深色模式 state）+ `useLanguage()` hook，回傳 `{ lang, t, toggle }`。

`LanguageProvider` 包在 `App.tsx` 最外層（`ThemeProvider` 外側或內側皆可，兩者互不依賴）。

## 2. 按鈕

新增 `LanguageToggle` 元件，放在 `designs/taste/Shell.tsx` 左側欄底部（第 61-68 行區塊），**緊貼在深色模式按鈕正上方**。套用同一顆 `.year-like` 膠囊樣式。中文模式顯示「English」、英文模式顯示「中文」（文字＝按下去會變成的語言，跟 gapminder 一致）。

## 3. UI 介面文字翻譯範圍（全翻）

涵蓋 `TasteShell` 全路徑：`App.tsx`、`Shell.tsx`、`YearTabs.tsx`、`MapBreadcrumb.tsx`、`MapLegend.tsx`、`SourceFooter.tsx`、`Choropleth.tsx`（tooltip 部分；`legend` prop 恆為 false 的區塊不用管）、`RegionRank.tsx`、`InfoPanel.tsx`、`Scatter.tsx`（含 `ScatterControls`）、`lib/nav.ts`、`lib/scatterCaption.ts`、`lib/data.ts` 內寫死的 UI 字串。約 90+ 條字串，含動態組字串（`${label}（${unit}）`、排名前五名字尾、已選數量提示、使用說明彈窗四條 bullet 等）需拆成模板片段分開存字典。

指標名稱（5 項）、十大死因名稱（11 項）、區域分類（北/中/南/東/離島，5 項）雖資料驅動，但集合小且固定，用資料既有的英文 `key` 當索引另建小型英文對照表（例：`density`→"Population density"、`death_c06`→"Malignant neoplasms"）。

## 4. 地名羅馬拼音（縣市/鄉鎮/村里）

新增 `src/lib/placeName.ts`，用 `pinyin-pro`（npm 套件，瀏覽器可用、支援地名多音字消歧）做即時轉換 + `Map` cache 記憶化（比照 gapminder `countryDisplayName.ts` 的 `zhNameCache` 寫法）。

規則：
- 不加聲調。
- 去掉中文行政層級字尾後轉拼音，再接英文行政單位字尾：縣→County、市→City、區→District、鎮→Town、鄉→Township、里/村→Village。抓不到已知字尾則整串轉拼音、不加字尾（安全 fallback）。
- 例：板橋區→"Banqiao District"、金門縣→"Kinmen County"、民生里→"Minsheng Village"。

套用在麵包屑、地圖 tooltip、排名卡標題、散布圖 tooltip 等所有顯示地名的地方（英文模式時呼叫）。

## 5. 測試/驗證

- vitest 單元測試：`placeName.ts` 拼音轉換函式跑過已知案例（含金門/連江等特殊縣市、雙字姓地名、抓不到字尾的 fallback）。
- 既有 vitest 套件（現況 vitest 133+）需維持全綠，不因新增翻譯字典破壞既有元件測試對文字的斷言（既有測試若斷言中文字串，需確認語言預設值為 zh 不受影響）。
- Playwright 手動/自動驗證：中英切換不噴錯、深色模式鈕位置/樣式不受語言鈕排擠影響、地名在英文模式全部可讀（無殘留中文字或 undefined）。
- `tsc` 型別檢查、`npm run build` 過。

## 範圍排除

- `designs/directionA/Shell.tsx` 與其專屬元件（未上線，不動）。
- 不持久化語言選擇（reload 回中文，比照 gapminder）。
- 不做完整台灣官方行政區英譯資料庫校對（拼音轉換為自動化最佳近似，非官方羅馬拼音權威來源）。
