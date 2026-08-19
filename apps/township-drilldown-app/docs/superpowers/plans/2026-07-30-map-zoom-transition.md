# 地圖層級切換 Zoom In/Out 動畫 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 點縣市/鄉鎮下鑽（或返回上層）時，地圖以點擊位置為中心播放 zoom in/out 縮放淡出淡入動畫；換指標／年份／主題／框選（view 層級未變）完全不觸發。

**Architecture:** 在 `Choropleth.tsx` 既有的單一繪圖 `useEffect` 前後各加一段：效果一開始比較「前一個 view」與「這次 view」的深度算出方向（`nav.ts` 的純函式 `zoomDirection`），若有方向則把「目前畫面」序列化成一張 `<img>`（避免污染任何 `svg path` 查詢——這是本設計相對原 spec 的關鍵修正，見下方 Global Constraints）疊在原地當「分身」；既有 D3 繪圖程式碼完全不改、瞬間畫出新內容；效果尾端用雙重 `requestAnimationFrame`（本專案既有動畫慣例）驅動 CSS `transform`/`opacity` 轉場，分身淡出、新內容淡入，750ms 後移除分身。

**Tech Stack:** React 18 + TypeScript（既有）、D3 v7（既有，不新增依賴）、原生 CSS transition＋`XMLSerializer`（瀏覽器原生 API，不新增套件）、vitest（純函式測試）、Playwright（端對端驗證）。

## Global Constraints

- **只有 view 深度改變才觸發動畫**：nation=0、county=1、town=2；深度不變（換指標/年份/主題/框選/懸停造成的 effect 重跑）一律沿用現行瞬間切換，零視覺變化。這是本功能最容易犯錯之處，任何一步都不可破壞這條規則。
- **分身用 `<img>`（序列化 SVG 字串），不用 `cloneNode` 插入的 `<svg>`**：因為現有 8 支 Playwright 驗證腳本大量使用 `document.querySelectorAll("svg path")` 之類的全域查詢，若分身是真的 `<svg>` 節點，會在動畫期間讓路徑數量疊加、造成既有斷言假失敗（本專案曾有過同類「多一個 svg 污染全域計數」的 bug，教訓記在 skill 的 verification.md）。`<img>` 天生沒有可查詢的子節點，從源頭排除此風險，且不需要動任何一支既有驗證腳本的選擇器。
- **`prefers-reduced-motion: reduce` 時完全不建立分身、不套用任何 transform/opacity**——沿用 `Scatter.tsx`/`RegionRank.tsx` 已用的 `window.matchMedia?.("(prefers-reduced-motion: reduce)").matches` 慣例。
- **雙重 `requestAnimationFrame` 才能讓 CSS transition 真的播放**——本專案在排名長條「從 0 長出」動畫踩過的教訓（直接同一輪設起點+終點，瀏覽器會合併成一次繪製、動畫不跑）同樣適用這裡。
- **並發保護＝最後動作贏**：每次 effect 重跑，先清掉任何殘留的舊分身節點與待執行的 timer，不排隊、不堆疊。
- **動畫時長 750ms**，緩衝到 850ms 才移除分身節點（沿用 `Scatter.tsx` 泡泡補間同款節奏）。
- 不改動現有 D3 繪圖邏輯本身（縣級聚合、inset 框、選取疊加層、村里 lazy load）——這些已通過 156+ 項驗證，本功能只加一層獨立的視覺效果。
- 不做精確邊界框縮放（bbox-to-bbox）、不鎖動畫期間其他互動、不改動散布圖/排名面板既有動畫時序——皆為 spec 明確排除的範圍（YAGNI）。

---

### Task 1: `zoomDirection` 純函式（TDD）

**Files:**
- Modify: `src/lib/nav.ts`（在既有 `View`/`dataLevelOf` 附近新增，檔尾 `effectiveIndicator` 之後）
- Test: `src/lib/nav.test.ts`（在既有 `describe` 區塊之後新增一個新的 `describe`）

**Interfaces:**
- Consumes：既有 `View` type（`{level, county, town, towncode}`）、既有 `NATION`/`drillToCounty`/`drillToTown`（測試用來建構各層 view）。
- Produces：`export function depthOf(view: View): number`、`export type ZoomDirection = "in" | "out" | null`、`export function zoomDirection(prev: View, next: View): ZoomDirection` —— Task 2（Choropleth.tsx）會 import 這兩個名稱。

- [ ] **Step 1: 寫失敗的測試**

在 `src/lib/nav.test.ts` 檔案最後（`describe("indicator availability by view level", ...)` 區塊之後）加入：

```ts
describe("zoomDirection（地圖 zoom in/out 動畫方向）", () => {
  it("depthOf 對應三層深度：nation=0、county=1、town=2", () => {
    expect(depthOf(NATION)).toBe(0);
    expect(depthOf(drillToCounty("臺北市"))).toBe(1);
    expect(depthOf(drillToTown(drillToCounty("臺北市"), "臺北市北投區", "63000110"))).toBe(2);
  });
  it("深度變深＝zoom in，變淺＝zoom out，深度不變＝null（不觸發動畫）", () => {
    const county = drillToCounty("臺北市");
    const town = drillToTown(county, "臺北市北投區", "63000110");
    expect(zoomDirection(NATION, county)).toBe("in");
    expect(zoomDirection(county, town)).toBe("in");
    expect(zoomDirection(NATION, town)).toBe("in"); // 跨層麵包屑/深連結一次到位也算 zoom in（純比深度差，不要求相鄰層）
    expect(zoomDirection(town, county)).toBe("out");
    expect(zoomDirection(town, NATION)).toBe("out");
    expect(zoomDirection(county, NATION)).toBe("out");
    expect(zoomDirection(NATION, NATION)).toBe(null);
    // 換指標/年份/主題/框選只會重跑 effect、view 本身不變 → 必須是 null（不能因為切 X 軸畫面也跳一下）
    expect(zoomDirection(county, county)).toBe(null);
  });
});
```

同時把檔案最上方的 import 從：
```ts
import { NATION, drillToCounty, drillToTown, up, crumbs, indicatorAvailable, effectiveIndicator,
  viewToHash, hashToView, sameView, type View } from "./nav";
```
改成（新增 `depthOf, zoomDirection`）：
```ts
import { NATION, drillToCounty, drillToTown, up, crumbs, indicatorAvailable, effectiveIndicator,
  viewToHash, hashToView, sameView, depthOf, zoomDirection, type View } from "./nav";
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/lib/nav.test.ts`
Expected: FAIL —— `depthOf`/`zoomDirection` 不存在（TypeScript 編譯錯誤或 undefined）。

- [ ] **Step 3: 寫最小實作**

在 `src/lib/nav.ts` 檔案最後（`effectiveIndicator` 函式之後）加入：

```ts
// 地圖 zoom in/out 動畫方向：nation=0、county=1、town=2。只有「深度」用來判斷方向——
// 換指標/年份/主題/框選會讓 Choropleth 的 effect 重跑，但 view 本身沒變，必須回傳 null 不觸發動畫。
export function depthOf(view: View): number {
  return view.level === "nation" ? 0 : view.level === "county" ? 1 : 2;
}
export type ZoomDirection = "in" | "out" | null;
export function zoomDirection(prev: View, next: View): ZoomDirection {
  const d = depthOf(next) - depthOf(prev);
  if (d > 0) return "in";
  if (d < 0) return "out";
  return null;
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/lib/nav.test.ts`
Expected: PASS（全部測試綠燈，含新增的 2 項）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/nav.ts src/lib/nav.test.ts
git commit -m "feat: 新增 zoomDirection 純函式,判斷地圖層級切換的縮放方向"
```

---

### Task 2: Choropleth.tsx——縮放動畫實作

**Files:**
- Modify: `src/charts/Choropleth.tsx`

**Interfaces:**
- Consumes：Task 1 的 `zoomDirection`（從 `../lib/nav` import，加進既有的 `import { drillToCounty, drillToTown, dataLevelOf, type View } from "./lib/nav";` 那行）。
- Produces：無新增對外介面（Choropleth 的 props 簽名不變），純內部視覺效果。

- [ ] **Step 1: 擴充 nav.ts 的 import**

把 `src/charts/Choropleth.tsx` 第 9 行：
```ts
import { drillToCounty, drillToTown, dataLevelOf, type View } from "../lib/nav";
```
改成：
```ts
import { drillToCounty, drillToTown, dataLevelOf, zoomDirection, type View } from "../lib/nav";
```

- [ ] **Step 2: 新增四個 ref**

在第 25 行 `const ref = useRef<SVGSVGElement>(null);` 之後加入：
```ts
  const wrapperRef = useRef<HTMLDivElement>(null);          // 縮放動畫容器(svg 的父層,絕對定位分身用)
  const prevViewRef = useRef<View>(view);                   // 上一次的 view,用來算深度差＝縮放方向
  const clickAnchorRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null); // 縮放中心點(相對 svg 容器像素)
  const ghostTimerRef = useRef<number | null>(null);        // 分身移除的 timer,供並發保護清除用
```

- [ ] **Step 3: tsc 確認到此為止沒有引入錯誤**

Run: `npx tsc --noEmit`
Expected: 0 errors（此步驟只加了未使用的 ref 宣告，TS 不會因未使用的 `useRef` 報錯，但確認語法正確）。

- [ ] **Step 4: 點擊時記錄縮放中心點**

第 83 行原本：
```ts
        .on("click", (_ev: MouseEvent, f: GeoJSON.Feature) => { clickOf(f)?.(); });
```
改成：
```ts
        .on("click", (ev: MouseEvent, f: GeoJSON.Feature) => {
          // 縣市/鄉鎮點擊會下鑽(觸發 zoom in)：先記錄點擊位置供縮放中心點用；
          // 村里點擊只顯示資訊面板、view 不變，不需要——即使意外設了也會在下一輪 effect
          // 開頭被無條件清掉，不會被日後無關的下鑽誤用（見 Step 5）
          if (level === "county" || level === "town") {
            const svgEl = (ev.currentTarget as SVGPathElement).ownerSVGElement;
            const rect = svgEl?.getBoundingClientRect();
            if (rect) clickAnchorRef.current = { x: ev.clientX - rect.left, y: ev.clientY - rect.top, w: rect.width, h: rect.height };
          }
          clickOf(f)?.();
        });
```

- [ ] **Step 5: effect 開頭偵測方向、建立分身**

第 32-37 行原本：
```ts
  useEffect(() => {
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    const W = 800, H = 900;
    svg.attr("viewBox", `0 0 ${W} ${H}`);
    setHover(null);
```
改成：
```ts
  useEffect(() => {
    const svgNode = ref.current;
    const svg = d3.select(svgNode);

    // --- 縮放動畫(老師建議):偵測 view 深度是否改變,只有下鑽/返回才觸發；
    // 換指標/年份/主題/框選也會重跑這個 effect,但 view 沒變,direction 會是 null、不動作 ---
    const direction = zoomDirection(prevViewRef.current, view);
    prevViewRef.current = view;
    const anchor = clickAnchorRef.current;
    clickAnchorRef.current = null; // 用過即清，防止陳舊點擊座標被下一次無關的重繪誤用
    if (ghostTimerRef.current !== null) { window.clearTimeout(ghostTimerRef.current); ghostTimerRef.current = null; }
    wrapperRef.current?.querySelectorAll("img[data-zoom-ghost]").forEach((el) => el.remove()); // 並發保護:先清掉任何殘留分身
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let ghostImg: HTMLImageElement | null = null;
    if (direction && !reduceMotion && svgNode && wrapperRef.current) {
      // 分身用 <img>(序列化目前 svg 為 data URI),不是 cloneNode 插入真的 <svg>——
      // 這樣動畫期間不會被任何既有驗證腳本的 `svg path` 查詢誤數到（見 plan Global Constraints）
      const clone = svgNode.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const svgStr = new XMLSerializer().serializeToString(clone);
      ghostImg = document.createElement("img");
      ghostImg.dataset.zoomGhost = "true";
      ghostImg.setAttribute("aria-hidden", "true");
      ghostImg.alt = "";
      ghostImg.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);
      ghostImg.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;";
      wrapperRef.current.appendChild(ghostImg);
    }

    svg.selectAll("*").remove();
    const W = 800, H = 900;
    svg.attr("viewBox", `0 0 ${W} ${H}`);
    setHover(null);
```

- [ ] **Step 6: tsc 確認**

Run: `npx tsc --noEmit`
Expected: 0 errors。

- [ ] **Step 7: effect 尾端播放轉場動畫**

原本第 220-221 行（三層 if/else if 結束後）：
```ts
    }
  }, [geo, counties, villages, values, meta, indicator, ind.key, deathCause, year, t, view, level, breaks, onView, selectedVillage, onSelectVillage, selectedTowns, onHoverCounty]);
```
改成：
```ts
    }

    // --- 縮放動畫收尾:真實內容從縮小/透明狀態長回正常,分身反向放大/縮小淡出。
    // 雙重 requestAnimationFrame 讓瀏覽器先畫出「起點」那一幀,轉場才會真的播放
    // (同排名長條「從 0 長出」動畫的既有教訓:同一輪設起點+終點,瀏覽器會合併繪製、動畫不跑)。
    if (direction && !reduceMotion && ghostImg && svgNode) {
      const originPct = anchor && anchor.w > 0 && anchor.h > 0
        ? `${(anchor.x / anchor.w) * 100}% ${(anchor.y / anchor.h) * 100}%`
        : "50% 50%"; // 無點擊座標(麵包屑/網址深連結/瀏覽器上一頁)：固定以容器正中央為縮放中心
      const enterFrom = direction === "in" ? "scale(0.92)" : "scale(1.08)";
      const exitTo = direction === "in" ? "scale(1.08)" : "scale(0.92)";
      const ghost = ghostImg;
      ghost.style.transformOrigin = originPct;
      svgNode.style.transformOrigin = originPct;
      svgNode.style.transition = "none";
      svgNode.style.transform = enterFrom;
      svgNode.style.opacity = "0";
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const EASE = "750ms cubic-bezier(0.4, 0, 0.2, 1)";
        ghost.style.transition = `transform ${EASE}, opacity ${EASE}`;
        ghost.style.transform = exitTo;
        ghost.style.opacity = "0";
        svgNode.style.transition = `transform ${EASE}, opacity ${EASE}`;
        svgNode.style.transform = "scale(1)";
        svgNode.style.opacity = "1";
      }));
      ghostTimerRef.current = window.setTimeout(() => {
        ghost.remove();
        svgNode.style.transition = "";
        ghostTimerRef.current = null;
      }, 850);
    }

    return () => {
      if (ghostTimerRef.current !== null) window.clearTimeout(ghostTimerRef.current);
    };
  }, [geo, counties, villages, values, meta, indicator, ind.key, deathCause, year, t, view, level, breaks, onView, selectedVillage, onSelectVillage, selectedTowns, onHoverCounty]);
```

- [ ] **Step 8: 把 `wrapperRef` 接到容器 div**

第 251 行原本：
```tsx
        <div style={fluid ? { position: "relative", minWidth: 0, flex: 1, minHeight: 0 } : { position: "relative", minWidth: 0 }}>
```
改成（加 `ref={wrapperRef}`）：
```tsx
        <div ref={wrapperRef} style={fluid ? { position: "relative", minWidth: 0, flex: 1, minHeight: 0 } : { position: "relative", minWidth: 0 }}>
```

- [ ] **Step 9: tsc + build 確認整支檔案沒問題**

Run: `npx tsc --noEmit && npm run build`
Expected: 0 errors，build 成功。

- [ ] **Step 10: 開發伺服器手動驗證**

Run: `npm run dev`（背景執行，開 `http://localhost:5173`）

手動操作確認：
1. 點任一縣市 → 應看到「以點擊處為中心放大淡出＋新畫面從點擊處長出」的 zoom in 效果，動畫結束後畫面正常（無殘影、無殘留分身節點——開瀏覽器 DevTools Elements 面板確認 `img[data-zoom-ghost]` 動畫結束後已消失）。
2. 點麵包屑「全國」回上層 → 應看到反方向的 zoom out 效果，中心點在容器正中央。
3. 切換左側任一指標按鈕（不下鑽）→ 地圖應瞬間更新、**完全沒有縮放動畫**。
4. 切換深色模式、切換年份 → 同樣完全沒有縮放動畫。
5. 系統設定打開「減少動態效果」（Windows：設定 → 協助工具 → 視覺效果 → 動畫效果關閉）後重整頁面，再下鑽 → 應瞬間切換，無動畫、無分身節點閃現。

- [ ] **Step 11: Commit**

```bash
git add src/charts/Choropleth.tsx
git commit -m "feat: 地圖層級切換加 zoom in/out 動畫(老師建議),點擊位置為中心,換指標/年份/主題不觸發"
```

---

### Task 3: 新增 `verify-map-zoom.mjs`

**Files:**
- Create: `scripts/verify-map-zoom.mjs`

**Interfaces:**
- Consumes：`http://localhost:5173`（需先 `npm run dev`）；沿用既有驗證腳本的 `chromium`/`ok`/`fail` 慣例（參照 `verify-merged.mjs` 開頭寫法）。
- Produces：無（獨立可執行腳本，`node scripts/verify-map-zoom.mjs`）。

- [ ] **Step 1: 寫腳本**

建立 `scripts/verify-map-zoom.mjs`：

```js
// 地圖層級切換 zoom in/out 動畫驗證(老師建議)：
// 換指標/年份/主題/框選不觸發、下鑽=zoom in、麵包屑返回=zoom out、reduced-motion 瞬間切換、
// 快速連續點擊(並發保護)不留殘留分身。需先 npm run dev(localhost:5173)。
import { chromium } from "playwright";
const fail = (m) => { console.error("FAIL: " + m); process.exitCode = 1; };
const ok = (m) => console.log("PASS: " + m);

const ghostCount = (p) => p.evaluate(() => document.querySelectorAll('img[data-zoom-ghost]').length);
const clickCounty = (p, name) => p.evaluate((n) => {
  const el = Array.from(document.querySelectorAll(".chart-map svg path"))
    .find((c) => c.__data__?.properties?.COUNTYNAME === n);
  el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  return !!el;
}, name);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await p.goto("http://localhost:5173");
await p.waitForFunction(() => document.querySelectorAll("svg path").length >= 20, null, { timeout: 30000 });
await p.waitForTimeout(300);

// ---- 1. 換指標不觸發縮放動畫（本功能最容易犯錯之處，明確回歸檢查）----
await p.locator(".taste-nav", { hasText: "平均所得" }).click();
await p.waitForTimeout(200);
if ((await ghostCount(p)) === 0) ok("換指標：無縮放分身(不觸發動畫)");
else fail("換指標卻出現縮放分身");
await p.locator(".taste-nav", { hasText: "人口密度" }).click();
await p.waitForTimeout(200);

// ---- 2. 換年份不觸發 ----
await p.locator(".year-tab", { hasText: "102 年" }).click();
await p.waitForTimeout(200);
if ((await ghostCount(p)) === 0) ok("換年份：無縮放分身");
else fail("換年份卻出現縮放分身");
await p.locator(".year-tab", { hasText: "107 年" }).click();
await p.waitForTimeout(200);

// ---- 3. 換深色模式不觸發 ----
await p.locator(".year-like", { hasText: "深色模式" }).click();
await p.waitForTimeout(200);
if ((await ghostCount(p)) === 0) ok("換主題：無縮放分身");
else fail("換主題卻出現縮放分身");
await p.locator(".year-like", { hasText: "淺色模式" }).click();
await p.waitForTimeout(200);

// ---- 4. 點縣市下鑽＝zoom in：動畫期間分身存在，850ms 後消失，地圖內容立即正確 ----
if (await clickCounty(p, "臺北市")) ok("點擊臺北市"); else fail("找不到臺北市多邊形");
await p.waitForTimeout(80); // 抓動畫「進行中」的瞬間
const midGhosts = await ghostCount(p);
const midPaths = await p.evaluate(() => document.querySelectorAll(".chart-map svg:not([data-zoom-ghost]) path").length);
if (midGhosts === 1) ok("下鑽瞬間：分身存在 1 個(zoom in 動畫進行中)");
else fail("下鑽瞬間分身數異常: " + midGhosts);
if (midPaths === 12) ok("下鑽瞬間：地圖內容已是新層(12 區)，不受分身影響");
else fail("下鑽瞬間地圖內容異常 paths=" + midPaths);
await p.waitForTimeout(850);
if ((await ghostCount(p)) === 0) ok("850ms 後：分身已移除");
else fail("分身未清除");
const crumb1 = await p.locator('nav[aria-label="下鑽層級"]').textContent();
if (crumb1?.includes("臺北市")) ok("麵包屑已下鑽至臺北市"); else fail("麵包屑異常: " + crumb1);

// ---- 5. 點麵包屑回全國＝zoom out ----
await p.locator('nav[aria-label="下鑽層級"] button').filter({ hasText: "全國" }).click();
await p.waitForTimeout(80);
if ((await ghostCount(p)) === 1) ok("回全國瞬間：分身存在 1 個(zoom out 動畫進行中)");
else fail("回全國瞬間分身數異常");
await p.waitForTimeout(850);
if ((await ghostCount(p)) === 0) ok("回全國 850ms 後：分身已移除");
else fail("回全國分身未清除");

// ---- 6. 快速連續點擊(並發保護)：不留下多個殘留分身 ----
await clickCounty(p, "臺北市");
await p.waitForTimeout(80);
await p.locator('nav[aria-label="下鑽層級"] button').filter({ hasText: "全國" }).click();
await p.waitForTimeout(80);
await clickCounty(p, "高雄市");
await p.waitForTimeout(80);
const rapidGhosts = await ghostCount(p);
if (rapidGhosts <= 1) ok(`快速連續操作：分身數 ${rapidGhosts}（不堆疊，最後動作贏）`);
else fail("快速連續操作留下多個分身: " + rapidGhosts);
await p.waitForTimeout(850);
if ((await ghostCount(p)) === 0) ok("快速操作結束 850ms 後：分身已全數清除");
else fail("快速操作後仍有殘留分身");

// ---- 7. reduced-motion：瞬間切換，完全無分身 ----
const p2 = await b.newPage({ viewport: { width: 1500, height: 950 }, reducedMotion: "reduce" });
p2.on("pageerror", (e) => errors.push(String(e)));
await p2.goto("http://localhost:5173");
await p2.waitForFunction(() => document.querySelectorAll("svg path").length >= 20, null, { timeout: 30000 });
await clickCounty(p2, "臺南市");
await p2.waitForTimeout(200);
if ((await ghostCount(p2)) === 0) ok("reduced-motion：下鑽不建立分身");
else fail("reduced-motion 仍建立了分身");
const crumb2 = await p2.locator('nav[aria-label="下鑽層級"]').textContent();
if (crumb2?.includes("臺南市")) ok("reduced-motion：下鑽仍正確瞬間切換至臺南市");
else fail("reduced-motion 下鑽失敗: " + crumb2);
await p2.close();

if (errors.length) fail("console/page 錯誤: " + errors.join(" | ")); else ok("無 console/page 錯誤");
await b.close();
console.log(process.exitCode ? "== 有項目失敗 ==" : "== 全部通過 ==");
```

- [ ] **Step 2: 啟動 dev server（若尚未啟動）**

Run（背景執行）: `npm run dev`

- [ ] **Step 3: 執行驗證腳本**

Run: `node scripts/verify-map-zoom.mjs`
Expected: 全部 `PASS:`，結尾 `== 全部通過 ==`。若任何一項 `FAIL:`，回頭檢查 Task 2 對應的邏輯（例如 `direction` 判斷或分身清除時機），修正後重跑本步驟，不要跳過。

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-map-zoom.mjs
git commit -m "test: 新增 verify-map-zoom 驗證地圖縮放動畫觸發規則與並發保護"
```

---

### Task 4: 既有回歸套件 + README 更新

**Files:**
- Modify: `README.md`（verify 腳本清單、vitest 項目數、功能敘述新增一句）
- Test: 全部既有 vitest／pytest／Playwright 腳本（不預期需要改動內容，僅供驗證；若發現實際失敗才動手修，見 Step 2 說明）

**Interfaces:** 無新介面，本任務是收尾驗證與文件同步。

- [ ] **Step 1: 全套 vitest**

Run: `npx vitest run`
Expected: 全部通過，總數＝原本數字＋2（Task 1 新增的 2 項）。記下實際印出的總數，Step 6 會用到。

- [ ] **Step 2: 全部既有 Playwright 驗證腳本（需先 `npm run dev` 開著）**

依序執行並確認全部 `== 全部通過 ==`：
```bash
node scripts/verify-drilldown.mjs
node scripts/verify-designs.mjs
node scripts/verify-taiwanvotes.mjs
node scripts/verify-scatter.mjs
node scripts/verify-brush-play.mjs
node scripts/verify-scatter-causes.mjs
node scripts/verify-merged.mjs
node scripts/verify-rwd.mjs
```

若有任何一支在下鑽動作後的斷言出現「數量對不上」的失敗（例如路徑數量、螢幕截圖時機），**先確認失敗訊息裡的實際數字**：因為分身用 `<img>` 不會污染 `svg path` 計數，理論上不需要改動任何既有腳本；若確實觀察到失敗，在該腳本對應的斷言之前，於該次下鑽點擊的 `waitForFunction`/`waitForTimeout` 之後，額外加一行 `await page.waitForTimeout(850);` 再重跑該腳本確認轉綠。不要預先臆測性修改未實際失敗的地方。

- [ ] **Step 3: tsc + build**

Run: `npx tsc --noEmit && npm run build`
Expected: 0 errors，build 成功。

- [ ] **Step 4: ETL pytest（確認未受影響，純粹作為完整回歸的一部分）**

Run（於 `township-drilldown-app` 目錄下）: `python -m pytest etl/ -q`
Expected: 8 項全過（本功能未觸碰 ETL，預期無變化，執行此步驟純為完整回歸紀錄）。

- [ ] **Step 5: 手動截圖存證**

用 Step 1（Task 2）已開著的 `npm run dev`，在瀏覽器開 DevTools 打開效能面板或直接用眼睛確認下鑽動畫，截兩張圖存到 `docs/superpowers/artifacts/`：
- `map-zoom-in-midflight.png`：點擊某縣市、動畫進行到一半時的畫面（分身淡出＋新內容淡入交疊的瞬間）。
- `map-zoom-out-settled.png`：麵包屑回全國、動畫結束後的畫面。

- [ ] **Step 6: 更新 README**

在 `README.md` 找到功能敘述段落（三層下鑽相關的段落）與驗證清單段落：
1. 在三層下鑽功能敘述附近新增一句：「縣市/鄉鎮下鑽與返回上層時，地圖以點擊位置為中心播放 zoom in/out 縮放動畫（老師建議；換指標/年份/主題/框選不觸發；`prefers-reduced-motion` 時瞬間切換）。」
2. 找到 `node scripts/verify-rwd.mjs` 那一行，新增一行：
   ```
   node scripts/verify-map-zoom.mjs        # 地圖縮放動畫：觸發規則(換指標/年份/主題不觸發)+並發保護+reduced-motion
   ```
3. 找到 `npm run test` 那一行的 vitest 項目數敘述，把數字改成 Step 1 實際印出的總數（原數字＋2）。

- [ ] **Step 7: Commit**

```bash
git add README.md docs/superpowers/artifacts/map-zoom-in-midflight.png docs/superpowers/artifacts/map-zoom-out-settled.png
git commit -m "docs: README 補地圖縮放動畫敘述與驗證腳本清單、更新 vitest 項目數"
```

---

## Self-Review 附註（寫給執行者）

- **Spec 對照**：spec 的「範圍與行為規則」「技術架構」「測試影響」「不做」四節，逐一對應 Task 1（方向判斷）、Task 2（動畫實作）、Task 3+4（測試影響與回歸）、Global Constraints 最後一條（YAGNI 排除項）——無遺漏。
- 分身技術從 spec 原寫的「`cloneNode` 插入 `<svg>`」修正為「序列化成 `<img>`」，原因與風險分析已寫入 Global Constraints 第二條，執行者不需要重新推導。
- Task 2 Step 10 的手動驗證與 Task 4 Step 5 的截圖存證都需要真人眼睛看過，不是自動化能完全取代的一關（呼應本專案「human-in-the-loop」一貫做法）。
