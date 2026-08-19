# Gapminder 泡泡圖 + 地球儀 App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建一個仿 Gapminder Tools 的三欄式互動網頁：左邊國家勾選清單、中間泡泡圖（X=life expectancy、Y=income 對數刻度、大小=population）、右邊 globe.gl 3D 地球儀，支援 1950–2050 年份滑桿與播放動畫，三面板 hover 互相連動。

**Architecture:** 純前端 React + TypeScript + Vite 專案（無後端）。所有可測試邏輯（資料轉換、色階、播放推進、勾選、地球儀點位計算、狀態機）寫成 `src/lib/` 下的純函式並用 Vitest 單元測試；React 元件只做「呼叫這些函式 + 畫面呈現」的薄接線層，比照 sibling 專案 township-drilldown-app 已驗證過的「內容與樣式分離」慣例。資料在 scaffold 階段用一支 node 腳本從 CSV 預先處理成靜態 JSON，執行期不再解析 CSV。

**Tech Stack:** React 18、TypeScript、Vite、Tailwind CSS v4、D3（含 d3-scale／d3-dsv）、globe.gl、Vitest、Playwright（供之後手動瀏覽器驗證用，不寫成 commit 進 repo 的自動化 spec）。

## Global Constraints

- 純前端、無後端無資料庫；資料在建置期（非執行期）處理成靜態 JSON。
- 資料來源：`supervisor/data/global/gapminder_core3.csv`，篩選 `all_three == "1"`（1950–2050 年、195 國、19,416 列）。
- 不對缺值做內插或補值——序列內部本來沒有破洞，缺的是兩端之外的年份，如實呈現即可。
- 不可用 `un_state` 篩選（會誤刪台灣 `geo = twn`）。
- X 軸 = life_expectancy（線性刻度），Y 軸 = income（**對數刻度**），泡泡大小 = population（開方刻度）。
- 顏色依 `world_4region`（asia / europe / africa / americas）四色分類，泡泡圖與地球儀顏色一致。
- 測試慣例：可測邏輯一律抽成 `src/lib/*.ts` 純函式並寫 Vitest 單元測試；React 元件不寫 jsdom/RTL 掛載測試，改用 `npx tsc --noEmit` 型別檢查 + 手動瀏覽器驗證（比照 township-drilldown-app 既有慣例，該專案的 `src/lib/*.test.ts` 就是這個模式）。
- Commit 訊息不加 `Co-Authored-By: Claude` 這行。
- 新專案資料夾：`gapminder-bubble-globe-app/`，與 `supervisor/`、`township-drilldown-app/` 同層（`jayla/` 下）。

---

## Task 1: 專案 Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/index.css`
- Create: `.gitignore`

**Interfaces:**
- Produces: 可執行的 `npm run dev` / `npm run build` / `npm run test` 環境，之後所有 task 都在這個專案內新增檔案。

- [ ] **Step 1: 寫 package.json**

```json
{
  "name": "gapminder-bubble-globe-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "prepare-data": "node scripts/prepare-data.js"
  },
  "dependencies": {
    "d3": "^7.9.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@types/d3": "^7.4.3",
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "playwright": "^1.61.1",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: 寫 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: 寫 vite.config.ts**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

- [ ] **Step 4: 寫 index.html**

```html
<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Gapminder 泡泡圖 + 地球儀</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: 寫 src/index.css**

```css
@import "tailwindcss";
```

- [ ] **Step 6: 寫 src/main.tsx**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 7: 寫 src/App.tsx（暫時佔位，後續 task 會逐步替換）**

```tsx
export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center text-slate-600">
      <p>Gapminder 泡泡圖 + 地球儀 — scaffold OK</p>
    </div>
  );
}
```

- [ ] **Step 8: 寫 .gitignore**

```
node_modules
dist
```

- [ ] **Step 9: 安裝依賴並驗證 build**

Run: `npm install`
Run: `npm run build`
Expected: build 成功，`dist/` 產生輸出，無錯誤。

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src .gitignore
git commit -m "Scaffold Vite + React + TypeScript + Tailwind v4 project"
```

---

## Task 2: 資料處理管線

**Files:**
- Create: `scripts/transform.js`
- Test: `scripts/transform.test.js`
- Create: `scripts/prepare-data.js`
- Create: `src/data/types.ts`
- Generate (by running the script, not hand-written): `src/data/countries.json`, `src/data/gapminder.json`

**Interfaces:**
- Consumes: `supervisor/data/global/gapminder_core3.csv`（老師提供的原始資料，路徑相對於本專案是 `../supervisor/data/global/gapminder_core3.csv`）
- Produces:
  - `filterAllThree(rows: object[]): object[]`
  - `toCountryList(rows: object[]): { geo: string; name: string; region: string; latitude: number; longitude: number }[]`
  - `toYearRecords(rows: object[]): { geo: string; year: number; income: number|null; lifeExpectancy: number|null; population: number|null; incomeIsProjection: boolean; lifeExpectancyIsProjection: boolean; populationIsProjection: boolean }[]`
  - TypeScript 型別 `Region`、`CountryMeta`、`YearRecord`（`src/data/types.ts`），後續所有 task 都 import 這些型別。
  - `src/data/countries.json`（195 筆）、`src/data/gapminder.json`（19,416 筆），後續 task 直接 import 使用。

- [ ] **Step 1: 寫失敗測試 scripts/transform.test.js**

```js
import { describe, it, expect } from "vitest";
import { filterAllThree, toCountryList, toYearRecords } from "./transform.js";

const rawRows = [
  {
    geo: "twn", name: "Taiwan", year: "2000", income: "20000", life_expectancy: "77.5",
    population: "22000000", world_4region: "asia", latitude: "23.7", longitude: "121.0",
    income_is_projection: "0", life_expectancy_is_projection: "0", population_is_projection: "0",
    all_three: "1",
  },
  {
    geo: "twn", name: "Taiwan", year: "2030", income: "30000", life_expectancy: "82.1",
    population: "23000000", world_4region: "asia", latitude: "23.7", longitude: "121.0",
    income_is_projection: "1", life_expectancy_is_projection: "1", population_is_projection: "1",
    all_three: "1",
  },
  {
    geo: "abw", name: "Aruba", year: "1960", income: "", life_expectancy: "",
    population: "45000", world_4region: "americas", latitude: "12.5", longitude: "-69.97",
    income_is_projection: "", life_expectancy_is_projection: "", population_is_projection: "0",
    all_three: "0",
  },
];

describe("filterAllThree", () => {
  it("只保留 all_three 為 1 的列", () => {
    const result = filterAllThree(rawRows);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.all_three === "1")).toBe(true);
  });
});

describe("toCountryList", () => {
  it("依 geo 去重、經緯度轉數字、依國名排序", () => {
    const result = toCountryList(filterAllThree(rawRows));
    expect(result).toEqual([
      { geo: "twn", name: "Taiwan", region: "asia", latitude: 23.7, longitude: 121.0 },
    ]);
  });
});

describe("toYearRecords", () => {
  it("轉換數值型態並標記推估值", () => {
    const result = toYearRecords(filterAllThree(rawRows));
    expect(result).toEqual([
      {
        geo: "twn", year: 2000, income: 20000, lifeExpectancy: 77.5, population: 22000000,
        incomeIsProjection: false, lifeExpectancyIsProjection: false, populationIsProjection: false,
      },
      {
        geo: "twn", year: 2030, income: 30000, lifeExpectancy: 82.1, population: 23000000,
        incomeIsProjection: true, lifeExpectancyIsProjection: true, populationIsProjection: true,
      },
    ]);
  });

  it("空字串轉為 null（結構性缺值，不可硬轉成 0）", () => {
    const result = toYearRecords(rawRows);
    const aruba = result.find((r) => r.geo === "abw");
    expect(aruba.income).toBeNull();
    expect(aruba.lifeExpectancy).toBeNull();
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run scripts/transform.test.js`
Expected: FAIL（`transform.js` 尚未存在 / 函式未定義）

- [ ] **Step 3: 寫 scripts/transform.js**

```js
export function filterAllThree(rows) {
  return rows.filter((row) => row.all_three === "1");
}

export function toCountryList(rows) {
  const byGeo = new Map();
  for (const row of rows) {
    if (!byGeo.has(row.geo)) {
      byGeo.set(row.geo, {
        geo: row.geo,
        name: row.name,
        region: row.world_4region,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
      });
    }
  }
  return Array.from(byGeo.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function toYearRecords(rows) {
  return rows.map((row) => ({
    geo: row.geo,
    year: Number(row.year),
    income: row.income === "" ? null : Number(row.income),
    lifeExpectancy: row.life_expectancy === "" ? null : Number(row.life_expectancy),
    population: row.population === "" ? null : Number(row.population),
    incomeIsProjection: row.income_is_projection === "1",
    lifeExpectancyIsProjection: row.life_expectancy_is_projection === "1",
    populationIsProjection: row.population_is_projection === "1",
  }));
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run scripts/transform.test.js`
Expected: PASS（全部案例綠燈）

- [ ] **Step 5: 寫 src/data/types.ts**

```ts
export type Region = "asia" | "europe" | "africa" | "americas";

export interface CountryMeta {
  geo: string;
  name: string;
  region: Region;
  latitude: number;
  longitude: number;
}

export interface YearRecord {
  geo: string;
  year: number;
  income: number | null;
  lifeExpectancy: number | null;
  population: number | null;
  incomeIsProjection: boolean;
  lifeExpectancyIsProjection: boolean;
  populationIsProjection: boolean;
}
```

- [ ] **Step 6: 寫 scripts/prepare-data.js（I/O 膠水層，讀真實 CSV 並輸出 JSON）**

```js
import { csvParse } from "d3";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { filterAllThree, toCountryList, toYearRecords } from "./transform.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = resolve(__dirname, "..", "..", "supervisor", "data", "global", "gapminder_core3.csv");
const OUT_DIR = resolve(__dirname, "..", "src", "data");

const csvText = readFileSync(CSV_PATH, "utf-8");
const rows = csvParse(csvText);
const filtered = filterAllThree(rows);

const countries = toCountryList(filtered);
const records = toYearRecords(filtered);

writeFileSync(resolve(OUT_DIR, "countries.json"), JSON.stringify(countries, null, 2));
writeFileSync(resolve(OUT_DIR, "gapminder.json"), JSON.stringify(records));

console.log(`countries: ${countries.length}, records: ${records.length}`);
```

- [ ] **Step 7: 執行資料處理腳本**

Run: `npm run prepare-data`
Expected: 印出 `countries: 195, records: 19416`（對照 `gapminder_core3_缺失值說明.md` 記載的 195 國、19,416 列），並在 `src/data/` 產生 `countries.json`、`gapminder.json` 兩個檔案。

- [ ] **Step 8: Commit**

```bash
git add scripts/transform.js scripts/transform.test.js scripts/prepare-data.js src/data/types.ts src/data/countries.json src/data/gapminder.json
git commit -m "Add data pipeline: filter all_three rows into static JSON"
```

---

## Task 3: 顏色與座標刻度純函式

**Files:**
- Create: `src/lib/regionColors.ts`
- Test: `src/lib/regionColors.test.ts`
- Create: `src/lib/scales.ts`
- Test: `src/lib/scales.test.ts`

**Interfaces:**
- Consumes: `Region`（`src/data/types.ts`，Task 2 產出）
- Produces:
  - `REGION_COLORS: Record<Region, string>`、`colorForRegion(region: Region): string`
  - `LIFE_EXPECTANCY_DOMAIN`、`INCOME_DOMAIN`、`POPULATION_DOMAIN`
  - `createLifeExpectancyScale(range: [number, number])`、`createIncomeScale(range: [number, number])`、`createPopulationRadiusScale(range: [number, number])`（皆回傳 d3 scale function）

- [ ] **Step 1: 寫失敗測試 src/lib/regionColors.test.ts**

```ts
import { describe, it, expect } from "vitest";
import { colorForRegion, REGION_COLORS } from "./regionColors";

describe("colorForRegion", () => {
  it("每個洲別對應到固定顏色", () => {
    expect(colorForRegion("asia")).toBe(REGION_COLORS.asia);
    expect(colorForRegion("europe")).toBe(REGION_COLORS.europe);
    expect(colorForRegion("africa")).toBe(REGION_COLORS.africa);
    expect(colorForRegion("americas")).toBe(REGION_COLORS.americas);
  });

  it("未知洲別退回灰色，避免地球儀/泡泡圖因髒資料而整片崩潰", () => {
    // @ts-expect-error 刻意傳入非法值測防禦分支
    expect(colorForRegion("unknown")).toBe("#9aa0a6");
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/lib/regionColors.test.ts`
Expected: FAIL（模組不存在）

- [ ] **Step 3: 寫 src/lib/regionColors.ts**

```ts
import type { Region } from "../data/types";

export const REGION_COLORS: Record<Region, string> = {
  asia: "#d08c60",
  europe: "#5b7fa6",
  africa: "#6fa287",
  americas: "#c98a9e",
};

export function colorForRegion(region: Region): string {
  return REGION_COLORS[region] ?? "#9aa0a6";
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/lib/regionColors.test.ts`
Expected: PASS

- [ ] **Step 5: 寫失敗測試 src/lib/scales.test.ts**

```ts
import { describe, it, expect } from "vitest";
import {
  createLifeExpectancyScale,
  createIncomeScale,
  createPopulationRadiusScale,
} from "./scales";

describe("createLifeExpectancyScale", () => {
  it("線性刻度，定義域邊界對應到值域邊界", () => {
    const scale = createLifeExpectancyScale([0, 600]);
    expect(scale(20)).toBeCloseTo(0);
    expect(scale(90)).toBeCloseTo(600);
  });
});

describe("createIncomeScale", () => {
  it("對數刻度，幾何平均數落在值域中點", () => {
    const scale = createIncomeScale([0, 100]);
    expect(scale(300)).toBeCloseTo(0, 5);
    expect(scale(200000)).toBeCloseTo(100, 5);
    expect(scale(Math.sqrt(300 * 200000))).toBeCloseTo(50, 5);
  });
});

describe("createPopulationRadiusScale", () => {
  it("開方刻度，值域邊界對應正確", () => {
    const scale = createPopulationRadiusScale([4, 40]);
    expect(scale(10000)).toBeCloseTo(4);
    expect(scale(1_500_000_000)).toBeCloseTo(40);
  });
});
```

- [ ] **Step 6: 執行測試確認失敗**

Run: `npx vitest run src/lib/scales.test.ts`
Expected: FAIL（模組不存在）

- [ ] **Step 7: 寫 src/lib/scales.ts**

```ts
import { scaleLinear, scaleLog, scaleSqrt } from "d3";

export const LIFE_EXPECTANCY_DOMAIN: [number, number] = [20, 90];
export const INCOME_DOMAIN: [number, number] = [300, 200000];
export const POPULATION_DOMAIN: [number, number] = [10000, 1_500_000_000];

export function createLifeExpectancyScale(range: [number, number]) {
  return scaleLinear().domain(LIFE_EXPECTANCY_DOMAIN).range(range);
}

export function createIncomeScale(range: [number, number]) {
  return scaleLog().domain(INCOME_DOMAIN).range(range);
}

export function createPopulationRadiusScale(range: [number, number]) {
  return scaleSqrt().domain(POPULATION_DOMAIN).range(range);
}
```

- [ ] **Step 8: 執行測試確認通過**

Run: `npx vitest run src/lib/scales.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/lib/regionColors.ts src/lib/regionColors.test.ts src/lib/scales.ts src/lib/scales.test.ts
git commit -m "Add region color mapping and D3 scale factories"
```

---

## Task 4: 年份播放純函式

**Files:**
- Create: `src/lib/playback.ts`
- Test: `src/lib/playback.test.ts`

**Interfaces:**
- Produces: `YEAR_MIN = 1950`、`YEAR_MAX = 2050`、`nextYear(current: number): number | null`、`playStartYear(current: number): number`

- [ ] **Step 1: 寫失敗測試 src/lib/playback.test.ts**

```ts
import { describe, it, expect } from "vitest";
import { nextYear, playStartYear, YEAR_MIN, YEAR_MAX } from "./playback";

describe("nextYear", () => {
  it("中段年份前進一年", () => expect(nextYear(2000)).toBe(2001));
  it("末年回 null（該停）", () => expect(nextYear(YEAR_MAX)).toBeNull());
  it("超過末年也回 null（防禦）", () => expect(nextYear(YEAR_MAX + 5)).toBeNull());
});

describe("playStartYear", () => {
  it("末年按播放→從頭年重播", () => expect(playStartYear(YEAR_MAX)).toBe(YEAR_MIN));
  it("中段按播放→原年起播", () => expect(playStartYear(2000)).toBe(2000));
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/lib/playback.test.ts`
Expected: FAIL（模組不存在）

- [ ] **Step 3: 寫 src/lib/playback.ts**

```ts
export const YEAR_MIN = 1950;
export const YEAR_MAX = 2050;

export function nextYear(current: number): number | null {
  if (current >= YEAR_MAX) return null;
  return current + 1;
}

export function playStartYear(current: number): number {
  if (current >= YEAR_MAX) return YEAR_MIN;
  return current;
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/lib/playback.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/playback.ts src/lib/playback.test.ts
git commit -m "Add year playback pure functions"
```

---

## Task 5: 國家勾選純函式

**Files:**
- Create: `src/lib/selection.ts`
- Test: `src/lib/selection.test.ts`

**Interfaces:**
- Consumes: `CountryMeta`, `Region`（`src/data/types.ts`）
- Produces:
  - `toggleCountry(selected: Set<string>, geo: string): Set<string>`
  - `setRegionSelection(selected: Set<string>, countries: CountryMeta[], region: Region, isSelected: boolean): Set<string>`
  - `groupByRegion(countries: CountryMeta[]): Record<Region, CountryMeta[]>`
  - `filterBySearch(countries: CountryMeta[], query: string): CountryMeta[]`

- [ ] **Step 1: 寫失敗測試 src/lib/selection.test.ts**

```ts
import { describe, it, expect } from "vitest";
import { toggleCountry, setRegionSelection, groupByRegion, filterBySearch } from "./selection";
import type { CountryMeta } from "../data/types";

const countries: CountryMeta[] = [
  { geo: "twn", name: "Taiwan", region: "asia", latitude: 23.7, longitude: 121.0 },
  { geo: "jpn", name: "Japan", region: "asia", latitude: 36.2, longitude: 138.3 },
  { geo: "deu", name: "Germany", region: "europe", latitude: 51.2, longitude: 10.5 },
];

describe("toggleCountry", () => {
  it("已勾選則取消", () => {
    const result = toggleCountry(new Set(["twn"]), "twn");
    expect(result.has("twn")).toBe(false);
  });
  it("未勾選則加入", () => {
    const result = toggleCountry(new Set(), "twn");
    expect(result.has("twn")).toBe(true);
  });
  it("不改動原本傳入的 Set（不可變）", () => {
    const original = new Set(["twn"]);
    toggleCountry(original, "twn");
    expect(original.has("twn")).toBe(true);
  });
});

describe("setRegionSelection", () => {
  it("整組勾選只影響該洲的國家", () => {
    const result = setRegionSelection(new Set(), countries, "asia", true);
    expect(result.has("twn")).toBe(true);
    expect(result.has("jpn")).toBe(true);
    expect(result.has("deu")).toBe(false);
  });
  it("整組取消只移除該洲的國家", () => {
    const all = new Set(["twn", "jpn", "deu"]);
    const result = setRegionSelection(all, countries, "asia", false);
    expect(result.has("twn")).toBe(false);
    expect(result.has("jpn")).toBe(false);
    expect(result.has("deu")).toBe(true);
  });
});

describe("groupByRegion", () => {
  it("依 world_4region 分成四組", () => {
    const groups = groupByRegion(countries);
    expect(groups.asia).toHaveLength(2);
    expect(groups.europe).toHaveLength(1);
    expect(groups.africa).toHaveLength(0);
    expect(groups.americas).toHaveLength(0);
  });
});

describe("filterBySearch", () => {
  it("依國名（不分大小寫）篩選", () => {
    expect(filterBySearch(countries, "jap")).toEqual([countries[1]]);
    expect(filterBySearch(countries, "GERMANY")).toEqual([countries[2]]);
  });
  it("空字串回傳全部", () => {
    expect(filterBySearch(countries, "")).toEqual(countries);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/lib/selection.test.ts`
Expected: FAIL（模組不存在）

- [ ] **Step 3: 寫 src/lib/selection.ts**

```ts
import type { CountryMeta, Region } from "../data/types";

export function toggleCountry(selected: Set<string>, geo: string): Set<string> {
  const next = new Set(selected);
  if (next.has(geo)) next.delete(geo);
  else next.add(geo);
  return next;
}

export function setRegionSelection(
  selected: Set<string>,
  countries: CountryMeta[],
  region: Region,
  isSelected: boolean
): Set<string> {
  const next = new Set(selected);
  for (const country of countries) {
    if (country.region !== region) continue;
    if (isSelected) next.add(country.geo);
    else next.delete(country.geo);
  }
  return next;
}

export function groupByRegion(countries: CountryMeta[]): Record<Region, CountryMeta[]> {
  const groups: Record<Region, CountryMeta[]> = {
    asia: [],
    europe: [],
    africa: [],
    americas: [],
  };
  for (const country of countries) {
    groups[country.region].push(country);
  }
  return groups;
}

export function filterBySearch(countries: CountryMeta[], query: string): CountryMeta[] {
  const q = query.trim().toLowerCase();
  if (!q) return countries;
  return countries.filter((c) => c.name.toLowerCase().includes(q));
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/lib/selection.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/selection.ts src/lib/selection.test.ts
git commit -m "Add country selection pure functions"
```

---

## Task 6: 地球儀點位純函式

**Files:**
- Create: `src/lib/globePoints.ts`
- Test: `src/lib/globePoints.test.ts`

**Interfaces:**
- Consumes: `CountryMeta`（`src/data/types.ts`）、`colorForRegion`（`src/lib/regionColors.ts`）
- Produces: `GlobePoint { geo, name, lat, lng, color, radius }`、`buildGlobePoints(countries: CountryMeta[], selected: Set<string>, hovered: string | null): GlobePoint[]`

- [ ] **Step 1: 寫失敗測試 src/lib/globePoints.test.ts**

```ts
import { describe, it, expect } from "vitest";
import { buildGlobePoints } from "./globePoints";
import { colorForRegion } from "./regionColors";
import type { CountryMeta } from "../data/types";

const countries: CountryMeta[] = [
  { geo: "twn", name: "Taiwan", region: "asia", latitude: 23.7, longitude: 121.0 },
  { geo: "jpn", name: "Japan", region: "asia", latitude: 36.2, longitude: 138.3 },
];

describe("buildGlobePoints", () => {
  it("只回傳有勾選的國家", () => {
    const points = buildGlobePoints(countries, new Set(["twn"]), null);
    expect(points).toHaveLength(1);
    expect(points[0].geo).toBe("twn");
  });

  it("顏色依洲別，座標對應 latitude/longitude → lat/lng", () => {
    const points = buildGlobePoints(countries, new Set(["twn"]), null);
    expect(points[0].color).toBe(colorForRegion("asia"));
    expect(points[0].lat).toBe(23.7);
    expect(points[0].lng).toBe(121.0);
  });

  it("hover 中的國家半徑較大", () => {
    const points = buildGlobePoints(countries, new Set(["twn", "jpn"]), "jpn");
    const twn = points.find((p) => p.geo === "twn")!;
    const jpn = points.find((p) => p.geo === "jpn")!;
    expect(jpn.radius).toBeGreaterThan(twn.radius);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/lib/globePoints.test.ts`
Expected: FAIL（模組不存在）

- [ ] **Step 3: 寫 src/lib/globePoints.ts**

```ts
import type { CountryMeta } from "../data/types";
import { colorForRegion } from "./regionColors";

export interface GlobePoint {
  geo: string;
  name: string;
  lat: number;
  lng: number;
  color: string;
  radius: number;
}

export function buildGlobePoints(
  countries: CountryMeta[],
  selected: Set<string>,
  hovered: string | null
): GlobePoint[] {
  return countries
    .filter((c) => selected.has(c.geo))
    .map((c) => ({
      geo: c.geo,
      name: c.name,
      lat: c.latitude,
      lng: c.longitude,
      color: colorForRegion(c.region),
      radius: c.geo === hovered ? 0.6 : 0.35,
    }));
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/lib/globePoints.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/globePoints.ts src/lib/globePoints.test.ts
git commit -m "Add globe.gl point-building pure function"
```

---

## Task 7: App 狀態 Reducer

**Files:**
- Create: `src/state/appState.ts`
- Test: `src/state/appState.test.ts`

**Interfaces:**
- Consumes: `CountryMeta`, `Region`（`src/data/types.ts`）、`toggleCountry`, `setRegionSelection`（`src/lib/selection.ts`）、`YEAR_MIN`（`src/lib/playback.ts`）
- Produces:
  - `AppState { selectedCountries: Set<string>; hoveredCountry: string | null; currentYear: number; isPlaying: boolean }`
  - `AppAction`（`TOGGLE_COUNTRY` | `SET_REGION` | `SELECT_ALL` | `DESELECT_ALL` | `SET_HOVERED` | `SET_YEAR` | `TOGGLE_PLAYING` | `STOP_PLAYING`）
  - `createInitialState(countries: CountryMeta[]): AppState`
  - `appStateReducer(state: AppState, action: AppAction): AppState`

- [ ] **Step 1: 寫失敗測試 src/state/appState.test.ts**

```ts
import { describe, it, expect } from "vitest";
import { createInitialState, appStateReducer } from "./appState";
import type { CountryMeta } from "../data/types";
import { YEAR_MIN } from "../lib/playback";

const countries: CountryMeta[] = [
  { geo: "twn", name: "Taiwan", region: "asia", latitude: 23.7, longitude: 121.0 },
  { geo: "deu", name: "Germany", region: "europe", latitude: 51.2, longitude: 10.5 },
];

describe("createInitialState", () => {
  it("預設全選、年份為 YEAR_MIN、未播放、無 hover", () => {
    const state = createInitialState(countries);
    expect(state.selectedCountries).toEqual(new Set(["twn", "deu"]));
    expect(state.currentYear).toBe(YEAR_MIN);
    expect(state.isPlaying).toBe(false);
    expect(state.hoveredCountry).toBeNull();
  });
});

describe("appStateReducer", () => {
  const initial = createInitialState(countries);

  it("TOGGLE_COUNTRY 切換單一國家", () => {
    const next = appStateReducer(initial, { type: "TOGGLE_COUNTRY", geo: "twn" });
    expect(next.selectedCountries.has("twn")).toBe(false);
  });

  it("SET_REGION 整組切換", () => {
    const next = appStateReducer(initial, {
      type: "SET_REGION", region: "asia", countries, selected: false,
    });
    expect(next.selectedCountries.has("twn")).toBe(false);
    expect(next.selectedCountries.has("deu")).toBe(true);
  });

  it("DESELECT_ALL 清空選取", () => {
    const next = appStateReducer(initial, { type: "DESELECT_ALL" });
    expect(next.selectedCountries.size).toBe(0);
  });

  it("SELECT_ALL 全選", () => {
    const empty = appStateReducer(initial, { type: "DESELECT_ALL" });
    const next = appStateReducer(empty, { type: "SELECT_ALL", countries });
    expect(next.selectedCountries).toEqual(new Set(["twn", "deu"]));
  });

  it("SET_HOVERED 設定 hover 國家", () => {
    const next = appStateReducer(initial, { type: "SET_HOVERED", geo: "twn" });
    expect(next.hoveredCountry).toBe("twn");
  });

  it("SET_YEAR 設定年份", () => {
    const next = appStateReducer(initial, { type: "SET_YEAR", year: 2000 });
    expect(next.currentYear).toBe(2000);
  });

  it("TOGGLE_PLAYING 切換播放狀態", () => {
    const next = appStateReducer(initial, { type: "TOGGLE_PLAYING" });
    expect(next.isPlaying).toBe(true);
    const next2 = appStateReducer(next, { type: "TOGGLE_PLAYING" });
    expect(next2.isPlaying).toBe(false);
  });

  it("STOP_PLAYING 強制停止播放", () => {
    const playing = appStateReducer(initial, { type: "TOGGLE_PLAYING" });
    const stopped = appStateReducer(playing, { type: "STOP_PLAYING" });
    expect(stopped.isPlaying).toBe(false);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/state/appState.test.ts`
Expected: FAIL（模組不存在）

- [ ] **Step 3: 寫 src/state/appState.ts**

```ts
import type { CountryMeta, Region } from "../data/types";
import { toggleCountry, setRegionSelection } from "../lib/selection";
import { YEAR_MIN } from "../lib/playback";

export interface AppState {
  selectedCountries: Set<string>;
  hoveredCountry: string | null;
  currentYear: number;
  isPlaying: boolean;
}

export type AppAction =
  | { type: "TOGGLE_COUNTRY"; geo: string }
  | { type: "SET_REGION"; region: Region; countries: CountryMeta[]; selected: boolean }
  | { type: "SELECT_ALL"; countries: CountryMeta[] }
  | { type: "DESELECT_ALL" }
  | { type: "SET_HOVERED"; geo: string | null }
  | { type: "SET_YEAR"; year: number }
  | { type: "TOGGLE_PLAYING" }
  | { type: "STOP_PLAYING" };

export function createInitialState(countries: CountryMeta[]): AppState {
  return {
    selectedCountries: new Set(countries.map((c) => c.geo)),
    hoveredCountry: null,
    currentYear: YEAR_MIN,
    isPlaying: false,
  };
}

export function appStateReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "TOGGLE_COUNTRY":
      return { ...state, selectedCountries: toggleCountry(state.selectedCountries, action.geo) };
    case "SET_REGION":
      return {
        ...state,
        selectedCountries: setRegionSelection(
          state.selectedCountries,
          action.countries,
          action.region,
          action.selected
        ),
      };
    case "SELECT_ALL":
      return { ...state, selectedCountries: new Set(action.countries.map((c) => c.geo)) };
    case "DESELECT_ALL":
      return { ...state, selectedCountries: new Set() };
    case "SET_HOVERED":
      return { ...state, hoveredCountry: action.geo };
    case "SET_YEAR":
      return { ...state, currentYear: action.year };
    case "TOGGLE_PLAYING":
      return { ...state, isPlaying: !state.isPlaying };
    case "STOP_PLAYING":
      return { ...state, isPlaying: false };
    default:
      return state;
  }
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/state/appState.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/state/appState.ts src/state/appState.test.ts
git commit -m "Add app state reducer combining selection and playback logic"
```

---

## Task 8: React Context 接線（狀態 + 播放計時器）

**Files:**
- Create: `src/state/AppStateContext.tsx`
- Modify: `src/App.tsx`（載入 JSON 資料、包上 Provider，暫時保留佔位文字）

**Interfaces:**
- Consumes: `appStateReducer`, `createInitialState`, `AppState`, `AppAction`（`src/state/appState.ts`）、`nextYear`（`src/lib/playback.ts`）、`CountryMeta`, `YearRecord`（`src/data/types.ts`）
- Produces: `AppStateProvider({ countries, children })`、`useAppState(): { state: AppState; dispatch: React.Dispatch<AppAction> }`（供 Task 9–11 的所有元件使用）

- [ ] **Step 1: 寫 src/state/AppStateContext.tsx**

```tsx
import { createContext, useContext, useEffect, useReducer, type ReactNode } from "react";
import { appStateReducer, createInitialState, type AppState, type AppAction } from "./appState";
import { nextYear } from "../lib/playback";
import type { CountryMeta } from "../data/types";

interface AppStateContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({
  countries,
  children,
}: {
  countries: CountryMeta[];
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(appStateReducer, countries, createInitialState);

  useEffect(() => {
    if (!state.isPlaying) return;
    const timer = window.setInterval(() => {
      const next = nextYear(state.currentYear);
      if (next === null) {
        dispatch({ type: "STOP_PLAYING" });
      } else {
        dispatch({ type: "SET_YEAR", year: next });
      }
    }, 400);
    return () => window.clearInterval(timer);
  }, [state.isPlaying, state.currentYear]);

  return (
    <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>
  );
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
```

- [ ] **Step 2: 修改 src/App.tsx，載入資料並包上 Provider**

```tsx
import countriesData from "./data/countries.json";
import type { CountryMeta } from "./data/types";
import { AppStateProvider } from "./state/AppStateContext";

const countries = countriesData as CountryMeta[];

export default function App() {
  return (
    <AppStateProvider countries={countries}>
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        <p>資料載入完成，共 {countries.length} 國 — 接下來加三欄版面</p>
      </div>
    </AppStateProvider>
  );
}
```

- [ ] **Step 3: 型別檢查與 build**

Run: `npm run typecheck`
Expected: 無型別錯誤
Run: `npm run build`
Expected: build 成功

- [ ] **Step 4: Commit**

```bash
git add src/state/AppStateContext.tsx src/App.tsx
git commit -m "Wire up React context for app-wide selection/hover/year/playing state"
```

---

## Task 9: 左側國家勾選清單元件

**Files:**
- Create: `src/components/CountryChecklist.tsx`
- Modify: `src/App.tsx`（把左欄換成 `CountryChecklist`）

**Interfaces:**
- Consumes: `useAppState`（`src/state/AppStateContext.tsx`）、`groupByRegion`, `filterBySearch`（`src/lib/selection.ts`）、`CountryMeta`（`src/data/types.ts`）
- Produces: `CountryChecklist({ countries }: { countries: CountryMeta[] })`

- [ ] **Step 1: 寫 src/components/CountryChecklist.tsx**

```tsx
import { useMemo, useState } from "react";
import { useAppState } from "../state/AppStateContext";
import { groupByRegion, filterBySearch } from "../lib/selection";
import type { CountryMeta, Region } from "../data/types";

const REGION_LABELS: Record<Region, string> = {
  asia: "亞洲",
  europe: "歐洲",
  africa: "非洲",
  americas: "美洲",
};

export function CountryChecklist({ countries }: { countries: CountryMeta[] }) {
  const { state, dispatch } = useAppState();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<Region, boolean>>({
    asia: false,
    europe: false,
    africa: false,
    americas: false,
  });

  const filtered = useMemo(() => filterBySearch(countries, query), [countries, query]);
  const groups = useMemo(() => groupByRegion(filtered), [filtered]);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 text-sm">
      <input
        type="text"
        placeholder="搜尋國家…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-3 rounded border border-slate-300 px-2 py-1"
      />
      {(Object.keys(groups) as Region[]).map((region) => {
        const list = groups[region];
        if (list.length === 0) return null;
        const allSelected = list.every((c) => state.selectedCountries.has(c.geo));
        return (
          <div key={region} className="mb-2">
            <div className="flex items-center gap-2 font-medium">
              <button
                type="button"
                onClick={() => setCollapsed((prev) => ({ ...prev, [region]: !prev[region] }))}
              >
                {collapsed[region] ? "▶" : "▼"}
              </button>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_REGION",
                      region,
                      countries: list,
                      selected: e.target.checked,
                    })
                  }
                />
                {REGION_LABELS[region]}（{list.length}）
              </label>
            </div>
            {!collapsed[region] && (
              <ul className="ml-6">
                {list.map((c) => (
                  <li
                    key={c.geo}
                    onMouseEnter={() => dispatch({ type: "SET_HOVERED", geo: c.geo })}
                    onMouseLeave={() => dispatch({ type: "SET_HOVERED", geo: null })}
                    className={state.hoveredCountry === c.geo ? "bg-slate-100" : ""}
                  >
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={state.selectedCountries.has(c.geo)}
                        onChange={() => dispatch({ type: "TOGGLE_COUNTRY", geo: c.geo })}
                      />
                      {c.name}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: 修改 src/App.tsx，換上左欄元件**

```tsx
import countriesData from "./data/countries.json";
import type { CountryMeta } from "./data/types";
import { AppStateProvider } from "./state/AppStateContext";
import { CountryChecklist } from "./components/CountryChecklist";

const countries = countriesData as CountryMeta[];

export default function App() {
  return (
    <AppStateProvider countries={countries}>
      <div className="grid grid-cols-[280px_1fr_1fr] h-screen">
        <aside className="border-r border-slate-200">
          <CountryChecklist countries={countries} />
        </aside>
        <main className="flex items-center justify-center text-slate-600">
          泡泡圖（下個 task）
        </main>
        <aside className="flex items-center justify-center text-slate-600">
          地球儀（下個 task）
        </aside>
      </div>
    </AppStateProvider>
  );
}
```

- [ ] **Step 3: 型別檢查與 build**

Run: `npm run typecheck`
Expected: 無型別錯誤
Run: `npm run build`
Expected: build 成功

- [ ] **Step 4: Commit**

```bash
git add src/components/CountryChecklist.tsx src/App.tsx
git commit -m "Add left-panel country checklist grouped by region"
```

---

## Task 10: 泡泡圖與時間控制元件

**Files:**
- Create: `src/components/BubbleChart.tsx`
- Create: `src/components/TimeControls.tsx`
- Modify: `src/App.tsx`（把中欄換成 `BubbleChart` + `TimeControls`）

**Interfaces:**
- Consumes: `useAppState`、`createLifeExpectancyScale`, `createIncomeScale`, `createPopulationRadiusScale`（`src/lib/scales.ts`）、`colorForRegion`（`src/lib/regionColors.ts`）、`YEAR_MIN`, `YEAR_MAX`（`src/lib/playback.ts`）、`CountryMeta`, `YearRecord`（`src/data/types.ts`）
- Produces: `BubbleChart({ countries, records }: { countries: CountryMeta[]; records: YearRecord[] })`、`TimeControls()`

- [ ] **Step 1: 寫 src/components/BubbleChart.tsx**

```tsx
import { useMemo } from "react";
import { useAppState } from "../state/AppStateContext";
import {
  createLifeExpectancyScale,
  createIncomeScale,
  createPopulationRadiusScale,
} from "../lib/scales";
import { colorForRegion } from "../lib/regionColors";
import type { CountryMeta, YearRecord } from "../data/types";

const WIDTH = 720;
const HEIGHT = 480;
const MARGIN = { top: 20, right: 20, bottom: 40, left: 60 };

export function BubbleChart({
  countries,
  records,
}: {
  countries: CountryMeta[];
  records: YearRecord[];
}) {
  const { state, dispatch } = useAppState();

  const countryByGeo = useMemo(() => {
    const map = new Map<string, CountryMeta>();
    for (const c of countries) map.set(c.geo, c);
    return map;
  }, [countries]);

  const yearRecordByGeo = useMemo(() => {
    const map = new Map<string, YearRecord>();
    for (const r of records) {
      if (r.year === state.currentYear) map.set(r.geo, r);
    }
    return map;
  }, [records, state.currentYear]);

  const xScale = useMemo(
    () => createLifeExpectancyScale([MARGIN.left, WIDTH - MARGIN.right]),
    []
  );
  const yScale = useMemo(
    () => createIncomeScale([HEIGHT - MARGIN.bottom, MARGIN.top]),
    []
  );
  const rScale = useMemo(() => createPopulationRadiusScale([3, 40]), []);

  const bubbles = Array.from(state.selectedCountries)
    .map((geo) => {
      const country = countryByGeo.get(geo);
      const record = yearRecordByGeo.get(geo);
      if (!country || !record) return null;
      if (record.income === null || record.lifeExpectancy === null || record.population === null) {
        return null;
      }
      return { country, record };
    })
    .filter((b): b is { country: CountryMeta; record: YearRecord } => b !== null);

  if (state.selectedCountries.size === 0) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        尚未勾選任何國家，請從左側清單勾選要顯示的國家。
      </div>
    );
  }

  return (
    <svg width={WIDTH} height={HEIGHT} role="img" aria-label="Gapminder 泡泡圖">
      {bubbles.map(({ country, record }) => {
        const isProjection =
          record.incomeIsProjection || record.lifeExpectancyIsProjection || record.populationIsProjection;
        return (
          <circle
            key={country.geo}
            cx={xScale(record.lifeExpectancy!)}
            cy={yScale(record.income!)}
            r={rScale(record.population!)}
            fill={colorForRegion(country.region)}
            opacity={isProjection ? 0.35 : 0.85}
            stroke={country.geo === state.hoveredCountry ? "#111827" : "none"}
            strokeWidth={2}
            onMouseEnter={() => dispatch({ type: "SET_HOVERED", geo: country.geo })}
            onMouseLeave={() => dispatch({ type: "SET_HOVERED", geo: null })}
          >
            <title>
              {country.name}（{record.year}）
              {isProjection ? "・推估值" : ""}
            </title>
          </circle>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 2: 寫 src/components/TimeControls.tsx**

```tsx
import { useAppState } from "../state/AppStateContext";
import { YEAR_MIN, YEAR_MAX, playStartYear } from "../lib/playback";

export function TimeControls() {
  const { state, dispatch } = useAppState();

  const handlePlayToggle = () => {
    if (!state.isPlaying) {
      dispatch({ type: "SET_YEAR", year: playStartYear(state.currentYear) });
    }
    dispatch({ type: "TOGGLE_PLAYING" });
  };

  return (
    <div className="flex items-center gap-3 p-3">
      <button
        type="button"
        onClick={handlePlayToggle}
        className="rounded border border-slate-300 px-3 py-1"
      >
        {state.isPlaying ? "暫停" : "播放"}
      </button>
      <input
        type="range"
        min={YEAR_MIN}
        max={YEAR_MAX}
        value={state.currentYear}
        onChange={(e) => {
          dispatch({ type: "STOP_PLAYING" });
          dispatch({ type: "SET_YEAR", year: Number(e.target.value) });
        }}
        className="flex-1"
      />
      <span className="w-14 text-right tabular-nums">{state.currentYear}</span>
    </div>
  );
}
```

- [ ] **Step 3: 修改 src/App.tsx，換上中欄元件**

```tsx
import countriesData from "./data/countries.json";
import gapminderData from "./data/gapminder.json";
import type { CountryMeta, YearRecord } from "./data/types";
import { AppStateProvider } from "./state/AppStateContext";
import { CountryChecklist } from "./components/CountryChecklist";
import { BubbleChart } from "./components/BubbleChart";
import { TimeControls } from "./components/TimeControls";

const countries = countriesData as CountryMeta[];
const records = gapminderData as YearRecord[];

export default function App() {
  return (
    <AppStateProvider countries={countries}>
      <div className="grid grid-cols-[280px_1fr_1fr] h-screen">
        <aside className="border-r border-slate-200">
          <CountryChecklist countries={countries} />
        </aside>
        <main className="flex flex-col">
          <div className="flex-1 flex items-center justify-center">
            <BubbleChart countries={countries} records={records} />
          </div>
          <TimeControls />
        </main>
        <aside className="flex items-center justify-center text-slate-600">
          地球儀（下個 task）
        </aside>
      </div>
    </AppStateProvider>
  );
}
```

- [ ] **Step 4: 型別檢查與 build**

Run: `npm run typecheck`
Expected: 無型別錯誤
Run: `npm run build`
Expected: build 成功

- [ ] **Step 5: Commit**

```bash
git add src/components/BubbleChart.tsx src/components/TimeControls.tsx src/App.tsx
git commit -m "Add bubble chart and time slider/playback controls"
```

---

## Task 11: 右側地球儀元件與最終版面

**Files:**
- Create: `src/types/globe-gl.d.ts`
- Create: `src/components/WorldGlobe.tsx`
- Modify: `src/App.tsx`（右欄換成 `WorldGlobe`，最終定案三欄版面）
- Modify: `package.json`（新增 `globe.gl` 依賴）

**Interfaces:**
- Consumes: `useAppState`、`buildGlobePoints`（`src/lib/globePoints.ts`）、`CountryMeta`（`src/data/types.ts`）
- Produces: `WorldGlobe({ countries }: { countries: CountryMeta[] })`

- [ ] **Step 1: 安裝 globe.gl**

Run: `npm install globe.gl`
Expected: `package.json` 的 `dependencies` 自動新增 `globe.gl`

- [ ] **Step 2: 寫 src/types/globe-gl.d.ts（官方無型別定義，補一個最小宣告檔）**

```ts
declare module "globe.gl";
```

- [ ] **Step 3: 寫 src/components/WorldGlobe.tsx**

```tsx
import { useEffect, useRef } from "react";
import Globe from "globe.gl";
import { useAppState } from "../state/AppStateContext";
import { buildGlobePoints } from "../lib/globePoints";
import type { CountryMeta } from "../data/types";

export function WorldGlobe({ countries }: { countries: CountryMeta[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<ReturnType<ReturnType<typeof Globe>> | null>(null);
  const { state, dispatch } = useAppState();

  useEffect(() => {
    if (!containerRef.current) return;
    // globe.gl 的匯出是工廠函式：Globe(config?) 回傳一個「掛載函式」，
    // 呼叫該函式並傳入容器 DOM 才會建立實例——不是 `new Globe(el)`。
    const globeInstance = Globe()(containerRef.current)
      .globeImageUrl("//unpkg.com/three-globe/example/img/earth-blue-marble.jpg")
      .pointLat("lat")
      .pointLng("lng")
      .pointColor("color")
      .pointRadius("radius")
      .pointAltitude(0.01)
      .onPointHover((point: { geo: string } | null) =>
        dispatch({ type: "SET_HOVERED", geo: point?.geo ?? null })
      );
    globeRef.current = globeInstance;

    return () => {
      containerRef.current!.innerHTML = "";
      globeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const points = buildGlobePoints(countries, state.selectedCountries, state.hoveredCountry);
    globeRef.current?.pointsData(points);
  }, [countries, state.selectedCountries, state.hoveredCountry]);

  return <div ref={containerRef} className="h-full w-full" />;
}
```

- [ ] **Step 4: 修改 src/App.tsx，換上右欄元件（最終三欄版面）**

```tsx
import countriesData from "./data/countries.json";
import gapminderData from "./data/gapminder.json";
import type { CountryMeta, YearRecord } from "./data/types";
import { AppStateProvider } from "./state/AppStateContext";
import { CountryChecklist } from "./components/CountryChecklist";
import { BubbleChart } from "./components/BubbleChart";
import { TimeControls } from "./components/TimeControls";
import { WorldGlobe } from "./components/WorldGlobe";

const countries = countriesData as CountryMeta[];
const records = gapminderData as YearRecord[];

export default function App() {
  return (
    <AppStateProvider countries={countries}>
      <div className="grid grid-cols-[280px_1fr_1fr] h-screen">
        <aside className="border-r border-slate-200">
          <CountryChecklist countries={countries} />
        </aside>
        <main className="flex flex-col border-r border-slate-200">
          <div className="flex-1 flex items-center justify-center">
            <BubbleChart countries={countries} records={records} />
          </div>
          <TimeControls />
        </main>
        <aside>
          <WorldGlobe countries={countries} />
        </aside>
      </div>
    </AppStateProvider>
  );
}
```

- [ ] **Step 5: 型別檢查與 build**

Run: `npm run typecheck`
Expected: 無型別錯誤
Run: `npm run build`
Expected: build 成功

- [ ] **Step 6: Commit**

```bash
git add src/types/globe-gl.d.ts src/components/WorldGlobe.tsx src/App.tsx package.json package-lock.json
git commit -m "Add globe.gl right panel and finalize three-column layout"
```

---

## Task 12: 手動瀏覽器驗證與收尾

**Files:**
- Create: `README.md`

**Interfaces:**
- 無新程式介面；此 task 只做驗證與文件收尾。

- [ ] **Step 1: 啟動開發伺服器**

Run: `npm run dev`（背景執行，取得 local URL）

- [ ] **Step 2: 用瀏覽器（Playwright MCP 或人工開瀏覽器）逐項確認以下行為**

- 開啟頁面時左側 195 國全勾、中間泡泡圖畫出年份 1950 的泡泡、右側地球儀顯示對應亮點
- 在左側取消勾選某國 → 該國泡泡與地球儀亮點同時消失
- 滑鼠移到左側清單某國 → 中間泡泡與右側地球儀該國同步高亮（描邊/放大）
- 點擊「播放」→ 年份每 400ms 自動 +1，泡泡隨年份移動，播到 2050 自動停止
- 拖曳年份滑桿 → 圖表立即跳到該年份
- 取消全部勾選 → 中間顯示「尚未勾選任何國家」提示，而非空白或報錯
- 檢查 2020 年之後：Andorra、Monaco 等 9 個微型國家的泡泡消失屬預期現象（對照
  `gapminder_core3_缺失值說明.md` 第三節），非程式錯誤

- [ ] **Step 3: 執行全部單元測試**

Run: `npx vitest run`
Expected: `scripts/transform.test.js`、`src/lib/*.test.ts`、`src/state/appState.test.ts` 全部通過

- [ ] **Step 4: 最終型別檢查與 build**

Run: `npm run typecheck`
Run: `npm run build`
Expected: 皆無錯誤

- [ ] **Step 5: 寫 README.md**

```markdown
# Gapminder 泡泡圖 + 地球儀

仿 Gapminder Tools 的互動網頁：左側國家勾選清單、中間泡泡圖
（X 軸 life expectancy、Y 軸 income 對數刻度、泡泡大小 = population）、
右側 globe.gl 3D 地球儀，支援 1950–2050 年份滑桿與播放動畫。

## 開發

\`\`\`bash
npm install
npm run prepare-data   # 從 supervisor/data/global/gapminder_core3.csv 重新產生 src/data/*.json
npm run dev
\`\`\`

## 測試

\`\`\`bash
npm run test        # Vitest 單元測試（資料處理、色階、播放、勾選、地球儀點位、狀態機）
npm run typecheck   # TypeScript 型別檢查
npm run build       # 正式建置
\`\`\`

## 資料來源

`supervisor/data/global/gapminder_core3.csv`（Gapminder，CC-BY 4.0），
篩選 `all_three == 1`（1950–2050 年、195 國）。詳見同目錄
`gapminder_core3_缺失值說明.md` 對缺值結構與推估值分界的完整說明。
```

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "Add README with dev/test instructions and data source notes"
```

---

## Self-Review Notes

- **Spec coverage**：規格書七大段（背景/範圍/技術棧/資料處理/共用狀態/元件設計/錯誤處理/測試計畫）皆對應到 Task 1–12；「不在本次範圍」的三項（choropleth 地球儀、其他指標、後端）未安排任何 task，符合規格。
- **型別一致性**：`CountryMeta`、`YearRecord`、`Region`、`AppState`、`AppAction`、`GlobePoint` 的欄位名稱在 Task 2/5/6/7/8/9/10/11 across 檔案中保持一致（例如一律用 `lifeExpectancy` 不混用 `life_expectancy`）。
- **測試慣例調整**：規格書原提到「Playwright 端對端測試」，實作時改為「手動瀏覽器驗證（Task 12）＋核心邏輯全部下沉到 `src/lib` 做 Vitest 單元測試」，這是比照 sibling 專案 township-drilldown-app 已驗證有效的慣例（該專案同樣沒有 committed 的 Playwright spec，而是把邏輯測試做在 `src/lib/*.test.ts`）。行為覆蓋範圍不變，只是換了驗證手段。
