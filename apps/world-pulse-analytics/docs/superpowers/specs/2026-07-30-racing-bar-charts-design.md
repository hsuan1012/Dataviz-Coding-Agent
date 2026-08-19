# 三欄式動態競賽長條圖 (Racing Bar Chart) 設計規格

日期：2026-07-30
交辦人：使用者（沿用同一 Gapminder 泡泡圖+地球儀 app 的後續功能）

## 背景與目標

現有 app（gapminder-bubble-globe-app）已完成泡泡圖+地球儀+年份播放的三欄主畫面。
使用者要求在主畫面下方新增一個區塊，用三張並排的「動態競賽長條圖」同時呈現
income（對數）、life_expectancy、population 三個指標的全球前 5 名，並與現有的
全局年份時間軸（播放/滑桿）同步連動。

## 範圍界定

- 資料範圍**固定為全球 195 國**排名，不受左側國家勾選清單影響（跟泡泡圖/地球儀
  的「已選取」概念是兩個獨立維度）。
- 每個指標固定顯示前 5 名（不做可調整名次數量的 UI）。
- 每列加國旗 emoji，資料來源是真實的 `iso3166_1_alpha2`（見下方資料層），不手刻
  對照表。
- 播放/年份滑桿從「只驅動泡泡圖」升級為「全局時間軸」，同時驅動泡泡圖與三個
  長條圖（沿用既有的 `useAppState().currentYear`/`isPlaying`，不需要新的狀態）。
- 不在本次範圍：長條圖的名次數量可調整、依左側勾選清單過濾長條圖、長條圖本身
  可勾選並連動高亮泡泡圖/地球儀（維持單向：時間軸→長條圖，長條圖不回頭觸發
  hover/selection）。

## 資料層

### 補國旗資料

`supervisor/data/global/ddf--entities--geo--country.csv` 有 `iso3166_1_alpha2`
欄位（原本 `countries.json` 只保留了 `iso3166_1_alpha3`，也就是 `geo` 本身）。
擴充 `scripts/prepare-data.js`：多讀這份 CSV，依 `iso3166_1_alpha3`（轉小寫）
比對到既有 195 國，把 `iso3166_1_alpha2` 併入每筆 `CountryMeta`，新增欄位
`iso2: string`（找不到對應時允許為空字串，不阻斷整個資料產出——防禦性寫法，
呼應先前 `groupByRegion` 對未知值的防呆精神）。

`src/data/types.ts` 的 `CountryMeta` 新增 `iso2: string`。

### 國旗 emoji 純函式

`src/lib/flagEmoji.ts`：`alpha2ToFlagEmoji(iso2: string): string`。演算法：
ISO 3166-1 alpha-2 兩個字母各自對應 Unicode Regional Indicator Symbol
（`A` → U+1F1E6，逐字母偏移），兩個 Regional Indicator 字元組合渲染成國旗。
輸入非兩碼英文字母（空字串、長度不對）時回傳空字串（防禦，不丟例外）。

### 排名純函式

`src/lib/racingBars.ts`：

```ts
export type RacingMetric = "income" | "lifeExpectancy" | "population";

export interface RankedCountry {
  geo: string;
  name: string;
  iso2: string;
  region: Region;
  value: number;
}

export function getTopN(
  countries: CountryMeta[],
  records: YearRecord[],
  year: number,
  metric: RacingMetric,
  n: number
): RankedCountry[];
```

行為：篩出 `year` 該年、`metric` 值非 null 的紀錄，依值遞減排序，取前 `n` 筆，
組合對應的國家中繼資料（name/iso2/region）回傳。**不套用 `selectedCountries`
篩選**——這是本功能與泡泡圖/地球儀唯一的行為差異，需要在測試中明確驗證
（給定一個不在 `selectedCountries` 裡的國家，只要它是該年全球前 5 名，仍要
出現在排名結果中）。

## 元件設計

### `RacingBarChart`（可重用元件，三個指標各自傳入一份 props）

```ts
interface RacingBarChartProps {
  title: string;
  countries: CountryMeta[];
  records: YearRecord[];
  metric: RacingMetric;
  formatValue: (value: number) => string;
}
```

- 內部透過 `useAppState()` 拿 `state.currentYear`，呼叫 `getTopN(...,5)`。
- 每列：排名數字、國旗（`alpha2ToFlagEmoji`）、國名、長條（依洲別色票上色，
  沿用 `colorForRegion`）、格式化後數值。
- 長條寬度依「當年前 5 名裡的最大值」動態縮放（每年最大值都填滿滿版寬度，
  是 bar chart race 常見做法，最有「競賽感」）。
- 換年份時，名次可能互換：用 CSS `transform: translateY(...)` + `transition`
  讓每一列平滑移動到新名次位置，長條寬度也用 `transition` 平滑變化，而不是
  瞬間重新排列的生硬切換。
- `formatValue`：income/population 用 k/M/B 縮寫（如 60000→"60.0k"、
  1400000000→"1.4B"）；life_expectancy 直接顯示到小數點一位（如 "84.2"）。

### App.tsx 版面重構

- 外層容器加 `overflow-y-auto`，讓整頁可以往下捲動看到長條圖區塊。
- 播放鍵/年份滑桿（`TimeControls`）從「中欄下方」移到「泡泡圖+地球儀那一列」
  與「三欄長條圖」中間，橫跨全寬（`col-span-full` 概念，在目前的 grid 結構裡
  等效於把 `TimeControls` 移出三欄 grid、放在整個上半部區塊下方獨立一行）。
- 新增區塊標題「📈 全球指標動態排行 (1950–2050)」。
- 三欄長條圖容器：`grid grid-cols-1 xl:grid-cols-3 gap-6 p-4`，小螢幕（xl 以下）
  自動變直向堆疊。
- 每張卡片：`bg-white rounded-xl shadow-sm p-4 flex flex-col`，標題
  `font-bold text-gray-700 mb-4 border-b pb-2`，圖表區 `h-72 flex-1`。

## 測試計畫

- `flagEmoji.test.ts`：已知 alpha-2（如 "TW"→🇹🇼、"us"小寫也要能轉）、非法輸入
  （空字串、長度不對）回傳空字串。
- `racingBars.test.ts`：已知年份/指標排出正確前 N 名與排序；null 值正確排除；
  **關鍵案例**——不在 `selectedCountries`（若傳入）裡的國家仍會出現在結果中
  （驗證「不受勾選清單過濾」這個行為）；`n` 超過可用國家數時不出錯，回傳
  實際筆數。
- `prepare-data.js` 重跑後驗證：`countries.json` 每筆都有 `iso2` 欄位、
  台灣（`geo=twn`）能正確轉出 🇹🇼。
- React 元件（`RacingBarChart`、App.tsx 版面）不寫 jsdom/RTL 測試，比照全案
  既有慣例，改用 `tsc --noEmit` + `npm run build` + 手動瀏覽器驗證。

## 手動瀏覽器驗證項目

- 三張長條圖初始（1950 年）顯示各指標正確的全球前 5 名。
- 點擊「播放」：泡泡圖與三個長條圖的年份同步推進，長條圖名次/長度隨年份平滑
  動畫變化。
- 拖曳滑桿到不同年份：三個長條圖立即更新到該年排名。
- 取消勾選左側清單中目前排在長條圖前 5 名的國家：長條圖排名維持不變（驗證
  「不受勾選清單影響」）。
- 縮小視窗寬度到 xl 斷點以下：三張卡片自動變直向堆疊，長條圖不會被過度擠壓。
