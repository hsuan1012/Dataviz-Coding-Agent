# Gapminder 散布圖功能對齊鄉鎮圖集 — 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把鄉鎮圖集散布圖的全部互動功能（四通道下拉、框選選取/清除、圖例、caption、排名卡連動）移植到 Gapminder 泡泡圖，並加兩個新指標與地球儀雙向連動。

**Architecture:** 依 spec（`docs/superpowers/specs/2026-07-31-scatter-feature-parity-design.md`）採做法 A：移植鄉鎮版已驗證的模組（`scatterChannels` 設定檔、選取 reducer、caption 純函式），適配 Gapminder 資料模型。狀態全部走既有 `appStateReducer`（單一 reducer 模式），視覺元件讀 state 渲染。

**Tech Stack:** React 18 + TypeScript + d3 v7 + globe.gl + Tailwind v4 + Vite 5 + vitest + Playwright（verify 腳本）。

## Global Constraints

- 回覆/註解/UI 文案一律繁體中文；程式註解跟隨現有風格（說明「為什麼」的中文註解）。
- commit 訊息**不加** `Co-Authored-By: Claude`（使用者明確要求）。
- 版面鎖單螢幕：`h-screen` 不出頁面捲軸（回歸基準 1536×781）。
- 選取語意兩層分工：左側勾選清單＝顯示範圍（**行為不動**）；focus 框選＝高亮聚焦層。
- 排名卡對象＝全部國家（不受勾選清單與 focus 影響）。
- 新指標無 projection 旗標，一律視為觀測值。
- 完成門檻：`npm run typecheck`、`npm test`、`npm run build`、verify 腳本全綠。
- 工作目錄＝worktree：`C:\Users\user\jayla\gapminder-bubble-globe-app\.claude\worktrees\gapminder-bubble-globe-implementation`。

---

### Task 1: ETL — 下載 fasttrack 兩指標並併入資料管線

**Files:**
- Create: `scripts/download-fasttrack.js`
- Create: `data-src/`（下載檔存放，連 CSV 一起進 git）
- Modify: `scripts/transform.js`
- Modify: `scripts/transform.test.js`
- Modify: `scripts/prepare-data.js`
- Modify: `src/data/types.ts`
- Modify: `package.json`（scripts 加 `download-data`）

**Interfaces:**
- Consumes: 現有 `toYearRecords()` 輸出的 record 陣列（欄位見 `src/data/types.ts`）。
- Produces: `YearRecord` 新增 `childMortality: number | null`、`fertility: number | null`；
  `indexFasttrack(rows, valueColumn): Map<string, number>`、
  `mergeFasttrack(records, mortalityByKey, fertilityByKey): records`（transform.js 匯出）。
  重新產出的 `src/data/gapminder.json` 每筆都含兩個新欄位。

- [ ] **Step 1: 寫 transform 的失敗測試**（`scripts/transform.test.js` 追加）

```js
import { indexFasttrack, mergeFasttrack } from "./transform.js";

test("indexFasttrack 以 country|time 建索引並轉數值、跳過空值", () => {
  const rows = [
    { country: "afg", time: "1950", child_mortality_0_5_year_olds_dying_per_1000_born: "420.5" },
    { country: "afg", time: "1951", child_mortality_0_5_year_olds_dying_per_1000_born: "" },
  ];
  const map = indexFasttrack(rows, "child_mortality_0_5_year_olds_dying_per_1000_born");
  expect(map.get("afg|1950")).toBe(420.5);
  expect(map.has("afg|1951")).toBe(false);
});

test("mergeFasttrack 併入兩指標,查不到補 null", () => {
  const records = [{ geo: "afg", year: 1950, income: 1000 }];
  const mort = new Map([["afg|1950", 420.5]]);
  const fert = new Map(); // 生育率查不到
  const merged = mergeFasttrack(records, mort, fert);
  expect(merged[0].childMortality).toBe(420.5);
  expect(merged[0].fertility).toBeNull();
  expect(merged[0].income).toBe(1000); // 原欄位保留
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run scripts/transform.test.js`
Expected: FAIL —— `indexFasttrack is not a function`

- [ ] **Step 3: 在 `scripts/transform.js` 實作**

```js
// fasttrack datapoints:country|time → 數值。空字串=缺值,不進索引。
export function indexFasttrack(rows, valueColumn) {
  const map = new Map();
  for (const row of rows) {
    const v = row[valueColumn];
    if (v === "" || v === undefined) continue;
    map.set(`${row.country}|${row.time}`, Number(v));
  }
  return map;
}

// 以 geo+year 併入兩個新指標;fasttrack 無 projection 欄位,一律視為觀測值(見 spec)。
export function mergeFasttrack(records, mortalityByKey, fertilityByKey) {
  return records.map((r) => ({
    ...r,
    childMortality: mortalityByKey.get(`${r.geo}|${r.year}`) ?? null,
    fertility: fertilityByKey.get(`${r.geo}|${r.year}`) ?? null,
  }));
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run scripts/transform.test.js`
Expected: PASS（新舊測試全綠）

- [ ] **Step 5: 寫下載腳本 `scripts/download-fasttrack.js`**

```js
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "..", "data-src");
const BASE = "https://raw.githubusercontent.com/open-numbers/ddf--gapminder--fasttrack/master/";
const FILES = [
  "ddf--datapoints--child_mortality_0_5_year_olds_dying_per_1000_born--by--country--time.csv",
  "ddf--datapoints--children_per_woman_total_fertility--by--country--time.csv",
];

mkdirSync(OUT_DIR, { recursive: true });
for (const file of FILES) {
  const res = await fetch(BASE + file);
  if (!res.ok) {
    console.error(`[download-fasttrack] 下載失敗 ${res.status}:${file}`);
    console.error("檔名可能已變更,用 GitHub API 查實際檔名:");
    console.error("  https://api.github.com/repos/open-numbers/ddf--gapminder--fasttrack/contents/");
    process.exit(1);
  }
  const text = await res.text();
  // 基本健檢:datapoints CSV 首行必含 country,time 兩欄
  if (!text.slice(0, 200).includes("country,time")) {
    console.error(`[download-fasttrack] ${file} 首行不含 country,time,格式可能已變`);
    process.exit(1);
  }
  writeFileSync(resolve(OUT_DIR, file), text);
  console.log(`${file}: ${text.split("\n").length} 行`);
}
```

`package.json` scripts 加：`"download-data": "node scripts/download-fasttrack.js"`。

- [ ] **Step 6: 執行下載並確認檔案落地**

Run: `npm run download-data`，然後 `ls data-src/`
Expected: 兩個 CSV 存在，各數萬行。若 404，照錯誤訊息用 GitHub API 查實際檔名後改 `FILES` 再跑。

- [ ] **Step 7: 修改 `scripts/prepare-data.js` 併入與驗證**

在現有 `const records = toYearRecords(filtered);` 之後插入：

```js
import { indexFasttrack, mergeFasttrack } from "./transform.js"; // 檔頭 import 併入既有那行

const DATA_SRC = resolve(__dirname, "..", "data-src");
const mortalityText = readFileSync(
  resolve(DATA_SRC, "ddf--datapoints--child_mortality_0_5_year_olds_dying_per_1000_born--by--country--time.csv"),
  "utf-8"
).replace(/^\uFEFF/, "");
const fertilityText = readFileSync(
  resolve(DATA_SRC, "ddf--datapoints--children_per_woman_total_fertility--by--country--time.csv"),
  "utf-8"
).replace(/^\uFEFF/, "");
const mortalityByKey = indexFasttrack(csvParse(mortalityText), "child_mortality_0_5_year_olds_dying_per_1000_born");
const fertilityByKey = indexFasttrack(csvParse(fertilityText), "children_per_woman_total_fertility");
const merged = mergeFasttrack(records, mortalityByKey, fertilityByKey);

// 防呆(spec §1):join 覆蓋率——2000 年至少 150 國兩指標皆有值,
// 否則多半是 fasttrack 檔名/geo 代碼對不上,靜默寫出全 null 會讓新通道整個空白。
const y2000 = merged.filter((r) => r.year === 2000);
const mortCover = y2000.filter((r) => r.childMortality !== null).length;
const fertCover = y2000.filter((r) => r.fertility !== null).length;
if (mortCover < 150 || fertCover < 150) {
  console.error(`[prepare-data] fasttrack join 覆蓋率異常:2000 年兒童死亡率 ${mortCover} 國、生育率 ${fertCover} 國(預期 ≥150)`);
  process.exit(1);
}
// 極值檢查:超出 channels.ts 的固定 domain 表示資料形態改變,要人工確認
const mortMax = Math.max(...merged.map((r) => r.childMortality ?? -Infinity));
const fertMax = Math.max(...merged.map((r) => r.fertility ?? -Infinity));
console.log(`childMortality max=${mortMax}, fertility max=${fertMax}`);
if (mortMax > 550 || fertMax > 9) {
  console.error(`[prepare-data] 新指標極值超出 domain(兒童死亡率≤550、生育率≤9),請同步調整 channels.ts`);
  process.exit(1);
}
```

寫檔那行改用 `merged`：`writeFileSync(resolve(OUT_DIR, "gapminder.json"), JSON.stringify(merged));`

`src/data/types.ts` 的 `YearRecord` 追加：

```ts
  childMortality: number | null;
  fertility: number | null;
```

- [ ] **Step 8: 重跑 ETL 確認產出**

Run: `npm run prepare-data`
Expected: 印出 countries/records 數（與之前相同）＋兩指標 max 值；`git diff --stat src/data/gapminder.json` 顯示檔案變大。

- [ ] **Step 9: Commit**

```bash
git add scripts/ data-src/ src/data/ package.json
git commit -m "feat: ETL 併入 fasttrack 兒童死亡率與總生育率兩指標"
```

---

### Task 2: 通道設定檔 `channels.ts`（含 X=Y 防呆與色階工具）

**Files:**
- Create: `src/lib/channels.ts`
- Create: `src/lib/channels.test.ts`

**Interfaces:**
- Consumes: `LIFE_EXPECTANCY_DOMAIN`、`INCOME_DOMAIN`、`POPULATION_DOMAIN`（自 `src/lib/scales.ts`，避免 domain 重複定義）。
- Produces（後續全部 Task 依賴，簽名如下）:
  - `type MetricKey = "income" | "lifeExpectancy" | "population" | "childMortality" | "fertility"`
  - `type ColorKey = "region" | MetricKey`
  - `interface ScatterChannels { x: MetricKey; y: MetricKey; size: MetricKey; color: ColorKey }`
  - `const METRICS: Record<MetricKey, MetricConfig>`（`MetricConfig = { label; unit; scaleType: "log" | "linear"; domain: [number, number]; ticks: number[]; format(v: number): string }`）
  - `const DEFAULT_CHANNELS: ScatterChannels`
  - `patchChannels(s: ScatterChannels, patch: Partial<ScatterChannels>): ScatterChannels`
  - `makeMetricScale(key: MetricKey, range: [number, number])`
  - `makeRadiusScale(key: MetricKey, range: [number, number])`
  - `makeColorNormalizer(key: MetricKey)`（值→[0,1]，clamp）
  - `const TEAL_RAMP: string[]`、`rampColor(ramp: string[]): (t: number) => string`
  - `sizeTicks(domain: [number, number]): number[]`

- [ ] **Step 1: 寫失敗測試 `src/lib/channels.test.ts`**

```ts
import { describe, expect, test } from "vitest";
import {
  METRICS, DEFAULT_CHANNELS, patchChannels, makeMetricScale,
  makeColorNormalizer, rampColor, sizeTicks, TEAL_RAMP,
} from "./channels";

describe("patchChannels", () => {
  test("X 改成與 Y 相同時自動對調(Y 接手舊 X)", () => {
    const s = { x: "lifeExpectancy", y: "income", size: "population", color: "region" } as const;
    const next = patchChannels(s, { x: "income" });
    expect(next.x).toBe("income");
    expect(next.y).toBe("lifeExpectancy");
  });
  test("無變更時回傳原物件(setState 短路)", () => {
    const s = DEFAULT_CHANNELS;
    expect(patchChannels(s, { x: s.x })).toBe(s);
  });
  test("顏色/大小與軸重複是合法的", () => {
    const next = patchChannels(DEFAULT_CHANNELS, { color: DEFAULT_CHANNELS.x });
    expect(next.color).toBe(DEFAULT_CHANNELS.x);
  });
});

describe("METRICS 設定", () => {
  test("五個指標齊全且 domain 有限", () => {
    const keys = ["income", "lifeExpectancy", "population", "childMortality", "fertility"];
    for (const k of keys) {
      const m = METRICS[k as keyof typeof METRICS];
      expect(m.label).toBeTruthy();
      expect(Number.isFinite(m.domain[0]) && Number.isFinite(m.domain[1])).toBe(true);
      expect(m.ticks.length).toBeGreaterThan(2);
    }
  });
  test("對數指標的 domain 下界必須 > 0(scaleLog 不能含 0)", () => {
    for (const m of Object.values(METRICS)) {
      if (m.scaleType === "log") expect(m.domain[0]).toBeGreaterThan(0);
    }
  });
});

describe("尺度與色階", () => {
  test("makeMetricScale clamp 超界值", () => {
    const s = makeMetricScale("fertility", [0, 100]);
    expect(s(99)).toBe(100); // 遠超 domain 上界 9 → 夾在 range 上界
  });
  test("makeColorNormalizer 值域鎖 [0,1]", () => {
    const n = makeColorNormalizer("childMortality");
    expect(n(-10)).toBe(0);
    expect(n(99999)).toBe(1);
  });
  test("rampColor 兩端等於色階端點", () => {
    const f = rampColor(TEAL_RAMP);
    expect(f(0)).toBe("rgb(209, 250, 229)"); // TEAL_RAMP[0] = #D1FAE5
    expect(f(1)).toBe("rgb(6, 95, 70)");     // TEAL_RAMP[4] = #065F46
  });
  test("sizeTicks 全部落在 domain 內且最多 3 個", () => {
    const t = sizeTicks(METRICS.population.domain);
    expect(t.length).toBeLessThanOrEqual(3);
    for (const v of t) {
      expect(v).toBeGreaterThanOrEqual(METRICS.population.domain[0]);
      expect(v).toBeLessThanOrEqual(METRICS.population.domain[1]);
    }
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/channels.test.ts`
Expected: FAIL —— 模組不存在

- [ ] **Step 3: 實作 `src/lib/channels.ts`**

```ts
import { scaleLinear, scaleLog, scaleSqrt, interpolateRgb, ticks as d3Ticks } from "d3";
import { LIFE_EXPECTANCY_DOMAIN, INCOME_DOMAIN, POPULATION_DOMAIN } from "./scales";

export type MetricKey = "income" | "lifeExpectancy" | "population" | "childMortality" | "fertility";
export type ColorKey = "region" | MetricKey;
export interface ScatterChannels { x: MetricKey; y: MetricKey; size: MetricKey; color: ColorKey }

export interface MetricConfig {
  label: string;
  unit: string;
  scaleType: "log" | "linear";
  domain: [number, number];
  ticks: number[];
  format: (v: number) => string;
}

function formatCompact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return v.toFixed(0);
}

// 五指標設定。既有三指標 domain 沿用 scales.ts 的固定值(Gapminder 慣例刻度);
// 新指標 domain 為固定值+clamp,由 prepare-data.js 的極值檢查守住(超界即 ETL 紅燈)。
export const METRICS: Record<MetricKey, MetricConfig> = {
  income: {
    label: "人均所得", unit: "2021 國際元,對數刻度", scaleType: "log",
    domain: INCOME_DOMAIN, ticks: [300, 1000, 3000, 10000, 30000, 100000, 250000],
    format: (v) => v.toLocaleString("en-US"),
  },
  lifeExpectancy: {
    label: "平均餘命", unit: "歲", scaleType: "linear",
    domain: LIFE_EXPECTANCY_DOMAIN, ticks: [20, 30, 40, 50, 60, 70, 80, 90],
    format: (v) => v.toFixed(1),
  },
  population: {
    label: "總人口", unit: "人,對數刻度", scaleType: "log",
    domain: POPULATION_DOMAIN, ticks: [1e4, 1e5, 1e6, 1e7, 1e8, 1e9],
    format: formatCompact,
  },
  childMortality: {
    label: "兒童死亡率", unit: "每千活產", scaleType: "linear",
    domain: [0, 550], ticks: [0, 100, 200, 300, 400, 500],
    format: (v) => v.toFixed(0),
  },
  fertility: {
    label: "總生育率", unit: "婦女平均生育數", scaleType: "linear",
    domain: [0, 9], ticks: [0, 2, 4, 6, 8],
    format: (v) => v.toFixed(2),
  },
};

export const DEFAULT_CHANNELS: ScatterChannels = {
  x: "lifeExpectancy", y: "income", size: "population", color: "region",
};

// 通道更新統一入口(移植鄉鎮版):X/Y 撞同指標時自動對調(被動軸接手舊值),
// 避免 X=Y 對角線退化圖。顏色/大小與軸重複是合法的。無變更時回原物件讓 setState 短路。
export function patchChannels(s: ScatterChannels, patch: Partial<ScatterChannels>): ScatterChannels {
  const next = { ...s, ...patch };
  if (next.x === next.y) {
    if ("x" in patch) next.y = s.x;
    else if ("y" in patch) next.x = s.y;
  }
  return next.x === s.x && next.y === s.y && next.size === s.size && next.color === s.color ? s : next;
}

export function makeMetricScale(key: MetricKey, range: [number, number]) {
  const m = METRICS[key];
  const scale = m.scaleType === "log" ? scaleLog() : scaleLinear();
  return scale.domain(m.domain).range(range).clamp(true);
}

export function makeRadiusScale(key: MetricKey, range: [number, number]) {
  return scaleSqrt().domain(METRICS[key].domain).range(range).clamp(true);
}

// 顏色通道:指標值 → [0,1]。對數指標走 log 正規化(與位置軸讀感一致),線性指標線性;clamp 防越界。
export function makeColorNormalizer(key: MetricKey) {
  const m = METRICS[key];
  const s = m.scaleType === "log" ? scaleLog() : scaleLinear();
  return s.domain(m.domain).range([0, 1]).clamp(true);
}

// 青綠 sequential 色階(spec §2:淺→深=低→高),與主題 accent 同色系。
export const TEAL_RAMP = ["#D1FAE5", "#6EE7B7", "#34D399", "#059669", "#065F46"];

// 5 段色階 → 連續插值(移植鄉鎮版):分段線性,兩端=色階端點。
export function rampColor(ramp: string[]): (t: number) => string {
  if (ramp.length < 2) return () => ramp[0] ?? "#000";
  const n = ramp.length - 1;
  return (t) => {
    const c = Math.min(Math.max(t, 0), 1) * n;
    const i = Math.min(Math.floor(c), n - 1);
    return interpolateRgb(ramp[i], ramp[i + 1])(c - i);
  };
}

// 大小圖例代表值(移植鄉鎮版):2–3 個整齊值,全部落在 domain 內
// (r 尺度用同一把,值必須在 domain 內才不外插)。
export function sizeTicks(domain: [number, number]): number[] {
  const t = d3Ticks(domain[0], domain[1], 3);
  if (t.length === 0) return [domain[0], domain[1]];
  if (t.length <= 3) return t;
  return [t[0], t[Math.floor(t.length / 2)], t[t.length - 1]];
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/channels.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/channels.ts src/lib/channels.test.ts
git commit -m "feat: 加入五指標通道設定檔與 X=Y 防呆、色階工具"
```

---

### Task 3: focus 選取層 reducer（appState 擴充）

**Files:**
- Create: `src/lib/brushSelect.ts`
- Create: `src/lib/brushSelect.test.ts`
- Modify: `src/state/appState.ts`
- Modify: `src/state/appState.test.ts`

**Interfaces:**
- Consumes: `ScatterChannels`、`DEFAULT_CHANNELS`、`patchChannels`（Task 2）。
- Produces:
  - `AppState` 新增 `focusSelection: Set<string>`、`focusMode: "select" | "clear" | null`、`channels: ScatterChannels`
  - 新 action：`SET_FOCUS_MODE {mode}`、`BRUSH_APPLY {geos: string[]}`、`FOCUS_ADD {geo}`、`FOCUS_REMOVE {geo}`、`FOCUS_TOGGLE {geo}`、`FOCUS_CLEAR`、`SET_CHANNELS {patch: Partial<ScatterChannels>}`
  - `brushSelect.ts`：`interface PlacedBubble { geo: string; cx: number; cy: number }`、
    `geosInRect(pts: PlacedBubble[], rect: [[number, number], [number, number]]): string[]`

- [ ] **Step 1: 寫失敗測試**

`src/lib/brushSelect.test.ts`：

```ts
import { describe, expect, test } from "vitest";
import { geosInRect } from "./brushSelect";

describe("geosInRect", () => {
  const pts = [
    { geo: "twn", cx: 10, cy: 10 },
    { geo: "jpn", cx: 50, cy: 50 },
    { geo: "kor", cx: 90, cy: 90 },
  ];
  test("矩形內的國家(邊界含端點)", () => {
    expect(geosInRect(pts, [[10, 10], [50, 50]])).toEqual(["twn", "jpn"]);
  });
  test("空矩形回空陣列", () => {
    expect(geosInRect(pts, [[0, 0], [5, 5]])).toEqual([]);
  });
});
```

`src/state/appState.test.ts` 追加（沿用現有測試檔的 `makeCountries` 類 helper；若無，測試內直接造 `countries` 陣列）：

```ts
import { createInitialState, appStateReducer } from "./appState";
import { DEFAULT_CHANNELS } from "../lib/channels";

const countries = [
  { geo: "twn", name: "Taiwan", region: "asia", latitude: 0, longitude: 0, iso2: "TW" },
  { geo: "jpn", name: "Japan", region: "asia", latitude: 0, longitude: 0, iso2: "JP" },
  { geo: "fra", name: "France", region: "europe", latitude: 0, longitude: 0, iso2: "FR" },
] as const;

describe("focus 選取層", () => {
  const init = () => createInitialState([...countries]);

  test("初始:無選取、無模式、預設通道", () => {
    const s = init();
    expect(s.focusSelection.size).toBe(0);
    expect(s.focusMode).toBeNull();
    expect(s.channels).toEqual(DEFAULT_CHANNELS);
  });

  test("SET_FOCUS_MODE:再按同模式=關閉(互斥 toggle)", () => {
    let s = appStateReducer(init(), { type: "SET_FOCUS_MODE", mode: "select" });
    expect(s.focusMode).toBe("select");
    s = appStateReducer(s, { type: "SET_FOCUS_MODE", mode: "clear" });
    expect(s.focusMode).toBe("clear");
    s = appStateReducer(s, { type: "SET_FOCUS_MODE", mode: "clear" });
    expect(s.focusMode).toBeNull();
  });

  test("BRUSH_APPLY:選取模式累加、清除模式累減、無模式不動作", () => {
    let s = appStateReducer(init(), { type: "SET_FOCUS_MODE", mode: "select" });
    s = appStateReducer(s, { type: "BRUSH_APPLY", geos: ["twn", "jpn"] });
    expect([...s.focusSelection].sort()).toEqual(["jpn", "twn"]);
    s = appStateReducer(s, { type: "SET_FOCUS_MODE", mode: "clear" });
    s = appStateReducer(s, { type: "BRUSH_APPLY", geos: ["jpn", "fra"] });
    expect([...s.focusSelection]).toEqual(["twn"]);
    s = appStateReducer(s, { type: "SET_FOCUS_MODE", mode: "clear" }); // 關閉模式
    const before = s.focusSelection;
    s = appStateReducer(s, { type: "BRUSH_APPLY", geos: ["fra"] });
    expect(s.focusSelection).toBe(before); // 無模式=不動作
  });

  test("FOCUS_ADD / FOCUS_REMOVE / FOCUS_TOGGLE / FOCUS_CLEAR", () => {
    let s = appStateReducer(init(), { type: "FOCUS_ADD", geo: "twn" });
    expect(s.focusSelection.has("twn")).toBe(true);
    s = appStateReducer(s, { type: "FOCUS_TOGGLE", geo: "jpn" });
    expect(s.focusSelection.has("jpn")).toBe(true);
    s = appStateReducer(s, { type: "FOCUS_TOGGLE", geo: "jpn" });
    expect(s.focusSelection.has("jpn")).toBe(false);
    s = appStateReducer(s, { type: "FOCUS_REMOVE", geo: "twn" });
    expect(s.focusSelection.size).toBe(0);
    s = appStateReducer(s, { type: "FOCUS_ADD", geo: "twn" });
    s = appStateReducer(s, { type: "FOCUS_CLEAR" });
    expect(s.focusSelection.size).toBe(0);
  });

  test("SET_CHANNELS 走 patchChannels(X=Y 自動對調)", () => {
    const s = appStateReducer(init(), { type: "SET_CHANNELS", patch: { x: "income" } });
    expect(s.channels.x).toBe("income");
    expect(s.channels.y).toBe("lifeExpectancy"); // 原 x 被 y 接手
  });

  test("勾選清單縮小顯示範圍時,focus 名單同步剔除(顯示範圍優先)", () => {
    let s = appStateReducer(init(), { type: "FOCUS_ADD", geo: "twn" });
    s = appStateReducer(s, { type: "FOCUS_ADD", geo: "fra" });
    s = appStateReducer(s, { type: "TOGGLE_COUNTRY", geo: "twn" }); // 取消勾選 twn
    expect(s.focusSelection.has("twn")).toBe(false);
    expect(s.focusSelection.has("fra")).toBe(true);
    s = appStateReducer(s, { type: "DESELECT_ALL" });
    expect(s.focusSelection.size).toBe(0);
  });

  test("SET_YEAR / TOGGLE_PLAYING 不影響 focus 名單(播放中選取保留)", () => {
    let s = appStateReducer(init(), { type: "FOCUS_ADD", geo: "twn" });
    s = appStateReducer(s, { type: "SET_YEAR", year: 1999 });
    s = appStateReducer(s, { type: "TOGGLE_PLAYING" });
    expect(s.focusSelection.has("twn")).toBe(true);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/brushSelect.test.ts src/state/appState.test.ts`
Expected: FAIL

- [ ] **Step 3: 實作**

`src/lib/brushSelect.ts`（移植鄉鎮版，鄉鎮名改 geo）：

```ts
// 框選集合:viewBox 座標矩形內的國家名單(邊界含端點)。純函式,座標換算由 BubbleChart 做。
export interface PlacedBubble { geo: string; cx: number; cy: number }

export function geosInRect(
  pts: PlacedBubble[],
  rect: [[number, number], [number, number]],
): string[] {
  const [[x0, y0], [x1, y1]] = rect;
  return pts
    .filter((p) => p.cx >= x0 && p.cx <= x1 && p.cy >= y0 && p.cy <= y1)
    .map((p) => p.geo);
}
```

`src/state/appState.ts` 擴充（型別、初始值、reducer case；勾選清單三個既有 case 補 focus 剔除）：

```ts
import type { ScatterChannels } from "../lib/channels";
import { DEFAULT_CHANNELS, patchChannels } from "../lib/channels";

export type FocusMode = "select" | "clear" | null;

export interface AppState {
  selectedCountries: Set<string>;
  hoveredCountry: string | null;
  currentYear: number;
  isPlaying: boolean;
  focusSelection: Set<string>;
  focusMode: FocusMode;
  channels: ScatterChannels;
}

export type AppAction =
  | { type: "TOGGLE_COUNTRY"; geo: string }
  | { type: "SET_REGION"; region: Region; countries: CountryMeta[]; selected: boolean }
  | { type: "SELECT_ALL"; countries: CountryMeta[] }
  | { type: "DESELECT_ALL" }
  | { type: "SET_HOVERED"; geo: string | null }
  | { type: "SET_YEAR"; year: number }
  | { type: "TOGGLE_PLAYING" }
  | { type: "STOP_PLAYING" }
  | { type: "SET_FOCUS_MODE"; mode: FocusMode }
  | { type: "BRUSH_APPLY"; geos: string[] }
  | { type: "FOCUS_ADD"; geo: string }
  | { type: "FOCUS_REMOVE"; geo: string }
  | { type: "FOCUS_TOGGLE"; geo: string }
  | { type: "FOCUS_CLEAR" }
  | { type: "SET_CHANNELS"; patch: Partial<ScatterChannels> };

// 顯示範圍優先:勾選清單縮小時,focus 名單只留仍顯示的國家(spec §3)。
function pruneFocus(focus: Set<string>, displayed: Set<string>): Set<string> {
  if (focus.size === 0) return focus;
  const next = new Set([...focus].filter((g) => displayed.has(g)));
  return next.size === focus.size ? focus : next;
}

export function createInitialState(countries: CountryMeta[]): AppState {
  return {
    selectedCountries: new Set(countries.map((c) => c.geo)),
    hoveredCountry: null,
    currentYear: YEAR_MIN,
    isPlaying: false,
    focusSelection: new Set(),
    focusMode: null,
    channels: DEFAULT_CHANNELS,
  };
}

// reducer 追加/修改 case(既有 case 不動的略):
case "TOGGLE_COUNTRY": {
  const selectedCountries = toggleCountry(state.selectedCountries, action.geo);
  return { ...state, selectedCountries, focusSelection: pruneFocus(state.focusSelection, selectedCountries) };
}
case "SET_REGION": {
  const selectedCountries = setRegionSelection(state.selectedCountries, action.countries, action.region, action.selected);
  return { ...state, selectedCountries, focusSelection: pruneFocus(state.focusSelection, selectedCountries) };
}
case "DESELECT_ALL":
  return { ...state, selectedCountries: new Set(), focusSelection: new Set() };
case "SET_FOCUS_MODE":
  return { ...state, focusMode: action.mode === state.focusMode ? null : action.mode };
case "BRUSH_APPLY": {
  if (state.focusMode === null || action.geos.length === 0) return state;
  const next = new Set(state.focusSelection);
  for (const g of action.geos) state.focusMode === "select" ? next.add(g) : next.delete(g);
  return { ...state, focusSelection: next };
}
case "FOCUS_ADD": {
  if (state.focusSelection.has(action.geo)) return state;
  return { ...state, focusSelection: new Set(state.focusSelection).add(action.geo) };
}
case "FOCUS_REMOVE": {
  if (!state.focusSelection.has(action.geo)) return state;
  const next = new Set(state.focusSelection);
  next.delete(action.geo);
  return { ...state, focusSelection: next };
}
case "FOCUS_TOGGLE":
  return state.focusSelection.has(action.geo)
    ? appStateReducer(state, { type: "FOCUS_REMOVE", geo: action.geo })
    : appStateReducer(state, { type: "FOCUS_ADD", geo: action.geo });
case "FOCUS_CLEAR":
  return state.focusSelection.size === 0 ? state : { ...state, focusSelection: new Set() };
case "SET_CHANNELS": {
  const channels = patchChannels(state.channels, action.patch);
  return channels === state.channels ? state : { ...state, channels };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run`
Expected: 全綠（含既有測試——SELECT_ALL 不需剔除因為顯示範圍只增不減）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/brushSelect.ts src/lib/brushSelect.test.ts src/state/appState.ts src/state/appState.test.ts
git commit -m "feat: focus 選取層 reducer(框選累加/累減/toggle/清空/顯示範圍剔除)與通道 state"
```

---

### Task 4: caption 純函式庫

**Files:**
- Create: `src/lib/scatterCaption.ts`
- Create: `src/lib/scatterCaption.test.ts`

**Interfaces:**
- Consumes: `ScatterChannels`、`METRICS`（Task 2）、`FocusMode`（Task 3）。
- Produces:
  - `buildScatterCaption(ch: ScatterChannels): string`
  - `buildFocusCaption(count: number): string`

- [ ] **Step 1: 寫失敗測試 `src/lib/scatterCaption.test.ts`**

```ts
import { describe, expect, test } from "vitest";
import { buildScatterCaption, buildFocusCaption } from "./scatterCaption";
import { DEFAULT_CHANNELS } from "./channels";

describe("buildScatterCaption", () => {
  test("預設通道:講 X/Y/大小,顏色=區域講洲別", () => {
    const s = buildScatterCaption(DEFAULT_CHANNELS);
    expect(s).toContain("每顆泡泡代表一個國家");
    expect(s).toContain("平均餘命");
    expect(s).toContain("人均所得");
    expect(s).toContain("總人口");
    expect(s).toContain("所屬洲別");
  });
  test("顏色=連續指標:改講顏色深淺", () => {
    const s = buildScatterCaption({ ...DEFAULT_CHANNELS, color: "childMortality" });
    expect(s).toContain("兒童死亡率");
    expect(s).toContain("越深");
  });
});

describe("buildFocusCaption", () => {
  test("未選:顯示框選教學", () => {
    expect(buildFocusCaption(0)).toContain("選取");
  });
  test("已選 N 國:含數量與保留說明", () => {
    const s = buildFocusCaption(14);
    expect(s).toContain("已選 14 國");
    expect(s).toContain("保留");
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/scatterCaption.test.ts`
Expected: FAIL

- [ ] **Step 3: 實作 `src/lib/scatterCaption.ts`**（文案結構移植鄉鎮版）

```ts
import type { ScatterChannels } from "./channels";
import { METRICS } from "./channels";

// 泡泡圖白話解說(移植鄉鎮版 7/23 教訓:很多人看不懂泡泡圖):
// 一句話講清楚「一顆泡泡=一個國家」+四個視覺通道各自編碼什麼、往哪個方向讀。
export function buildScatterCaption(ch: ScatterChannels): string {
  const lab = (k: keyof typeof METRICS) => METRICS[k].label;
  const color = ch.color === "region"
    ? "泡泡的顏色代表所屬洲別(亞洲/歐洲/非洲/美洲各一色)"
    : `泡泡的顏色越深代表「${lab(ch.color)}」越高`;
  return `每顆泡泡代表一個國家。泡泡越靠右代表「${lab(ch.x)}」越高、` +
    `越靠上代表「${lab(ch.y)}」越高;泡泡越大代表「${lab(ch.size)}」越高;${color}。`;
}

// 選取狀態列:未選=教學,已選=數量+操作提示(移植鄉鎮版狀態式說明)。
export function buildFocusCaption(count: number): string {
  if (count === 0) {
    return "按「選取」後在圖上拖曳框選一批國家,單擊泡泡加入、雙擊移除;選取後其餘國家會灰階淡化。";
  }
  return `已選 ${count} 國:切換年份或指標,名單都會保留;` +
    "按「清除」後框選移出一批,雙擊泡泡可個別移除。";
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/scatterCaption.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/scatterCaption.ts src/lib/scatterCaption.test.ts
git commit -m "feat: 散布圖狀態式 caption 純函式(通道解說+選取狀態)"
```

---

### Task 5: BubbleChart 重構 — 動態通道、灰化描邊、單擊/雙擊

**Files:**
- Modify: `src/components/BubbleChart.tsx`（整檔重寫）

**Interfaces:**
- Consumes: `state.channels`、`state.focusSelection`、`METRICS`、`makeMetricScale`、`makeRadiusScale`、`makeColorNormalizer`、`rampColor`、`TEAL_RAMP`、actions `FOCUS_ADD`/`FOCUS_REMOVE`。
- Produces: 內部匯出 `placeBubbles()` 不需要——但**保留元件 props 簽名不變**：`{ countries: CountryMeta[]; records: YearRecord[] }`（App.tsx 呼叫處不用改）。泡泡 `<circle>` 加 `data-geo={geo}` 與 class `bubble-dot`（verify 腳本與 Task 6 框選都靠它）。

**要點（整檔重寫時遵守）：**

1. 尺度改動態：

```tsx
const xScale = useMemo(
  () => makeMetricScale(state.channels.x, [MARGIN.left, WIDTH - MARGIN.right]),
  [state.channels.x]
);
const yScale = useMemo(
  () => makeMetricScale(state.channels.y, [HEIGHT - MARGIN.bottom, MARGIN.top]),
  [state.channels.y]
);
const rScale = useMemo(() => makeRadiusScale(state.channels.size, [3, 40]), [state.channels.size]);
```

2. 取值統一走 record 索引（`YearRecord` 的五個指標欄位名＝`MetricKey`，直接 `record[key]`）；任一使用中通道（x/y/size、顏色為指標時含 color）值為 null 的國家不畫。

3. 軸刻度/標籤全部從 `METRICS[state.channels.x]`（`.ticks`、`.format`、`.label`、`.unit`）產生，X 軸標籤文字 `${label} (${unit})`，Y 軸同理。既有手寫 `X_TICKS`/`Y_TICKS` 常數刪除。

4. 顏色：

```tsx
const colorOf = useMemo(() => {
  if (state.channels.color === "region") {
    return (country: CountryMeta, _record: YearRecord) => colorForRegion(country.region);
  }
  const normalize = makeColorNormalizer(state.channels.color);
  const ramp = rampColor(TEAL_RAMP);
  return (_country: CountryMeta, record: YearRecord) => {
    const v = record[state.channels.color as MetricKey];
    return v === null ? "#CBD5E1" : ramp(normalize(v));
  };
}, [state.channels.color]);
```

5. focus 灰化與描邊（spec §3）：

```tsx
const hasFocus = state.focusSelection.size > 0;
const isFocused = state.focusSelection.has(country.geo);
// <circle> 屬性:
fill={hasFocus && !isFocused ? "#CBD5E1" : colorOf(country, record)}
opacity={hasFocus && !isFocused ? 0.35 : isProjection ? 0.35 : 0.85}
stroke={isFocused ? "#0F172A" : country.geo === state.hoveredCountry ? "#111827" : "none"}
strokeWidth={isFocused ? 2.5 : 2}
```

6. 單擊加入/雙擊移除（移植鄉鎮版 timer 技巧——click 與 dblclick 同一次雙擊都會觸發，用 200ms timer 讓 dblclick 蓋掉單擊那次）：

```tsx
const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
const onBubbleClick = (geo: string) => {
  if (clickTimer.current) clearTimeout(clickTimer.current);
  clickTimer.current = setTimeout(() => dispatch({ type: "FOCUS_ADD", geo }), 200);
};
const onBubbleDblClick = (geo: string) => {
  if (clickTimer.current) clearTimeout(clickTimer.current);
  dispatch({ type: "FOCUS_REMOVE", geo });
};
```

7. 泡泡 `<circle>` 加 `className="bubble-dot"` 與 `data-geo={country.geo}`；`<title>` tooltip 保留並加上目前 X/Y 指標的格式化數值。

- [ ] **Step 1: 重寫 BubbleChart.tsx（依上述要點）**
- [ ] **Step 2: 驗證**

Run: `npm run typecheck && npx vitest run`，然後開 dev server 用 Playwright 截圖確認：預設畫面與改版前一致（洲別色、軸不變）。
Expected: 型檢綠、測試綠、截圖無走樣。

- [ ] **Step 3: Commit**

```bash
git add src/components/BubbleChart.tsx
git commit -m "feat: 泡泡圖接四通道動態尺度,加 focus 灰化描邊與單擊加入/雙擊移除"
```

---

### Task 6: 框選互動（拖曳矩形）與通道/選取控制列

**Files:**
- Modify: `src/components/BubbleChart.tsx`（加框選 overlay）
- Create: `src/components/ChannelControls.tsx`

**Interfaces:**
- Consumes: `geosInRect`（Task 3）、`METRICS`、`ScatterChannels`、actions `BRUSH_APPLY`/`SET_FOCUS_MODE`/`FOCUS_CLEAR`/`SET_CHANNELS`。
- Produces: `<ChannelControls />`（無 props，直接讀 context）。控制列按鈕 class：`.scatter-select-toggle`（選取）、`.sel-clear`（清除）——verify 腳本靠這些選擇器。框選矩形 `<rect class="brush-rect">`。（7/31 使用者要求：**無「清空」鈕**；FOCUS_CLEAR action 保留但無 UI 入口。）

**框選實作要點（BubbleChart 內，spec §3）：**

- `focusMode !== null` 時在 plot 區覆蓋一層透明 `<rect>`（`cursor: crosshair`），pointer events 起拖；`focusMode === null` 時不渲染 overlay（拖曳完全無反應——比照鄉鎮版拆 brush）。
- 座標換算用 SVG CTM（viewBox letterbox 安全）：

```tsx
function toViewBox(svg: SVGSVGElement, clientX: number, clientY: number): [number, number] {
  const pt = new DOMPoint(clientX, clientY);
  const ctm = svg.getScreenCTM();
  if (!ctm) return [0, 0];
  const p = pt.matrixTransform(ctm.inverse());
  return [p.x, p.y];
}
```

- `useState` 存 `dragStart`/`dragCurrent`（viewBox 座標）；拖曳中畫虛線透明框（比照鄉鎮版 7/30 定版）：

```tsx
<rect className="brush-rect" x={x0} y={y0} width={x1 - x0} height={y1 - y0}
  fill="var(--accent)" fillOpacity={0.08}
  stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="6 4" />
```

- pointerup 時：`dispatch({ type: "BRUSH_APPLY", geos: geosInRect(placed, rect) })` 後清掉 drag state；`placed` 是渲染泡泡時同步收集的 `PlacedBubble[]`（geo、cx、cy）。矩形寬高 < 3（viewBox 單位）視為誤觸不動作。
- overlay 在泡泡**下層**渲染（泡泡 raise 之上——JSX 順序 overlay 在前、泡泡在後），單擊泡泡加入才不會被 overlay 吃掉；從空白處起拖才框選（比照鄉鎮版 `dots.raise()`）。
- pointerdown 要 `svg.setPointerCapture(ev.pointerId)`，拖出圖外仍能收到 pointerup。

**`ChannelControls.tsx`（新元件，放泡泡圖卡頂部）：**

```tsx
import { useAppState } from "../state/AppStateContext";
import { METRICS, type MetricKey, type ColorKey } from "../lib/channels";

const METRIC_KEYS = Object.keys(METRICS) as MetricKey[];

function ChannelSelect({ label, value, options, disabledKey, onChange }: {
  label: string;
  value: string;
  options: { key: string; label: string }[];
  disabledKey?: string; // X=Y 防呆:對向軸目前指標 disabled(灰項),搭配 patchChannels 對調雙保險
  onChange: (key: string) => void;
}) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
      <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ fontSize: 12, border: "1px solid var(--color-border)", borderRadius: 6, padding: "2px 4px" }}>
        {options.map((o) => (
          <option key={o.key} value={o.key} disabled={o.key === disabledKey}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function ChannelControls() {
  const { state, dispatch } = useAppState();
  const ch = state.channels;
  const metricOptions = METRIC_KEYS.map((k) => ({ key: k, label: METRICS[k].label }));
  const colorOptions = [{ key: "region", label: "區域(洲別)" }, ...metricOptions];
  const hasSel = state.focusSelection.size > 0;
  const btn = (active: boolean): React.CSSProperties => ({
    fontSize: 12, padding: "3px 10px", borderRadius: 999,
    border: `1px solid ${active ? "var(--accent)" : "var(--color-border)"}`,
    background: active ? "var(--accent)" : "var(--color-surface)",
    color: active ? "#fff" : "var(--color-text)", cursor: "pointer",
  });
  return (
    <div className="flex flex-wrap items-center gap-3 shrink-0 px-3 pt-2">
      <ChannelSelect label="X 軸" value={ch.x} options={metricOptions} disabledKey={ch.y}
        onChange={(k) => dispatch({ type: "SET_CHANNELS", patch: { x: k as MetricKey } })} />
      <ChannelSelect label="Y 軸" value={ch.y} options={metricOptions} disabledKey={ch.x}
        onChange={(k) => dispatch({ type: "SET_CHANNELS", patch: { y: k as MetricKey } })} />
      <ChannelSelect label="顏色" value={ch.color} options={colorOptions}
        onChange={(k) => dispatch({ type: "SET_CHANNELS", patch: { color: k as ColorKey } })} />
      <ChannelSelect label="大小" value={ch.size} options={metricOptions}
        onChange={(k) => dispatch({ type: "SET_CHANNELS", patch: { size: k as MetricKey } })} />
      <div className="flex-1" />
      <button className="scatter-select-toggle" aria-pressed={state.focusMode === "select"}
        style={btn(state.focusMode === "select")}
        onClick={() => dispatch({ type: "SET_FOCUS_MODE", mode: "select" })}>選取</button>
      <button className="sel-clear scatter-select-toggle" aria-pressed={state.focusMode === "clear"}
        disabled={!hasSel} style={{ ...btn(state.focusMode === "clear"), opacity: hasSel ? 1 : 0.4 }}
        onClick={() => dispatch({ type: "SET_FOCUS_MODE", mode: "clear" })}>清除</button>
      {/* 7/31 使用者要求:不設「清空」鈕;清除靠「清除」模式框選與雙擊 */}
    </div>
  );
}
```

- [ ] **Step 1: 實作框選 overlay 與 ChannelControls**
- [ ] **Step 2: 手動驗證（dev server + Playwright）**

情境：按「選取」→ 拖曳框選 → 泡泡描邊/其餘灰化；按「清除」→ 框掉一批；下拉換 X 軸 → 軸與泡泡位置變、Y 下拉中該項 disabled。
Expected: 全部符合。

- [ ] **Step 3: `npm run typecheck && npx vitest run` 全綠後 Commit**

```bash
git add src/components/BubbleChart.tsx src/components/ChannelControls.tsx
git commit -m "feat: 框選累加/累減互動與四通道下拉+選取/清除/清空控制列"
```

---

### Task 7: 圖例（大小同心圓＋連續色條）

**Files:**
- Create: `src/components/ScatterLegends.tsx`
- Modify: `src/components/BubbleChart.tsx`（右上角掛圖例）

**Interfaces:**
- Consumes: `METRICS`、`sizeTicks`、`makeRadiusScale`、`makeColorNormalizer`、`rampColor`、`TEAL_RAMP`、`state.channels`。
- Produces: `<ScatterLegends />`（無 props）。色條容器 class `.color-bar`（verify 腳本靠它）。

**實作：**

```tsx
import { useAppState } from "../state/AppStateContext";
import {
  METRICS, sizeTicks, makeRadiusScale, TEAL_RAMP, type MetricKey,
} from "../lib/channels";

// 泡泡圖右上角圖例(spec §5):大小=嵌套同心圓;顏色連續=色階色條(min/max 標籤);
// 顏色=區域時洲別點列由既有版面呈現,這裡不重複。
export function ScatterLegends() {
  const { state } = useAppState();
  const sizeMetric = METRICS[state.channels.size];
  const ticks = sizeTicks(sizeMetric.domain);
  const rScale = makeRadiusScale(state.channels.size, [3, 40]);
  const biggest = ticks[ticks.length - 1];
  const rMax = rScale(biggest);
  const colorIsMetric = state.channels.color !== "region";
  const colorMetric = colorIsMetric ? METRICS[state.channels.color as MetricKey] : null;

  return (
    <div className="absolute top-2 right-2 flex items-start gap-3"
      style={{ fontSize: 11, color: "var(--color-text-muted)", pointerEvents: "none" }}>
      {colorMetric && (
        <div className="color-bar flex items-center gap-1">
          <span>{colorMetric.format(colorMetric.domain[0])}</span>
          <div style={{
            width: 72, height: 8, borderRadius: 4,
            background: `linear-gradient(to right, ${TEAL_RAMP.join(",")})`,
          }} />
          <span>{colorMetric.format(colorMetric.domain[1])}</span>
          <span style={{ marginLeft: 2 }}>{colorMetric.label}</span>
        </div>
      )}
      {/* 嵌套同心圓:底對齊,大圓在外。同一把 rScale,值一定落在 domain 內(sizeTicks 保證) */}
      <svg width={rMax * 2 + 4} height={rMax * 2 + 14} aria-label="大小圖例">
        {ticks.slice().reverse().map((v) => {
          const r = rScale(v);
          return (
            <g key={v}>
              <circle cx={rMax + 2} cy={rMax * 2 + 2 - r} r={r}
                fill="none" stroke="var(--color-text-muted)" strokeWidth={1} />
              <text x={rMax + 2} y={rMax * 2 - 2 * r} textAnchor="middle" fontSize={9}
                fill="var(--color-text-muted)">{sizeMetric.format(v)}</text>
            </g>
          );
        })}
        <text x={rMax + 2} y={rMax * 2 + 12} textAnchor="middle" fontSize={9}
          fill="var(--color-text-muted)">{sizeMetric.label}</text>
      </svg>
    </div>
  );
}
```

BubbleChart 的外層容器（App.tsx 中泡泡圖卡）需要 `position: relative` 才能絕對定位——掛載留到 Task 9 版面整合一起做，本 Task 先完成元件本身。

- [ ] **Step 1: 實作 ScatterLegends.tsx**
- [ ] **Step 2: `npm run typecheck` 綠後 Commit**

```bash
git add src/components/ScatterLegends.tsx
git commit -m "feat: 大小同心圓圖例與連續色階色條元件"
```

---

### Task 8: 地球儀雙向連動

**Files:**
- Modify: `src/lib/globePoints.ts`
- Modify: `src/lib/globePoints.test.ts`
- Modify: `src/components/WorldGlobe.tsx`

**Interfaces:**
- Consumes: `state.focusSelection`、action `FOCUS_TOGGLE`。
- Produces: `buildGlobePoints(countries, selected, hovered, focus: Set<string>): GlobePoint[]`（**簽名加第 4 參數**，呼叫處只有 WorldGlobe 一處）。

- [ ] **Step 1: 寫失敗測試（globePoints.test.ts 追加）**

```ts
test("有 focus 選取:未選國家灰化縮小,選中維持原色放大", () => {
  const countries = [
    { geo: "twn", name: "Taiwan", region: "asia", latitude: 23, longitude: 121, iso2: "TW" },
    { geo: "fra", name: "France", region: "europe", latitude: 46, longitude: 2, iso2: "FR" },
  ];
  const pts = buildGlobePoints(countries, new Set(["twn", "fra"]), null, new Set(["twn"]));
  const twn = pts.find((p) => p.geo === "twn")!;
  const fra = pts.find((p) => p.geo === "fra")!;
  expect(twn.radius).toBeGreaterThan(fra.radius);
  expect(fra.color).toBe("#CBD5E1"); // 灰化
  expect(twn.color).not.toBe("#CBD5E1");
});

test("無 focus 選取:行為與原本相同(全部原色)", () => {
  const countries = [
    { geo: "twn", name: "Taiwan", region: "asia", latitude: 23, longitude: 121, iso2: "TW" },
  ];
  const pts = buildGlobePoints(countries, new Set(["twn"]), null, new Set());
  expect(pts[0].color).not.toBe("#CBD5E1");
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/globePoints.test.ts`
Expected: FAIL —— 參數數量不符/斷言失敗

- [ ] **Step 3: 實作**

`globePoints.ts`：

```ts
export function buildGlobePoints(
  countries: CountryMeta[],
  selected: Set<string>,
  hovered: string | null,
  focus: Set<string>
): GlobePoint[] {
  const hasFocus = focus.size > 0;
  return countries
    .filter((c) => selected.has(c.geo))
    .map((c) => {
      const isFocused = focus.has(c.geo);
      const dimmed = hasFocus && !isFocused;
      return {
        geo: c.geo,
        name: c.name,
        lat: c.latitude,
        lng: c.longitude,
        color: dimmed ? "#CBD5E1" : colorForRegion(c.region),
        radius: c.geo === hovered ? 0.7 : isFocused ? 0.55 : dimmed ? 0.25 : 0.35,
      };
    });
}
```

`WorldGlobe.tsx`：初始化鏈加 `.onPointClick((point: { geo: string } | null) => { if (point) dispatch({ type: "FOCUS_TOGGLE", geo: point.geo }); })`；資料更新 effect 改
`buildGlobePoints(countries, state.selectedCountries, state.hoveredCountry, state.focusSelection)` 並把 `state.focusSelection` 加進依賴陣列。
（懸停雙向已存在：泡泡 hover 與地球儀 `onPointHover` 都走 `SET_HOVERED`，radius 0.7 分支即地球儀端的預覽放大。）

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run`
Expected: 全綠

- [ ] **Step 5: Commit**

```bash
git add src/lib/globePoints.ts src/lib/globePoints.test.ts src/components/WorldGlobe.tsx
git commit -m "feat: 地球儀雙向連動(focus 高亮/灰化+點擊 toggle)"
```

---

### Task 9: 排名卡四通道連動＋版面整合

**Files:**
- Modify: `src/lib/racingBars.ts`（`RacingMetric` 改 alias `MetricKey`、`formatRacingValue` 補兩指標）
- Modify: `src/lib/racingBars.test.ts`（補新指標排序/格式測試）
- Modify: `src/components/RacingBarChart.tsx`（不動邏輯，僅型別跟著 alias）
- Modify: `src/App.tsx`（控制列/caption/圖例掛載、排名卡改四張連動、grid-cols-4）

**Interfaces:**
- Consumes: `state.channels`、`METRICS`、`buildScatterCaption`、`buildFocusCaption`、`<ChannelControls />`、`<ScatterLegends />`。
- Produces: 完整版面。排名卡標題格式：`{METRICS[key].label}({單位簡寫省略}) · 全球前5`——直接用 `` `${METRICS[key].label} · 全球前5` ``。

- [ ] **Step 1: racingBars 失敗測試（追加）**

```ts
test("getTopN 支援新指標 childMortality(值最高前 N)", () => {
  const countries = [
    { geo: "a", name: "A", region: "asia", latitude: 0, longitude: 0, iso2: "AA" },
    { geo: "b", name: "B", region: "asia", latitude: 0, longitude: 0, iso2: "BB" },
  ];
  const records = [
    { geo: "a", year: 2000, childMortality: 100 },
    { geo: "b", year: 2000, childMortality: 300 },
  ];
  const top = getTopN(countries as any, records as any, 2000, "childMortality", 5);
  expect(top[0].geo).toBe("b");
});

test("formatRacingValue:childMortality 整數、fertility 兩位小數", () => {
  expect(formatRacingValue("childMortality", 123.4)).toBe("123");
  expect(formatRacingValue("fertility", 3.456)).toBe("3.46");
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/racingBars.test.ts`
Expected: FAIL

- [ ] **Step 3: 實作 racingBars 修改**

```ts
import type { MetricKey } from "./channels";
export type RacingMetric = MetricKey; // 五指標全開;getTopN 的 record[metric] 索引不用改

export function formatRacingValue(metric: RacingMetric, value: number): string {
  if (metric === "lifeExpectancy") return value.toFixed(1);
  if (metric === "childMortality") return value.toFixed(0);
  if (metric === "fertility") return value.toFixed(2);
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toFixed(0);
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run`
Expected: 全綠

- [ ] **Step 5: App.tsx 版面整合**

泡泡圖卡改為：

```tsx
<div className="flex-1 min-h-0 flex flex-col relative" style={panelCardStyle}>
  <ChannelControls />
  <div className="flex-1 min-h-0 relative">
    <BubbleChart countries={countries} records={records} />
    <ScatterLegends />
  </div>
  <ScatterCaptionBlock />  {/* 見下 */}
</div>
```

caption 區塊（App.tsx 內小元件，需在 `AppStateProvider` 之內讀 context）：

```tsx
function ScatterCaptionBlock() {
  const { state } = useAppState();
  return (
    <div className="shrink-0 px-3 pb-2" style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
      <div>{buildScatterCaption(state.channels)}</div>
      <div>{buildFocusCaption(state.focusSelection.size)}</div>
    </div>
  );
}
```

排名卡區改四張連動（也是 context 內的小元件 `RankRow`）：

```tsx
function RankRow({ countries, records }: { countries: CountryMeta[]; records: YearRecord[] }) {
  const { state } = useAppState();
  const ch = state.channels;
  const card = (key: MetricKey, prefix: string) => (
    <RacingBarChart title={`${prefix}(${METRICS[key].label}) · 全球前5`}
      countries={countries} records={records} metric={key} />
  );
  return (
    <div className="grid grid-cols-4 gap-2 bg-gray-50/50 rounded-lg p-2 h-full">
      {card(ch.x, "X軸")}
      {card(ch.y, "Y軸")}
      {ch.color === "region" ? (
        <div className="bg-white rounded-lg shadow-sm p-2 h-full flex flex-col">
          <h3 className="text-sm font-bold mb-1 truncate shrink-0" style={{ color: "#374151" }}>顏色(區域)</h3>
          <div className="flex-1 flex items-center justify-center text-xs"
            style={{ color: "var(--color-text-muted)" }}>顏色通道=區域,無排名數值</div>
        </div>
      ) : card(ch.color as MetricKey, "顏色")}
      {card(ch.size, "大小")}
    </div>
  );
}
```

（`App()` 內原本 `<div className="grid grid-cols-3 ...">` 整塊換成 `<RankRow countries={countries} records={records} />`；因要讀 context，`RankRow`/`ScatterCaptionBlock` 必須是 `AppStateProvider` 的子元件。）

- [ ] **Step 6: 驗證版面**

Run: `npm run typecheck && npx vitest run`，dev server 以 1536×781 截圖。
Expected: 單螢幕無捲軸；四張排名卡塞得下（不行就把 h-48 調到 h-44 並縮 ROW_HEIGHT——記錄實際採用值）。

- [ ] **Step 7: Commit**

```bash
git add src/lib/racingBars.ts src/lib/racingBars.test.ts src/components/RacingBarChart.tsx src/App.tsx
git commit -m "feat: 排名卡改四通道連動,整合控制列/圖例/caption 版面"
```

---

### Task 10: verify 腳本（Playwright 實跑七情境）

**Files:**
- Create: `scripts/verify-scatter-parity.mjs`
- Modify: `package.json`（scripts 加 `"verify:scatter": "node scripts/verify-scatter-parity.mjs"`）

**Interfaces:**
- Consumes: dev server（腳本自行 spawn `npm run dev`）；DOM 選擇器：`.scatter-select-toggle`、`.sel-clear`、`.bubble-dot`、`[data-geo]`、`.color-bar`、`.brush-rect`、四個 `<select>`（依 label 順序 X/Y/顏色/大小）。（無 `.sel-reset`——「清空」鈕已依使用者要求移除。）
- Produces: exit 0=全過；每情境印 `PASS/FAIL 情境名`。

**七情境（spec 測試節）：**

1. **換通道**：X 軸下拉改「兒童死亡率」→ X 軸標籤文字含「兒童死亡率」；Y 軸下拉中「兒童死亡率」變 disabled。
2. **X=Y 防呆**：把 X 改成目前 Y 的指標（透過 select option 檢查 disabled——UI 層擋掉即 PASS）。
3. **框選累加**：點「選取」→ 在 svg 中央拖 200×150px → `.bubble-dot[stroke]` 描邊數 > 0，且灰化泡泡（fill=#CBD5E1）存在；caption 出現「已選」。
4. **雙擊剔除**：記 caption 的 N → 對一顆已選泡泡 dblclick → N 減 1。
5. **色條**：顏色下拉改「總生育率」→ `.color-bar` 出現；改回「區域(洲別)」→ 消失。
6. **播放中選取保留**：有選取時按「播放」→ 等 1.5 秒 → caption 仍含「已選」且年份前進。
7. **單螢幕回歸**：viewport 1536×781，`document.documentElement.scrollHeight <= innerHeight + 1`。

**骨架（完整寫出、可直接執行）：**

```js
import { chromium } from "playwright";
import { spawn } from "node:child_process";

const results = [];
function check(name, ok, detail = "") {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const dev = spawn("npm", ["run", "dev"], { shell: true, stdio: "pipe" });
const url = await new Promise((resolveUrl, reject) => {
  const timer = setTimeout(() => reject(new Error("dev server 30s 未就緒")), 30000);
  dev.stdout.on("data", (buf) => {
    const m = String(buf).match(/Local:\s+(http:\/\/localhost:\d+\/)/);
    if (m) { clearTimeout(timer); resolveUrl(m[1]); }
  });
});

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1536, height: 781 } });
await page.goto(url);
await page.waitForSelector(".bubble-dot");

// 1+2. 換通道與 X=Y 防呆
const xSelect = page.locator("select").nth(0);
const ySelect = page.locator("select").nth(1);
await xSelect.selectOption({ label: "兒童死亡率" });
const xAxisLabel = await page.locator("svg text").filter({ hasText: "兒童死亡率" }).count();
check("換通道:X 軸標籤跟著切", xAxisLabel > 0);
const disabledInY = await ySelect.locator("option[disabled]").allTextContents();
check("X=Y 防呆:Y 下拉 disable 目前 X", disabledInY.some((t) => t.includes("兒童死亡率")));
await xSelect.selectOption({ label: "平均餘命" }); // 還原

// 3. 框選累加
await page.locator(".scatter-select-toggle").first().click();
const svg = page.locator("svg[aria-label='Gapminder 泡泡圖']");
const box = await svg.boundingBox();
await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.75, { steps: 8 });
await page.mouse.up();
const strokes = await page.locator(".bubble-dot[stroke='#0F172A']").count();
check("框選累加:選中泡泡描邊", strokes > 0, `${strokes} 顆`);
const dimmed = await page.locator(".bubble-dot[fill='#CBD5E1']").count();
check("框選累加:未選灰化", dimmed > 0, `${dimmed} 顆`);
const capText = await page.locator("text=/已選 \\d+ 國/").textContent().catch(() => null);
check("caption 顯示已選數量", capText !== null, capText ?? "");

// 4. 雙擊剔除
const nBefore = Number((capText ?? "").match(/已選 (\d+) 國/)?.[1] ?? 0);
await page.locator(".bubble-dot[stroke='#0F172A']").first().dblclick({ force: true });
await page.waitForTimeout(300);
const capAfter = await page.locator("text=/已選 \\d+ 國|按「選取」/").first().textContent();
const nAfter = Number(capAfter.match(/已選 (\d+) 國/)?.[1] ?? 0);
check("雙擊剔除:數量減 1", nAfter === nBefore - 1, `${nBefore} → ${nAfter}`);

// 5. 色條
const colorSelect = page.locator("select").nth(2);
await colorSelect.selectOption({ label: "總生育率" });
check("顏色連續:色條出現", (await page.locator(".color-bar").count()) > 0);
await colorSelect.selectOption({ label: "區域(洲別)" });
check("顏色=區域:色條消失", (await page.locator(".color-bar").count()) === 0);

// 6. 播放中選取保留
await page.locator("button", { hasText: "播放" }).click();
await page.waitForTimeout(1500);
const stillSelected = await page.locator("text=/已選 \\d+ 國/").count();
check("播放中選取保留", stillSelected > 0);
await page.locator("button", { hasText: "暫停" }).click().catch(() => {});

// 7. 單螢幕回歸
const noScroll = await page.evaluate(
  () => document.documentElement.scrollHeight <= window.innerHeight + 1
);
check("1536×781 無頁面捲軸", noScroll);

await browser.close();
dev.kill("SIGTERM");
process.exit(results.every(Boolean) ? 0 : 1);
```

（註：播放鈕文案以實際 `TimeControls` 為準——寫腳本前先開檔確認按鈕文字與暫停態文案，對不上就改腳本選擇器，**不改 app 文案遷就腳本**。地球儀點擊 toggle 不進 Playwright——WebGL headless 命中 3D 點位不可靠，由 Task 8 單元測試＋完成後人工實測覆蓋，此限制記在 PR/進度回報。）

- [ ] **Step 1: 寫腳本並跑到全 PASS**

Run: `npm run verify:scatter`
Expected: 7 情境全 PASS、exit 0。有 FAIL 就修 app（或修腳本的錯誤預期），不放行。

- [ ] **Step 2: Commit**

```bash
git add scripts/verify-scatter-parity.mjs package.json
git commit -m "test: 散布圖功能對齊 verify 腳本(七情境 Playwright 實跑)"
```

---

### Task 11: 全綠門檻與收尾

**Files:**
- Modify: `README.md`（功能清單補新互動與兩個新指標、資料來源補 fasttrack）

- [ ] **Step 1: 四道門檻依序全跑**

```bash
npm run typecheck
npm test
npm run build
npm run verify:scatter
```

Expected: 全綠。任何一道紅就回對應 Task 修，不得跳過。

- [ ] **Step 2: 人工實測地球儀連動**

dev server 開起來，實際點地球儀國家點 → 泡泡圖描邊出現/消失；框選後地球儀灰化。截圖存證。

- [ ] **Step 3: README 更新後 Commit**

```bash
git add README.md
git commit -m "docs: README 補散布圖四通道/框選/地球儀連動與 fasttrack 資料來源"
```

---

## Self-Review 紀錄

- **Spec 覆蓋**：§1 ETL→Task 1；§2 通道→Task 2、5、6；§3 選取→Task 3、5、6；§4 地球儀→Task 8；§5 圖例→Task 7；§6 caption→Task 4、9；§7 排名卡→Task 9；版面→Task 9；測試驗證→各 Task TDD＋Task 10、11。無缺口。
- **型別一致性**：`MetricKey`/`ColorKey`/`ScatterChannels` 全部源自 Task 2；`geosInRect`/`PlacedBubble` 源自 Task 3；`buildGlobePoints` 四參數簽名 Task 8 定義且唯一呼叫處同步改；`RacingMetric = MetricKey` alias 讓 RacingBarChart 免改邏輯。
- **佔位符掃描**：無 TBD/TODO；Task 5/6 為整檔重寫型任務，以「要點＋關鍵程式碼」而非全文給出，重寫者需保留既有中文註解風格。
