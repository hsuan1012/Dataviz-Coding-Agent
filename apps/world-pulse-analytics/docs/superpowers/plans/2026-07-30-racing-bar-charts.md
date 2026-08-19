# Racing Bar Chart Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在現有 Gapminder 泡泡圖+地球儀 app 下方新增一個「三欄式動態競賽長條圖」區塊，同時呈現 income/life_expectancy/population 三指標的全球前 5 名，與現有的全局年份時間軸同步連動；並把左側國家清單的顯示名稱改成「中文 (English)」雙語格式。

**Architecture:** 延續既有的「純函式下沉 src/lib + React 元件薄接線」慣例。新增兩個純函式模組（`flagEmoji.ts`、`racingBars.ts`，皆有 Vitest 測試）與一個可重用元件（`RacingBarChart`，三個指標各自帶入不同 metric）。資料層擴充既有的 `prepare-data.js` 腳本，多讀一份實體表 CSV 把 `iso3166_1_alpha2` 併入 `countries.json`。版面重構 `App.tsx`：外層改可捲動，播放/年份滑桿移到主視覺區塊與長條圖區塊之間、橫跨全寬，同時驅動兩者（沿用同一份 `useAppState().currentYear`）。

**Tech Stack:** 沿用現有專案：React 18、TypeScript、Vite、Tailwind CSS v4、Vitest。不新增任何 npm 依賴。

## Global Constraints

- 長條圖排名資料**固定為全球 195 國**，不受左側國家勾選清單（`selectedCountries`）影響——`getTopN` 函式本身不接受任何選取子集合參數。
- 每個指標固定顯示前 5 名，不做可調整名次數量的 UI。
- 國旗 emoji 一律從真實資料算出（`ddf--entities--geo--country.csv` 的 `iso3166_1_alpha2` 欄位），不手刻國家對照表；查無對應時回傳空字串（防禦，不丟例外、不阻斷資料產出）。
- React 元件不寫 jsdom/RTL 測試；`src/lib/*.ts` 的純函式一律要有 Vitest 測試；驗證改用 `npx tsc --noEmit` + `npm run build` + 手動瀏覽器檢查。
- Commit 訊息不加 `Co-Authored-By: Claude` 這行。
- 不新增 npm 依賴；不修改已審查過的 `scripts/transform.js`/`scripts/transform.test.js`（iso2 併入邏輯放在 `prepare-data.js` 的 I/O 膠水層，不動 `transform.js` 的純函式）。
- 中文國名一律用瀏覽器/Node 內建的 `Intl.DisplayNames(["zh-Hant"], { type: "region" })` 即時算出（不手刻 195 國翻譯表），查無對應（`iso2` 為空字串或該地區無法解析）時純顯示英文名稱，不得顯示空字串或 "undefined"。

---

## Task 1: 國旗資料與純函式

**Files:**
- Modify: `scripts/prepare-data.js`
- Modify: `src/data/types.ts`
- Create: `src/lib/flagEmoji.ts`
- Test: `src/lib/flagEmoji.test.ts`

**Interfaces:**
- Consumes: `supervisor/data/global/ddf--entities--geo--country.csv`（新讀取的來源檔，欄位 `country`（=geo，小寫 alpha-3）與 `iso3166_1_alpha2`（大寫 alpha-2，例如 Taiwan 是 `country=twn`、`iso3166_1_alpha2=TW`；部分未受承認地區此欄位可能是空字串，須容錯）
- Produces:
  - `CountryMeta.iso2: string`（`src/data/types.ts`，後續 Task 2/3 都會用到）
  - `alpha2ToFlagEmoji(iso2: string): string`（`src/lib/flagEmoji.ts`，Task 3 會用）
  - 重新產生的 `src/data/countries.json`：每筆多一個 `iso2` 欄位

- [ ] **Step 1: 寫失敗測試 src/lib/flagEmoji.test.ts**

```ts
import { describe, it, expect } from "vitest";
import { alpha2ToFlagEmoji } from "./flagEmoji";

describe("alpha2ToFlagEmoji", () => {
  it("大寫兩碼轉國旗", () => {
    expect(alpha2ToFlagEmoji("TW")).toBe("🇹🇼");
    expect(alpha2ToFlagEmoji("US")).toBe("🇺🇸");
  });

  it("小寫兩碼也能轉（來源資料可能大小寫不一）", () => {
    expect(alpha2ToFlagEmoji("us")).toBe("🇺🇸");
  });

  it("空字串回傳空字串（找不到對應的國家，防禦不丟例外）", () => {
    expect(alpha2ToFlagEmoji("")).toBe("");
  });

  it("長度不對的輸入回傳空字串", () => {
    expect(alpha2ToFlagEmoji("USA")).toBe("");
    expect(alpha2ToFlagEmoji("U")).toBe("");
  });

  it("非英文字母的輸入回傳空字串", () => {
    expect(alpha2ToFlagEmoji("1A")).toBe("");
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/lib/flagEmoji.test.ts`
Expected: FAIL（模組不存在）

- [ ] **Step 3: 寫 src/lib/flagEmoji.ts**

```ts
const REGIONAL_INDICATOR_BASE = 0x1f1e6;

export function alpha2ToFlagEmoji(iso2: string): string {
  if (!/^[A-Za-z]{2}$/.test(iso2)) return "";
  const codePoints = [...iso2.toUpperCase()].map(
    (char) => REGIONAL_INDICATOR_BASE + (char.charCodeAt(0) - 65)
  );
  return String.fromCodePoint(...codePoints);
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/lib/flagEmoji.test.ts`
Expected: PASS

- [ ] **Step 5: 修改 src/data/types.ts，`CountryMeta` 新增 `iso2` 欄位**

```ts
export interface CountryMeta {
  geo: string;
  name: string;
  region: Region;
  latitude: number;
  longitude: number;
  iso2: string;
}
```

- [ ] **Step 6: 修改 scripts/prepare-data.js，讀取實體表 CSV 並把 iso2 併入 countries**

在現有的 `const filtered = filterAllThree(rows);` 之後、`const countries = toCountryList(filtered);` 之前，新增：

```js
const ENTITIES_CSV_PATH = resolve(
  __dirname,
  "..",
  "..",
  "supervisor",
  "data",
  "global",
  "ddf--entities--geo--country.csv"
);
const entitiesText = readFileSync(ENTITIES_CSV_PATH, "utf-8").replace(/^﻿/, "");
const entityRows = csvParse(entitiesText);
const iso2ByGeo = new Map(entityRows.map((row) => [row.country, row.iso3166_1_alpha2 ?? ""]));
```

然後把 `const countries = toCountryList(filtered);` 改成：

```js
const countries = toCountryList(filtered).map((c) => ({
  ...c,
  iso2: iso2ByGeo.get(c.geo) ?? "",
}));
```

（`toCountryList` 本身——`scripts/transform.js`——不需要改動，iso2 併入是 prepare-data.js 這個 I/O 膠水層自己做的後處理。）

- [ ] **Step 7: 重跑資料處理腳本並驗證**

Run: `npm run prepare-data`
Expected: 印出 `countries: 195, records: 19416`（跟之前一致，數量不變）

Run（驗證台灣有正確併入 iso2，用 Node 直接檢查產出的 JSON）：
```bash
node -e "const c = require('./src/data/countries.json'); const twn = c.find(x => x.geo === 'twn'); console.log(JSON.stringify(twn));"
```
Expected: 印出的物件包含 `"iso2":"TW"`

- [ ] **Step 8: Commit**

```bash
git add scripts/prepare-data.js src/data/types.ts src/lib/flagEmoji.ts src/lib/flagEmoji.test.ts src/data/countries.json
git commit -m "Join iso3166_1_alpha2 into countries.json and add flag emoji helper"
```

---

## Task 2: 排名純函式

**Files:**
- Create: `src/lib/racingBars.ts`
- Test: `src/lib/racingBars.test.ts`

**Interfaces:**
- Consumes: `CountryMeta`（含 Task 1 新增的 `iso2`）、`YearRecord`（`src/data/types.ts`）
- Produces:
  - `RacingMetric = "income" | "lifeExpectancy" | "population"`
  - `RankedCountry { geo: string; name: string; iso2: string; region: Region; value: number }`
  - `getTopN(countries: CountryMeta[], records: YearRecord[], year: number, metric: RacingMetric, n: number): RankedCountry[]`
  - `formatRacingValue(metric: RacingMetric, value: number): string`

- [ ] **Step 1: 寫失敗測試 src/lib/racingBars.test.ts**

```ts
import { describe, it, expect } from "vitest";
import { getTopN, formatRacingValue } from "./racingBars";
import type { CountryMeta, YearRecord } from "../data/types";

const countries: CountryMeta[] = [
  { geo: "twn", name: "Taiwan", region: "asia", latitude: 23.7, longitude: 121.0, iso2: "TW" },
  { geo: "jpn", name: "Japan", region: "asia", latitude: 36.2, longitude: 138.3, iso2: "JP" },
  { geo: "deu", name: "Germany", region: "europe", latitude: 51.2, longitude: 10.5, iso2: "DE" },
  { geo: "usa", name: "United States", region: "americas", latitude: 38.0, longitude: -97.0, iso2: "US" },
];

function record(geo: string, year: number, income: number | null): YearRecord {
  return {
    geo,
    year,
    income,
    lifeExpectancy: 80,
    population: 1000,
    incomeIsProjection: false,
    lifeExpectancyIsProjection: false,
    populationIsProjection: false,
  };
}

const records: YearRecord[] = [
  record("twn", 2000, 20000),
  record("jpn", 2000, 35000),
  record("deu", 2000, 30000),
  record("usa", 2000, 40000),
  record("twn", 2001, 21000),
];

describe("getTopN", () => {
  it("依指標值遞減排序，取前 N 名", () => {
    const result = getTopN(countries, records, 2000, "income", 3);
    expect(result.map((r) => r.geo)).toEqual(["usa", "jpn", "deu"]);
  });

  it("n 超過可用國家數時回傳實際筆數，不出錯", () => {
    const result = getTopN(countries, records, 2000, "income", 10);
    expect(result).toHaveLength(4);
  });

  it("null 值的紀錄被排除", () => {
    const recordsWithNull = [...records, record("jpn", 2005, null)];
    const result = getTopN(countries, recordsWithNull, 2005, "income", 5);
    expect(result.find((r) => r.geo === "jpn")).toBeUndefined();
  });

  it("只篩選指定年份", () => {
    const result = getTopN(countries, records, 2001, "income", 5);
    expect(result).toEqual([
      { geo: "twn", name: "Taiwan", iso2: "TW", region: "asia", value: 21000 },
    ]);
  });

  it("回傳結果不受任何『目前勾選』子集合影響——此函式本身沒有選取集合參數，" +
     "全部 195 國（此測試裡是全部 4 國）都納入排名計算", () => {
    const result = getTopN(countries, records, 2000, "income", 1);
    // usa 是全域最高值，即使它「假設」不在某個外部選取清單裡，也一定出現在結果中，
    // 因為 getTopN 根本不接受選取清單這個概念。
    expect(result[0].geo).toBe("usa");
  });
});

describe("formatRacingValue", () => {
  it("income/population 用 k/M/B 縮寫", () => {
    expect(formatRacingValue("income", 500)).toBe("500");
    expect(formatRacingValue("income", 60000)).toBe("60.0k");
    expect(formatRacingValue("population", 1_400_000_000)).toBe("1.4B");
    expect(formatRacingValue("population", 5_000_000)).toBe("5.0M");
  });

  it("lifeExpectancy 顯示到小數點一位", () => {
    expect(formatRacingValue("lifeExpectancy", 84.234)).toBe("84.2");
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/lib/racingBars.test.ts`
Expected: FAIL（模組不存在）

- [ ] **Step 3: 寫 src/lib/racingBars.ts**

```ts
import type { CountryMeta, YearRecord, Region } from "../data/types";

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
): RankedCountry[] {
  const countryByGeo = new Map(countries.map((c) => [c.geo, c]));
  const ranked: RankedCountry[] = [];

  for (const record of records) {
    if (record.year !== year) continue;
    const value = record[metric];
    if (value === null) continue;
    const country = countryByGeo.get(record.geo);
    if (!country) continue;
    ranked.push({
      geo: country.geo,
      name: country.name,
      iso2: country.iso2,
      region: country.region,
      value,
    });
  }

  ranked.sort((a, b) => b.value - a.value);
  return ranked.slice(0, n);
}

export function formatRacingValue(metric: RacingMetric, value: number): string {
  if (metric === "lifeExpectancy") return value.toFixed(1);

  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toFixed(0);
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/lib/racingBars.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/racingBars.ts src/lib/racingBars.test.ts
git commit -m "Add racing bar ranking and value-formatting pure functions"
```

---

## Task 3: RacingBarChart 元件

**Files:**
- Create: `src/components/RacingBarChart.tsx`

**Interfaces:**
- Consumes: `useAppState`（`src/state/AppStateContext.tsx`）、`getTopN`, `formatRacingValue`, `RacingMetric`（`src/lib/racingBars.ts`）、`colorForRegion`（`src/lib/regionColors.ts`）、`alpha2ToFlagEmoji`（`src/lib/flagEmoji.ts`）、`CountryMeta`, `YearRecord`（`src/data/types.ts`）
- Produces: `RacingBarChart({ title, countries, records, metric }: { title: string; countries: CountryMeta[]; records: YearRecord[]; metric: RacingMetric })`

- [ ] **Step 1: 寫 src/components/RacingBarChart.tsx**

```tsx
import { useMemo } from "react";
import { useAppState } from "../state/AppStateContext";
import { getTopN, formatRacingValue, type RacingMetric } from "../lib/racingBars";
import { colorForRegion } from "../lib/regionColors";
import { alpha2ToFlagEmoji } from "../lib/flagEmoji";
import type { CountryMeta, YearRecord } from "../data/types";

const TOP_N = 5;
const ROW_HEIGHT = 40;

export function RacingBarChart({
  title,
  countries,
  records,
  metric,
}: {
  title: string;
  countries: CountryMeta[];
  records: YearRecord[];
  metric: RacingMetric;
}) {
  const { state } = useAppState();

  const ranked = useMemo(
    () => getTopN(countries, records, state.currentYear, metric, TOP_N),
    [countries, records, state.currentYear, metric]
  );

  const maxValue = ranked[0]?.value ?? 1;

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col">
      <h3
        className="font-bold mb-4 border-b pb-2"
        style={{ color: "#374151", borderColor: "var(--color-border)" }}
      >
        {title}
      </h3>
      <div className="h-72 flex-1 relative" style={{ minHeight: TOP_N * ROW_HEIGHT }}>
        {ranked.map((item, index) => (
          <div
            key={item.geo}
            className="absolute left-0 right-0 flex items-center gap-2"
            style={{
              top: 0,
              height: ROW_HEIGHT,
              transform: `translateY(${index * ROW_HEIGHT}px)`,
              transition: "transform 500ms ease",
            }}
          >
            <span className="w-5 text-right text-xs" style={{ color: "var(--color-text-muted)" }}>
              {index + 1}
            </span>
            <span className="text-base leading-none">{alpha2ToFlagEmoji(item.iso2)}</span>
            <span
              className="w-28 truncate text-sm"
              style={{ color: "var(--color-text)" }}
              title={item.name}
            >
              {item.name}
            </span>
            <div className="flex-1 h-4 rounded" style={{ background: "var(--color-border)" }}>
              <div
                className="h-4 rounded"
                style={{
                  width: `${(item.value / maxValue) * 100}%`,
                  background: colorForRegion(item.region),
                  transition: "width 500ms ease",
                }}
              />
            </div>
            <span
              className="w-16 text-right text-xs tabular-nums"
              style={{ color: "var(--color-text-muted)" }}
            >
              {formatRacingValue(metric, item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 型別檢查與 build**

Run: `npm run typecheck`
Expected: 無型別錯誤
Run: `npm run build`
Expected: build 成功

- [ ] **Step 3: Commit**

```bash
git add src/components/RacingBarChart.tsx
git commit -m "Add reusable RacingBarChart component"
```

---

## Task 4: App.tsx 版面重構與接線

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `RacingBarChart`（Task 3）、既有的 `CountryChecklist`、`BubbleChart`、`TimeControls`、`WorldGlobe`、`AppStateProvider`

- [ ] **Step 1: 修改 src/App.tsx**

```tsx
import type { CSSProperties } from "react";
import countriesData from "./data/countries.json";
import gapminderData from "./data/gapminder.json";
import type { CountryMeta, YearRecord } from "./data/types";
import { AppStateProvider } from "./state/AppStateContext";
import { CountryChecklist } from "./components/CountryChecklist";
import { BubbleChart } from "./components/BubbleChart";
import { TimeControls } from "./components/TimeControls";
import { WorldGlobe } from "./components/WorldGlobe";
import { RacingBarChart } from "./components/RacingBarChart";

const countries = countriesData as CountryMeta[];
const records = gapminderData as YearRecord[];

const panelCardStyle: CSSProperties = {
  background: "var(--color-surface)",
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  boxShadow: "0 8px 30px -14px rgba(15, 27, 45, 0.25)",
};

export default function App() {
  return (
    <AppStateProvider countries={countries}>
      <div className="min-h-screen overflow-y-auto" style={{ padding: "20px 24px 48px" }}>
        <div style={{ maxWidth: 1440, margin: "0 auto", width: "100%" }}>
          <p
            style={{
              margin: 0,
              fontSize: 11.5,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--accent)",
              fontWeight: 600,
            }}
          >
            資料視覺化 · 全球指標
          </p>
          <h1
            style={{
              margin: "6px 0 0",
              fontFamily: "var(--font-serif)",
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              lineHeight: 1.15,
              color: "var(--color-text)",
            }}
          >
            全球發展泡泡圖 + 地球儀
          </h1>
          <p
            style={{
              margin: "8px 0 16px",
              fontSize: 13.5,
              color: "var(--color-text-muted)",
              maxWidth: "72ch",
            }}
          >
            平均餘命 · 人均所得 · 人口　—　1950–2050 年，可複選國家並播放時間軸。
          </p>
        </div>

        <div
          className="grid grid-cols-[280px_1fr_1fr] gap-3"
          style={{ maxWidth: 1440, margin: "0 auto", width: "100%", height: 600 }}
        >
          <aside className="min-h-0 overflow-hidden" style={panelCardStyle}>
            <CountryChecklist countries={countries} />
          </aside>
          <main
            className="min-h-0 overflow-hidden flex items-center justify-center"
            style={panelCardStyle}
          >
            <BubbleChart countries={countries} records={records} />
          </main>
          <aside className="min-h-0 overflow-hidden" style={panelCardStyle}>
            <WorldGlobe countries={countries} />
          </aside>
        </div>

        <div
          className="mt-4"
          style={{ maxWidth: 1440, margin: "16px auto 0", width: "100%" }}
        >
          <div style={panelCardStyle}>
            <TimeControls />
          </div>
        </div>

        <div style={{ maxWidth: 1440, margin: "24px auto 0", width: "100%" }}>
          <h2
            className="font-bold mb-2"
            style={{ fontSize: 18, color: "var(--color-text)" }}
          >
            📈 全球指標動態排行 (1950–2050)
          </h2>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 p-4">
            <RacingBarChart
              title="人均所得 (2021 國際元，對數)"
              countries={countries}
              records={records}
              metric="income"
            />
            <RacingBarChart
              title="平均餘命 (歲)"
              countries={countries}
              records={records}
              metric="lifeExpectancy"
            />
            <RacingBarChart
              title="總人口"
              countries={countries}
              records={records}
              metric="population"
            />
          </div>
        </div>
      </div>
    </AppStateProvider>
  );
}
```

- [ ] **Step 2: 型別檢查與 build**

Run: `npm run typecheck`
Expected: 無型別錯誤
Run: `npm run build`
Expected: build 成功

- [ ] **Step 3: 執行完整測試套件確認無回歸**

Run: `npx vitest run`
Expected: 全部通過（Task 1/2 新增的測試 + 既有測試全數綠燈）

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "Restructure layout: scrollable page, global time axis, three-column racing bar section"
```

---

## Task 5: 手動瀏覽器驗證與收尾

**Files:** 無新檔案；此 task 只做驗證。

- [ ] **Step 1: 啟動開發伺服器**

Run: `npm run dev`（背景執行，取得 local URL）

- [ ] **Step 2: 用瀏覽器（Playwright MCP 或人工開瀏覽器）逐項確認以下行為**

- 三張長條圖初始（1950 年）顯示各指標正確的全球前 5 名，每列有國旗、國名、依洲別上色的長條、格式化後數值
- 點擊「播放」：泡泡圖與三個長條圖的年份同步推進；長條圖名次/長度隨年份平滑動畫變化（不是瞬間跳動）
- 拖曳滑桿到不同年份：三個長條圖立即更新到該年排名
- 取消勾選左側清單中目前排在某個長條圖前 5 名的國家：該長條圖排名維持不變（驗證「不受勾選清單影響」這個關鍵行為）
- 整頁可以正常往下捲動看到長條圖區塊，捲動時上方泡泡圖/地球儀區塊不會跑版或被壓扁
- 縮小視窗寬度到 xl 斷點（1280px）以下：三張長條圖卡片自動變直向堆疊
- 檢查瀏覽器 console 有無新增錯誤/警告

- [ ] **Step 3: 執行全部單元測試、型別檢查、build 最終確認**

Run: `npx vitest run`
Run: `npm run typecheck`
Run: `npm run build`
Expected: 三者皆無錯誤

- [ ] **Step 4: 停止開發伺服器，清除任何截圖檔案**

- [ ] **Step 5: Commit（若驗證過程有修正任何小問題）**

```bash
git add -A
git commit -m "Verify racing bar chart feature in browser"
```

（若驗證過程沒有發現需要修正的問題，此 task 不需要額外 commit。）

---

## Task 6: 左側清單改中文國名顯示 + 側欄縮窄

> **修訂（對話中途）**：原本規劃是「中文 (English)」雙語顯示，使用者看過後改口要求**只顯示中文**（不要英文、不要括號）；同時要求左側清單面板寬度縮窄，比照 `township-drilldown-app` 的 `taste-aside` 側欄寬度（`src/designs/taste/Shell.tsx` 裡的 `width: 190`）。本節已更新為最終版本。

**Files:**
- Create: `src/lib/countryDisplayName.ts`
- Test: `src/lib/countryDisplayName.test.ts`
- Modify: `src/components/CountryChecklist.tsx`
- Modify: `src/App.tsx`（左側 `<aside>` 寬度）

**Interfaces:**
- Consumes: `CountryMeta.iso2`（Task 1 新增的欄位）
- Produces: `formatCountryDisplayName(name: string, iso2: string): string`

- [ ] **Step 1: 寫失敗測試 src/lib/countryDisplayName.test.ts**

```ts
import { describe, it, expect } from "vitest";
import { formatCountryDisplayName } from "./countryDisplayName";

describe("formatCountryDisplayName", () => {
  it("有效 iso2 時只回傳中文名稱（不含英文、不含括號）", () => {
    expect(formatCountryDisplayName("Taiwan", "TW")).toBe("台灣");
    expect(formatCountryDisplayName("Japan", "JP")).toBe("日本");
  });

  it("iso2 為空字串時退回英文原名，不顯示空字串或 undefined", () => {
    expect(formatCountryDisplayName("Some Territory", "")).toBe("Some Territory");
  });

  it("iso2 無法被 Intl.DisplayNames 解析時退回英文原名", () => {
    expect(formatCountryDisplayName("Unknown Place", "ZZ")).toBe("Unknown Place");
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/lib/countryDisplayName.test.ts`
Expected: FAIL（模組不存在）

- [ ] **Step 3: 寫 src/lib/countryDisplayName.ts**

```ts
const regionNames = new Intl.DisplayNames(["zh-Hant"], { type: "region" });

export function formatCountryDisplayName(name: string, iso2: string): string {
  if (!iso2) return name;
  let zhName: string | undefined;
  try {
    zhName = regionNames.of(iso2);
  } catch {
    return name;
  }
  // Intl.DisplayNames 對無法辨識的代碼有時會原樣回傳輸入值而非拋錯，
  // 這種情況視同「查無中文名」，一律退回英文原名，確保清單不會出現空白列。
  if (!zhName || zhName === iso2) return name;
  return zhName;
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/lib/countryDisplayName.test.ts`
Expected: PASS

- [ ] **Step 5: 修改 src/components/CountryChecklist.tsx，套用中文顯示**

在檔案頂部新增 import：

```ts
import { formatCountryDisplayName } from "../lib/countryDisplayName";
```

把國家清單那一行的 `{c.name}` 改成：

```tsx
{formatCountryDisplayName(c.name, c.iso2)}
```

（其餘結構不變——checkbox、hover 高亮、勾選狀態、搜尋邏輯都不受影響，`filterBySearch` 比對的是 `CountryMeta.name`（英文原名），不受顯示文字改變影響，使用者仍可用英文搜尋。）

- [ ] **Step 6: 修改 src/App.tsx，縮窄左側清單面板寬度**

把左側 `<aside>` 的 `className="w-1/4 h-full min-h-0 overflow-y-auto"` 改成固定寬度 `190px`（比照 township-drilldown-app taste 側欄），不再用 `w-1/4` 佔中央區的比例寬度：

```tsx
<aside
  className="h-full min-h-0 overflow-y-auto shrink-0"
  style={{ ...panelCardStyle, width: 190 }}
>
  <CountryChecklist countries={countries} />
</aside>
```

（父層 `flex-1 flex flex-row gap-4 min-h-0 mb-4` 不用改，`<aside>` 從彈性比例寬度改成固定寬度＋`shrink-0`，讓出來的空間會自動分給中央區跟地球儀。）

- [ ] **Step 7: 型別檢查、build、完整測試套件**

Run: `npm run typecheck`
Run: `npx vitest run`
Run: `npm run build`
Expected: 三者皆無錯誤

- [ ] **Step 8: 手動瀏覽器驗證**

啟動 `npm run dev`，確認：
- 左側清單國家名稱顯示為純中文（例如「台灣」「日本」），不含英文、不含括號
- 搜尋框仍能用英文原名搜尋到對應國家
- 左側面板寬度明顯變窄（約 190px），讓出的空間讓中央泡泡圖區跟右側地球儀變大

- [ ] **Step 9: Commit**

```bash
git add src/lib/countryDisplayName.ts src/lib/countryDisplayName.test.ts src/components/CountryChecklist.tsx src/App.tsx
git commit -m "Show Chinese-only country names in checklist and narrow the sidebar to match township-drilldown-app"
```

---

## Self-Review Notes

- **Spec coverage**：設計規格書的資料層/純函式/元件/版面重構/測試計畫五段都對應到 Task 1–5；「不在本次範圍」的三項（可調整名次數量、依勾選清單過濾、長條圖回頭觸發 hover）未安排任何 task，符合規格。Task 6（雙語國名）是對話中途追加的需求，不在原始設計規格書內，但範圍小、跟 Task 1 的 `iso2` 資料共用，獨立成一個 task 不影響其他任務。
- **型別一致性**：`RankedCountry`、`RacingMetric`、`CountryMeta.iso2` 的欄位名稱在 Task 1/2/3 之間保持一致；Task 6 的 `formatCountryDisplayName` 只讀 `CountryMeta` 既有欄位，不新增型別。
- **關鍵行為測試**：「不受勾選清單影響」這個最容易被忽略的行為差異，在 Task 2 的測試裡有明確案例，也在 Task 5 的手動驗證清單裡重複列出，雙重把關。
- **防禦一致性**：Task 6 的 `formatCountryDisplayName` 對「查無中文名」的處理（退回英文原名，不顯示空括號/undefined）跟全案既有的防禦慣例（`colorForRegion`、`alpha2ToFlagEmoji`、`groupByRegion` 對未知值一律優雅降級而非丟例外）一致。
