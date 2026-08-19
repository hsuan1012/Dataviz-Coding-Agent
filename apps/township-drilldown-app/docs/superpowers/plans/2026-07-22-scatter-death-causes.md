# 十大死因進散布圖四通道 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 關係頁四通道（X/Y/顏色/大小）可選十大死因，自由組合死因×死因、死因×社經指標；左側死亡率＋地圖死因選擇連動帶入 X。

**Architecture:** `ScatterKey = IndicatorKey | \`death_c${string}\``（template literal pattern）擴充 Point/ScatterDomains/ScatterChannels 的 key 空間；新純函式 `scatterVars(meta)` 統一供應「變數清單（key/label/unit/分組）」給下拉、軸標題、tooltip、圖例。既有互動（框選/播放/迷你地圖）零改動自動繼承。

**Tech Stack:** React 18 + TypeScript + d3 v7 + vitest + Playwright。

## Global Constraints

- spec：`docs/superpowers/specs/2026-07-22-scatter-death-causes-design.md`
- 分支 `minimap-linked` 續作，**只 commit 本地、不得 push GitHub**。
- commit 訊息**不加** `Co-Authored-By: Claude`。
- 既有行為不得變：框選/清除/切年切通道保留名單/播放/迷你地圖等高點縣懸停塗色/地圖頁死因選單/村里層。
- 既有測試全綠：vitest 84（76＋本計畫新增 8）、verify-scatter / verify-brush-play / verify-minimap-linked。
- 資料前提（已驗證）：10 死因 town 層 102–108 全 368 鄉鎮無缺值。

---

### Task 1: `ScatterKey` 型別擴充＋`scatterVars`（TDD）

**Files:**
- Modify: `src/lib/data.ts`（型別＋新函式；`Point`/`scatterPoints`/`ScatterDomains`/`scatterDomains` 擴 key）
- Test: `src/lib/scatterVars.test.ts`（新檔）

**Interfaces:**
- Consumes: `Meta`（`indicators`/`deathCauses`）。
- Produces:
  - `export type ScatterKey = IndicatorKey | \`death_c${string}\``
  - `export interface ScatterVar { key: ScatterKey; label: string; unit: string; group: "ind" | "cause" }`
  - `export function scatterVars(meta: Meta): ScatterVar[]` — 5 指標＋10 死因（排除 `death` 重複；死因 unit＝死亡率指標單位）
  - `Point = { township: string; region: Region } & Record<ScatterKey, number>`（欄位涵蓋死因）
  - `ScatterDomains = Record<ScatterKey, [number, number]>`

- [ ] **Step 1: 寫失敗測試** `src/lib/scatterVars.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { scatterVars, scatterPoints, scatterDomains, type Meta, type Values } from "./data";

const meta = {
  years: [102, 103],
  indicators: [
    { key: "density", label: "人口密度", unit: "人/km²" },
    { key: "income", label: "平均所得", unit: "千元/戶" },
    { key: "death", label: "死亡率", unit: "每10萬人" },
    { key: "clinic", label: "診所醫事人力", unit: "人/萬人" },
    { key: "hospital", label: "醫院醫事人力", unit: "人/萬人" },
  ],
  deathCauses: [
    { key: "death", label: "全死因" },
    { key: "death_c06", label: "惡性腫瘤" },
    { key: "death_c21", label: "肺炎" },
  ],
  regions: { 臺北市中正區: "北" },
} as unknown as Meta;

const town = (v: number) => ({ 臺北市中正區: v });
const values = {
  density: { town: { "102": town(100), "103": town(110) } },
  income: { town: { "102": town(700), "103": town(710) } },
  death: { town: { "102": town(600), "103": town(610) } },
  clinic: { town: { "102": town(20), "103": town(21) } },
  hospital: { town: { "102": town(30), "103": town(31) } },
  death_c06: { town: { "102": town(180), "103": town(190) } },
  death_c21: { town: { "102": town(40), "103": town(45) } },
} as unknown as Values;

describe("scatterVars", () => {
  it("=指標+死因(排除重複 death),死因 unit=死亡率單位", () => {
    const v = scatterVars(meta);
    expect(v.map((x) => x.key)).toEqual(["density", "income", "death", "clinic", "hospital", "death_c06", "death_c21"]);
    expect(v.find((x) => x.key === "death_c06")).toMatchObject({ label: "惡性腫瘤", unit: "每10萬人", group: "cause" });
    expect(v.filter((x) => x.group === "ind")).toHaveLength(5);
  });
});

describe("scatterPoints 含死因", () => {
  it("點的欄位含死因值(對照 fixture 真值)", () => {
    const pts = scatterPoints(values, meta, 102);
    expect(pts).toHaveLength(1);
    expect(pts[0].death_c06).toBe(180);
    expect(pts[0].death_c21).toBe(40);
    expect(pts[0].density).toBe(100);
  });
  it("死因缺值的鄉鎮被剔除(維持點集完整可比)", () => {
    const v2 = JSON.parse(JSON.stringify(values)) as Values;
    delete (v2 as any).death_c06.town["102"]["臺北市中正區"];
    expect(scatterPoints(v2, meta, 102)).toHaveLength(0);
  });
});

describe("scatterDomains 含死因", () => {
  it("死因 domain=跨年 extent", () => {
    const d = scatterDomains(values, meta);
    expect(d.death_c06).toEqual([180, 190]);
    expect(d.death_c21).toEqual([40, 45]);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/scatterVars.test.ts`
Expected: FAIL（`scatterVars` 未匯出）

- [ ] **Step 3: 實作 `src/lib/data.ts`**

3a. `IndicatorKey` 定義（第 1 行）之後加：

```ts
// 散布圖可用變數 key:5 指標 ∪ 死因(death_c*)。template literal pattern 涵蓋全部死因碼,
// 不逐一列舉(死因清單由 meta.json 資料驅動)。
export type ScatterKey = IndicatorKey | `death_c${string}`;
export interface ScatterVar { key: ScatterKey; label: string; unit: string; group: "ind" | "cause" }
```

3b. `resolveMetric` 之前（或之後）加：

```ts
// 散布圖變數清單:指標(group=ind)+十大死因(group=cause)。排除 deathCauses 裡與指標
// 重複的「全死因 death」;死因無 unit 欄位,沿用死亡率指標單位。下拉/軸標題/tooltip 統一查這張表。
export function scatterVars(meta: Meta): ScatterVar[] {
  const deathUnit = meta.indicators.find((i) => i.key === "death")?.unit ?? "";
  return [
    ...meta.indicators.map((i) => ({ key: i.key as ScatterKey, label: i.label, unit: i.unit, group: "ind" as const })),
    ...(meta.deathCauses ?? [])
      .filter((d) => d.key !== "death")
      .map((d) => ({ key: d.key as ScatterKey, label: d.label, unit: deathUnit, group: "cause" as const })),
  ];
}
```

3c. `Point`/`scatterPoints`/`ScatterDomains`/`scatterDomains` 改用 ScatterKey 與 scatterVars：

```ts
export type Point = { township: string; region: Region } & Record<ScatterKey, number>;
export function scatterPoints(values: Values, meta: Meta, year: number): Point[] {
  const y = String(year);
  const keys = scatterVars(meta).map((v) => v.key);
  const out: Point[] = [];
  for (const town of Object.keys(values.income?.town?.[y] ?? {})) {
    const region = meta.regions[town];
    if (region === undefined) continue;
    const vals = {} as Record<ScatterKey, number>;
    let complete = true;
    for (const k of keys) {
      const val = values[k]?.town?.[y]?.[town];
      if (val === undefined) { complete = false; break; }  // 任一變數缺值即跳過該鄉鎮，維持點集完整可比
      vals[k] = val;
    }
    if (!complete) continue;
    out.push({ township: town, region, ...vals });
  }
  return out;
}
```

```ts
export type ScatterDomains = Record<ScatterKey, [number, number]>;
export function scatterDomains(values: Values, meta: Meta): ScatterDomains {
  const keys = scatterVars(meta).map((v) => v.key);
  const acc = {} as Record<ScatterKey, [number, number]>;
  for (const k of keys) acc[k] = [Infinity, -Infinity];
  for (const y of meta.years)
    for (const p of scatterPoints(values, meta, y))
      for (const k of keys) {
        if (p[k] < acc[k][0]) acc[k][0] = p[k];
        if (p[k] > acc[k][1]) acc[k][1] = p[k];
      }
  return acc;
}
```

（`scatterPoints` 上方註解「指標欄位由 meta.indicators 動態決定」同步改為
「變數欄位由 scatterVars（指標＋死因）動態決定」。）

- [ ] **Step 4: 跑測試確認通過＋全套回歸**

Run: `npx vitest run src/lib/scatterVars.test.ts; npx vitest run; npx tsc --noEmit`
Expected: 新 5 項綠；全套綠（若 Scatter/scatterChannels 因型別未同步而 tsc 報錯，
先確認錯誤僅限「IndicatorKey vs ScatterKey」再進 Task 2 一併處理——vitest 不受影響）。

- [ ] **Step 5: Commit**（若 tsc 需等 Task 2，一併延後到 Task 2 commit；vitest 綠即可先 commit lib）

```bash
git add src/lib/data.ts src/lib/scatterVars.test.ts
git commit -m "關係頁:ScatterKey 型別擴充+scatterVars(指標∪十大死因,TDD)"
```

---

### Task 2: 通道型別放寬＋Scatter 下拉 optgroup＋標籤查表

**Files:**
- Modify: `src/lib/scatterChannels.ts`（型別）
- Modify: `src/lib/mapFill.ts`（colorKey 型別）
- Modify: `src/charts/Scatter.tsx`（vars 查表＋optgroup 下拉）

**Interfaces:**
- Consumes: Task 1 `ScatterKey`/`scatterVars`。
- Produces: `ScatterChannels { x/y/size: ScatterKey; color: "region" | ScatterKey }`（App 沿用）；
  下拉 DOM：`select.scatter-ch optgroup[label="十大死因"]`（Task 3 Playwright 依賴）。

- [ ] **Step 1: `src/lib/scatterChannels.ts` 型別放寬**

```ts
import type { ScatterKey } from "./data";
```
（原 `import type { IndicatorKey } from "./data";` 整行取代）

```ts
export type ColorKey = "region" | ScatterKey;
export interface ScatterChannels { x: ScatterKey; y: ScatterKey; size: ScatterKey; color: ColorKey }
```

`makeColorNormalizer(key: IndicatorKey, ...)` → `makeColorNormalizer(key: ScatterKey, ...)`；
`colorTicks(key: IndicatorKey, ...)` → `colorTicks(key: ScatterKey, ...)`。其餘不動。

- [ ] **Step 2: `src/lib/mapFill.ts` 型別放寬**

```ts
import type { Point, ScatterKey } from "./data";
```
`colorKey: IndicatorKey | "region"` → `colorKey: ScatterKey | "region"`，
泛型參數同步（函式體不動）。

- [ ] **Step 3: `src/charts/Scatter.tsx` 改查 scatterVars＋optgroup**

3a. import：`scatterPoints, scatterDomains, REGIONS, type Values, type Meta, type IndicatorKey, type Point`
的那行加入 `scatterVars, type ScatterKey`（`IndicatorKey` 若不再使用可移除）。

3b. 元件內 `const keys = meta.indicators.map((i) => i.key as IndicatorKey);` 與
`const lab = (k: IndicatorKey) => meta.indicators.find((i) => i.key === k)!;` 兩行改為：

```ts
  const vars = useMemo(() => scatterVars(meta), [meta]);
  const lab = (k: ScatterKey) => vars.find((v) => v.key === k)!;
```

（原 `lab(xKey).label`／`lab(xKey).unit` 等呼叫全部不動——ScatterVar 有同名欄位。）

3c. 原 `const indOpts = keys.map((k) => ({ key: k, label: lab(k).label }));` 改為分組：

```ts
  const groups = [
    { label: "基本指標", opts: vars.filter((v) => v.group === "ind").map((v) => ({ key: v.key, label: v.label })) },
    { label: "十大死因", opts: vars.filter((v) => v.group === "cause").map((v) => ({ key: v.key, label: v.label })) },
  ];
```

3d. `chSelect` 改吃分組（`pre`＝顏色通道前置的「區域」選項）：

```tsx
  const chSelect = (ch: keyof ScatterChannels, label: string, value: string,
    pre?: { key: string; label: string }[]) => (
    <label key={ch} style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span>{label}</span>
      <select className="scatter-ch" data-ch={ch} aria-label={label} value={value} style={selStyle}
        onChange={(e) => onChannel({ [ch]: e.target.value } as Partial<ScatterChannels>)}>
        {pre?.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        {groups.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.opts.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );
```

呼叫端改為：

```tsx
        {chSelect("x", "X 軸", xKey)}
        {chSelect("y", "Y 軸", yKey)}
        {chSelect("color", "顏色", colorKey, [{ key: "region", label: "區域" }])}
        {chSelect("size", "大小", sizeKey)}
```

3e. `xIsLog`/`yIsLog`（`=== "density"`）、tooltip、色條、大小圖例程式全部不動
（型別放寬後自動支援死因 key）。

- [ ] **Step 4: 型檢＋全套測試＋本機煙霧**

Run: `npx tsc --noEmit; npx vitest run`
Expected: 0 錯／84 項全綠。
瀏覽器（dev server）關係頁：X 選「惡性腫瘤」、Y 選「肺炎」→ 散布呈現、軸標題正確；
顏色選「糖尿病」→ 色條＋迷你地圖變該死因色階。

- [ ] **Step 5: Commit**

```bash
git add src/lib/scatterChannels.ts src/lib/mapFill.ts src/charts/Scatter.tsx
git commit -m "關係頁:四通道可選十大死因(optgroup 分組/標籤查表/型別放寬)"
```

---

### Task 3: 左側死因連動＋Playwright 驗證腳本

**Files:**
- Modify: `src/App.tsx`（X 帶入邏輯）
- Create: `scripts/verify-scatter-causes.mjs`

**Interfaces:**
- Consumes: Task 2 的 optgroup DOM、`button.death-cause`（既有）、`.taste-nav`（既有）。
- Produces: 截圖 `docs/superpowers/artifacts/causes-*.png`。

- [ ] **Step 1: `src/App.tsx` 連動**

import 區把 `ScatterChannels` 那行改為同時引入 ScatterKey：

```ts
import type { ScatterChannels } from "./lib/scatterChannels";
import type { ScatterKey } from "./lib/data";
```

原 effect（`// 進入關係頁、或在關係頁切左側指標時...`）改為：

```ts
  // 進入關係頁、或在關係頁切左側指標時,X 通道同步當前指標;
  // 死亡率+已選死因別 → 帶入該死因(地圖看惡性腫瘤→關係頁 X=惡性腫瘤);頁內下拉可再自由改
  useEffect(() => {
    if (tab !== "scatter") return;
    const x: ScatterKey = indicator === "death" && deathCause !== "death"
      ? (deathCause as ScatterKey) : indicator;
    setScatter((s) => (s.x === x ? s : { ...s, x }));
  }, [tab, indicator, deathCause]);
```

- [ ] **Step 2: 寫 `scripts/verify-scatter-causes.mjs`**

```js
// 十大死因進散布圖四通道驗證:optgroup/死因×死因/死因當顏色連動迷你地圖/名單保留/左側死因帶入X。
// 需先 npm run dev(localhost:5173)。
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

const axisTexts = () => p.evaluate(() =>
  Array.from(document.querySelectorAll("svg g.axes text")).map((t) => t.textContent));
const dotN = () => p.locator("svg g.dots circle").count();

// 1) optgroup 分組存在(四通道都有)
for (const ch of ["x", "y", "color", "size"]) {
  const n = await p.locator(`select.scatter-ch[data-ch="${ch}"] optgroup[label="十大死因"] option`).count();
  if (n === 10) ok(`通道 ${ch}:十大死因 optgroup=10 項`); else fail(`通道 ${ch} 死因項=${n}`);
}

// 2) 死因×死因:X=惡性腫瘤、Y=肺炎
await p.locator('select.scatter-ch[data-ch="x"]').selectOption({ label: "惡性腫瘤" });
await p.locator('select.scatter-ch[data-ch="y"]').selectOption({ label: "肺炎" });
await p.waitForTimeout(900);
const ax = await axisTexts();
if (ax.some((t) => t?.includes("惡性腫瘤"))) ok("X 軸標題=惡性腫瘤"); else fail("X 軸標題未變: " + ax.join("/"));
if (ax.some((t) => t?.includes("肺炎"))) ok("Y 軸標題=肺炎"); else fail("Y 軸標題未變");
if ((await dotN()) === 368) ok("死因×死因點數=368(無缺值剔除)"); else fail(`點數=${await dotN()}`);
await p.screenshot({ path: `${OUT}/causes-scatter-pair.png` });

// 3) 顏色=糖尿病 → 色條出現+迷你地圖同步色階
const beforeFill = await p.locator("path.mini-town").first().getAttribute("fill");
await p.locator('select.scatter-ch[data-ch="color"]').selectOption({ label: "糖尿病" });
await p.waitForTimeout(900);
if ((await p.locator("svg.colorbar").count()) === 1) ok("顏色=糖尿病 → 色條出現"); else fail("無色條");
const afterFill = await p.locator("path.mini-town").first().getAttribute("fill");
if (beforeFill !== afterFill) ok("迷你地圖同步死因色階"); else fail("迷你地圖未變色");
await p.screenshot({ path: `${OUT}/causes-color-channel.png` });

// 4) 框選+切死因通道 → 名單保留
const box = await p.evaluate(() => document.querySelector("svg.mini-map")
  .closest("div").parentElement.querySelector("svg[width='100%']").getBoundingClientRect().toJSON());
await p.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
await p.mouse.down();
await p.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, { steps: 8 });
await p.mouse.up();
await p.waitForTimeout(900);
const n1 = Number((await p.locator(".mini-count").textContent())?.match(/\d+/)?.[0] ?? -1);
if (n1 > 0) ok(`框選鎖定 ${n1} 鄉鎮`); else fail("框選失敗");
await p.locator('select.scatter-ch[data-ch="y"]').selectOption({ label: "心臟疾病" });
await p.waitForTimeout(900);
const n2 = Number((await p.locator(".mini-count").textContent())?.match(/\d+/)?.[0] ?? -1);
if (n2 === n1) ok("切死因通道 → 名單保留"); else fail(`名單 ${n2} ≠ ${n1}`);
await p.locator("button.mini-clear").click();
await p.waitForTimeout(400);

// 5) 左側死亡率+地圖死因=惡性腫瘤 → 回關係頁 X=惡性腫瘤
await p.locator(".view-toggle", { hasText: "分區排名" }).click();
await p.waitForTimeout(600);
await p.locator(".taste-nav", { hasText: "死亡率" }).click();
await p.waitForTimeout(600);
await p.locator("button.death-cause", { hasText: "惡性腫瘤" }).click();
await p.waitForTimeout(900);
await p.locator(".view-toggle", { hasText: "關係" }).click();
await p.waitForTimeout(900);
const ax2 = await axisTexts();
if (ax2.some((t) => t?.includes("惡性腫瘤"))) ok("左側死因=惡性腫瘤 → 關係頁 X 帶入");
else fail("X 未帶入死因: " + ax2.join("/"));
await p.screenshot({ path: `${OUT}/causes-nav-sync.png` });

if (errors.length) fail("console/page 錯誤: " + errors.join(" | ")); else ok("無 console/page 錯誤");
await b.close();
console.log(process.exitCode ? "== 有項目失敗 ==" : "== 全部通過 ==");
```

- [ ] **Step 3: 跑新腳本**

Run: `node scripts/verify-scatter-causes.mjs`
Expected: 全 PASS、三張截圖產出。

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx scripts/verify-scatter-causes.mjs
git commit -m "關係頁:左側死因選擇連動帶入X+死因通道驗證腳本"
```

---

### Task 4: 全套驗證＋README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 全套回歸**

Run: `node scripts/verify-scatter.mjs; node scripts/verify-brush-play.mjs; node scripts/verify-minimap-linked.mjs`
Expected: 三支全 PASS（既有行為未破壞）。

- [ ] **Step 2: 程式層**

Run: `npx tsc --noEmit; npx vitest run; npm run build`
Expected: 0 錯／84 綠／build 成功。

- [ ] **Step 3: README 補述**

「關係散布圖＝四通道 crossfilter」段落補：

```
四通道下拉分「基本指標／十大死因」兩組（optgroup），死因×死因（如惡性腫瘤×肺炎）或死因×社經指標皆可自由組合；左側「死亡率」若已選死因別，進關係頁 X 軸自動帶入該死因。註：死因相關為鄉鎮層級的生態相關，不等同個人層級關聯。
```

測試數與驗證腳本清單同步：vitest 76→84、加一行
`node scripts/verify-scatter-causes.mjs  # 需 dev server：死因四通道 12 項`。

- [ ] **Step 4: 視覺層 AI 終審**

Read 三張截圖（causes-scatter-pair / causes-color-channel / causes-nav-sync），
檢查：軸標題/色條標籤/迷你地圖色階一致、下拉分組顯示正常、無跑版。異常→回修。

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "README:關係頁十大死因四通道說明+驗證腳本清單/測試數更新"
```

**不 push。** localhost 驗收與老師過目後才推。
