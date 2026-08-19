# 散布圖滾輪縮放 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 township-drilldown-app 散布圖(`Scatter.tsx`)的「放大」框選縮放按鈕拿掉，改成滑鼠滾輪縮放（游標錨點、縮小 clamp 回全域、放大 clamp 5% 下限），並同步更新使用說明彈窗文字與相關 verify 腳本。只在 localhost 完成與驗證，不部署。

**Architecture:** 縮放的核心數學（依錨點與係數算新 domain、clamp 邊界、超過全域回 null）抽成 `src/lib/scatterZoom.ts` 的純函式並用 vitest 覆蓋；`Scatter.tsx` 只需在既有的 `zoomX`/`zoomY` state 上掛一個 `wheel` DOM 事件監聽器呼叫這個函式，拿掉整個「放大」按鈕與 `mode === "zoom"` 分支。既有的 `zoomX`/`zoomY` state、symlog 軸切線性刻度、雙擊還原、裁切區等機制完全不動。

**Tech Stack:** React + TypeScript + d3(v7, `d3.pointer`/`scaleLinear`/`scaleSymlog`) + vitest（單元測試）+ Playwright（`scripts/verify-*.mjs` 端對端腳本，需先 `npm run dev` 起 localhost:5173）。

## Global Constraints

- 縮放錨點＝滑鼠游標位置（游標下的資料值縮放後仍在游標下）。
- 縮小 clamp：新 domain 寬度 ≥ 全域寬度時，直接回到 `null`（=全範圍，symlog 軸自動切回既有固定對數刻度）。
- 放大 clamp：新 domain 寬度不得小於全域寬度的 5%。
- 只保留雙擊空白處還原；不加「還原」按鈕。
- 選取／清除模式與其拖曳框選邏輯不受影響，滾輪縮放獨立運作。
- 不處理觸控 pinch-zoom、不做縮放狀態持久化。

---

### Task 1: 抽出滾輪縮放的 domain 數學為純函式 + 單元測試

**Files:**
- Create: `src/lib/scatterZoom.ts`
- Test: `src/lib/scatterZoom.test.ts`

**Interfaces:**
- Produces: `zoomDomain(current: [number, number], full: [number, number], anchor: number, factor: number, minFrac?: number): [number, number] | null` — Task 2 的 wheel handler 會呼叫這個函式算 X/Y 各自的新 domain。`factor > 1` = 放大（domain 變窄），`factor < 1` = 縮小（domain 變寬）；`minFrac` 預設 `0.05`。

- [ ] **Step 1: 寫失敗測試**

建立 `src/lib/scatterZoom.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { zoomDomain } from "./scatterZoom";

describe("zoomDomain", () => {
  it("放大:錨點在中心,domain 對稱縮小", () =>
    expect(zoomDomain([0, 100], [0, 100], 50, 2)).toEqual([25, 75]));

  it("放大:錨點偏左,錨點在新舊 domain 中的比例(t)不變", () =>
    expect(zoomDomain([0, 100], [0, 100], 20, 2)).toEqual([10, 60]));

  it("縮小到超過全域寬度 → 回 null(還原全範圍)", () =>
    expect(zoomDomain([25, 75], [0, 100], 50, 0.5)).toBeNull());

  it("縮小但未達全域寬度 → 正常擴大", () =>
    expect(zoomDomain([40, 60], [0, 100], 50, 0.5)).toEqual([30, 70]));

  it("放大超過 5% 下限 → clamp 在 minFrac(預設 0.05)對應的寬度", () =>
    expect(zoomDomain([45, 55], [0, 100], 50, 4)).toEqual([47.5, 52.5]));

  it("放大貼左邊界 → clamp 平移(不改變寬度),不超出全域下界", () =>
    expect(zoomDomain([0, 20], [0, 100], 5, 0.5)).toEqual([0, 40]));

  it("放大貼右邊界 → clamp 平移(不改變寬度),不超出全域上界", () =>
    expect(zoomDomain([80, 100], [0, 100], 95, 0.5)).toEqual([60, 100]));

  it("degenerate domain(寬度 0)→ 退回中心錨點(t=0.5),不除以零", () =>
    expect(zoomDomain([50, 50], [0, 100], 50, 2)).toEqual([47.5, 52.5]));
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npm test -- scatterZoom`
Expected: FAIL，錯誤訊息類似 `Cannot find module './scatterZoom'`（檔案還不存在）。

- [ ] **Step 3: 寫最小實作**

建立 `src/lib/scatterZoom.ts`：

```typescript
// 滾輪縮放的 domain 數學(純函式,不碰 DOM/React state):以 anchor(游標對應的資料值)
// 為錨點縮放 [current] 這段 domain,factor>1=放大(變窄)、factor<1=縮小(變寬)。
// 縮小超過 full 的寬度直接回 null(=交給呼叫端還原成全範圍,symlog 軸會自動切回固定對數刻度)。
// 放大 clamp 在 full 寬度的 minFrac(預設 5%),避免縮到看不到任何資料點。
export function zoomDomain(
  current: [number, number],
  full: [number, number],
  anchor: number,
  factor: number,
  minFrac = 0.05,
): [number, number] | null {
  const [lo, hi] = current;
  const [fullLo, fullHi] = full;
  const width = hi - lo;
  const fullWidth = fullHi - fullLo;
  let newWidth = width / factor;
  const minWidth = fullWidth * minFrac;
  if (newWidth < minWidth) newWidth = minWidth;
  if (newWidth >= fullWidth) return null;
  // t=錨點在目前 domain 裡的比例位置;縮放後用同一個 t 反推新邊界,螢幕座標上的錨點位置不變
  // (range 不變、t 不變 ⇒ 映射到同一個像素)。寬度 0(degenerate)時無比例可言,退回置中。
  const t = width === 0 ? 0.5 : (anchor - lo) / width;
  let newLo = anchor - t * newWidth;
  let newHi = newLo + newWidth;
  // 邊界 clamp:平移(不改寬度)把超出全域的部分推回界內,保持 newWidth 不變
  if (newLo < fullLo) { newHi += fullLo - newLo; newLo = fullLo; }
  if (newHi > fullHi) { newLo -= newHi - fullHi; newHi = fullHi; }
  return [newLo, newHi];
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npm test -- scatterZoom`
Expected: PASS，8 項全過。

- [ ] **Step 5: Commit**

```bash
git add src/lib/scatterZoom.ts src/lib/scatterZoom.test.ts
git commit -m "feat: 抽出滾輪縮放 domain 數學為純函式(zoomDomain)+ 單元測試"
```

---

### Task 2: Scatter.tsx 拿掉放大按鈕,改掛滾輪縮放

**Files:**
- Modify: `src/charts/Scatter.tsx`

**Interfaces:**
- Consumes: `zoomDomain` from `./scatterZoom`（Task 1）；既有的 `x`/`y`（`d3.ScaleLinear`/`d3.ScaleSymlog`，都支援 `.domain()`/`.invert()`）、`zoomX`/`zoomY` state、`domAll`、`safeDomain`、`makeScale`、`M`/`PAD`/`W`/`H` 常數（皆已存在於檔案內）。
- Produces: 無新的對外介面（`Scatter` 元件 props 不變）。

- [ ] **Step 1: 型別與衍生變數拿掉 zoom 模式**

在 `src/charts/Scatter.tsx` 找到：

```typescript
  const [mode, setMode] = useState<"select" | "clear" | "zoom" | null>(null);
  const selectMode = mode === "select";
  const clearMode = mode === "clear";
  const zoomMode = mode === "zoom";
  // 放大鏡框選縮放(使用者要求,7/31,仿 Gapminder Bubbles 縮放工具):純視覺,不進 App/reducer、
  // 不影響 selected 名單。null=用全範圍(domAll 算出的完整 extent)。
  const [zoomX, setZoomX] = useState<[number, number] | null>(null);
  const [zoomY, setZoomY] = useState<[number, number] | null>(null);
```

改成：

```typescript
  const [mode, setMode] = useState<"select" | "clear" | null>(null);
  const selectMode = mode === "select";
  const clearMode = mode === "clear";
  // 滾輪縮放(使用者要求,8/4,取代原本的放大鏡框選按鈕):純視覺,不進 App/reducer、
  // 不影響 selected 名單。null=用全範圍(domAll 算出的完整 extent)。見下方 wheel effect。
  const [zoomX, setZoomX] = useState<[number, number] | null>(null);
  const [zoomY, setZoomY] = useState<[number, number] | null>(null);
```

- [ ] **Step 2: 加上全域 domain 的 memo(給滾輪縮放的 clamp 用)**

找到（緊接在 `x`/`y`/`r` 三個 scale 的 `useMemo` 之後）：

```typescript
  const r = useMemo(() => d3.scaleSqrt().domain(safeDomain(domAll[sizeKey], sizeKey)).range(R_RANGE), [domAll, sizeKey]);
```

在這行後面新增：

```typescript
  // 滾輪縮放 clamp 用的「完整範圍」:重用 makeScale 算出跟 x/y 完全一致的 domain
  // (symlog 軸是 [0, niceHi(...)],線性軸是 .nice() 過的邊界,不是 safeDomain 的原始值)。
  const fullXDomain = useMemo(
    () => makeScale(xIsLog, safeDomain(domAll[xKey], xKey), [M.l + PAD, W - M.r - PAD]).domain() as [number, number],
    [domAll, xKey, xIsLog, W]);
  const fullYDomain = useMemo(
    () => makeScale(yIsLog, safeDomain(domAll[yKey], yKey), [H - M.b - PAD, M.t + PAD]).domain() as [number, number],
    [domAll, yKey, yIsLog, H]);
```

- [ ] **Step 3: 拿掉 brush 的 zoom 分支**

找到框選 `useEffect`（`d3.brush()...on("end", ...)`）裡的：

```typescript
        if (!ev.selection) {
          // 點空白處(無拖曳,使用者要求 7/31):三個模式都比照「再次點按鈕」退出目前模式;
          // 放大模式額外連同縮放範圍一起還原(同按鈕/雙擊空白處的還原邏輯)。
          bg.call(brush.move as any, null);
          if (mode === "zoom") { setZoomX(null); setZoomY(null); }
          setMode(null);
          return;
        }
        const rectSel = ev.selection as [[number, number], [number, number]];
        if (mode === "zoom") {
          const [[rx0, ry0], [rx1, ry1]] = rectSel;
          const xv0 = x.invert(rx0), xv1 = x.invert(rx1);
          const yv0 = y.invert(ry0), yv1 = y.invert(ry1); // y 螢幕座標上下顛倒,取 min/max 排好順序
          setZoomX([Math.min(xv0, xv1), Math.max(xv0, xv1)]);
          setZoomY([Math.min(yv0, yv1), Math.max(yv0, yv1)]);
          bg.call(brush.move as any, null);
          return;
        }
        const pts = scatterPoints(values, meta, year)
```

改成：

```typescript
        if (!ev.selection) {
          // 點空白處(無拖曳):兩個模式都比照「再次點按鈕」退出目前模式,不動 selected 名單。
          bg.call(brush.move as any, null);
          setMode(null);
          return;
        }
        const rectSel = ev.selection as [[number, number], [number, number]];
        const pts = scatterPoints(values, meta, year)
```

同一個 effect 上方的註解也要跟著改，找到：

```typescript
  // 框選(d3.brush):放開瞬間依模式做三選一——選取=框內泡泡併入名單(累加)、
  // 清除=框內泡泡移出名單(累減)、放大=把框選矩形換算回資料值當新的 X/Y 軸範圍(7/31 新增,
  // 仿 Gapminder Bubbles 縮放工具;純視覺,不動 selected 名單)。
```

改成：

```typescript
  // 框選(d3.brush):放開瞬間依模式做二選一——選取=框內泡泡併入名單(累加)、
  // 清除=框內泡泡移出名單(累減)。縮放改走滾輪(見下方 wheel effect),不再經過框選。
```

- [ ] **Step 4: 雙擊還原拿掉退出 zoom 模式那行**

找到：

```typescript
    svg.on("dblclick.zoomReset", (ev: MouseEvent) => {
      if ((ev.target as Element).tagName?.toLowerCase() === "circle") return;
      setZoomX(null); setZoomY(null);
      // 比照「再次點放大鏡按鈕」「點空白處(無拖曳)」:一併退出放大模式,三種還原手勢行為一致。
      setMode((m) => (m === "zoom" ? null : m));
    });
```

改成：

```typescript
    svg.on("dblclick.zoomReset", (ev: MouseEvent) => {
      if ((ev.target as Element).tagName?.toLowerCase() === "circle") return;
      setZoomX(null); setZoomY(null);
    });
```

- [ ] **Step 5: 新增滾輪縮放 effect**

在雙擊還原那個 `useEffect`（Step 4 改的那個）後面，新增一個新的 `useEffect`：

```typescript
  // 滾輪縮放(使用者要求,8/4,取代原本的放大鏡框選按鈕):以游標位置為錨點,往上滾(deltaY<0)
  // 放大、往下滾縮小;數學細節見 zoomDomain(src/lib/scatterZoom.ts)。用原生 addEventListener
  // (而非 d3 的 .on)是為了明確傳入 { passive: false },讓 preventDefault() 能擋掉整頁捲動。
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const ZOOM_STEP = 1.2;
    const handler = (ev: WheelEvent) => {
      ev.preventDefault();
      const [px, py] = d3.pointer(ev, node);
      const factor = ev.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const xv = x.invert(px), yv = y.invert(py);
      setZoomX(zoomDomain(x.domain() as [number, number], fullXDomain, xv, factor));
      setZoomY(zoomDomain(y.domain() as [number, number], fullYDomain, yv, factor));
    };
    node.addEventListener("wheel", handler, { passive: false });
    return () => node.removeEventListener("wheel", handler);
  }, [x, y, fullXDomain, fullYDomain]);
```

在檔案頂端 import 區塊加入這個新函式：

```typescript
import { townsInRect } from "../lib/brushSelect";
```

改成：

```typescript
import { townsInRect } from "../lib/brushSelect";
import { zoomDomain } from "../lib/scatterZoom";
```

- [ ] **Step 6: 拿掉「放大」按鈕,改文案 + 拿掉相關樣式常數**

找到整段「放大鏡/選取/清除」控制列註解與放大按鈕（`.scatter-select-toggle .scatter-zoom-toggle`）：

```typescript
      {/* 放大鏡/選取/清除(使用者要求,7/30 選取清除、7/31 加放大鏡):三者互斥的工具切換鈕
          (工具式,再按一次或切到另一顆即關閉;不會做完一次動作就自動退出)。清除鈕無選取時停用
          (沒東西可清,灰階不可點,不從 DOM 消失防版面跳動);名單清空後(見上方 useEffect)也會
          自動退出清除模式。放大鏡框選=把矩形換算回資料值當新 X/Y 軸範圍,雙擊空白處還原。 */}
      <div ref={controlsRef} className="scatter-select-controls" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexShrink: 0, flexGrow: 1, position: "relative" }}>
        {/* 樣式比照下方年份列的播放鈕(同一套 aria-pressed 開關視覺,使用者要求一致);
            class 不能共用 .year-play——會讓既有驗證腳本的 `.year-play` 選擇器同時選到
            兩顆按鈕而炸掉(strict mode 衝突),用專屬 class 名稱、CSS 規則另外掛。三顆鈕都共用
            .scatter-select-toggle 拿視覺樣式,另外各自疊一個專屬 class 供驗證腳本精準辨識
            (單靠 :not(.sel-clear) 排除法在三顆鈕時會失效,見 verify-brush-play 教訓)。 */}
        <button className="scatter-select-toggle scatter-zoom-toggle" aria-pressed={zoomMode} aria-label="放大"
          title="放大:拖曳框選要放大的範圍;再按一次或雙擊空白處還原"
          onClick={() => {
            // 再次點擊已開啟的放大鏡=連同縮放範圍一起還原(使用者要求,7/31):
            // 不用非得記得「雙擊空白處」才能還原,按鈕本身就是還原捷徑。
            if (mode === "zoom") { setZoomX(null); setZoomY(null); }
            setMode((m) => (m === "zoom" ? null : "zoom"));
          }}
          style={{ cursor: "pointer", padding: "4px 10px", borderRadius: C.pill.radius,
            border: `1px solid ${zoomMode ? t.accent : t.border}`,
            background: zoomMode ? t.accent : t.surface,
            color: zoomMode ? t.accentFg : t.text,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontFamily: "inherit", transition: "background .15s, border-color .15s, color .15s" }}>
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden focusable="false">
            <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <line x1="11" y1="11" x2="15" y2="15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <button className="scatter-select-toggle scatter-mode-select" aria-pressed={selectMode}
```

改成：

```typescript
      {/* 選取/清除(使用者要求,7/30):兩者互斥的工具切換鈕(工具式,再按一次或切到另一顆即關閉;
          不會做完一次動作就自動退出)。清除鈕無選取時停用(沒東西可清,灰階不可點,不從 DOM 消失
          防版面跳動);名單清空後(見上方 useEffect)也會自動退出清除模式。縮放改走滾輪
          (8/4,取代原本這裡的放大鏡按鈕,見上方 wheel effect),雙擊空白處還原。 */}
      <div ref={controlsRef} className="scatter-select-controls" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexShrink: 0, flexGrow: 1, position: "relative" }}>
        {/* 樣式比照下方年份列的播放鈕(同一套 aria-pressed 開關視覺,使用者要求一致);
            class 不能共用 .year-play——會讓既有驗證腳本的 `.year-play` 選擇器同時選到
            兩顆按鈕而炸掉(strict mode 衝突),用專屬 class 名稱、CSS 規則另外掛。兩顆鈕都共用
            .scatter-select-toggle 拿視覺樣式,另外各自疊一個專屬 class 供驗證腳本精準辨識。 */}
        <button className="scatter-select-toggle scatter-mode-select" aria-pressed={selectMode}
```

- [ ] **Step 7: 更新使用說明彈窗的列點文字**

找到：

```typescript
            <li>按「放大」開啟後，拖曳框選要放大的範圍；再按一次或點空白處還原。</li>
```

改成：

```typescript
            <li>滑鼠移到圖上滾動滾輪可縮放；雙擊空白處還原。</li>
```

- [ ] **Step 8: 型別檢查 + 起 dev server 手動確認**

Run: `npx tsc --noEmit`
Expected: 無錯誤（`zoomMode`/`"zoom"` mode 的殘留參照若還沒清乾淨,這裡會報錯,依報錯位置補漏）。

Run: `npm run dev`（另開終端機,保持執行,後面 Task 3/4 的 Playwright 腳本要用）
在瀏覽器打開 `http://localhost:5173`，切到有散布圖的頁面，用滑鼠滾輪在圖上滾動，確認會放大/縮小；確認「放大」按鈕已經不見，只剩「選取」「清除」「使用說明」三顆；點開「使用說明」確認列點文字已經改成滾輪縮放的說明；雙擊空白處確認縮放還原。

- [ ] **Step 9: Commit**

```bash
git add src/charts/Scatter.tsx
git commit -m "feat: 散布圖縮放改滑鼠滾輪(取代放大鏡框選按鈕),游標錨點+全域/5%上下限"
```

---

### Task 3: 改寫 verify-scatter-zoom.mjs 為滾輪驗證

**Files:**
- Modify: `scripts/verify-scatter-zoom.mjs`

**Interfaces:**
- Consumes: Task 2 完成後的 `Scatter.tsx`（`.scatter-zoom-toggle` 已不存在；`g.dots`/`.scatter-caption`/軸刻度 DOM 結構不變）。localhost:5173 dev server 需在跑（Task 2 Step 8 已啟動）。

- [ ] **Step 1: 整份改寫測試腳本**

用以下內容整份覆蓋 `scripts/verify-scatter-zoom.mjs`：

```javascript
// 散布圖滾輪縮放驗證(8/4,取代原本的放大鏡框選按鈕):以游標位置為錨點縮放 X/Y 軸範圍、
// 人口密度(symlog)軸縮放時暫時改線性刻度(方案 A,沿用 7/31 邏輯不變)、縮小到全域自動還原、
// 放大有 5% 下限、雙擊空白處還原、選取/清除模式下滾輪縮放仍可用且不影響框選結果。
// 需先 npm run dev(localhost:5173)。
import { chromium } from "playwright";
const fail = (m) => { console.error("FAIL: " + m); process.exitCode = 1; };
const ok = (m) => console.log("PASS: " + m);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await p.goto("http://localhost:5173");
await p.waitForFunction(() => document.querySelectorAll("svg path").length >= 20, null, { timeout: 30000 });
await p.waitForTimeout(500);

const selectToggle = p.locator(".scatter-mode-select");
const clearToggle = p.locator("button.sel-clear");
const sbox = () => p.locator(".chart-scatter svg[width='100%']").boundingBox();
// 在圖表座標系(fx,fy 為 0~1 的相對位置)上滾動滾輪;deltaY<0=放大、>0=縮小(見 Scatter.tsx)
const wheelAt = async (fx, fy, deltaY, times = 1) => {
  const bx = await sbox();
  await p.mouse.move(bx.x + bx.width * fx, bx.y + bx.height * fy);
  for (let i = 0; i < times; i++) await p.mouse.wheel(0, deltaY);
  await p.waitForTimeout(300);
};
const clickBlank = async () => {
  const bx = await sbox();
  await p.mouse.click(bx.x + bx.width * 0.98, bx.y + bx.height * 0.95);
  await p.waitForTimeout(400);
};
const xTickTexts = () => p.evaluate(() =>
  Array.from(document.querySelectorAll("g.axes > g")[0].querySelectorAll(".tick text")).map((t) => t.textContent));
const xAxisMax = async () => Math.max(...(await xTickTexts()).map((s) => Number(s.replace(/,/g, ""))).filter((n) => !Number.isNaN(n)));

if (await p.locator(".scatter-zoom-toggle").count() === 0) ok("「放大」按鈕已移除");
else fail("「放大」按鈕仍存在,應已被滾輪縮放取代");

// ==== 第一段:X=人口密度(symlog),滾輪縮放時暫時改線性刻度(方案 A,沿用 7/31 邏輯) ====
if ((await xTickTexts()).includes("40,000")) ok("預設人口密度軸=手調固定刻度(含 40,000)");
else fail("預設人口密度軸刻度異常: " + (await xTickTexts()));

await wheelAt(0.3, 0.5, -300, 6); // 游標偏左、往上滾(放大)六次,確保縮放幅度夠大能觸發線性刻度
const densityTicksZoomed = await xTickTexts();
if (!densityTicksZoomed.includes("40,000")) ok(`滾輪放大後人口密度軸改線性刻度(${densityTicksZoomed.join("、")})`);
else fail("滾輪放大後仍是固定刻度組,方案 A 未生效: " + densityTicksZoomed.join("、"));

// ---- 泡泡不跑出 X/Y 軸:縮放後軸外的泡泡要被裁掉,不能疊到軸線外(裁切區沿用 7/31 機制) ----
const clipInfo = await p.evaluate(() => {
  const dots = document.querySelector("g.dots");
  const svg = dots.closest("svg");
  const clipAttr = dots.getAttribute("clip-path");
  const idMatch = clipAttr?.match(/#([\w-]+)/);
  const clipRect = idMatch ? svg.querySelector(`#${idMatch[1]} rect`) : null;
  return { hasClip: !!clipAttr, rectExists: !!clipRect, w: clipRect ? +clipRect.getAttribute("width") : null, h: clipRect ? +clipRect.getAttribute("height") : null };
});
if (clipInfo.hasClip && clipInfo.rectExists && clipInfo.w > 0 && clipInfo.h > 0)
  ok(`g.dots 有裁切區限制在軸線範圍內(${clipInfo.w}×${clipInfo.h})`);
else fail("g.dots 缺少有效裁切區,縮放時軸外泡泡會跑出範圍: " + JSON.stringify(clipInfo));

// 雙擊空白處還原
await p.evaluate(() => {
  const svg = document.querySelector("g.dots").closest("svg");
  svg.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
});
await p.waitForTimeout(400);
if ((await xTickTexts()).includes("40,000")) ok("雙擊空白處 → 滾輪縮放還原(刻度變回固定值)");
else fail("雙擊空白處未還原: " + (await xTickTexts()).join("、"));

// ==== 第二段:縮小 clamp 回全域、放大 clamp 5% 下限 ====
await p.locator('select.scatter-ch[data-ch="x"]').selectOption({ label: "平均所得" });
await p.waitForTimeout(700);
const fullMax = await xAxisMax();
await wheelAt(0.5, 0.5, -300, 8); // 中心點連續放大八次
const zoomedMax = await xAxisMax();
if (zoomedMax < fullMax) ok(`滾輪放大正常:${fullMax}→${zoomedMax}`);
else fail(`滾輪放大異常: ${zoomedMax} 未小於 ${fullMax}`);

await wheelAt(0.5, 0.5, -300, 30); // 大量再放大,確認會 clamp 在 5% 下限而不是縮到 0/negative
const overZoomedMax = await xAxisMax();
const overZoomedTexts = await xTickTexts();
const overZoomedMin = Math.min(...overZoomedTexts.map((s) => Number(s.replace(/,/g, ""))).filter((n) => !Number.isNaN(n)));
if (overZoomedMax > overZoomedMin && (overZoomedMax - overZoomedMin) > 0)
  ok(`連續大量放大仍維持有效範圍(未縮到 0):${overZoomedMin}~${overZoomedMax}`);
else fail(`連續大量放大後範圍異常: ${overZoomedMin}~${overZoomedMax}`);

await wheelAt(0.5, 0.5, 300, 40); // 大量往下滾(縮小),應該會 clamp 回全域而不是無限放大範圍
await p.waitForTimeout(300);
if ((await xAxisMax()) === fullMax) ok(`連續大量縮小 → clamp 回全域範圍(${fullMax})`);
else fail(`連續大量縮小後未回到全域範圍: ${await xAxisMax()} ≠ ${fullMax}`);

// ==== 第三段:選取/清除模式下滾輪縮放仍可用,且不影響框選結果 ====
await selectToggle.click();
await p.waitForTimeout(150);
const dragFrac = async (fx0, fy0, fx1, fy1) => {
  const bx = await sbox();
  const pt = (fx, fy) => [bx.x + bx.width * fx, bx.y + bx.height * fy];
  const [ax0, ay0] = pt(fx0, fy0), [ax1, ay1] = pt(fx1, fy1);
  await p.mouse.move(ax0, ay0); await p.mouse.down();
  await p.mouse.move(ax1, ay1, { steps: 8 }); await p.mouse.up();
  await p.waitForTimeout(400);
};
await dragFrac(0.05, 0.05, 0.35, 0.5);
const n = Number((await p.locator(".mini-count").textContent())?.match(/\d+/)?.[0] ?? -1);
if (n > 0) ok(`選取模式框選鎖定 ${n} 鄉鎮`); else fail("選取框選失敗");

await wheelAt(0.5, 0.5, -300, 3);
const n2 = Number((await p.locator(".mini-count").textContent())?.match(/\d+/)?.[0] ?? -1);
if (n2 === n) ok(`選取模式下滾輪縮放不影響已選名單(仍 ${n2})`); else fail(`滾輪縮放意外改動了名單: ${n2} ≠ ${n}`);
if ((await selectToggle.getAttribute("aria-pressed")) === "true") ok("滾輪縮放後選取模式仍維持開啟");
else fail("滾輪縮放不應影響選取模式開關狀態");

await clickBlank();
if ((await selectToggle.getAttribute("aria-pressed")) === "false") ok("點空白處 → 退出選取模式(名單不變)");
else fail("選取模式點空白處未退出");

// 清除模式下滾輪縮放同樣不影響名單(名單非空時清除鈕才可點)
await clearToggle.click();
await p.waitForTimeout(150);
if ((await clearToggle.getAttribute("aria-pressed")) === "true") ok("清除模式開啟");
else fail("清除模式未開啟");
await wheelAt(0.5, 0.5, -300, 3);
const n3 = Number((await p.locator(".mini-count").textContent())?.match(/\d+/)?.[0] ?? -1);
if (n3 === n) ok(`清除模式下滾輪縮放不影響名單(仍 ${n3})`); else fail(`滾輪縮放意外改動了名單: ${n3} ≠ ${n}`);

if (errors.length) fail("console/page 錯誤: " + errors.join(" | ")); else ok("無 console/page 錯誤");
await b.close();
console.log(process.exitCode ? "== 有項目失敗 ==" : "== 全部通過 ==");
```

- [ ] **Step 2: 執行驗證腳本**

Run: `node scripts/verify-scatter-zoom.mjs`（確認 `npm run dev` 還在跑）
Expected: 全部 `PASS:`，結尾印出 `== 全部通過 ==`。若有 `FAIL:`，依訊息內容檢查 Task 2 的實作（常見狀況：`wheelAt` 的 deltaY 幅度不夠大導致縮放不明顯，可調整 `times` 參數；`zoomDomain` 的 clamp 邏輯若寫反方向會導致「縮小」測項失敗）。

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-scatter-zoom.mjs
git commit -m "test: verify-scatter-zoom 改寫為滾輪縮放驗證(取代原放大鏡框選流程)"
```

---

### Task 4: 更新其他引用「放大」按鈕的 verify 腳本

**Files:**
- Modify: `scripts/verify-scatter.mjs`
- Modify: `scripts/verify-brush-play.mjs`

**Interfaces:**
- Consumes: Task 2 完成後的 `Scatter.tsx`（`.scatter-zoom-toggle` 不存在、使用說明彈窗列點文字已改）。

- [ ] **Step 1: 更新 verify-scatter.mjs 的使用說明內容斷言**

在 `scripts/verify-scatter.mjs` 找到：

```javascript
if (helpText?.includes("每顆泡泡代表一個鄉鎮") && helpText?.includes("放大") && helpText?.includes("選取") && helpText?.includes("清除"))
  ok("使用說明內容含白話解說+四項操作說明");
else fail("使用說明內容缺漏: " + helpText);
```

改成：

```javascript
if (helpText?.includes("每顆泡泡代表一個鄉鎮") && helpText?.includes("滾輪") && helpText?.includes("選取") && helpText?.includes("清除"))
  ok("使用說明內容含白話解說+四項操作說明");
else fail("使用說明內容缺漏: " + helpText);
```

- [ ] **Step 2: 拿掉 verify-brush-play.mjs 裡沒用到的 zoomToggle locator**

在 `scripts/verify-brush-play.mjs` 找到：

```javascript
// .scatter-select-toggle 三顆按鈕(放大/選取/清除)共用視覺樣式,各自疊專屬 class 精準辨識
// (7/31 加放大鏡後,單靠 :not(.sel-clear) 排除法會連放大鏡一起選到,炸 strict mode)
const zoomToggle = p.locator(".scatter-zoom-toggle");
const selectToggle = p.locator(".scatter-mode-select");
```

改成：

```javascript
// .scatter-select-toggle 兩顆按鈕(選取/清除)共用視覺樣式,各自疊專屬 class 精準辨識
// (單靠 :not(.sel-clear) 排除法在多顆鈕時會失效,故用專屬 class 而非排除法)
const selectToggle = p.locator(".scatter-mode-select");
```

- [ ] **Step 3: 執行這兩支腳本 + 未改動的 verify-merged.mjs / verify-scatter-causes.mjs 做回歸確認**

Run: `node scripts/verify-scatter.mjs`
Expected: 全部 `PASS:`。

Run: `node scripts/verify-brush-play.mjs`
Expected: 全部 `PASS:`。

Run: `node scripts/verify-merged.mjs`
Expected: 全部 `PASS:`（這支沒改動,純回歸確認沒被 Task 2 的改動波及）。

Run: `node scripts/verify-scatter-causes.mjs`
Expected: 全部 `PASS:`（同上,純回歸確認）。

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-scatter.mjs scripts/verify-brush-play.mjs
git commit -m "test: 更新 verify-scatter/verify-brush-play 移除放大按鈕相關斷言"
```

---

### Task 5: 全套本機驗證收尾

**Files:** 無新增/修改檔案,純執行既有指令做最終確認。

- [ ] **Step 1: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無錯誤。

- [ ] **Step 2: 單元測試全跑**

Run: `npm test`
Expected: 全部 PASS(含 Task 1 新增的 `scatterZoom.test.ts`)。

- [ ] **Step 3: build**

Run: `npm run build`
Expected: 成功,無錯誤。

- [ ] **Step 4: 剩餘 verify 腳本跑一輪確認沒有波及其他頁面**

Run: `node scripts/verify-merged.mjs && node scripts/verify-scatter.mjs && node scripts/verify-scatter-zoom.mjs && node scripts/verify-brush-play.mjs && node scripts/verify-scatter-causes.mjs`
Expected: 全部 `PASS:`，最後都印出 `== 全部通過 ==`。

- [ ] **Step 5: 更新 spec 文件標記完成狀態(選用)**

若這次改動有值得記進 skill 的通用教訓（例如滾輪縮放的 clamp 數學、`d3.pointer` 在有 viewBox 縮放時要取代 `offsetX/offsetY` 這類），在 `docs/superpowers/specs/2026-08-04-scatter-scroll-zoom-design.md` 補一段「實作完成」筆記；純本次特定的按鈕文案調整不需要進 skill（見專案慣例：只有通用教訓才進 skill）。

- [ ] **Step 6: 最終確認 git log 乾淨**

Run: `git status --short`
Expected: 無未 commit 的變更(Task 1-4 的 commit 都已各自完成)。

---

## 追加任務(8/4,使用者實測後追加):縮放後可拖曳平移

使用者在 localhost 實測後回饋，縮放機制本身(游標錨點、軸範圍縮窄)符合預期，額外需要「縮放後
可以用滑鼠拖曳平移目前的檢視範圍」。設計細節見
`docs/superpowers/specs/2026-08-04-scatter-scroll-zoom-design.md` 的「追加:縮放後可拖曳平移」
一節——以下任務即依該節實作。

### Task 6: 抽出平移 domain 數學為純函式 + 單元測試

**Files:**
- Modify: `src/lib/scatterZoom.ts`(新增 `panDomain`,並抽一個共用的內部 clamp 輔助函式）
- Modify: `src/lib/scatterZoom.test.ts`(新增 `panDomain` 的測試)

**Interfaces:**
- Produces: `panDomain(current: [number, number], full: [number, number], delta: number): [number, number]` — Task 7 的拖曳 drag handler 會呼叫這個函式算 X/Y 各自平移後的新 domain。`delta` 是資料值位移量(可正可負),超出 `full` 邊界時會被 clamp(貼齊邊界,寬度不變,不回傳 null——平移不會有「回到全範圍」這個概念,因為呼叫端只在該軸已經是縮放狀態時才會呼叫這個函式)。

- [ ] **Step 1: 寫失敗測試**

在 `src/lib/scatterZoom.test.ts` 檔案最後(既有的 `zoomDomain` describe block 後面)新增:

```typescript
describe("panDomain", () => {
  it("範圍內平移", () =>
    expect(panDomain([30, 50], [0, 100], 10)).toEqual([40, 60]));

  it("往左平移貼到左邊界 → clamp(不改寬度),不超出全域下界", () =>
    expect(panDomain([0, 20], [0, 100], -10)).toEqual([0, 20]));

  it("往右平移貼到右邊界 → clamp(不改寬度),不超出全域上界", () =>
    expect(panDomain([80, 100], [0, 100], 30)).toEqual([80, 100]));

  it("delta=0 → 不變", () =>
    expect(panDomain([40, 60], [0, 100], 0)).toEqual([40, 60]));

  it("小幅平移,尚未貼到邊界 → 正常平移不 clamp", () =>
    expect(panDomain([10, 30], [0, 100], -5)).toEqual([5, 25]));
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npm test -- scatterZoom`
Expected: FAIL,錯誤訊息類似 `panDomain is not a function` 或 `does not provide an export named 'panDomain'`。

- [ ] **Step 3: 寫最小實作**

在 `src/lib/scatterZoom.ts` 裡,把 `zoomDomain` 函式內重複出現的邊界 clamp 邏輯抽成一個共用的
內部輔助函式,並新增 `panDomain`。完整檔案內容改成:

```typescript
// 滾輪縮放/拖曳平移共用的邊界 clamp:把 [newLo,newHi] 這段範圍平移(不改變寬度)貼回
// [fullLo,fullHi] 之內,超出哪一側就往回推多少。
function clampToFull(newLo: number, newHi: number, fullLo: number, fullHi: number): [number, number] {
  if (newLo < fullLo) { newHi += fullLo - newLo; newLo = fullLo; }
  if (newHi > fullHi) { newLo -= newHi - fullHi; newHi = fullHi; }
  return [newLo, newHi];
}

// 滾輪縮放的 domain 數學(純函式,不碰 DOM/React state):以 anchor(游標對應的資料值)
// 為錨點縮放 [current] 這段 domain,factor>1=放大(變窄)、factor<1=縮小(變寬)。
// 縮小超過 full 的寬度直接回 null(=交給呼叫端還原成全範圍,symlog 軸會自動切回固定對數刻度)。
// 放大 clamp 在 full 寬度的 minFrac(預設 5%),避免縮到看不到任何資料點。
export function zoomDomain(
  current: [number, number],
  full: [number, number],
  anchor: number,
  factor: number,
  minFrac = 0.05,
): [number, number] | null {
  const [lo, hi] = current;
  const [fullLo, fullHi] = full;
  const width = hi - lo;
  const fullWidth = fullHi - fullLo;
  let newWidth = width / factor;
  const minWidth = fullWidth * minFrac;
  if (newWidth < minWidth) newWidth = minWidth;
  if (newWidth >= fullWidth) return null;
  // t=錨點在目前 domain 裡的比例位置;縮放後用同一個 t 反推新邊界,螢幕座標上的錨點位置不變
  // (range 不變、t 不變 ⇒ 映射到同一個像素)。寬度 0(degenerate)時無比例可言,退回置中。
  const t = width === 0 ? 0.5 : (anchor - lo) / width;
  const newLo = anchor - t * newWidth;
  const newHi = newLo + newWidth;
  return clampToFull(newLo, newHi, fullLo, fullHi);
}

// 拖曳平移的 domain 數學(純函式):把 current 平移 delta(資料值位移量),超出 full 邊界時
// clamp 貼齊邊界(寬度不變)。呼叫端(Scatter.tsx 的拖曳 handler)只在該軸已經是縮放狀態
// (current 不是完整 full 範圍)時才會呼叫,故不需要「平移回全範圍變 null」這種情境。
export function panDomain(
  current: [number, number],
  full: [number, number],
  delta: number,
): [number, number] {
  const [lo, hi] = current;
  const [fullLo, fullHi] = full;
  return clampToFull(lo + delta, hi + delta, fullLo, fullHi);
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npm test -- scatterZoom`
Expected: PASS,`zoomDomain` 原本 8 項 + `panDomain` 新增 5 項,共 13 項全過(確認原本的 `zoomDomain`
測試在抽出 `clampToFull` 之後仍然全過,行為沒有被這次重構動到)。

- [ ] **Step 5: Commit**

```bash
git add src/lib/scatterZoom.ts src/lib/scatterZoom.test.ts
git commit -m "feat: 抽出拖曳平移 domain 數學為純函式(panDomain),與 zoomDomain 共用邊界 clamp"
```

---

### Task 7: Scatter.tsx 縮放後可拖曳平移

**Files:**
- Modify: `src/charts/Scatter.tsx`

**Interfaces:**
- Consumes: `panDomain` from `./scatterZoom`(Task 6)；既有的 `zoomX`/`zoomY`/`setZoomX`/`setZoomY` state、`x`/`y` scale(`.range()`)、`fullXDomain`/`fullYDomain`(Task 2 已新增)、`mode`、`W`/`H` 常數、框選 `useEffect` 裡的 `g.brush` 容器 `bg`。
- Produces: 無新的對外介面。

- [ ] **Step 1: 拖曳平移接進框選 `useEffect` 的 `if (!mode)` 分支**

找到(Task 2 已經把這段簡化過):

```typescript
    if (!mode) {
      // 點空白處(無拖曳):兩個模式都比照「再次點按鈕」退出目前模式,不動 selected 名單。
```

往上找到這整個 `if (!mode) { ... }` 區塊(目前內容是):

```typescript
    if (!mode) {
      bg.on(".brush", null);
      bg.selectAll("*").remove();
      svg.select<SVGGElement>("g.dots").raise();
      return;
    }
```

改成:

```typescript
    if (!mode) {
      bg.on(".brush", null);
      bg.selectAll("*").remove();
      // 拖曳平移(使用者要求,8/4):兩模式都關閉、且至少一軸有縮放時,拖曳空白處改成平移目前
      // 檢視範圍(比照抓著內容拖曳的直覺)。X/Y 各自只平移「目前有縮放」的那一軸;兩軸都沒縮放
      // 時完全不掛任何 pointer 互動,拖曳空白處維持縮放前的既有行為(無反應)。
      if (zoomX || zoomY) {
        const panRect = bg.append("rect")
          .attr("x", 0).attr("y", 0).attr("width", W).attr("height", H)
          .attr("fill", "none").attr("pointer-events", "all")
          .style("cursor", "grab");
        let panStart: { px: number; py: number; xDomain: [number, number] | null; yDomain: [number, number] | null } | null = null;
        const drag = d3.drag<SVGRectElement, unknown>()
          .on("start", (ev) => {
            panStart = { px: ev.x, py: ev.y, xDomain: zoomX, yDomain: zoomY };
            panRect.style("cursor", "grabbing");
          })
          .on("drag", (ev) => {
            if (!panStart) return;
            const dxPx = ev.x - panStart.px, dyPx = ev.y - panStart.py;
            if (panStart.xDomain) {
              const [xr0, xr1] = x.range();
              const pxPerUnit = (xr1 - xr0) / (panStart.xDomain[1] - panStart.xDomain[0]);
              setZoomX(panDomain(panStart.xDomain, fullXDomain, -dxPx / pxPerUnit));
            }
            if (panStart.yDomain) {
              const [yr0, yr1] = y.range();
              const pxPerUnit = (yr1 - yr0) / (panStart.yDomain[1] - panStart.yDomain[0]);
              setZoomY(panDomain(panStart.yDomain, fullYDomain, -dyPx / pxPerUnit));
            }
          })
          .on("end", () => {
            panStart = null;
            panRect.style("cursor", "grab");
          });
        panRect.call(drag as any);
      }
      svg.select<SVGGElement>("g.dots").raise();
      return;
    }
```

在同一個 `useEffect` 的依賴陣列裡(目前是
`[values, meta, year, x, y, xKey, yKey, select, W, H, mode, selected]`)加上 `zoomX, zoomY, fullXDomain, fullYDomain, setZoomX, setZoomY`(`setZoomX`/`setZoomY` 是 `useState` 的 setter,身分穩定但列出來更清楚這個 effect 讀寫了它們)——改成:

```typescript
  }, [values, meta, year, x, y, xKey, yKey, select, W, H, mode, selected, zoomX, zoomY, fullXDomain, fullYDomain]);
```

- [ ] **Step 2: 使用說明彈窗補一句拖曳平移的說明**

找到(Task 2 已經把這條列點改成滾輪縮放的說明):

```typescript
            <li>滑鼠移到圖上滾動滾輪可縮放；雙擊空白處還原。</li>
```

改成:

```typescript
            <li>滑鼠移到圖上滾動滾輪可縮放；縮放後可拖曳平移；雙擊空白處還原。</li>
```

- [ ] **Step 3: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無錯誤。

- [ ] **Step 4: 起 dev server 實際測試方向是否符合直覺**

Run: `npm run dev`(若 5173 被佔用,Vite 會自動換下一個空 port,記下實際用的 port)
在瀏覽器打開對應網址,切到有散布圖的頁面：
1. 先滾輪放大幾格(確認軸範圍縮小)。
2. 在圖上拖曳空白處(不要從泡泡本身拖),確認：往右拖 → 內容跟著往右移(看到的資料範圍往左邊
   移動,即 X 軸數值變小的方向進來)；往下拖同理confirm 是否符合直覺。
3. **如果方向感覺是反的**(拖右邊卻往左跑),把 Step 1 那段程式碼裡 `setZoomX`/`setZoomY` 呼叫
   的 `-dxPx`/`-dyPx` 正負號反過來(拿掉負號或加負號,兩軸可能各自需要獨立判斷,尤其 Y 軸的
   `range()` 是反過來的[大到小],正負號很容易跟 X 軸不對稱),重新整理頁面測到方向正確為止。
4. 確認拖到底(平移到全域邊界)會停住,不會露出資料以外的空白。
5. 確認「選取」「清除」開啟時,拖曳空白處仍是方框選取/清除,不會被平移搶走。
6. 確認未縮放狀態下(兩軸都是全範圍)拖曳空白處完全無反應(游標不會變成 grab)。

把最終確認正確的方向/是否有修正正負號,記在你的報告裡。

- [ ] **Step 5: Commit**

```bash
git add src/charts/Scatter.tsx
git commit -m "feat: 散布圖縮放後可拖曳平移(游標抓取直覺,clamp 全域邊界,選取/清除模式不受影響)"
```

---

### Task 8: verify-scatter-zoom.mjs 補拖曳平移驗證

**Files:**
- Modify: `scripts/verify-scatter-zoom.mjs`

**Interfaces:**
- Consumes: Task 7 完成後的 `Scatter.tsx`(拖曳平移已可用)。localhost dev server 需在跑。

- [ ] **Step 1: 在腳本最後(既有的 select/clear 段落後面、`if (errors.length)` 之前)新增拖曳平移驗證**

在 `scripts/verify-scatter-zoom.mjs` 找到腳本尾端的:

```javascript
if (errors.length) fail("console/page 錯誤: " + errors.join(" | ")); else ok("無 console/page 錯誤");
await b.close();
console.log(process.exitCode ? "== 有項目失敗 ==" : "== 全部通過 ==");
```

在這段前面插入(先切回一個乾淨的線性通道、清掉選取/清除模式,避免受前面測項殘留狀態影響):

```javascript
// ==== 第四段:縮放後可拖曳平移 ====
await p.locator('select.scatter-ch[data-ch="x"]').selectOption({ label: "平均所得" });
await p.waitForTimeout(700);
if ((await selectToggle.getAttribute("aria-pressed")) === "true") await selectToggle.click();
if ((await clearToggle.getAttribute("aria-pressed")) === "true") await clearToggle.click();
await p.waitForTimeout(200);

const dragPan = async (fx0, fy0, fx1, fy1) => {
  const bx = await sbox();
  const pt = (fx, fy) => [bx.x + bx.width * fx, bx.y + bx.height * fy];
  const [ax0, ay0] = pt(fx0, fy0), [ax1, ay1] = pt(fx1, fy1);
  await p.mouse.move(ax0, ay0); await p.mouse.down();
  await p.mouse.move(ax1, ay1, { steps: 10 }); await p.mouse.up();
  await p.waitForTimeout(400);
};

// 未縮放時拖曳空白處完全無反應(比照縮放前既有行為)
const preZoomMax = await xAxisMax();
await dragPan(0.5, 0.9, 0.2, 0.9);
if ((await xAxisMax()) === preZoomMax) ok("未縮放時拖曳空白處無反應");
else fail(`未縮放時拖曳不該有反應,但範圍變了: ${preZoomMax} → ${await xAxisMax()}`);

// 縮放後拖曳可平移(軸刻度應該改變,且不是「縮放範圍變寬/變窄」而是整段平移——寬度不變)
await wheelAt(0.5, 0.5, -300, 6);
const zoomedTicks1 = await xTickTexts();
const zoomedMax1 = Math.max(...zoomedTicks1.map((s) => Number(s.replace(/,/g, ""))).filter((n) => !Number.isNaN(n)));
const zoomedMin1 = Math.min(...zoomedTicks1.map((s) => Number(s.replace(/,/g, ""))).filter((n) => !Number.isNaN(n)));
await dragPan(0.7, 0.9, 0.3, 0.9); // 在圖表下緣拖曳(避開泡泡),往左拖
const zoomedTicks2 = await xTickTexts();
const zoomedMax2 = Math.max(...zoomedTicks2.map((s) => Number(s.replace(/,/g, ""))).filter((n) => !Number.isNaN(n)));
const zoomedMin2 = Math.min(...zoomedTicks2.map((s) => Number(s.replace(/,/g, ""))).filter((n) => !Number.isNaN(n)));
const width1 = zoomedMax1 - zoomedMin1, width2 = zoomedMax2 - zoomedMin2;
if (zoomedMax2 !== zoomedMax1 || zoomedMin2 !== zoomedMin1) ok(`拖曳後範圍改變(平移生效):[${zoomedMin1},${zoomedMax1}] → [${zoomedMin2},${zoomedMax2}]`);
else fail("拖曳後範圍完全沒變,平移未生效");
if (Math.abs(width1 - width2) < Math.max(1, width1 * 0.05)) ok(`平移前後寬度大致不變(${width1} ≈ ${width2},只是平移不是縮放)`);
else fail(`平移不應改變範圍寬度: ${width1} → ${width2}`);

// 選取模式開啟時,拖曳空白處是方框選取,不是平移
await selectToggle.click();
await p.waitForTimeout(150);
const beforeSelectDragMax = await xAxisMax();
await dragFrac_local();
async function dragFrac_local() {
  const bx = await sbox();
  const pt = (fx, fy) => [bx.x + bx.width * fx, bx.y + bx.height * fy];
  const [ax0, ay0] = pt(0.05, 0.05), [ax1, ay1] = pt(0.35, 0.5);
  await p.mouse.move(ax0, ay0); await p.mouse.down();
  await p.mouse.move(ax1, ay1, { steps: 8 }); await p.mouse.up();
  await p.waitForTimeout(400);
}
const selN = Number((await p.locator(".mini-count").textContent())?.match(/\d+/)?.[0] ?? -1);
if (selN > 0) ok(`選取模式下拖曳空白處仍是框選(鎖定 ${selN} 鄉鎮),不是平移`); else fail("選取模式下拖曳應該框選,但沒有鎖定任何鄉鎮");
if ((await xAxisMax()) === beforeSelectDragMax) ok("選取模式下拖曳框選不影響縮放範圍"); else fail("選取模式下拖曳意外改動了縮放範圍");
await selectToggle.click();
await p.waitForTimeout(150);
```

把這段插入原本 `if (errors.length) fail(...)` 之前(緊接在既有第三段「選取/清除模式下滾輪縮放」
之後)。這段用到的 `sbox`、`wheelAt`、`xTickTexts`、`xAxisMax`、`selectToggle` 都是腳本裡已經
存在的既有工具/變數,直接沿用即可,不用重新宣告。

- [ ] **Step 2: 執行驗證腳本**

Run: `node scripts/verify-scatter-zoom.mjs`(確認 `npm run dev` 還在跑)
Expected: 全部 `PASS:`,結尾印出 `== 全部通過 ==`。若拖曳方向的斷言失敗,先確認 Task 7 Step 4
是否已經在瀏覽器裡確認過方向(如果 Task 7 修正過正負號,這裡的斷言邏輯不用跟著改,因為斷言本身
沒有假設特定方向,只檢查「範圍有變」與「寬度不變」,不檢查變大變小的方向)。

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-scatter-zoom.mjs
git commit -m "test: verify-scatter-zoom 補拖曳平移驗證(未縮放無反應/平移生效/寬度不變/clamp/選取模式不受影響)"
```

---

### Task 9: 拖曳平移全套本機驗證收尾

**Files:** 無新增/修改檔案,純執行既有指令做最終確認。

- [ ] **Step 1: 型別檢查 + 單元測試**

Run: `npx tsc --noEmit`
Expected: 無錯誤。

Run: `npm test`
Expected: 全部 PASS(含 Task 6 新增的 `panDomain` 測試)。

- [ ] **Step 2: build**

Run: `npm run build`
Expected: 成功,無錯誤。

- [ ] **Step 3: 全部 verify 腳本跑一輪**

Run: `node scripts/verify-merged.mjs && node scripts/verify-scatter.mjs && node scripts/verify-scatter-zoom.mjs && node scripts/verify-brush-play.mjs && node scripts/verify-scatter-causes.mjs`
Expected: 全部 `PASS:`,最後都印出 `== 全部通過 ==`。

- [ ] **Step 4: 最終確認 git log 乾淨**

Run: `git status --short`
Expected: 無未 commit 的變更。

---

## 追加任務(8/4,使用者實測後追加二):使用說明彈窗點外面關閉 + 清除模式單擊移出

使用者在測試拖曳平移的同時,又回報兩個獨立的小需求:

1. 「使用說明」彈窗目前只能再點一次「使用說明」按鈕才會關,要加上「點彈窗以外的空白處也會
   關閉」。
2. 目前「單擊＝加入選取、雙擊＝移出選取」是不分選取/清除模式的全域規則(7/30 的既有設計決策,
   見 `Scatter.tsx` 裡 `sel.on("click", ...)`/`.on("dblclick", ...)` 上方的註解)。使用者要把
   這個規則改成:**「清除」模式開啟時,單擊已選泡泡＝移出選取**(取代目前清除模式下單擊會誤加入
   名單的行為);「選取」模式的單擊＝加入維持不變;雙擊剔除這個全域捷徑(任何時候都能用,不分
   模式)維持不動,不拿掉。

### Task 10: 使用說明彈窗點外面關閉

**Files:**
- Modify: `src/charts/Scatter.tsx`

**Interfaces:**
- Consumes: 既有的 `showHelp`/`setShowHelp` state、`controlsRef`(按鈕列的 ref,彈窗目前用
  `createPortal` 掛到 `document.body`)。
- Produces: 無新的對外介面。

- [ ] **Step 1: 加一個「點彈窗外面關閉」的 effect**

在 `showHelp`/`helpPos` 那個既有的 `useEffect`(監聽 `resize` 更新彈窗座標)後面,新增一個新的
`useEffect`:

```typescript
  // 點彈窗以外的地方關閉(使用者要求,8/4):彈窗已經是 portal 到 document.body 的獨立節點,
  // 用「點擊事件的 target 是否在彈窗或觸發按鈕內」判斷——都不在才關閉,避免點按鈕本身時
  // 「開啟」跟「外部點擊關閉」兩個 handler 互搶導致彈窗開了又立刻被關掉。
  useEffect(() => {
    if (!showHelp) return;
    const onDocClick = (ev: MouseEvent) => {
      const target = ev.target as Node;
      const helpEl = document.querySelector(".scatter-help-popup");
      const btnEl = document.querySelector(".scatter-help-toggle");
      if (helpEl?.contains(target) || btnEl?.contains(target)) return;
      setShowHelp(false);
    };
    // 用 mousedown 而非 click:跟觸發按鈕的 onClick(在 click 階段觸發)有先後順序保證,
    // mousedown 比 click 早發生,不會出現「開啟」跟「關閉」同一次點擊互相打架的問題。
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showHelp]);
```

- [ ] **Step 2: 幫彈窗的容器加上 `.scatter-help-popup` class**

找到使用說明彈窗的 `createPortal` 那段(目前開頭是):

```typescript
      {createPortal(
        <div style={{ display: showHelp ? "block" : "none", position: "fixed", top: helpPos.top, right: helpPos.right,
```

改成(只加一個 `className`,其餘不動):

```typescript
      {createPortal(
        <div className="scatter-help-popup" style={{ display: showHelp ? "block" : "none", position: "fixed", top: helpPos.top, right: helpPos.right,
```

- [ ] **Step 3: 型別檢查 + 手動測試**

Run: `npx tsc --noEmit`
Expected: 無錯誤。

Run: `npm run dev`,在瀏覽器打開對應網址:點「使用說明」開啟彈窗,確認:
1. 點彈窗以外的空白處(圖表、頁面其他地方)→ 彈窗關閉。
2. 點彈窗內部(例如列點文字上)→ 彈窗不會意外關閉。
3. 再點一次「使用說明」按鈕本身 → 仍然可以正常切換開關(沒有被新加的 handler 卡住)。

- [ ] **Step 4: Commit**

```bash
git add src/charts/Scatter.tsx
git commit -m "feat: 使用說明彈窗支援點外面空白處關閉"
```

---

### Task 11: 清除模式單擊已選泡泡改為移出選取

**Files:**
- Modify: `src/charts/Scatter.tsx`

**Interfaces:**
- Consumes: 既有的 `mode`/`clearMode`/`selected`/`select`/`onExcludeTown` props 與 state。
- Produces: 無新的對外介面。

- [ ] **Step 1: 單擊 handler 依模式分流**

找到泡泡的單擊/雙擊 handler(在 `sel.attr("stroke", t.surface)` 那段附近):

```typescript
      .on("click", (_ev: MouseEvent, p) => {
        if (!mode) return;
        if (clickTimer !== null) window.clearTimeout(clickTimer);
        clickTimer = window.setTimeout(() => {
          clickTimer = null;
          if (selected?.includes(p.township)) return; // 已在名單,單擊不重複加入
          select([...new Set([...(selected ?? []), p.township])]);
        }, 250);
      })
```

改成:

```typescript
      .on("click", (_ev: MouseEvent, p) => {
        if (!mode) return;
        if (clickTimer !== null) window.clearTimeout(clickTimer);
        clickTimer = window.setTimeout(() => {
          clickTimer = null;
          if (mode === "clear") {
            // 清除模式:單擊已選泡泡＝移出選取(使用者要求,8/4,取代原本單擊會誤加入名單的
            // 行為);未選中的泡泡單擊無反應(清除模式的重點是移出,不會反過來把沒選的加進來)。
            if (!selected?.includes(p.township)) return;
            onExcludeTown(p.township);
            return;
          }
          if (selected?.includes(p.township)) return; // 已在名單,單擊不重複加入
          select([...new Set([...(selected ?? []), p.township])]);
        }, 250);
      })
```

雙擊 handler(緊接在下面)完全不動:

```typescript
      .on("dblclick", (_ev: MouseEvent, p) => {
        if (clickTimer !== null) { window.clearTimeout(clickTimer); clickTimer = null; }
        onExcludeTown(p.township);
      });
```

同一段上方的整體註解(目前在 `let clickTimer: number | null = null;` 前面,說明「單擊/雙擊
(使用者要求,7/30 再修正):不論目前是選取或清除模式,單擊一律=加入名單...」)需要更新,找到:

```typescript
    // 單擊/雙擊(使用者要求,7/30 再修正):不論目前是選取或清除模式,單擊一律=加入名單、
    // 雙擊一律=移出名單——框選(拖曳)才是選取/清除兩模式的加減差異所在,單顆泡泡的點擊
    // 手勢不分模式,統一用同一組直覺(單擊加、雙擊減)。任一模式開啟時單擊才有反應;
    // 雙擊不受模式影響,任何時候(含兩模式都關閉)都能用。
```

改成:

```typescript
    // 單擊/雙擊(使用者要求,7/30 初版,8/4 改為單擊依模式分流):選取模式單擊＝加入名單、
    // 清除模式單擊＝移出名單(未選中的泡泡單擊無反應)——單顆泡泡的點擊手勢現在跟框選
    // (拖曳)一樣依模式分流,選取/清除語意一致。雙擊剔除維持原本的全域捷徑,不受模式影響、
    // 任何時候(含兩模式都關閉)都能用,跟單擊分開判斷、互不影響。
```

- [ ] **Step 2: 使用說明彈窗的清除說明文字同步更新**

找到:

```typescript
            <li>按「清除」開啟後，拖曳框選要移出的鄉鎮，或單擊已選泡泡移出。</li>
```

這句其實已經跟新行為一致(單擊已選泡泡移出),不用改文字本身;但因為 Task 7 已經把上一條列點
(滾輪縮放那句)改過,這裡只要確認這條列點沒被誤動、順序還在「清除」列點的位置即可,不用額外
修改。

- [ ] **Step 3: 型別檢查 + 手動測試**

Run: `npx tsc --noEmit`
Expected: 無錯誤。

Run: `npm run dev`,在瀏覽器打開對應網址:
1. 開「選取」,單擊未選泡泡 → 加入名單(行為不變)。
2. 開「清除」,單擊已選泡泡 → 從名單移出。
3. 開「清除」,單擊未選泡泡 → 無反應(不會誤加入)。
4. 任何模式(含都關閉)雙擊泡泡 → 一律移出選取(既有剔除行為不變)。

- [ ] **Step 4: Commit**

```bash
git add src/charts/Scatter.tsx
git commit -m "feat: 清除模式單擊已選泡泡改為移出選取(取代原本單擊誤加入的行為)"
```

---

### Task 12: 全套本機驗證收尾(含使用說明外部關閉 + 清除模式單擊移出)

**Files:** 無新增/修改檔案,純執行既有指令做最終確認,並視情況更新既有 verify 腳本裡因為這兩項
改動而變得不成立的斷言。

- [ ] **Step 1: 检查既有 verify 腳本裡是否有斷言假設「清除模式單擊會加入名單」**

Run: `grep -rn "clear" scripts/verify-*.mjs`(或用等效方式)找出所有跟「清除模式」互動有關的
既有斷言,逐一確認:如果有腳本模擬「清除模式下單擊某個未選泡泡」並斷言它被加入名單,這個斷言
在 Task 11 之後會變成錯的,需要一併修正(改成斷言「無反應」,或斷言「單擊已選泡泡會被移出」)。
若沒有找到這類斷言,略過此步驟。

- [ ] **Step 2: 型別檢查 + 單元測試**

Run: `npx tsc --noEmit && npm test`
Expected: 全部通過。

- [ ] **Step 3: build**

Run: `npm run build`
Expected: 成功,無錯誤。

- [ ] **Step 4: 全部 verify 腳本跑一輪**

Run: `node scripts/verify-merged.mjs && node scripts/verify-scatter.mjs && node scripts/verify-scatter-zoom.mjs && node scripts/verify-brush-play.mjs && node scripts/verify-scatter-causes.mjs`
Expected: 全部 `PASS:`,最後都印出 `== 全部通過 ==`。若 Step 1 發現需要修正的既有斷言,這裡
應該已經反映修正後的結果。

- [ ] **Step 5: 最終確認 git log 乾淨**

Run: `git status --short`
Expected: 無未 commit 的變更。

---

## 追加任務(8/4,使用者實測後追加三):雙擊空白處一併清空選取

使用者要求:雙擊散布圖空白處,除了現有的「還原縮放」以外,也要一併回到「初始無選取」的狀態
(清空 `selected` 名單)。目前的雙擊還原(`dblclick.zoomReset`)只重置 `zoomX`/`zoomY`,不分模式
都會觸發(排除點在泡泡本身上的雙擊,那個走既有的「剔除」邏輯)。這次直接在同一個 handler 裡
一併清空選取,維持「雙擊空白處＝回到初始狀態」這個單一、好記的手勢,不分選取/清除/無模式都適用
(跟現有還原縮放的觸發範圍一致,行為上更好記:雙擊空白處永遠讓你回到一乾二淨的起點)。

### Task 13: 雙擊空白處一併清空選取

**Files:**
- Modify: `src/charts/Scatter.tsx`

**Interfaces:**
- Consumes: 既有的 `select`(清空選取用 `select(null)`,和框選/清除模式共用同一個 setter,7/30
  的既有慣例:空名單一律用 `null` 表示,不用空陣列)。
- Produces: 無新的對外介面。

- [ ] **Step 1: 雙擊還原 effect 一併清空選取**

找到雙擊還原縮放的 `useEffect`:

```typescript
  useEffect(() => {
    const svg = d3.select(ref.current);
    svg.on("dblclick.zoomReset", (ev: MouseEvent) => {
      if ((ev.target as Element).tagName?.toLowerCase() === "circle") return;
      setZoomX(null); setZoomY(null);
    });
    return () => { svg.on("dblclick.zoomReset", null); };
  }, []);
```

改成:

```typescript
  useEffect(() => {
    const svg = d3.select(ref.current);
    svg.on("dblclick.zoomReset", (ev: MouseEvent) => {
      if ((ev.target as Element).tagName?.toLowerCase() === "circle") return;
      setZoomX(null); setZoomY(null);
      select(null); // 使用者要求(8/4):雙擊空白處一併回到初始無選取狀態,不分模式都適用
    });
    return () => { svg.on("dblclick.zoomReset", null); };
  }, [select]);
```

(依賴陣列從 `[]` 改成 `[select]`——`select` 是元件內用 `useMemo` 包過的穩定函式(見檔案上方
`const select = useMemo(...)`),身分不會每次 render 都變,列進依賴陣列是正確做法,不會造成
這個 effect 意外頻繁重掛。)

- [ ] **Step 2: 型別檢查 + 手動測試**

Run: `npx tsc --noEmit`
Expected: 無錯誤。

Run: `npm run dev`,在瀏覽器打開對應網址:
1. 開「選取」框選幾個鄉鎮,確認名單有東西。
2. 雙擊圖表空白處(不要點在泡泡上)→ 確認選取名單清空(泡泡全部變回未選中的灰階淡化)、
   縮放範圍也還原(既有行為不變)。
3. 縮放後(滾輪放大)但沒有選取任何鄉鎮時,雙擊空白處 → 縮放照樣還原(名單本來就是空的,行為
   上沒有變化,不會報錯)。
4. 雙擊泡泡本身(不是空白處)→ 確認仍走既有的「剔除」邏輯(把該泡泡移出選取),不會被這次改動
   誤觸發清空整個名單。

- [ ] **Step 3: Commit**

```bash
git add src/charts/Scatter.tsx
git commit -m "feat: 雙擊散布圖空白處一併清空選取(回到初始無選取狀態),不只還原縮放"
```

---

### Task 14: 更新既有 verify 腳本裡假設「雙擊空白處只還原縮放、不動選取」的斷言 + 全套驗證收尾

**Files:**
- Modify: `scripts/verify-scatter-zoom.mjs`(需要,已知有斷言符合這個假設)
- 視情況修改其他 verify 腳本(需要先搜尋確認)

**Interfaces:**
- Consumes: Task 13 完成後的 `Scatter.tsx`。

- [ ] **Step 1: 找出並修正 verify-scatter-zoom.mjs 裡受影響的斷言**

`scripts/verify-scatter-zoom.mjs` 的「雙擊空白處還原縮放」測項(第一段,大約是這幾行):

```javascript
await p.evaluate(() => {
  const svg = document.querySelector("g.dots").closest("svg");
  svg.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
});
await p.waitForTimeout(400);
if ((await xTickTexts()).includes("40,000")) ok("雙擊空白處 → 滾輪縮放還原(刻度變回固定值)");
else fail("雙擊空白處未還原: " + (await xTickTexts()).join("、"));
```

這段測試本身不涉及選取名單,Task 13 之後應該仍然通過,不用改。但請額外搜尋整份腳本
(`grep -n "dblclick" scripts/verify-scatter-zoom.mjs`)確認有沒有其他地方在雙擊還原縮放
「之前」先框選了一批鄉鎮、卻沒有在雙擊「之後」驗證名單被清空——如果有這種先框選、雙擊、
後面又假設名單還在的斷言,Task 13 之後會壞掉,需要修正成:雙擊後名單應該是空的(`.mini-count`
元素應該消失或變成 0,依現有元件邏輯,`selected` 為 `null` 時 `.mini-count` 那個 `<li>` 不會
渲染,改用 `.mini-hint`「尚未選取」那條)。

若確認沒有這種衝突的既有斷言,可以額外**新增**一項驗證:框選幾個鄉鎮鎖定名單 → 雙擊空白處 →
確認 `.mini-count` 消失、`.mini-hint` 顯示「尚未選取」。

- [ ] **Step 2: 同樣搜尋 verify-brush-play.mjs / verify-merged.mjs / verify-scatter-causes.mjs**

Run: `grep -n "dblclick" scripts/verify-brush-play.mjs scripts/verify-merged.mjs scripts/verify-scatter-causes.mjs`

確認這幾支腳本裡如果有模擬「雙擊圖表空白處」的地方,是否隱含假設選取名單不受影響——若有,依
上一步同樣的方式修正或確認仍然成立。

- [ ] **Step 3: 型別檢查 + 單元測試 + build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: 全部通過。

- [ ] **Step 4: 全部 verify 腳本跑一輪**

Run: `node scripts/verify-merged.mjs && node scripts/verify-scatter.mjs && node scripts/verify-scatter-zoom.mjs && node scripts/verify-brush-play.mjs && node scripts/verify-scatter-causes.mjs`
Expected: 全部 `PASS:`,最後都印出 `== 全部通過 ==`。

- [ ] **Step 5: 最終確認 git log 乾淨**

Run: `git status --short`
Expected: 無未 commit 的變更。

