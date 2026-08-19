# 地球儀顏色通道 + 播放平滑化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 地球儀 choropleth 跟隨散布圖「顏色」通道上色;播放改 rAF 小數年份+資料內插,泡泡連續平滑移動。

**Architecture:** 新增純函式層(`advancePlayback`、`interpolateRecords`、`makeGlobeFill`)全部 TDD;元件端先讓所有年份消費者支援小數年(整數年行為不變),最後一步才把 setInterval 換成 rAF——每個 commit 都保持 app 可用。

**Tech Stack:** React 18 + TypeScript + vitest + d3(scale/interpolate) + globe.gl。

## Global Constraints

- 回覆/註解用繁體中文;commit 訊息不加 Claude co-author(使用者慣例)。
- 播放總時長不變:每秒 2.5 年(=原本 400ms/年)。
- 內插不捏造資料:任一側缺值 → 該指標 null。
- 整數年行為完全不變(滑桿/輸入框/浮水印仍是整數)。
- spec:`docs/superpowers/specs/2026-08-07-teacher-feedback-globe-color-smooth-playback-design.md`

---

### Task 1: advancePlayback 純函式

**Files:**
- Modify: `src/lib/playback.ts`
- Test: `src/lib/playback.test.ts`

**Interfaces:**
- Produces: `YEARS_PER_SEC = 2.5`、`advancePlayback(current: number, dtSec: number, yearsPerSec: number): { year: number; done: boolean }`(Task 5 的 rAF 迴圈使用)

- [ ] **Step 1: 寫失敗測試**(附加到 `playback.test.ts`)

```ts
describe("advancePlayback", () => {
  it("依 dt×速度推進小數年份", () =>
    expect(advancePlayback(2000, 0.4, 2.5)).toEqual({ year: 2001, done: false }));
  it("半格 dt 推進半年", () =>
    expect(advancePlayback(2000, 0.2, 2.5)).toEqual({ year: 2000.5, done: false }));
  it("到 YEAR_MAX 夾住並回報 done", () =>
    expect(advancePlayback(YEAR_MAX - 0.1, 1, 2.5)).toEqual({ year: YEAR_MAX, done: true }));
  it("dt=0 原地不動", () =>
    expect(advancePlayback(2000, 0, 2.5)).toEqual({ year: 2000, done: false }));
});
```

(import 行補上 `advancePlayback`)

- [ ] **Step 2: 跑測試確認失敗** — `npx vitest run src/lib/playback.test.ts`,預期 FAIL(advancePlayback 未定義)

- [ ] **Step 3: 實作**(附加到 `playback.ts`)

```ts
// 8/7 老師回饋:播放改 rAF 連續推進小數年份(取代 setInterval 每 400ms 跳一整年)。
// 速度維持原本觀感:400ms/年 = 每秒 2.5 年,總時長不變。
export const YEARS_PER_SEC = 2.5;

export function advancePlayback(
  current: number,
  dtSec: number,
  yearsPerSec: number
): { year: number; done: boolean } {
  const next = current + dtSec * yearsPerSec;
  if (next >= YEAR_MAX) return { year: YEAR_MAX, done: true };
  return { year: next, done: false };
}
```

- [ ] **Step 4: 跑測試確認通過** — `npx vitest run src/lib/playback.test.ts`,預期 PASS
- [ ] **Step 5: Commit** — `git add src/lib/playback.ts src/lib/playback.test.ts && git commit -m "feat: advancePlayback 純函式(rAF 播放的年份推進核心)"`

---

### Task 2: interpolateRecords 內插層

**Files:**
- Create: `src/lib/interpolateRecords.ts`
- Test: `src/lib/interpolateRecords.test.ts`

**Interfaces:**
- Consumes: `YearRecord`(`src/data/types.ts`)
- Produces: `YearIndex = Map<string, Map<number, YearRecord>>`、`buildYearIndex(records: YearRecord[]): YearIndex`(WeakMap 快取)、`interpolateRecord(index: YearIndex, geo: string, year: number): YearRecord | null`(Task 3/7 使用)

- [ ] **Step 1: 寫失敗測試**(`src/lib/interpolateRecords.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { buildYearIndex, interpolateRecord } from "./interpolateRecords";
import type { YearRecord } from "../data/types";

const rec = (year: number, over: Partial<YearRecord> = {}): YearRecord => ({
  geo: "twn", year,
  income: 1000, lifeExpectancy: 70, population: 20_000_000,
  incomeIsProjection: false, lifeExpectancyIsProjection: false, populationIsProjection: false,
  childMortality: 10, fertility: 2,
  ...over,
});

describe("buildYearIndex", () => {
  it("同一份 records 陣列回傳同一個快取 index", () => {
    const records = [rec(2000)];
    expect(buildYearIndex(records)).toBe(buildYearIndex(records));
  });
});

describe("interpolateRecord", () => {
  const records = [
    rec(2000),
    rec(2001, { income: 2000, lifeExpectancy: 80, population: 22_000_000, childMortality: 20, fertility: 4, incomeIsProjection: true }),
  ];
  const index = buildYearIndex(records);

  it("整數年直接回原始紀錄(不複製)", () =>
    expect(interpolateRecord(index, "twn", 2000)).toBe(records[0]));
  it("小數年逐指標線性內插,year 帶小數", () => {
    const r = interpolateRecord(index, "twn", 2000.5)!;
    expect(r.year).toBe(2000.5);
    expect(r.income).toBe(1500);
    expect(r.lifeExpectancy).toBe(75);
    expect(r.population).toBe(21_000_000);
    expect(r.childMortality).toBe(15);
    expect(r.fertility).toBe(3);
  });
  it("推估值旗標取 floor 年", () =>
    expect(interpolateRecord(index, "twn", 2000.5)!.incomeIsProjection).toBe(false));
  it("任一側缺值 → 該指標 null(其他指標照插)", () => {
    const idx = buildYearIndex([rec(2000, { income: null }), rec(2001, { income: 2000 })]);
    const r = interpolateRecord(idx, "twn", 2000.5)!;
    expect(r.income).toBeNull();
    expect(r.lifeExpectancy).toBe(70);
  });
  it("下一年紀錄不存在 → 退回 floor 年紀錄", () =>
    expect(interpolateRecord(index, "twn", 2001.5)).toBe(records[1]));
  it("查無國家 → null", () =>
    expect(interpolateRecord(index, "xxx", 2000)).toBeNull());
});
```

- [ ] **Step 2: 跑測試確認失敗** — `npx vitest run src/lib/interpolateRecords.test.ts`,預期 FAIL(模組不存在)

- [ ] **Step 3: 實作**(`src/lib/interpolateRecords.ts`)

```ts
import type { YearRecord } from "../data/types";

// 8/7 老師回饋「播放要更連續平滑」:播放改小數年份(如 1987.4)後,資料層對前後兩個
// 整數年逐指標線性內插——泡泡沿資料路徑連續移動,而不是一年一跳(Gapminder 官方做法)。
export type YearIndex = Map<string, Map<number, YearRecord>>;

// records 是模組層級常數(App.tsx 載入一次),WeakMap 以陣列 reference 當 key 快取,
// 多個元件(散布圖/地球儀)各自呼叫也只建一次索引。
const indexCache = new WeakMap<YearRecord[], YearIndex>();

export function buildYearIndex(records: YearRecord[]): YearIndex {
  const cached = indexCache.get(records);
  if (cached) return cached;
  const index: YearIndex = new Map();
  for (const r of records) {
    let byYear = index.get(r.geo);
    if (!byYear) {
      byYear = new Map();
      index.set(r.geo, byYear);
    }
    byYear.set(r.year, r);
  }
  indexCache.set(records, index);
  return index;
}

const METRIC_FIELDS = ["income", "lifeExpectancy", "population", "childMortality", "fertility"] as const;

// 整數年 → 原始紀錄(zero-cost fast path,未播放時行為與改版前完全相同)。
// 小數年 → 前後兩年逐指標內插;任一側缺值該指標給 null(不捏造資料,呼叫端照
// 現行規則隱藏該泡泡);推估值旗標取 floor 年(spread 自然帶入)。
// 下一年紀錄不存在(資料尾端)→ 退回 floor 年紀錄。
export function interpolateRecord(index: YearIndex, geo: string, year: number): YearRecord | null {
  const byYear = index.get(geo);
  if (!byYear) return null;
  const y0 = Math.floor(year);
  const base = byYear.get(y0) ?? null;
  if (year === y0 || !base) return base;
  const next = byYear.get(y0 + 1);
  if (!next) return base;
  const frac = year - y0;
  const out: YearRecord = { ...base, year };
  for (const f of METRIC_FIELDS) {
    const a = base[f];
    const b = next[f];
    out[f] = a === null || b === null ? null : a + (b - a) * frac;
  }
  return out;
}
```

- [ ] **Step 4: 跑測試確認通過** — `npx vitest run src/lib/interpolateRecords.test.ts`,預期 PASS
- [ ] **Step 5: Commit** — `git add src/lib/interpolateRecords.ts src/lib/interpolateRecords.test.ts && git commit -m "feat: 年份內插層(buildYearIndex/interpolateRecord,WeakMap 快取)"`

---

### Task 3: BubbleChart 改吃內插紀錄

**Files:**
- Modify: `src/components/BubbleChart.tsx:100-106`(yearRecordByGeo memo)、`:481`(浮水印)、`:568`(tooltip 年份)

**Interfaces:**
- Consumes: `buildYearIndex`/`interpolateRecord`(Task 2)

- [ ] **Step 1: 替換 yearRecordByGeo memo**(整數年時 `interpolateRecord` 回原始紀錄,行為不變;原版每次年份變動都掃全部 ~19,695 筆 records,新版只查選取國家,播放 60fps 時更省)

```tsx
import { buildYearIndex, interpolateRecord } from "../lib/interpolateRecords";
```

```tsx
  // 8/7 平滑播放:年份可能是小數(rAF 播放中),改查內插層——整數年 fast path 回原始
  // 紀錄(行為與改版前相同),小數年逐指標線性內插。只查勾選中的國家,不再每次掃全表。
  const yearIndex = useMemo(() => buildYearIndex(records), [records]);
  const yearRecordByGeo = useMemo(() => {
    const map = new Map<string, YearRecord>();
    for (const geo of state.selectedCountries) {
      const r = interpolateRecord(yearIndex, geo, state.currentYear);
      if (r) map.set(geo, r);
    }
    return map;
  }, [yearIndex, state.selectedCountries, state.currentYear]);
```

- [ ] **Step 2: 浮水印與 tooltip 顯示整數年** — `:481` `{state.currentYear}` → `{Math.floor(state.currentYear)}`;`:568` tooltip `（${record.year}）` → `（${Math.floor(record.year)}）`
- [ ] **Step 3: 驗證** — `npx vitest run && npx tsc --noEmit`,預期全綠(整數年行為不變,既有測試就是回歸網)
- [ ] **Step 4: Commit** — `git add src/components/BubbleChart.tsx && git commit -m "refactor: 散布圖改查年份內插層(整數年行為不變)"`

---

### Task 4: 其餘年份消費者的整數顯示防護

**Files:**
- Modify: `src/components/RacingBarChart.tsx:30`、`src/components/TimeControls.tsx:59,68,74`、`src/components/CountryChecklist.tsx:28,33`

**Interfaces:** 無新介面;全部是 `Math.floor` 防護(整數年時 no-op)

- [ ] **Step 1: RacingBarChart** — `:30` `getTopN(countries, records, state.currentYear, metric, TOP_N)` → `getTopN(countries, records, Math.floor(state.currentYear), metric, TOP_N)`(排名卡維持逐年跳,不在平滑化範圍——records 只有整數年,小數年查表會空)
- [ ] **Step 2: TimeControls** — `:59` slider `value={state.currentYear}` → `value={Math.floor(state.currentYear)}`;`:68` progress 變數與 `:74` 年份數字同樣包 `Math.floor(...)`(slider step=1 吃不了小數,年份顯示維持整數慣例)
- [ ] **Step 3: CountryChecklist** — `:28`/`:33` `String(state.currentYear)` → `String(Math.floor(state.currentYear))`(播放中同步顯示整數,不出現 1987.43…)
- [ ] **Step 4: 驗證** — `npx vitest run && npx tsc --noEmit`,預期全綠
- [ ] **Step 5: Commit** — `git add src/components/RacingBarChart.tsx src/components/TimeControls.tsx src/components/CountryChecklist.tsx && git commit -m "refactor: 年份顯示端統一 Math.floor 防護(為小數年份播放鋪路)"`

---

### Task 5: 播放迴圈改 rAF

**Files:**
- Modify: `src/state/AppStateContext.tsx:22-33`

**Interfaces:**
- Consumes: `advancePlayback`/`YEARS_PER_SEC`(Task 1)

- [ ] **Step 1: 替換 setInterval effect**(import 行 `nextYear` 換成 `advancePlayback, YEARS_PER_SEC`;`useRef` 加進 react import)

```tsx
  // 8/7 老師回饋「播放要更連續平滑」:setInterval 每 400ms 跳一整年 → rAF 每幀推進
  // 小數年份(每秒 2.5 年,總時長不變),散布圖吃內插紀錄連續移動。
  // yearRef 鏡射最新年份:effect 依賴只掛 isPlaying(不隨年份重啟),幀迴圈從 ref 讀
  // 當前年份、用真實幀間隔 dt 推進——不受 React render 耗時影響播放速度。
  const yearRef = useRef(state.currentYear);
  yearRef.current = state.currentYear;
  useEffect(() => {
    if (!state.isPlaying) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const { year, done } = advancePlayback(yearRef.current, dt, YEARS_PER_SEC);
      dispatch({ type: "SET_YEAR", year });
      if (done) {
        dispatch({ type: "STOP_PLAYING" });
      } else {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state.isPlaying]);
```

- [ ] **Step 2: 驗證** — `npx vitest run && npx tsc --noEmit` 全綠;`npm run dev` 起 dev server,瀏覽器按播放:泡泡連續滑動、年份數字/浮水印整數推進、到 2050 自動停、拖滑桿仍正常
- [ ] **Step 3: Commit** — `git add src/state/AppStateContext.tsx && git commit -m "feat: 播放改 rAF 連續小數年份(每秒 2.5 年),泡泡沿內插路徑平滑移動"`

---

### Task 6: makeGlobeFill 填色工廠

**Files:**
- Modify: `src/lib/globePoints.ts`
- Test: `src/lib/globePoints.test.ts`

**Interfaces:**
- Consumes: `makeColorNormalizer`/`rampColor`/`TEAL_RAMP`/`TEAL_RAMP_DARK`/`ColorKey`(channels.ts)、`colorForRegion`(regionColors.ts)
- Produces: `makeGlobeFill(colorKey: ColorKey, dark: boolean): (region: Region, value: number | null, isFocused: boolean, hasFocus: boolean) => string`(Task 7 使用)

- [ ] **Step 1: 寫失敗測試**(附加到 `globePoints.test.ts`;import 補 `makeGlobeFill`、`DECORATIVE_COLOR`,以及 `channels` 的 `makeColorNormalizer, rampColor, TEAL_RAMP, TEAL_RAMP_DARK` 與 `regionColors` 的 `colorForRegion`)

```ts
describe("makeGlobeFill", () => {
  it("region 模式=現行洲別色,value 不參與", () => {
    const fill = makeGlobeFill("region", false);
    expect(fill("asia", null, false, false)).toBe(colorForRegion("asia", false));
  });
  it("指標模式=散布圖同一套色階(normalize+ramp 組合)", () => {
    const fill = makeGlobeFill("lifeExpectancy", false);
    const expected = rampColor(TEAL_RAMP)(makeColorNormalizer("lifeExpectancy")(70));
    expect(fill("asia", 70, false, false)).toBe(expected);
  });
  it("深色模式用深色 ramp", () => {
    const fill = makeGlobeFill("lifeExpectancy", true);
    const expected = rampColor(TEAL_RAMP_DARK)(makeColorNormalizer("lifeExpectancy")(70));
    expect(fill("asia", 70, false, false)).toBe(expected);
  });
  it("指標模式缺值 → 無資料灰(與裝飾地形同色)", () => {
    const fill = makeGlobeFill("income", false);
    expect(fill("asia", null, false, false)).toBe(DECORATIVE_COLOR);
  });
  it("focus 灰化優先於一切(指標模式也一樣)", () => {
    const fill = makeGlobeFill("income", false);
    expect(fill("asia", 1000, false, true)).toBe("#CBD5E1");
  });
});
```

- [ ] **Step 2: 跑測試確認失敗** — `npx vitest run src/lib/globePoints.test.ts`,預期 FAIL(makeGlobeFill 未定義)

- [ ] **Step 3: 實作**(附加到 `globePoints.ts`;import 補 channels 的四個符號與 ColorKey 型別)

```ts
import { makeColorNormalizer, rampColor, TEAL_RAMP, TEAL_RAMP_DARK, type ColorKey } from "./channels";
```

```ts
// 8/7 老師回饋:choropleth 顏色只能呈現洲別,要能跟散布圖「顏色」通道一樣呈現
// 人均所得/平均餘命等指標。工廠函式:region 模式包裝現行 capColorFor(行為不變);
// 指標模式用散布圖同一套 normalize+青綠 ramp(深淺各自 ramp),缺值國家塗
// DECORATIVE_COLOR(語意=「這裡沒有資料」,與南極洲等裝飾地形一致)。
// focus 灰化在兩種模式都優先——選取聚焦時未選國一律淡出,與現行行為相同。
export function makeGlobeFill(
  colorKey: ColorKey,
  dark: boolean
): (region: Region, value: number | null, isFocused: boolean, hasFocus: boolean) => string {
  if (colorKey === "region") {
    return (region, _value, isFocused, hasFocus) => capColorFor(region, isFocused, hasFocus, dark);
  }
  const normalize = makeColorNormalizer(colorKey);
  const ramp = rampColor(dark ? TEAL_RAMP_DARK : TEAL_RAMP);
  return (_region, value, isFocused, hasFocus) => {
    if (hasFocus && !isFocused) return dark ? DIMMED_COLOR_DARK : DIMMED_COLOR;
    if (value === null) return DECORATIVE_COLOR;
    return ramp(normalize(value));
  };
}
```

- [ ] **Step 4: 跑測試確認通過** — `npx vitest run src/lib/globePoints.test.ts`,預期 PASS
- [ ] **Step 5: Commit** — `git add src/lib/globePoints.ts src/lib/globePoints.test.ts && git commit -m "feat: makeGlobeFill 填色工廠(地球儀跟隨顏色通道,指標模式用散布圖同套色階)"`

---

### Task 7: WorldGlobe 接上顏色通道 + hover 顯示值

**Files:**
- Modify: `src/components/WorldGlobe.tsx`(props、色值 map、accessor effect)、`src/App.tsx:219`

**Interfaces:**
- Consumes: `makeGlobeFill`(Task 6)、`buildYearIndex`/`interpolateRecord`(Task 2)、`metricLabel`/`METRICS`/`MetricKey`(channels.ts)

- [ ] **Step 1: App.tsx 傳 records** — `:219` `<WorldGlobe countries={countries} />` → `<WorldGlobe countries={countries} records={records} />`

- [ ] **Step 2: WorldGlobe props 與色值 map**(import 補 `buildYearIndex, interpolateRecord`、`makeGlobeFill`、channels 的 `metricLabel, METRICS, type MetricKey`、`useLanguage` 已有)

```tsx
export function WorldGlobe({ countries, records }: { countries: CountryMeta[]; records: YearRecord[] }) {
```

(型別 import 補 `YearRecord`)。元件內、第二個 useEffect 之前加:

```tsx
  // 8/7 老師回饋:choropleth 跟隨散布圖「顏色」通道。指標模式時算出每國「當年值」
  // (吃內插層——播放中顏色跟著小數年份連續變化);region 模式回 null,accessor 走
  // 現行洲別色路徑。查表以 boundary 資料實際有的國家為準(countries 全 195 國)。
  const yearIndex = useMemo(() => buildYearIndex(records), [records]);
  const colorValueByGeo = useMemo(() => {
    if (state.channels.color === "region") return null;
    const key = state.channels.color as MetricKey;
    const map = new Map<string, number | null>();
    for (const c of countries) {
      const r = interpolateRecord(yearIndex, c.geo, state.currentYear);
      map.set(c.geo, r ? r[key] : null);
    }
    return map;
  }, [state.channels.color, yearIndex, countries, state.currentYear]);
```

- [ ] **Step 3: accessor effect 接 makeGlobeFill 與 hover 值**——`:166-201` 的 effect 裡,`polygonCapColor` 換成:

```tsx
      .polygonCapColor((d: PolygonItem) =>
        isCountry(d)
          ? fill(d.region, colorValueByGeo?.get(d.geo) ?? null, state.focusSelection.has(d.geo), hasFocus)
          : DECORATIVE_COLOR
      )
```

effect 開頭(`const hasFocus = ...` 之後)加:

```tsx
    const fill = makeGlobeFill(state.channels.color, dark);
    // 指標模式 hover 標籤加一行當年值(choropleth 沒有數字可讀,hover 是唯一讀值入口);
    // 缺值國家顯示「—」。
    const colorKey = state.channels.color;
    const valueLine = (geo: string): string => {
      if (colorKey === "region" || !colorValueByGeo) return "";
      const v = colorValueByGeo.get(geo) ?? null;
      const text = v === null ? "—" : METRICS[colorKey as MetricKey].format(v);
      return `<div style="font-size:13px;opacity:.85">${metricLabel(colorKey as MetricKey, lang)}: ${text}</div>`;
    };
```

`polygonLabel` 的國家分支(兩個 lang 分支)各在收尾 `</div>` 前併入 `${valueLine(d.geo)}`:

```tsx
      .polygonLabel((d: PolygonItem) =>
        isCountry(d)
          ? lang === "zh"
            ? `<div style="text-align:center"><div style="font-size:15px;font-weight:600">${d.nameZh}</div>` +
              `<div style="font-size:15px;opacity:.8">(${d.nameEn})</div>${valueLine(d.geo)}</div>`
            : `<div style="text-align:center"><div style="font-size:15px;font-weight:600">${d.nameEn}</div>${valueLine(d.geo)}</div>`
          : lang === "zh"
            ? `<div style="text-align:center"><div style="font-size:14px;font-weight:600;opacity:.85">${d.nameZh}</div>` +
              `<div style="font-size:13px;opacity:.7">(${d.name})</div></div>`
            : `<div style="text-align:center;font-size:14px;font-weight:600;opacity:.85">${d.name}</div>`
      );
```

(注意英文國家分支從單行 div 改成外層置中容器包兩個 div。)effect 依賴陣列補 `state.channels.color, colorValueByGeo`:

```tsx
  }, [state.hoveredCountry, state.focusSelection, dark, lang, state.channels.color, colorValueByGeo]);
```

- [ ] **Step 4: 驗證** — `npx vitest run && npx tsc --noEmit` 全綠;dev server 手動確認:顏色通道切「平均餘命」→ 地球儀變青綠色階、hover 非洲某國看到數值行、切回「區域」→ 洲別色如舊、播放中地球儀顏色連續變化
- [ ] **Step 5: Commit** — `git add src/components/WorldGlobe.tsx src/App.tsx && git commit -m "feat: 地球儀 choropleth 跟隨顏色通道(指標色階/缺值灰/hover 顯示當年值)"`

---

### Task 8: 全套驗證 + 部署

**Files:** 無(驗證與部署)

- [ ] **Step 1: 全套驗證** — `npx vitest run`(預期 144+新增全綠)、`npx tsc --noEmit`、`npm run build` 全過
- [ ] **Step 2: Playwright 實測**(dev server 或 preview):
  - 顏色通道切「人均所得」→ 截圖:地球儀呈青綠色階、富國深綠/窮國淺綠、缺值灰
  - 深色模式同場景 → 截圖:深色 ramp
  - 按播放,間隔 ~0.3s 截兩張 → 對比泡泡位置有中間態(不是整年跳)
  - 播放到底自動停、拖滑桿/輸入年份行為不變
- [ ] **Step 3: Push** — `git push`(Vercel 自動部署)
- [ ] **Step 4: 正式站真瀏覽器實測**(記取 7/23 教訓:不用 curl 輪詢,用 Playwright 開正式站)確認兩個新行為都上線
