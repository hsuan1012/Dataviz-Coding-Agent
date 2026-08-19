# 關係頁 linked brushing ＋ 全域年份播放 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 年份列加 ▶ 自動輪播；散布圖加 d3.brush 框選鎖定鄉鎮名單，關係頁嵌迷你台灣地圖同步高亮。

**Architecture:** 播放＝純函式 reducer（`lib/playback.ts`）＋ YearTabs 內部計時器，到點呼叫既有 `onYear`，動畫全吃現成補間。框選＝純函式集合計算（`lib/brushSelect.ts`）＋ App 層 `selected` 狀態（鎖名單非鎖區域），Scatter 泡泡降透明度、新元件 MiniMap 沿用主地圖投影/金馬 inset 邏輯高亮。

**Tech Stack:** React 18 + TypeScript + d3 v7（brush/geo）+ vitest + Playwright（既有 verify-*.mjs 模式）。

**Spec:** `docs/superpowers/specs/2026-07-21-scatter-brush-play-design.md`

## Global Constraints

- 只在本地分支 `scatter-brush-play` commit，**絕不 `git push`**。
- commit 訊息比照現有風格（繁中、無 Co-Authored-By）。
- 播放間隔 **1.2 秒**；末年自動停、不循環；播放中手動點年份＝暫停。
- 框選語意＝**鎖定鄉鎮名單**（`Set` of 鄉鎮名）；切年份／切通道不清除；清除＝點「清除」鈕或框選空集合。
- 迷你地圖純顯示：不可點擊、不可下鑽。
- 不做軌跡線（trail）。
- 每個 task 結束時 `npx tsc --noEmit` 0 錯、`npm test`（vitest）全綠。
- dev server：`npm run dev`（Playwright 腳本連 `http://localhost:5173`）。

## File Structure

- Create: `src/lib/playback.ts` ＋ `src/lib/playback.test.ts` — 播放 reducer（純函式）
- Create: `src/lib/brushSelect.ts` ＋ `src/lib/brushSelect.test.ts` — 框內鄉鎮集合（純函式）
- Create: `src/charts/MiniMap.tsx` — 迷你台灣地圖（純 JSX path，無內部狀態）
- Modify: `src/components/YearTabs.tsx` — ▶ 鈕＋計時器
- Modify: `src/lib/data.test.ts` — 鄉鎮名對齊測試（scatterPoints ↔ geo FULLNAME）
- Modify: `src/designs/ShellProps.ts`、`src/App.tsx` — `selected` 狀態與回呼
- Modify: `src/charts/Scatter.tsx` — brush、降透明度、嵌 MiniMap
- Modify: `src/designs/directionA/Shell.tsx`、`src/designs/taste/Shell.tsx` — 傳 geo/selected 進 Scatter
- Create: `scripts/verify-brush-play.mjs` — Playwright 驗證新情境

---

### Task 1: 播放 reducer ＋ YearTabs ▶ 鈕

**Files:**
- Create: `src/lib/playback.ts`
- Test: `src/lib/playback.test.ts`
- Modify: `src/components/YearTabs.tsx`

**Interfaces:**
- Consumes: 無（純新增）。
- Produces: `nextYear(years: number[], year: number): number | null`（null＝末年，該停）；`playStartYear(years: number[], year: number): number`（末年按播放→回首年）。YearTabs props **不變**（`{ years, year, onYear }`），播放狀態內聚在元件裡。

- [ ] **Step 1: 寫失敗測試**

```ts
// src/lib/playback.test.ts
import { describe, it, expect } from "vitest";
import { nextYear, playStartYear } from "./playback";

const YEARS = [102, 103, 104, 105, 106, 107];

describe("nextYear", () => {
  it("中段年份前進一年", () => expect(nextYear(YEARS, 103)).toBe(104));
  it("末年回 null(該停)", () => expect(nextYear(YEARS, 107)).toBeNull());
  it("年份不在清單→退回首年(防禦:108 隱藏後殘留)", () => expect(nextYear(YEARS, 108)).toBe(102));
  it("空清單回 null", () => expect(nextYear([], 107)).toBeNull());
});

describe("playStartYear", () => {
  it("末年按播放→從首年重播", () => expect(playStartYear(YEARS, 107)).toBe(102));
  it("中段按播放→原年起播", () => expect(playStartYear(YEARS, 104)).toBe(104));
  it("空清單回原年", () => expect(playStartYear([], 107)).toBe(107));
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/playback.test.ts`
Expected: FAIL（`Cannot find module './playback'`）

- [ ] **Step 3: 最小實作**

```ts
// src/lib/playback.ts
// 年份播放 reducer(Gapminder 慣例):末年自動停、不循環;末年按播放=從頭重播。
// 純函式,計時器生命週期由 YearTabs 管。
export function nextYear(years: number[], year: number): number | null {
  if (!years.length) return null;
  const i = years.indexOf(year);
  if (i < 0) return years[0]; // 防禦:當前年不在清單(如隱藏年殘留)→回首年
  return i >= years.length - 1 ? null : years[i + 1];
}

export function playStartYear(years: number[], year: number): number {
  if (!years.length) return year;
  return year === years[years.length - 1] ? years[0] : year;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/playback.test.ts`
Expected: 7 passed

- [ ] **Step 5: YearTabs 加 ▶ 鈕與計時器**

改 `src/components/YearTabs.tsx` 全檔如下（props 不變；▶ 鈕在年份列最前）：

```tsx
import { useEffect, useState } from "react";
import { useTokens } from "../lib/useTokens";
import { nextYear, playStartYear } from "../lib/playback";

const PLAY_MS = 1200; // 每年停留 1.2s(spec)

// 年份標籤列：一排可點的「民國102…107」標籤＋ ▶ 自動輪播（Gapminder 式）。
// 播放用 setTimeout 而非 setInterval：每次年份變更重排下一拍，
// year 一定是最新值、且任何暫停路徑都由 cleanup 清掉計時器。
export default function YearTabs({ years, year, onYear }: {
  years: number[]; year: number; onYear: (y: number) => void;
}) {
  const t = useTokens();
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => {
      const ny = nextYear(years, year);
      if (ny === null) setPlaying(false); // 末年:自動停
      else onYear(ny);
    }, PLAY_MS);
    return () => window.clearTimeout(id);
  }, [playing, year, years, onYear]);

  const toggle = () => {
    if (playing) { setPlaying(false); return; }
    const start = playStartYear(years, year);
    if (start !== year) onYear(start); // 末年按播放→跳回首年起播
    setPlaying(true);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, margin: "10px 0 2px" }}>
      <span style={{ fontSize: 11.5, color: t.textMuted, letterSpacing: "0.04em" }}>選擇年度（民國）</span>
      <div role="tablist" aria-label="年度" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 6 }}>
        <button className="year-play" aria-label={playing ? "暫停" : "播放"} aria-pressed={playing}
          onClick={toggle}
          style={{
            cursor: "pointer", fontSize: 13, padding: "6px 12px", borderRadius: 999,
            border: `1px solid ${playing ? t.accent : t.border}`,
            background: playing ? t.accent : t.surface,
            color: playing ? t.accentFg : t.text,
            transition: "background .15s, border-color .15s, color .15s",
          }}>
          {playing ? "⏸" : "▶"}
        </button>
        {years.map((y) => {
          const on = y === year;
          return (
            <button key={y} role="tab" aria-selected={on} className="year-tab"
              onClick={() => { setPlaying(false); onYear(y); }} // 手動點年份=暫停(spec)
              style={{
                cursor: "pointer", fontSize: 13, fontVariantNumeric: "tabular-nums",
                padding: "6px 14px", borderRadius: 999,
                border: `1px solid ${on ? t.accent : t.border}`,
                background: on ? t.accent : t.surface,
                color: on ? t.accentFg : t.text,
                fontWeight: on ? 700 : 500,
                transition: "background .15s, border-color .15s, color .15s",
              }}>
              {y} 年
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: 全套檢查**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc 0 錯；vitest 全綠（既有 56＋新增 7）

- [ ] **Step 7: Commit**

```bash
git add src/lib/playback.ts src/lib/playback.test.ts src/components/YearTabs.tsx
git commit -m "年份列加▶自動輪播:1.2s/年、末年自動停、手動點年份即暫停"
```

---

### Task 2: 框選集合純函式

**Files:**
- Create: `src/lib/brushSelect.ts`
- Test: `src/lib/brushSelect.test.ts`

**Interfaces:**
- Consumes: 無。
- Produces: `interface PlacedPoint { township: string; cx: number; cy: number }`；`townsInRect(pts: PlacedPoint[], rect: [[number, number], [number, number]]): string[]`（rect＝d3.brush 的 `[[x0,y0],[x1,y1]]` 像素座標，邊界含端點）。

- [ ] **Step 1: 寫失敗測試**

```ts
// src/lib/brushSelect.test.ts
import { describe, it, expect } from "vitest";
import { townsInRect, type PlacedPoint } from "./brushSelect";

const PTS: PlacedPoint[] = [
  { township: "甲鎮", cx: 10, cy: 10 },
  { township: "乙鎮", cx: 50, cy: 50 },
  { township: "丙鎮", cx: 100, cy: 100 },
];

describe("townsInRect", () => {
  it("框內鄉鎮入選、框外排除", () =>
    expect(townsInRect(PTS, [[0, 0], [60, 60]])).toEqual(["甲鎮", "乙鎮"]));
  it("邊界點(等於框緣)入選", () =>
    expect(townsInRect(PTS, [[10, 10], [50, 50]])).toEqual(["甲鎮", "乙鎮"]));
  it("空框回空陣列", () =>
    expect(townsInRect(PTS, [[200, 200], [300, 300]])).toEqual([]));
  it("無點回空陣列", () =>
    expect(townsInRect([], [[0, 0], [999, 999]])).toEqual([]));
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/brushSelect.test.ts`
Expected: FAIL（`Cannot find module './brushSelect'`）

- [ ] **Step 3: 最小實作**

```ts
// src/lib/brushSelect.ts
// 框選集合:像素矩形內的鄉鎮名單(邊界含端點)。純函式,座標換算由 Scatter 做。
export interface PlacedPoint { township: string; cx: number; cy: number }

export function townsInRect(
  pts: PlacedPoint[],
  rect: [[number, number], [number, number]],
): string[] {
  const [[x0, y0], [x1, y1]] = rect;
  return pts
    .filter((p) => p.cx >= x0 && p.cx <= x1 && p.cy >= y0 && p.cy <= y1)
    .map((p) => p.township);
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/brushSelect.test.ts`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/brushSelect.ts src/lib/brushSelect.test.ts
git commit -m "框選集合純函式 townsInRect:像素矩形內鄉鎮名單(TDD)"
```

---

### Task 3: 選取狀態上提 App ＋ Scatter 加 brush 與降透明度

**Files:**
- Modify: `src/designs/ShellProps.ts`
- Modify: `src/App.tsx`
- Modify: `src/charts/Scatter.tsx`
- Modify: `src/designs/directionA/Shell.tsx`（Scatter 呼叫處，約 line 65）
- Modify: `src/designs/taste/Shell.tsx`（Scatter 呼叫處，約 line 104）
- Test: `src/lib/data.test.ts`（追加名稱對齊測試）

**Interfaces:**
- Consumes: Task 2 的 `townsInRect`。
- Produces: `ShellProps` 新增 `selected: string[] | null`（鄉鎮名陣列，null＝無選取）與 `onSelect: (s: string[] | null) => void`；`Scatter` props 新增 `geo: GeoJSON.FeatureCollection; selected: string[] | null; onSelect: (s: string[] | null) => void`（Task 4 的 MiniMap 也吃同一組）。

- [ ] **Step 1: 追加名稱對齊失敗測試（守住 選名單↔地圖高亮 的鍵）**

散布圖點的 `township` 名稱必須能對上 geo 的 `FULLNAME`，MiniMap 才高亮得起來。
在 `src/lib/data.test.ts` **檔尾**追加（沿用該檔既有的資料載入方式；若該檔已有讀
`public/data/values.json`／`public/taiwan_townships.geojson` 的 helper 就直接用）：

```ts
// —— 框選連動前置:散布圖鄉鎮名 ⊆ 地圖 FULLNAME(名對不上=迷你地圖亮不了) ——
import { readFileSync } from "node:fs";
import { scatterPoints } from "./data";

it("scatterPoints 鄉鎮名全部對得上 geo FULLNAME", () => {
  const values = JSON.parse(readFileSync("public/data/values.json", "utf8"));
  const meta = JSON.parse(readFileSync("public/data/meta.json", "utf8"));
  const geo = JSON.parse(readFileSync("public/taiwan_townships.geojson", "utf8"));
  const names = new Set(geo.features.map((f: any) => f.properties.FULLNAME));
  const latest = Math.max(...meta.years);
  const missing = scatterPoints(values, meta, latest)
    .map((p) => p.township).filter((n) => !names.has(n));
  expect(missing).toEqual([]);
});
```

※ 若 `public/data/` 下檔名不同（先 `ls public/data` 確認），改成實際檔名；
meta/values 的實際載入形狀以 `src/lib/data.ts` 的 `loadAll` 為準。

- [ ] **Step 2: 跑測試（此測應直接綠——它是保護網不是新功能；若紅，STOP 並回報，代表要改用 TOWNNAME 對齊，需人工決策）**

Run: `npx vitest run src/lib/data.test.ts`
Expected: PASS

- [ ] **Step 3: ShellProps ＋ App 加 selected 狀態**

`src/designs/ShellProps.ts`：在介面中（`scatter: ScatterChannels;` 附近）加兩行：

```ts
  selected: string[] | null;                     // 關係頁框選鎖定的鄉鎮名單(null=無)
  onSelect: (s: string[] | null) => void;
```

`src/App.tsx`：

```tsx
// state 區(scatter 狀態下一行)加:
const [selected, setSelected] = useState<string[] | null>(null); // 框選鎖定名單:切年/切通道不清(spec)

// shellProps 物件內加:
selected, onSelect: setSelected,
```

- [ ] **Step 4: Scatter 加 brush、降透明度**

`src/charts/Scatter.tsx` 修改四處：

(a) import 區加：

```tsx
import { townsInRect } from "../lib/brushSelect";
```

(b) props 簽名改為（`geo` 本 task 先收下、Task 4 給 MiniMap 用）：

```tsx
export default function Scatter({ values, meta, year, channels, onChannel, geo, selected, onSelect }: {
  values: Values; meta: Meta; year: number;
  channels: ScatterChannels; onChannel: (patch: Partial<ScatterChannels>) => void;
  geo: GeoJSON.FeatureCollection;
  selected: string[] | null; onSelect: (s: string[] | null) => void;
}) {
```

(c) 泡泡 effect（`// 泡泡:以鄉鎮名為 key...` 那段）：

- effect 開頭加 `const selSet = selected ? new Set(selected) : null;`
- enter 分支的 `.attr("fill-opacity", 0.7)` 保留不動（進場動畫起點）
- 最後的 transition 鏈加一行透明度（名單外調暗；對分類色/連續色階皆適用）：

```tsx
    sel.transition().duration(dur).ease(d3.easeCubicInOut)
      .attr("fill", (p) => fill(p))
      .attr("fill-opacity", (p) => (!selSet || selSet.has(p.township) ? 0.7 : 0.12))
      .attr("cx", (p) => x(p[xKey])).attr("cy", (p) => y(p[yKey])).attr("r", (p) => r(p[sizeKey]));
```

- 依賴陣列補 `selected`。

(d) 泡泡 effect 之後**新增一個 brush effect**：

```tsx
  // 框選(d3.brush):放開瞬間鎖定鄉鎮名單(鎖名單非鎖區域,spec)。
  // 名單存 App → 切年/切通道不清。選完即清掉框(名單已鎖定,殘框會誤導「鎖區域」)。
  // dots.raise() 把泡泡抬到 brush overlay 之上:tooltip 保留,從空白處起拖才框選。
  useEffect(() => {
    const svg = d3.select(ref.current);
    let bg = svg.select<SVGGElement>("g.brush");
    if (bg.empty()) bg = svg.append("g").attr("class", "brush");
    const brush = d3.brush()
      .extent([[M.l, M.t], [W - M.r, H - M.b]])
      .on("end", (ev) => {
        if (!ev.sourceEvent) return; // 程式化 brush.move(null) 不回圈
        if (!ev.selection) { onSelect(null); return; } // 點空白處=清除(spec)
        const pts = scatterPoints(values, meta, year)
          .map((p) => ({ township: p.township, cx: x(p[xKey]), cy: y(p[yKey]) }));
        const names = townsInRect(pts, ev.selection as [[number, number], [number, number]]);
        onSelect(names.length ? names : null); // 框空集合=清除(spec)
        bg.call(brush.move as any, null);
      });
    bg.call(brush as any);
    svg.select<SVGGElement>("g.dots").raise();
    return () => { bg.on(".brush", null); };
  }, [values, meta, year, x, y, xKey, yKey, onSelect]);
```

- [ ] **Step 5: 兩個外殼把新 props 傳進 Scatter**

`src/designs/directionA/Shell.tsx` 與 `src/designs/taste/Shell.tsx`：

- 解構參數各加 `selected, onSelect`（跟 `scatter, onScatterChannel` 放一起）。
- `<Scatter values={data.values} meta={data.meta} year={year} ...>` 呼叫處各加：

```tsx
  geo={data.geo} selected={selected} onSelect={onSelect}
```

- [ ] **Step 6: 全套檢查＋手動煙霧**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 錯、全綠

手動：`npm run dev` → 關係頁空白處拖一個框 → 框外泡泡變淡、框消失；切年份/切 X 下拉 → 淡的還是同一群；點空白處 → 全還原。

- [ ] **Step 7: Commit**

```bash
git add src/designs/ShellProps.ts src/App.tsx src/charts/Scatter.tsx src/designs/directionA/Shell.tsx src/designs/taste/Shell.tsx src/lib/data.test.ts
git commit -m "散布圖 d3.brush 框選鎖定鄉鎮名單:框外降透明度、切年切通道不清、空框即清除"
```

---

### Task 4: MiniMap 迷你台灣地圖

**Files:**
- Create: `src/charts/MiniMap.tsx`
- Modify: `src/charts/Scatter.tsx`（嵌進版面）

**Interfaces:**
- Consumes: `lib/counties.ts` 的 `splitFeatures/inTaiwanBox/insetFitFeatures`、`lib/insetBoxes.js` 的 `INSET_BOXES`、Task 3 的 `selected/onSelect`。
- Produces: `MiniMap({ geo, selected, onClear })` 元件；DOM 掛勾（Playwright 用）：`svg.mini-map`、`path.mini-town`（高亮者 `data-sel="1"`）、`.mini-count`（文字「已選 N 鄉鎮」）、`button.mini-clear`。

- [ ] **Step 1: 寫 MiniMap 元件**

```tsx
// src/charts/MiniMap.tsx
import { useMemo } from "react";
import * as d3 from "d3";
import { useTokens } from "../lib/useTokens";
import { splitFeatures, inTaiwanBox, insetFitFeatures } from "../lib/counties";
import { INSET_BOXES } from "../lib/insetBoxes.js";

// 迷你台灣地圖(關係頁框選連動):沿用主地圖同一套 viewBox 800×900 座標與
// 金馬 inset 邏輯(splitFeatures/INSET_BOXES),縮到 width=200 顯示。
// 純顯示:不可點、不可下鑽(spec/YAGNI)。名單內=主題強調色,其餘淺灰。
const W = 800, H = 900;

export default function MiniMap({ geo, selected, onClear }: {
  geo: GeoJSON.FeatureCollection;
  selected: string[] | null;
  onClear: () => void;
}) {
  const t = useTokens();
  const selSet = useMemo(() => (selected ? new Set(selected) : null), [selected]);
  const { main, insets } = useMemo(() => splitFeatures(geo.features), [geo]);
  const mainPath = useMemo(() => {
    const proj = d3.geoMercator().fitSize([W, H],
      { type: "FeatureCollection", features: main.filter(inTaiwanBox) } as any);
    return d3.geoPath(proj);
  }, [main]);
  const insetPaths = useMemo(() => insets.map((ins, i) => {
    const B = INSET_BOXES[i];
    const proj = d3.geoMercator().fitExtent(
      [[B.x + 10, B.y + 24], [B.x + B.w - 10, B.y + B.h - 10]],
      { type: "FeatureCollection", features: insetFitFeatures(geo.features, ins.county) } as any);
    return { ins, B, path: d3.geoPath(proj) };
  }), [insets, geo]);

  const name = (f: GeoJSON.Feature) => (f.properties as any).FULLNAME as string;
  const isSel = (f: GeoJSON.Feature) => selSet?.has(name(f)) ?? false;
  const fillOf = (f: GeoJSON.Feature) => (isSel(f) ? t.accent : t.border);
  const town = (f: GeoJSON.Feature, d: string | null) => (
    <path key={name(f)} className="mini-town" data-sel={isSel(f) ? "1" : "0"}
      d={d ?? ""} fill={fillOf(f)} stroke={t.surface} strokeWidth={0.4} />
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: "0 0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: t.textMuted }}>
        <span className="mini-count">已選 {selected?.length ?? 0} 鄉鎮</span>
        {selected && (
          <button className="mini-clear" onClick={onClear}
            style={{ cursor: "pointer", fontSize: 11.5, padding: "2px 10px", borderRadius: 999,
              border: `1px solid ${t.border}`, background: t.surface, color: t.text }}>
            清除
          </button>
        )}
      </div>
      <svg className="mini-map" viewBox={`0 0 ${W} ${H}`} width={200} aria-label="框選鄉鎮位置" role="img">
        {main.map((f) => town(f, mainPath(f as any)))}
        {insetPaths.map(({ ins, B, path }) => (
          <g key={ins.county}>
            <rect x={B.x} y={B.y} width={B.w} height={B.h} fill="none"
              stroke={t.border} strokeDasharray="4 3" rx={6} />
            {ins.features.map((f) => town(f, path(f as any)))}
          </g>
        ))}
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: 嵌進 Scatter 版面**

`src/charts/Scatter.tsx`：

(a) import 加 `import MiniMap from "./MiniMap";`

(b) 主 svg 那行（`<svg ref={ref} width="100%" style={{ maxHeight: "56vh" }} />`）
改成散布圖＋迷你地圖並排（窄幕 wrap 到下方）：

```tsx
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <svg ref={ref} width="100%" style={{ maxHeight: "56vh", flex: "1 1 480px", minWidth: 0 }} />
        <MiniMap geo={geo} selected={selected} onClear={() => onSelect(null)} />
      </div>
```

- [ ] **Step 3: 全套檢查＋手動煙霧**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 錯、全綠

手動：關係頁框選一群 → 迷你地圖對應鄉鎮變強調色、「已選 N 鄉鎮」數字合理、
金馬 inset 框有畫出來；點「清除」→ 全還原、清除鈕消失。

- [ ] **Step 4: Commit**

```bash
git add src/charts/MiniMap.tsx src/charts/Scatter.tsx
git commit -m "關係頁嵌迷你台灣地圖:框選名單同步高亮(沿用主圖投影+金馬inset)、已選N+清除鈕"
```

---

### Task 5: Playwright 驗證＋全套回歸

**Files:**
- Create: `scripts/verify-brush-play.mjs`

**Interfaces:**
- Consumes: Task 1 的 `.year-play`／`aria-pressed`、Task 4 的 `svg.mini-map`／`path.mini-town[data-sel]`／`.mini-count`／`button.mini-clear`、既有 `.view-toggle`／`select.scatter-ch`／`.year-tab`。
- Produces: 驗證腳本＋截圖（`docs/superpowers/artifacts/brush-*.png`、`play-*.png`）。

- [ ] **Step 1: 寫驗證腳本**

```js
// scripts/verify-brush-play.mjs
// 播放+框選連動驗證:▶末年重播/自動前進/點年份暫停;框選→迷你地圖高亮、
// 切年/切通道名單不變、清除還原。需先 npm run dev(localhost:5173)。
import { chromium } from "playwright";
const fail = (m) => { console.error("FAIL: " + m); process.exitCode = 1; };
const ok = (m) => console.log("PASS: " + m);
const OUT = "C:/Users/user/jayla/township-drilldown-app/docs/superpowers/artifacts";

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await p.goto("http://localhost:5173");
await p.waitForFunction(() => document.querySelectorAll("svg path").length >= 20, null, { timeout: 30000 });

const curYear = () => p.locator('.year-tab[aria-selected="true"]').textContent();

// ---- 播放 ----
if ((await p.locator(".year-play").count()) === 1) ok("▶ 播放鈕存在"); else fail("找不到 .year-play");

// 預設=最新年(末年)→按▶應跳回首年起播
await p.locator(".year-play").click();
await p.waitForTimeout(200);
let y = await curYear();
if (y?.includes("102")) ok("末年按▶ → 跳回首年 102 起播"); else fail("未回首年: " + y);
if ((await p.locator(".year-play").getAttribute("aria-pressed")) === "true") ok("播放中 aria-pressed=true"); else fail("aria-pressed 異常");

await p.waitForTimeout(1400); // 1.2s/年 → 應已前進一年
y = await curYear();
if (y?.includes("103")) ok("1.2s 後自動前進到 103"); else fail("未自動前進: " + y);
await p.screenshot({ path: `${OUT}/play-playing.png` });

// 播放中手動點年份=暫停
await p.locator(".year-tab", { hasText: "106" }).click();
await p.waitForTimeout(200);
if ((await p.locator(".year-play").getAttribute("aria-pressed")) === "false") ok("點年份 → 暫停"); else fail("點年份未暫停");
y = await curYear();
if (y?.includes("106")) ok("暫停後停在點選的 106"); else fail("年份異常: " + y);

// 末年自動停:從 106 播到 107 後應自己停(≤2 拍)
await p.locator(".year-play").click();
await p.waitForTimeout(3000);
if ((await p.locator(".year-play").getAttribute("aria-pressed")) === "false") ok("播到末年自動停"); else fail("末年未自動停");
y = await curYear();
if (y?.includes("107")) ok("停在末年 107"); else fail("末年異常: " + y);

// ---- 框選連動 ----
await p.locator(".view-toggle", { hasText: "關係" }).click();
await p.waitForTimeout(800);
if ((await p.locator("svg.mini-map").count()) === 1) ok("迷你地圖存在"); else fail("找不到 svg.mini-map");

// 在散布圖中央區域拖一個框(svg viewBox 760×520,取畫面座標比例換算)
const box = await p.locator("svg.mini-map").evaluate((el) =>
  el.closest("div")?.parentElement?.querySelector("svg[width='100%']")?.getBoundingClientRect().toJSON());
if (!box) { fail("找不到散布圖 svg"); process.exit(1); }
const px = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];
const [x0, y0] = px(0.25, 0.25), [x1, y1] = px(0.7, 0.7);
await p.mouse.move(x0, y0); await p.mouse.down();
await p.mouse.move(x1, y1, { steps: 8 }); await p.mouse.up();
await p.waitForTimeout(900);

const countText = await p.locator(".mini-count").textContent();
const n = Number(countText?.match(/\d+/)?.[0] ?? 0);
if (n > 0) ok(`框選鎖定 ${n} 鄉鎮`); else fail("框選後名單為 0: " + countText);
const hi = await p.locator('path.mini-town[data-sel="1"]').count();
if (hi === n) ok(`迷你地圖高亮數 ${hi} = 已選 N`); else fail(`高亮 ${hi} ≠ 已選 ${n}`);
const dim = await p.evaluate(() =>
  Array.from(document.querySelectorAll("svg g.dots circle"))
    .filter((c) => Number(c.getAttribute("fill-opacity")) < 0.2).length);
if (dim > 0) ok(`名單外泡泡已調暗(${dim} 顆)`); else fail("無泡泡被調暗");
await p.screenshot({ path: `${OUT}/brush-selected.png` });

// 切年份 → 名單不變(鎖名單非鎖區域)
await p.locator(".year-tab", { hasText: "103" }).click();
await p.waitForTimeout(900);
let n2 = Number((await p.locator(".mini-count").textContent())?.match(/\d+/)?.[0] ?? -1);
if (n2 === n) ok("切年份 → 名單不變"); else fail(`切年後 ${n2} ≠ ${n}`);

// 切通道 → 名單不變
await p.locator('select.scatter-ch[data-ch="x"]').selectOption({ label: "醫院醫事人力" });
await p.waitForTimeout(900);
n2 = Number((await p.locator(".mini-count").textContent())?.match(/\d+/)?.[0] ?? -1);
if (n2 === n) ok("切 X 通道 → 名單不變"); else fail(`切通道後 ${n2} ≠ ${n}`);
await p.screenshot({ path: `${OUT}/brush-channel-kept.png` });

// 清除 → 還原
await p.locator("button.mini-clear").click();
await p.waitForTimeout(900);
if ((await p.locator("button.mini-clear").count()) === 0) ok("清除鈕按後消失"); else fail("清除鈕未消失");
const dim2 = await p.evaluate(() =>
  Array.from(document.querySelectorAll("svg g.dots circle"))
    .filter((c) => Number(c.getAttribute("fill-opacity")) < 0.2).length);
if (dim2 === 0) ok("清除後泡泡全還原"); else fail(`仍有 ${dim2} 顆調暗`);
if ((await p.locator('path.mini-town[data-sel="1"]').count()) === 0) ok("迷你地圖高亮清空"); else fail("高亮未清");
await p.screenshot({ path: `${OUT}/brush-cleared.png` });

if (errors.length) fail("console/page 錯誤: " + errors.join(" | ")); else ok("無 console/page 錯誤");
await b.close();
```

- [ ] **Step 2: 跑新腳本**

Run: `npm run dev`（背景）後 `node scripts/verify-brush-play.mjs`
Expected: 全 PASS、exit code 0；不過就修（腳本座標換算或 DOM 掛勾對不上時，以實際 DOM 為準修腳本；功能行為錯就修功能）

- [ ] **Step 3: 既有四支 Playwright 回歸**

Run: `node scripts/verify-scatter.mjs && node scripts/verify-designs.mjs && node scripts/verify-drilldown.mjs && node scripts/verify-taiwanvotes.mjs`
Expected: 全 PASS（特別注意 verify-scatter 的 hover/tooltip 檢查——brush overlay 加入後靠 `dots.raise()` 保住 hover，此處若 FAIL 即回 Task 3 調整）

- [ ] **Step 4: production build**

Run: `npm run build`
Expected: build 成功 0 錯

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-brush-play.mjs docs/superpowers/artifacts
git commit -m "Playwright 驗證:播放(末年重播/自動前進/點年暫停/末年停)+框選連動(高亮/名單鎖定/清除)"
```

---

## Self-Review 紀錄

- Spec 覆蓋：播放（▶ 位置/1.2s/末年停/重播/點年暫停）→ Task 1；框選鎖名單/降透明度/空框清除 → Task 3；迷你地圖（inset/已選 N/清除/不可點）→ Task 4；五層驗證 → 各 task 的 tsc+vitest ＋ Task 5（互動層/視覺層截圖）；「切換分頁不中斷播放」由 YearTabs 掛在 tab 條件外的既有結構天然成立，Task 5 未另設檢查（手動走查涵蓋）。
- 不做的事（trail/循環/迷你地圖互動）均未出現在任何 task。
- 型別一致：`selected: string[] | null`／`onSelect` 在 ShellProps、App、Scatter、MiniMap 四處簽名相同；`townsInRect`、`nextYear/playStartYear` 名稱前後一致。
- 風險已標注：Task 3 Step 2 名稱對齊測試紅＝STOP 人工決策；Task 5 Step 3 hover 回歸由 `dots.raise()` 護住。
