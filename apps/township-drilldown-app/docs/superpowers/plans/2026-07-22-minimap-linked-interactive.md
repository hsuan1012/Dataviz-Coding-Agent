# 關係頁迷你地圖等高＋雙向互動 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 關係頁迷你地圖放大到與散布圖等高，塗色跟隨泡泡顏色通道，並支援點縣市 toggle 選取與懸停縣市預覽（雙向連動）。

**Architecture:** 選取名單仍存 App 層（`string[] | null`，FULLNAME）；點縣 toggle 抽純函式 `toggleCounty`；鄉鎮→填色抽純函式 `townFillMap`；hover 縣名狀態放 Scatter 層。MiniMap 由純顯示升級為互動元件，高度由 Scatter 以 ResizeObserver 量測散布圖 svg 實際高度傳入。

**Tech Stack:** React 18 + TypeScript + d3 v7 + vitest + Playwright（既有 verify-*.mjs 模式）。

## Global Constraints

- spec：`docs/superpowers/specs/2026-07-22-minimap-linked-interactive-design.md`
- 分支 `minimap-linked`，**全程只 commit 本地、不得 push GitHub**。
- commit 訊息**不加** `Co-Authored-By: Claude`（repo 慣例）。
- 名單型別維持 `string[] | null`（FULLNAME），不得改動 App 介面形狀。
- 既有行為不得變：框選、點空白清除、清除鈕、切年/切通道保留名單、年份播放、金馬 inset（含烏坵排除）。
- 既有測試全綠：vitest、`scripts/verify-brush-play.mjs`、`scripts/verify-scatter.mjs`。
- 操作說明文字必須保留關鍵詞：未選取含「框選」、已選取含「保留」（verify-brush-play.mjs 斷言依賴）。

---

### Task 1: `toggleCounty` 純函式（TDD）

**Files:**
- Create: `src/lib/countySelect.ts`
- Test: `src/lib/countySelect.test.ts`

**Interfaces:**
- Consumes: 無（純函式）。
- Produces: `toggleCounty(selected: string[] | null, countyTowns: string[]): string[] | null` — Task 3 的 Scatter 點縣 handler 使用。

- [ ] **Step 1: 寫失敗測試** `src/lib/countySelect.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { toggleCounty } from "./countySelect";

describe("toggleCounty", () => {
  it("無名單時點縣=整縣加入", () => {
    expect(toggleCounty(null, ["A", "B"])).toEqual(["A", "B"]);
  });
  it("部分已選=聯集(不重複、保留原順序)", () => {
    expect(toggleCounty(["A", "X"], ["A", "B"])).toEqual(["A", "X", "B"]);
  });
  it("整縣已在名單=整縣移出、其餘保留", () => {
    expect(toggleCounty(["A", "B", "X"], ["A", "B"])).toEqual(["X"]);
  });
  it("移出後名單空=回 null(視同清除)", () => {
    expect(toggleCounty(["A", "B"], ["A", "B"])).toBeNull();
  });
  it("縣無鄉鎮(防呆)=名單原樣", () => {
    expect(toggleCounty(["X"], [])).toEqual(["X"]);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/countySelect.test.ts`
Expected: FAIL（找不到模組 `./countySelect`）

- [ ] **Step 3: 最小實作** `src/lib/countySelect.ts`

```ts
// 迷你地圖點縣 toggle:整縣鄉鎮已全在名單→整縣移出;否則整縣併入(聯集)。
// 結果為空名單時回 null(=清除,與 App selected 語意一致)。
export function toggleCounty(selected: string[] | null, countyTowns: string[]): string[] | null {
  if (!countyTowns.length) return selected;
  const cur = selected ?? [];
  const curSet = new Set(cur);
  const allIn = countyTowns.every((t) => curSet.has(t));
  const next = allIn
    ? cur.filter((t) => !countyTowns.includes(t))
    : [...cur, ...countyTowns.filter((t) => !curSet.has(t))];
  return next.length ? next : null;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/countySelect.test.ts`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/countySelect.ts src/lib/countySelect.test.ts
git commit -m "關係頁:toggleCounty 純函式(點縣整縣加入/移出、空名單回null)"
```

---

### Task 2: `townFillMap` 純函式（TDD）

**Files:**
- Create: `src/lib/mapFill.ts`
- Test: `src/lib/mapFill.test.ts`

**Interfaces:**
- Consumes: `Point`（`src/lib/data.ts:158`，含 `township`/`region` 與各指標值）、`regionColor(region, categorical)`（`src/lib/scales.ts:10`）。
- Produces: `townFillMap(pts: Point[], colorKey: IndicatorKey | "region", categorical: string[], norm: ((v: number) => number) | null, ramp: (u: number) => string): Map<string, string>` — Task 3 的 Scatter 算好傳給 MiniMap。

- [ ] **Step 1: 寫失敗測試** `src/lib/mapFill.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { townFillMap } from "./mapFill";
import type { Point } from "./data";

// REGIONS 順序=["北","中","南","東","離島"] → 北=cat[0]、東=cat[3]
const pts = [
  { township: "臺北市中正區", region: "北", density: 100, death: 1, income: 2, clinic: 3, hospital: 4 },
  { township: "花蓮縣花蓮市", region: "東", density: 10, death: 2, income: 3, clinic: 4, hospital: 5 },
] as unknown as Point[];
const cat = ["#111", "#222", "#333", "#444", "#555"];

describe("townFillMap", () => {
  it("顏色通道=區域 → 區域分類色", () => {
    const m = townFillMap(pts, "region", cat, null, () => "#no");
    expect(m.get("臺北市中正區")).toBe("#111");
    expect(m.get("花蓮縣花蓮市")).toBe("#444");
  });
  it("顏色通道=指標 → ramp(norm(值))連續色階", () => {
    const m = townFillMap(pts, "density", cat, (v) => v / 100, (u) => `u${u}`);
    expect(m.get("臺北市中正區")).toBe("u1");
    expect(m.get("花蓮縣花蓮市")).toBe("u0.1");
  });
  it("不在點集的鄉鎮=查無(元件端 fallback 淺灰)", () => {
    const m = townFillMap(pts, "region", cat, null, () => "#no");
    expect(m.get("不存在鄉")).toBeUndefined();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/mapFill.test.ts`
Expected: FAIL（找不到模組 `./mapFill`）

- [ ] **Step 3: 最小實作** `src/lib/mapFill.ts`

```ts
import type { Point, IndicatorKey } from "./data";
import { regionColor } from "./scales";

// 鄉鎮→填色對應(迷你地圖塗色跟隨散布圖顏色通道):
// 區域=分類色、指標=同一條連續色階。缺資料鄉鎮不進 Map(元件端回淺灰)。
export function townFillMap(
  pts: Point[],
  colorKey: IndicatorKey | "region",
  categorical: string[],
  norm: ((v: number) => number) | null,
  ramp: (u: number) => string,
): Map<string, string> {
  return new Map(pts.map((p) => [
    p.township,
    colorKey === "region"
      ? regionColor(p.region, categorical)
      : ramp((norm ?? (() => 0))(p[colorKey])),
  ]));
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/mapFill.test.ts`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/mapFill.ts src/lib/mapFill.test.ts
git commit -m "關係頁:townFillMap 純函式(迷你地圖塗色跟隨顏色通道,缺資料淺灰)"
```

---

### Task 3: MiniMap 升級＋Scatter 接線（等高/塗色/點縣/懸停）

MiniMap 的新 props 與 Scatter 的傳入必須同一個 commit，否則 tsc 不過。

**Files:**
- Modify: `src/charts/MiniMap.tsx`（整檔重寫，見下）
- Modify: `src/charts/Scatter.tsx`（狀態/量測/接線）

**Interfaces:**
- Consumes: Task 1 `toggleCounty`、Task 2 `townFillMap`、`countyOf(f)`（`src/lib/counties.ts:5`，讀 `COUNTYNAME`）。
- Produces: MiniMap 新 props（Scatter 專用，無其他呼叫端）：
  `{ geo, selected, onClear, fillMap: Map<string,string>, height: number, hoverCounty: string | null, onHoverCounty: (c: string | null) => void, onToggleCounty: (c: string) => void }`
- 測試掛勾（Task 4 的 Playwright 依賴）：`path.mini-town` 新增 `data-county`、`data-hover` 屬性；`data-sel` 維持。

- [ ] **Step 1: 重寫 `src/charts/MiniMap.tsx`**

```tsx
import { useMemo } from "react";
import * as d3 from "d3";
import { useTokens } from "../lib/useTokens";
import { splitFeatures, inTaiwanBox, insetFitFeatures, countyOf } from "../lib/counties";
import { INSET_BOXES } from "../lib/insetBoxes.js";

// 迷你台灣地圖(關係頁連動):沿用主地圖同一套 viewBox 800×900 座標與金馬 inset 邏輯。
// 7/22 升級(spec: 2026-07-22-minimap-linked-interactive):
// 等高(height 由 Scatter 量測散布圖實高傳入)、塗色跟隨泡泡顏色通道(fillMap)、
// 點任一鄉鎮=toggle 整縣(onToggleCounty)、懸停=縣市預覽(onHoverCounty,不改名單)。
const W = 800, H = 900;

export default function MiniMap({ geo, selected, onClear, fillMap, height, hoverCounty, onHoverCounty, onToggleCounty }: {
  geo: GeoJSON.FeatureCollection;
  selected: string[] | null;
  onClear: () => void;
  fillMap: Map<string, string>;
  height: number;
  hoverCounty: string | null;
  onHoverCounty: (c: string | null) => void;
  onToggleCounty: (c: string) => void;
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

  const mapW = Math.max(220, Math.round((height * W) / H));
  const name = (f: GeoJSON.Feature) => (f.properties as any).FULLNAME as string;
  const isSel = (f: GeoJSON.Feature) => selSet?.has(name(f)) ?? false;
  const town = (f: GeoJSON.Feature, d: string | null) => {
    const c = countyOf(f);
    const sel = isSel(f), hov = hoverCounty === c;
    return (
      <path key={name(f)} className="mini-town" data-sel={sel ? "1" : "0"}
        data-county={c} data-hover={hov ? "1" : "0"}
        d={d ?? ""}
        fill={fillMap.get(name(f)) ?? t.border}
        fillOpacity={selSet && !sel ? 0.15 : 1}
        stroke={hov ? t.text : sel ? t.accent : t.surface}
        strokeWidth={hov ? 1.2 : sel ? 0.9 : 0.4}
        style={{ cursor: "pointer" }}
        onClick={() => onToggleCounty(c)}
        onMouseEnter={() => onHoverCounty(c)} />
    );
  };

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
      <svg className="mini-map" viewBox={`0 0 ${W} ${H}`} width={mapW} height={height}
        aria-label="鄉鎮位置與縣市選取" role="img"
        onMouseLeave={() => onHoverCounty(null)}>
        {main.map((f) => town(f, mainPath(f as any)))}
        {insetPaths.map(({ ins, B, path }) => (
          <g key={ins.county}>
            <rect x={B.x} y={B.y} width={B.w} height={B.h} fill="none"
              stroke={t.border} strokeDasharray="4 3" rx={6} />
            {/* 用 insetFitFeatures（同 fit 排除集合）而非 ins.features：烏坵鄉不在 fit 內卻仍被畫，
                會投影到框外、疊在主圖上（越框 blob）。這裡沒有主圖 Choropleth 的 clipPath 可擋，
                最小修法＝跟著 fit 一起排除烏坵，縮圖本就不必顯示它（同 check-inset-collision 教訓）。 */}
            {insetFitFeatures(geo.features, ins.county).map((f) => town(f, path(f as any)))}
          </g>
        ))}
      </svg>
      {/* 操作說明:未選取教「怎麼開始」,已選取教「接下來能做什麼」
          (verify-brush-play 斷言:未選含「框選」、已選含「保留」,措辭改動須保留關鍵詞) */}
      <p className="mini-hint" style={{ margin: 0, maxWidth: mapW, fontSize: 11, lineHeight: 1.6,
        color: t.textMuted, textAlign: "center" }}>
        {selected
          ? "點地圖可整縣加入或移出；切換年份或通道，名單都會保留；點散布圖空白處或「清除」還原。"
          : "在左側散布圖空白處拖曳框選，或點地圖任一縣市整縣加入，這裡會同步標出位置。"}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: 修改 `src/charts/Scatter.tsx`**

2a. 檔頭 import 增加（`townsInRect` 那行附近）：

```ts
import { toggleCounty } from "../lib/countySelect";
import { townFillMap } from "../lib/mapFill";
import { countyOf } from "../lib/counties";
```

2b. 元件內、`const [hover, setHover] = ...` 之後加狀態與衍生值：

```ts
  const [hoverCounty, setHoverCounty] = useState<string | null>(null);
  // 散布圖 svg 實際渲染高度 → 迷你地圖等高(spec)。差<2px 不更新,防 flex 來回震盪。
  const [chartH, setChartH] = useState(420);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const next = Math.round(el.getBoundingClientRect().height);
      setChartH((h) => (Math.abs(h - next) > 2 ? next : h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // FULLNAME→縣市(懸停預覽用);縣市→鄉鎮名單(點縣 toggle 用)。皆來自 geo(與 countyOf 同源)。
  const townCounty = useMemo(
    () => new Map(geo.features.map((f) => [(f.properties as any).FULLNAME as string, countyOf(f)])),
    [geo]);
  const pts = useMemo(() => scatterPoints(values, meta, year), [values, meta, year]);
  const fillMap = useMemo(
    () => townFillMap(pts, colorKey, t.categorical, colorNorm, ramp),
    [pts, colorKey, t, colorNorm, ramp]);
  const handleToggleCounty = (county: string) => {
    const towns = geo.features.filter((f) => countyOf(f) === county)
      .map((f) => (f.properties as any).FULLNAME as string);
    onSelect(toggleCounty(selected, towns));
  };
```

2c. 泡泡 effect（`// 泡泡:...` 那段）之後，新增**獨立的懸停描邊 effect**
（不併入補間 effect：hover 高頻變動不能重啟 750ms transition）：

```ts
  // 懸停縣市預覽:該縣泡泡描邊強調。獨立 effect,不重啟補間動畫。
  useEffect(() => {
    const dots = d3.select(ref.current).select<SVGGElement>("g.dots");
    dots.selectAll<SVGCircleElement, Point>("circle")
      .attr("stroke", (p) => (hoverCounty && townCounty.get(p.township) === hoverCounty ? t.accent : t.surface))
      .attr("stroke-width", (p) => (hoverCounty && townCounty.get(p.township) === hoverCounty ? 1.8 : 0.5));
  }, [hoverCounty, townCounty, t, values, meta, year, xKey, yKey, sizeKey, colorKey]);
```

2d. 版面：`<MiniMap geo={geo} selected={selected} onClear={() => onSelect(null)} />` 改為：

```tsx
        <MiniMap geo={geo} selected={selected} onClear={() => onSelect(null)}
          fillMap={fillMap} height={chartH} hoverCounty={hoverCounty}
          onHoverCounty={setHoverCounty} onToggleCounty={handleToggleCounty} />
```

（外層 row `display:flex, gap:12, alignItems:"flex-start", flexWrap:"wrap"` 不動——
等高由 height prop 決定，不靠 CSS stretch。）

- [ ] **Step 3: 型檢＋全套單元測試**

Run: `npx tsc --noEmit; npx vitest run`
Expected: tsc 0 錯；vitest 全綠（既有＋新增 8 項）

- [ ] **Step 4: 本機煙霧測試**

Run: `npm run dev`（背景），瀏覽器開 http://localhost:5173 → 關係頁：
地圖變大且與散布圖約等高、塗色=區域分類色、點台北市→泡泡淡化＋已選 12、
再點→清除、滑過縣市→描邊出現。

- [ ] **Step 5: Commit**

```bash
git add src/charts/MiniMap.tsx src/charts/Scatter.tsx
git commit -m "關係頁:迷你地圖等高+塗色跟色通道+點縣toggle+懸停縣預覽(雙向連動)"
```

---

### Task 4: Playwright 驗證腳本＋全套驗證＋README

**Files:**
- Create: `scripts/verify-minimap-linked.mjs`
- Modify: `README.md`（互動說明段補一句）

**Interfaces:**
- Consumes: Task 3 的 `data-county`/`data-hover`/`data-sel` 屬性、`.mini-count`/`.mini-clear`/`.scatter-ch` 既有掛勾。
- Produces: 驗證截圖存 `docs/superpowers/artifacts/minimap-*.png`。

- [ ] **Step 1: 寫 `scripts/verify-minimap-linked.mjs`**

（點選用 `dispatchEvent("click")`——小鄉鎮 bbox 中心可能落在鄰鄉 path 上，真滑鼠會點錯；
懸停要驗 mouseenter/mouseleave 真實行為，改真滑鼠移到「該縣最大 path」bbox 中心。）

```js
// 迷你地圖雙向互動驗證:等高/點縣toggle/聯集/懸停預覽/塗色跟色通道。需先 npm run dev。
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
await p.locator(".view-toggle", { hasText: "關係" }).click();
await p.waitForTimeout(800);

const count = async () => Number((await p.locator(".mini-count").textContent())?.match(/\d+/)?.[0] ?? -1);
const dimN = () => p.evaluate(() =>
  Array.from(document.querySelectorAll("svg g.dots circle"))
    .filter((c) => Number(c.getAttribute("fill-opacity")) < 0.2).length);

// ---- 等高:迷你地圖 svg 高 ≈ 散布圖 svg 高(±6px) ----
const hs = await p.evaluate(() => {
  const mini = document.querySelector("svg.mini-map");
  const chart = mini.closest("div").parentElement.querySelector("svg[width='100%']");
  return [chart.getBoundingClientRect().height, mini.getBoundingClientRect().height];
});
if (Math.abs(hs[0] - hs[1]) <= 6) ok(`等高 chart=${hs[0].toFixed(0)} mini=${hs[1].toFixed(0)}`);
else fail(`高度差過大 chart=${hs[0]} mini=${hs[1]}`);

// ---- 點縣=整縣加入 ----
const taipeiN = await p.locator('path.mini-town[data-county="臺北市"]').count();
await p.locator('path.mini-town[data-county="臺北市"]').first().dispatchEvent("click");
await p.waitForTimeout(900);
let n = await count();
if (n === taipeiN && n > 0) ok(`點臺北市 → 已選 ${n} = 該縣鄉鎮數`); else fail(`點縣後 ${n} ≠ ${taipeiN}`);
if ((await dimN()) > 0) ok("名單外泡泡調暗"); else fail("點縣後無泡泡調暗");
if ((await p.locator('path.mini-town[data-sel="1"]').count()) === taipeiN) ok("地圖高亮=整縣");
else fail("地圖高亮數 ≠ 縣鄉鎮數");
await p.screenshot({ path: `${OUT}/minimap-click-county.png` });

// ---- 點第二縣=聯集 ----
const nantouN = await p.locator('path.mini-town[data-county="南投縣"]').count();
await p.locator('path.mini-town[data-county="南投縣"]').first().dispatchEvent("click");
await p.waitForTimeout(600);
n = await count();
if (n === taipeiN + nantouN) ok(`點南投縣 → 名單=聯集 ${n}`); else fail(`聯集異常 ${n} ≠ ${taipeiN + nantouN}`);

// ---- 再點同縣=整縣移出 ----
await p.locator('path.mini-town[data-county="南投縣"]').first().dispatchEvent("click");
await p.waitForTimeout(600);
n = await count();
if (n === taipeiN) ok("再點南投縣 → 整縣移出"); else fail(`移出異常 ${n} ≠ ${taipeiN}`);

// ---- 框選+點縣=與框選結果聯集(名單增加) ----
const box = await p.evaluate(() => document.querySelector("svg.mini-map")
  .closest("div").parentElement.querySelector("svg[width='100%']").getBoundingClientRect().toJSON());
await p.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
await p.mouse.down();
await p.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, { steps: 8 });
await p.mouse.up();
await p.waitForTimeout(900);
const brushN = await count();
await p.locator('path.mini-town[data-county="臺東縣"]').first().dispatchEvent("click");
await p.waitForTimeout(600);
n = await count();
if (n > brushN) ok(`框選(${brushN})+點臺東縣 → 聯集 ${n}`); else fail(`框選後點縣未聯集 ${n} ≤ ${brushN}`);

// ---- 清除還原 ----
await p.locator("button.mini-clear").click();
await p.waitForTimeout(600);
if ((await count()) === 0 && (await dimN()) === 0) ok("清除 → 名單 0、泡泡全還原"); else fail("清除未還原");

// ---- 懸停預覽(真滑鼠,移到花蓮縣最大 path 中心) ----
const pt = await p.evaluate(() => {
  const paths = [...document.querySelectorAll('path.mini-town[data-county="花蓮縣"]')];
  let best = null, area = 0;
  for (const el of paths) {
    const r = el.getBoundingClientRect();
    if (r.width * r.height > area) { area = r.width * r.height; best = r; }
  }
  return { x: best.x + best.width / 2, y: best.y + best.height / 2 };
});
await p.mouse.move(pt.x, pt.y);
await p.waitForTimeout(300);
const hualienN = await p.locator('path.mini-town[data-county="花蓮縣"]').count();
const hovN = await p.locator('path.mini-town[data-hover="1"]').count();
if (hovN === hualienN) ok(`懸停 → 全縣 ${hovN} 鄉鎮描邊`); else fail(`懸停描邊 ${hovN} ≠ ${hualienN}`);
const ring = await p.evaluate(() =>
  Array.from(document.querySelectorAll("svg g.dots circle"))
    .filter((c) => Number(c.getAttribute("stroke-width")) > 1).length);
if (ring > 0) ok(`懸停 → ${ring} 顆泡泡描邊強調`); else fail("懸停無泡泡描邊");
await p.screenshot({ path: `${OUT}/minimap-hover.png` });
await p.mouse.move(10, 10);
await p.waitForTimeout(300);
if ((await p.locator('path.mini-town[data-hover="1"]').count()) === 0) ok("移開 → 描邊復原");
else fail("移開後描邊未復原");

// ---- 塗色跟色通道 ----
const before = await p.locator('path.mini-town[data-county="臺北市"]').first().getAttribute("fill");
await p.locator('select.scatter-ch[data-ch="color"]').selectOption({ label: "人口密度" });
await p.waitForTimeout(600);
const after = await p.locator('path.mini-town[data-county="臺北市"]').first().getAttribute("fill");
if (before !== after) ok("切顏色通道 → 地圖塗色改變(色階)"); else fail("切色通道地圖未變色");
await p.screenshot({ path: `${OUT}/minimap-colorscale.png` });

if (errors.length) fail("console/page 錯誤: " + errors.join(" | ")); else ok("無 console/page 錯誤");
await b.close();
console.log(process.exitCode ? "== 有項目失敗 ==" : "== 全部通過 ==");
```

- [ ] **Step 2: 跑新腳本**

Run: `npm run dev`（背景已開）→ `node scripts/verify-minimap-linked.mjs`
Expected: 全部 PASS、`== 全部通過 ==`；截圖出現在 `docs/superpowers/artifacts/`

- [ ] **Step 3: 跑既有回歸**

Run: `node scripts/verify-brush-play.mjs; node scripts/verify-scatter.mjs`
Expected: 兩支全 PASS（框選/播放/通道行為未破壞）

- [ ] **Step 4: 全套程式層驗證**

Run: `npx tsc --noEmit; npx vitest run; npm run build`
Expected: 0 錯 / 全綠 / build 成功

- [ ] **Step 5: README 補互動說明**

在 README「關係」互動說明處補一句（找「框選」既有段落，接在後面）：

```
- 迷你地圖與散布圖等高、塗色跟隨「顏色」通道；點地圖任一縣市＝整縣加入／再點移出（可與框選聯集），滑過縣市可預覽該縣泡泡。
```

- [ ] **Step 6: 視覺層 AI 終審**

Read 三張截圖（minimap-click-county / minimap-hover / minimap-colorscale），檢查：
等高版面無跑版、金馬 inset 正常（無越框 blob）、描邊清楚、色階塗色與色條一致。
發現異常→回 Task 3 修。

- [ ] **Step 7: Commit**

```bash
git add scripts/verify-minimap-linked.mjs README.md docs/superpowers/artifacts/minimap-click-county.png docs/superpowers/artifacts/minimap-hover.png docs/superpowers/artifacts/minimap-colorscale.png
git commit -m "關係頁:迷你地圖連動驗證腳本+README互動說明(等高/點縣/懸停/塗色)"
```

**不 push。** localhost 驗收與老師過目後才推。
