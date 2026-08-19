# 合併單頁 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 「分區排名×地圖」與「關係」合併為單頁三欄（散布圖45%｜地圖30%｜排名25%），語意合一：下鑽＝整縣選取。

**Architecture:** 純 reducer（`mergedSelect.ts`）統一 `{view, selected}` 狀態轉移；`scatter.x` 導出全頁指標；Choropleth 加選取疊加層與 hover 回呼；TasteShell 重排三欄；MiniMap/TitleToggle/指標欄/死因膠囊列退役。

**Tech Stack:** React 18 + D3 + vitest + Playwright（既有）。

## Global Constraints

- 分支 `from-20260723`；commit 不加 Claude 共同作者。
- spec：`docs/superpowers/specs/2026-07-24-merged-single-page-design.md`。
- spec 微調：村里層 X 無資料 → 沿用 7/23 行為「patchChannels({x:"density"})＋notice」（X 即全頁指標，降級一體適用）。
- 縣級聚合語意不變；全國層選取以鄉鎮疊加層（accent 描邊）表現。
- RWD：≤1100px 直向堆疊；index.css class+media query 模式。
- 教訓：RO 用 contentRect；地圖欄寬不入等高回路；改版後檢查捲軸寬度抖動。

---

### Task 1: xToIndicator 導出（scatterChannels.ts）

**Files:** Modify `src/lib/scatterChannels.ts`、`src/lib/scatterChannels.test.ts`

**Produces:** `xToIndicator(x: ScatterKey): { indicator: IndicatorKey; deathCause: string }`
（`death_c*`→`{indicator:"death", deathCause:x}`；其餘→`{indicator:x, deathCause:"death"}`）

- [ ] 失敗測試（death_c1→death+death_c1；density→density+death；death→death+death）→ 實作 → 綠 → commit

### Task 2: mergedSelect reducer（新檔）

**Files:** Create `src/lib/mergedSelect.ts`、`src/lib/mergedSelect.test.ts`

**Produces:**
```ts
export interface NavSel { view: View; selected: string[] | null }
export function applyView(s: NavSel, target: View, townsOfCounty: (c: string) => string[]): NavSel
// nation→{NATION,null}；county→{target,整縣鄉鎮}；town→{target,[target.town]}
export function applyBrush(s: NavSel, list: string[] | null): NavSel
// {NATION, list?.length?list:null}（已下鑽自動退回全國）
export function applyExclude(s: NavSel, township: string): NavSel
// excludeFromSelection；無變更回原物件；剔到空→{NATION,null}；否則保持 view
```

- [ ] 失敗測試鎖五條規則（含：縣層剔除保持下鑽、剔到空回全國、brush 空=清除、town 目標帶單鄉鎮名單）→ 實作 → 綠 → commit

### Task 3: App.tsx 重接線

**Files:** Modify `src/App.tsx`、`src/designs/ShellProps.ts`

- 移除 `tab`/`indicator`/`deathCause` state；`const { indicator, deathCause } = xToIndicator(scatter.x)`。
- 移除 X 同步 effect（原 38-43 行）；降級 effect 改 `setScatter(s=>patchChannels(s,{x:"density"}))`＋notice。
- `townsOfCounty` useMemo（geo.features 依 countyOf 分組）。
- `onView`＝applyView＋既有 hash 同步；hash 初始/變更 listener 同走 applyView（深連結帶整縣選取）。
- `onBrushSelect(list)`＝applyBrush＋view 變動時清 hash；`onExcludeTown(t)`＝applyExclude 同理。
- ShellProps：移除 `tab/onMain/onScatter`；`onSelect` 語意=框選/清除；新增 `onExcludeTown: (t: string) => void`。onIndicator=patchChannels({x:k})、onDeathCause=patchChannels({x:k})（DirectionA 相容）。
- [ ] tsc 過（Shell 兩檔同步改後）→ commit（與 Task 4-6 併批）

### Task 4: Scatter 拆控制列、退迷你地圖、hover 升級為 props

**Files:** Modify `src/charts/Scatter.tsx`

- 新增具名匯出 `ScatterControls({ meta, channels, onChannel })`：四下拉（chSelect/groups/selStyle 移入）。
- Scatter props：移除內部 hoverCounty state → `hoverCounty: string | null; onHoverCounty: (c: string|null)=>void`（散布圖泡泡描邊沿用）；新增 `onExcludeTown`；dblclick 改呼叫它。
- 移除：MiniMap 引用與渲染、toggleCounty/townFillMap/countyOf 相關、controls 列。legendRow/brush/caption/hint 保留。
- [ ] tsc（併 Task 6 驗證）

### Task 5: Choropleth 選取疊加＋hover 回呼

**Files:** Modify `src/charts/Choropleth.tsx`

- Props 新增 `selectedTowns?: string[] | null; hoverCounty?: string | null; onHoverCounty?: (c: string|null)=>void`。
- wire() 的 mouseover/mouseleave：nation 層時回呼 onHoverCounty(COUNTYNAME/null)。
- nation 層：主圖與各 inset 各畫 `g.sel-overlay`（pointer-events:none）：selected 鄉鎮 path，fill accent 0.22、stroke accent 1.4（沿用各自投影與 inset clipPath；主圖排除 inTaiwanBox 外）。
- county 層：selected≠整縣時對縣內選中鄉鎮畫同款描邊（雙擊剔除的視覺回饋）；village 層不畫。
- hoverCounty prop 變動：nation 層該縣 path accent 描邊（獨立小 effect 或併主 effect deps）。
- [ ] Playwright 目視（Task 9）

### Task 6: TasteShell 三欄重排

**Files:** Modify `src/designs/taste/Shell.tsx`

- 刪 aside/TabBar/死因膠囊列/TitleToggle。結構：
```
header: 品牌字(小) + h1(=X label,由 scatterVars 查) + ScatterControls
div.merged-cols (flex, gap 20):
  div.col-scatter (flex:9,minWidth 0): <Scatter …/>
  div.col-map (flex:6,minWidth 0): MapBreadcrumb + Choropleth(legend=false,selectedTowns,hover…) + MapLegend + 操作說明兩行 + 清除鈕(有 selected 時)
  div.col-rank (flex:5): RegionRank + InfoPanel
YearTabs；footer 列: SourceFooter + 深色模式鈕 + 民國註記
```
- 操作說明措辭：未選「點地圖任一縣市看整縣，或在散布圖空白處拖曳框選。」已選「已選 N 鄉鎮：雙擊泡泡可剔除；回全國或清除即還原。」（verify 關鍵詞「框選」「保留/還原」對齊 Task 9）。
- [ ] tsc + dev 目視 → commit(Task 3-6 一批: feat 合併單頁)

### Task 7: index.css 合併頁 RWD

**Files:** Modify `src/index.css`

- 移除 .taste-aside/.main-split 舊斷點區塊；新增：
```css
.col-rank { max-height: calc(100dvh - 330px); overflow-y: auto; }
.col-rank .rank-grid-nation { grid-template-columns: 1fr !important; }
@media (max-width: 1100px) {
  .merged-cols { flex-direction: column; align-items: center; }
  .col-scatter, .col-map, .col-rank { width: 100%; max-width: 780px; }
  .col-rank { max-height: none; overflow: visible; }
}
```
（RegionRank nation 層根 div 加 className="rank-grid-nation"。）
- [ ] verify-rwd 改寫後綠（Task 9）→ commit

### Task 8: DirectionAShell 續編譯

**Files:** Modify `src/designs/directionA/Shell.tsx`

- 內部 `const [tab,setTab]=useState<TabKey>("main")`；TitleToggle 接本地 handler；Scatter 新 props 補上（hoverCounty 本地 state、onExcludeTown、MiniMap 已從 Scatter 移除故其舊版關係頁佈局簡化為 Scatter+ScatterControls）。不追求像素還原（隱藏備用殼）。
- [ ] tsc 綠 → commit

### Task 9: 驗證套件改寫＋截圖

**Files:** Modify `scripts/verify-brush-play.mjs`、`scripts/verify-rwd.mjs`、其餘 verify-*；Create `scripts/verify-merged.mjs`

- brush-play：拿掉「切關係頁」導覽（同頁即見）；提示章/名單/剔除/播放斷言保留；「切回關係頁提示章重現」改「清除後提示章重現」。
- verify-merged 新增：點地圖臺北市→麵包屑=臺北市、排名標題含臺北市、散布圖高亮數=12、地圖 URL hash=#/臺北市；框選→自動回全國+hash 清空；縣層雙擊剔除→仍在縣層；深連結 #/臺北市 重載→帶整縣選取；三欄框相對位置。
- rwd：斷點類名改 .merged-cols/.col-*；767 檢查改「無 aside、header 在頂」。
- 其他 verify-* 掃舊選擇器（taste-aside/TitleToggle/tab）逐支修。
- [ ] vitest 全綠、tsc、build、全部 verify 綠、1500/960/740＋深色截圖 → commit
