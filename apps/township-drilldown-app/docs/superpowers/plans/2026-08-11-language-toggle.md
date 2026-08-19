# 中英文語言切換 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `township-drilldown-app` 加上中/英文切換按鈕，比照 `gapminder-bubble-globe-app` 已上線的機制，UI 全翻＋縣市/鄉鎮/村里地名用 `pinyin-pro` 即時音譯成羅馬拼音。

**Architecture:** `src/lib/i18n.ts`（Dict+translations,唯一真相來源）+ `src/state/LanguageContext.tsx`（純 useState,不持久化）+ `src/lib/metricI18n.ts`（指標/死因/區域小型英文對照,以既有資料 key 索引）+ `src/lib/placeName.ts`（`pinyin-pro` 即時音譯+memoize cache）。逐一為 `designs/taste/Shell.tsx` 全路徑元件接上 `useLanguage()` 取得的 `tr`(翻譯字典)與 `lang`(當前語言)。

**Tech Stack:** React 18 + TypeScript + Vite + `pinyin-pro`(新依賴) + vitest + Playwright。

## Global Constraints

- **不動** `designs/directionA/Shell.tsx` 與其專屬元件（`MiniMap`、`DesignSwitch`、`TabBar`、`TitleToggle`）——未上線的備用殼。
- 語言 state **不持久化**（reload 回中文），寫法對齊 `src/lib/useTokens.tsx` 深色模式 state 的純 `useState`。
- 既有 `useTokens()` 回傳值在全專案都解構為 `const t = useTokens()`（樣式 token）。**語言 context 的翻譯字典變數一律命名為 `tr`，絕不能叫 `t`**——這是與 gapminder 版本（那邊叫 `t`）唯一的刻意命名差異，因為這裡 `t` 已被樣式 token 佔用。
- 地名（縣市/鄉鎮/村里）英文模式一律呼叫 `romanizePlaceName(name, lang)`（`src/lib/placeName.ts`）取得羅馬拼音，**不是**官方英文地名（如「臺北」會轉成 Hanyu Pinyin "Taibei"，不是郵政式拼音 "Taipei"）——這是使用者已核准的已知限制。
- 既有 vitest 套件（現況 133+ 通過）**全程必須維持全綠**；新增測試不得斷言到會隨語言變動的中文字串而不指定預設 `lang="zh"`。
- 每個 Task 結束都跑 `npm run test`（vitest）+ `npx tsc --noEmit`，Task 完成後才進下一個。

---

## 翻譯字典總表（Task 2 會建的 `src/lib/i18n.ts` 完整內容基礎）

| key | zh | en |
|---|---|---|
| `deathRateVillageFallbackNotice` | 死亡率資料最細至鄉鎮，已自動切換為人口密度 | Death-rate data is only available down to the township level; automatically switched to population density. |
| `brandTitleLine1` | 臺灣鄉鎮 | Taiwan Township |
| `brandTitleLine2` | 統計圖集 | Statistical Atlas |
| `navIndicatorsAriaLabel` | 指標 | Indicators |
| `darkModeButton` | 深色模式 | Dark mode |
| `lightModeButton` | 淺色模式 | Light mode |
| `langToggleToZh` | 中文 | 中文 |
| `langToggleToEn` | English | English |
| `yearRangeFooterPrefix` | 民國 | ROC |
| `yearRangeFooterSuffix` | ｜ · 縣市›鄉鎮›村里 | · County › Township › Village |
| `loadingData` | 載入資料中… | Loading data… |
| `yearSelectLabel` | 選擇年度（民國） | Select year (ROC) |
| `yearTablistAriaLabel` | 年度 | Year |
| `pauseLabel` | 暫停 | Pause |
| `playLabel` | 播放 | Play |
| `yearSuffix` | 年 | *(空字串,不加尾字)* |
| `hintNation` | 點擊縣市下鑽至鄉鎮；金門、連江見左側虛線框 | Click a county to drill into townships; Kinmen and Lienchiang are shown in the dashed boxes on the left |
| `hintCounty` | 點擊鄉鎮下鑽至村里 | Click a township to drill into villages |
| `hintTown` | 點選村里可看三指標；村里人口為普查快照 | Click a village to see three indicators; village population is a census snapshot |
| `breadcrumbNavAriaLabel` | 下鑽層級 | Drill-down level |
| `villageDataLoading` | 村里圖資載入中… | Loading village map data… |
| `closeNoticeAriaLabel` | 關閉提示 | Close notice |
| `villageLoadFailedPrefix` | 村里檔載入失敗（ | Failed to load village data ( |
| `villageLoadFailedSuffix` | ） | ) |
| `nationLabel` | 全國 | Nation |
| `censusSnapshotNote` | 人口普查快照 | Census snapshot |
| `noVillageDataNote` | 無村里資料（最細至鄉鎮） | No village-level data (available down to township only) |
| `sourceFooterText` | 資料來源：鄉鎮多指標統計（民國 102–107）；鄉鎮界圖：政府開放資料。本站為研究用途之非官方作品。 | Data source: township multi-indicator statistics (ROC 102–107); township boundary map: government open data. This site is an unofficial research project. |
| `noDataLabel` | 無資料 | No data |
| `tooltipPopulationPrefix` | ｜人口 | \| Pop. |
| `regionChannelLabel` | 區域 | Region |
| `axisXLabel` | X 軸 | X Axis |
| `axisYLabel` | Y 軸 | Y Axis |
| `colorChannelLabel` | 顏色 | Color |
| `sizeChannelLabel` | 大小 | Size |
| `colorChannelRegionNoRank` | 顏色通道＝區域，無排名數值 | Color channel = region; no rank values |
| `topFiveSuffix` | 前五名 | – Top 5 |
| `villageFallbackLabel` | 村里 | Village |
| `villageTopFiveSuffix` | 村里前五名 | Village Top 5 |
| `deathRateNoVillageData` | 死亡率無村里資料（最細至鄉鎮） | Death-rate data unavailable at village level (available down to township only) |
| `trendSparklineAriaLabel` | 歷年趨勢 | Historical trend |
| `selectedEntityInfoAriaLabel` | 選取單位資訊 | Selected entity info |
| `selectModeButton` | 選取 | Select |
| `clearModeButton` | 清除 | Clear |
| `helpButton` | 使用說明 | Help |
| `helpBulletMapClick` | 點左側地圖任一縣市可看整縣。 | Click any county on the map on the left to view the whole county. |
| `helpBulletSelectMode` | 按「選取」開啟後，拖曳框選一批鄉鎮，或單擊泡泡逐一加入名單。 | Turn on "Select," then drag to lasso a group of townships, or click bubbles one at a time to add them. |
| `helpBulletClearMode` | 按「清除」開啟後，拖曳框選要移出的鄉鎮，或單擊已選泡泡移出。 | Turn on "Clear," then drag to lasso townships to remove, or click a selected bubble to remove it. |
| `helpBulletZoom` | 滑鼠移到圖上滾動滾輪可縮放；縮放後可拖曳平移；雙擊空白處還原。 | Hover over the chart and scroll to zoom; drag to pan once zoomed; double-click empty space to reset. |
| `selectedCountPrefix` | 已選 | Selected |
| `selectedCountSuffix` | 鄉鎮：雙擊已選泡泡可移出；切年份或通道，名單都會保留。 | townships: double-click a selected bubble to remove it; the list is kept when switching year or channel. |
| `returnToNationClears` | 回全國即可清空選取。 | Return to the nation view to clear the selection. |
| `noSelectionYetHelp` | 尚未選取：用上面的框選功能開始，或點左側地圖任一縣市。 | No selection yet: use the lasso tool above to start, or click any county on the map on the left. |
| `gotItCloseHint` | 知道了,關閉提示 | Got it, close hint |
| `brushHintText` | 按上方「選取」後可拖曳框選或單擊泡泡 | Turn on "Select" above, then drag to lasso or click bubbles |
| `tooltipSeparator` | ｜ | · |
| `basicIndicatorsGroup` | 基本指標 | Basic indicators |
| `topTenCausesGroup` | 十大死因 | Top 10 causes of death |

以上皆為字面上直接替換的 UI 字串。**動態組字串**（軸標籤「label（unit）」、caption 完整句子）用專屬 helper 函式（見各 Task），不進這張表。

## 指標/死因/區域小字典（Task 2 建 `src/lib/metricI18n.ts`）

| key(資料既有) | zh label | en label |
|---|---|---|
| `density` | 人口密度 | Population density |
| `income` | 平均所得 | Average income |
| `death` | 死亡率 | Death rate |
| `clinic` | 診所醫事人力 | Clinic medical staff |
| `hospital` | 醫院醫事人力 | Hospital medical staff |

| key | zh unit | en unit |
|---|---|---|
| `density` | 人/km² | people/km² |
| `income` | 千元/戶 | NT$1,000/household |
| `death` | 每10萬人 | per 100,000 |
| `clinic` | 人/萬人 | per 10,000 |
| `hospital` | 人/萬人 | per 10,000 |

死因（`deathCauses[].label`，key＝資料既有 `death_c*`）：

| key | zh | en |
|---|---|---|
| `death` | 全死因 | All causes |
| `death_c06` | 惡性腫瘤 | Malignant neoplasms |
| `death_c16` | 心臟疾病 | Heart disease |
| `death_c17` | 腦血管疾病 | Cerebrovascular disease |
| `death_c21` | 肺炎 | Pneumonia |
| `death_c09` | 糖尿病 | Diabetes mellitus |
| `death_c38` | 事故傷害 | Accidents |
| `death_c23` | 慢性下呼吸道疾病 | Chronic lower respiratory disease |
| `death_c15` | 高血壓性疾病 | Hypertensive disease |
| `death_c32` | 腎炎腎病症候群及腎病變 | Nephritis, nephrotic syndrome and nephrosis |
| `death_c28` | 慢性肝病及肝硬化 | Chronic liver disease and cirrhosis |

區域：北→North、中→Central、南→South、東→East、離島→Outlying Islands、東·離島→East · Outlying Islands。

---

### Task 1: 地名羅馬拼音函式庫

**Files:**
- Modify: `package.json`（新增 dependency `pinyin-pro`）
- Create: `src/lib/placeName.ts`
- Test: `src/lib/placeName.test.ts`

**Interfaces:**
- Produces: `romanizePlaceName(name: string, lang: Language): string`（`Language` 型別來自 Task 2 的 `src/lib/i18n.ts`，本 Task 先用 `"zh" | "en"` 內聯型別，Task 2 完成後兩處型別互通不用改）

- [ ] **Step 1: 安裝 pinyin-pro**

Run: `npm install pinyin-pro`

Expected: `package.json` 的 `dependencies` 多一行 `"pinyin-pro": "^3.x.x"`（實際版號以安裝結果為準）。

- [ ] **Step 2: 寫失敗測試**

```typescript
// src/lib/placeName.test.ts
import { describe, it, expect } from "vitest";
import { romanizePlaceName } from "./placeName";

describe("romanizePlaceName", () => {
  it("zh 模式原樣回傳", () => {
    expect(romanizePlaceName("板橋區", "zh")).toBe("板橋區");
  });
  it("區 → District", () => {
    expect(romanizePlaceName("板橋區", "en")).toBe("Banqiao District");
  });
  it("縣 → County", () => {
    expect(romanizePlaceName("金門縣", "en")).toBe("Jinmen County");
  });
  it("市（縣級市）→ City", () => {
    expect(romanizePlaceName("臺北市", "en")).toBe("Taibei City");
  });
  it("鄉 → Township", () => {
    expect(romanizePlaceName("烏坵鄉", "en")).toBe("Wuqiu Township");
  });
  it("里 → Village", () => {
    expect(romanizePlaceName("民生里", "en")).toBe("Minsheng Village");
  });
  it("村 → Village", () => {
    expect(romanizePlaceName("三民村", "en")).toBe("Sanmin Village");
  });
  it("抓不到已知字尾時整串轉拼音、不加字尾", () => {
    expect(romanizePlaceName("台灣", "en")).toBe("Taiwan");
  });
  it("同名稱重複呼叫回傳一致結果(cache 正確性)", () => {
    const a = romanizePlaceName("板橋區", "en");
    const b = romanizePlaceName("板橋區", "en");
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 3: 執行測試確認失敗**

Run: `npx vitest run src/lib/placeName.test.ts`
Expected: FAIL（`Cannot find module './placeName'` 或等價錯誤，因為檔案還不存在）

- [ ] **Step 4: 實作 `src/lib/placeName.ts`**

```typescript
import { pinyin } from "pinyin-pro";

export type Language = "zh" | "en";

// 中文行政層級字尾 → 英文行政單位字尾(比照臺灣官方雙語路牌慣例)。
// 依序比對(陣列順序=比對順序),抓到第一個符合的字尾就用;抓不到則整串轉拼音不加字尾。
const SUFFIX_MAP: [string, string][] = [
  ["縣", "County"],
  ["市", "City"],
  ["區", "District"],
  ["鎮", "Town"],
  ["鄉", "Township"],
  ["里", "Village"],
  ["村", "Village"],
];

const cache = new Map<string, string>();

// 漢語拼音轉英文專有名詞慣例:字首大寫、其餘小寫、音節間不留空格(如「板橋」→「Banqiao」而非「Ban Qiao」)。
function toPinyinWord(han: string): string {
  const syllables = pinyin(han, { toneType: "none", type: "array" }) as string[];
  return syllables
    .map((s, i) => (i === 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s))
    .join("");
}

// 拼音為自動化最佳近似(非官方羅馬拼音權威來源,如「臺北」轉出「Taibei」而非郵政式「Taipei」)。
export function romanizePlaceName(name: string, lang: Language): string {
  if (lang === "zh") return name;
  const cached = cache.get(name);
  if (cached !== undefined) return cached;
  const hit = SUFFIX_MAP.find(([suffix]) => name.length > suffix.length && name.endsWith(suffix));
  const result = hit ? `${toPinyinWord(name.slice(0, -1))} ${hit[1]}` : toPinyinWord(name);
  cache.set(name, result);
  return result;
}
```

- [ ] **Step 5: 執行測試確認通過**

Run: `npx vitest run src/lib/placeName.test.ts`
Expected: PASS（9 個測試全過）

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/placeName.ts src/lib/placeName.test.ts
git commit -m "feat: 新增地名羅馬拼音函式庫(pinyin-pro,英文模式縣市鄉鎮村里音譯)"
```

---

### Task 2: 翻譯字典 + 指標/死因/區域小字典

**Files:**
- Create: `src/lib/i18n.ts`
- Create: `src/lib/metricI18n.ts`
- Test: `src/lib/metricI18n.test.ts`

**Interfaces:**
- Produces: `Language`（改由此檔案匯出，Task 1 的 `placeName.ts` 之後改成 `import type { Language } from "./i18n"`）、`Dict` 型別、`translations: Record<Language, Dict>`、`metricLabel(key: string, zhLabel: string, lang: Language): string`、`metricUnit(key: string, zhUnit: string, lang: Language): string`、`regionLabel(region: string, lang: Language): string`

- [ ] **Step 1: 建立 `src/lib/i18n.ts`**

```typescript
export type Language = "zh" | "en";

export interface Dict {
  deathRateVillageFallbackNotice: string;
  brandTitleLine1: string;
  brandTitleLine2: string;
  navIndicatorsAriaLabel: string;
  darkModeButton: string;
  lightModeButton: string;
  langToggleToZh: string;
  langToggleToEn: string;
  yearRangeFooterPrefix: string;
  yearRangeFooterSuffix: string;
  loadingData: string;
  yearSelectLabel: string;
  yearTablistAriaLabel: string;
  pauseLabel: string;
  playLabel: string;
  yearSuffix: string;
  hintNation: string;
  hintCounty: string;
  hintTown: string;
  breadcrumbNavAriaLabel: string;
  villageDataLoading: string;
  closeNoticeAriaLabel: string;
  villageLoadFailedPrefix: string;
  villageLoadFailedSuffix: string;
  nationLabel: string;
  censusSnapshotNote: string;
  noVillageDataNote: string;
  sourceFooterText: string;
  noDataLabel: string;
  tooltipPopulationPrefix: string;
  regionChannelLabel: string;
  axisXLabel: string;
  axisYLabel: string;
  colorChannelLabel: string;
  sizeChannelLabel: string;
  colorChannelRegionNoRank: string;
  topFiveSuffix: string;
  villageFallbackLabel: string;
  villageTopFiveSuffix: string;
  deathRateNoVillageData: string;
  trendSparklineAriaLabel: string;
  selectedEntityInfoAriaLabel: string;
  selectModeButton: string;
  clearModeButton: string;
  helpButton: string;
  helpBulletMapClick: string;
  helpBulletSelectMode: string;
  helpBulletClearMode: string;
  helpBulletZoom: string;
  selectedCountPrefix: string;
  selectedCountSuffix: string;
  returnToNationClears: string;
  noSelectionYetHelp: string;
  gotItCloseHint: string;
  brushHintText: string;
  tooltipSeparator: string;
  basicIndicatorsGroup: string;
  topTenCausesGroup: string;
}

export const translations: Record<Language, Dict> = {
  zh: {
    deathRateVillageFallbackNotice: "死亡率資料最細至鄉鎮，已自動切換為人口密度",
    brandTitleLine1: "臺灣鄉鎮",
    brandTitleLine2: "統計圖集",
    navIndicatorsAriaLabel: "指標",
    darkModeButton: "深色模式",
    lightModeButton: "淺色模式",
    langToggleToZh: "中文",
    langToggleToEn: "English",
    yearRangeFooterPrefix: "民國 ",
    yearRangeFooterSuffix: " · 縣市›鄉鎮›村里",
    loadingData: "載入資料中…",
    yearSelectLabel: "選擇年度（民國）",
    yearTablistAriaLabel: "年度",
    pauseLabel: "暫停",
    playLabel: "播放",
    yearSuffix: " 年",
    hintNation: "點擊縣市下鑽至鄉鎮；金門、連江見左側虛線框",
    hintCounty: "點擊鄉鎮下鑽至村里",
    hintTown: "點選村里可看三指標；村里人口為普查快照",
    breadcrumbNavAriaLabel: "下鑽層級",
    villageDataLoading: "村里圖資載入中…",
    closeNoticeAriaLabel: "關閉提示",
    villageLoadFailedPrefix: "村里檔載入失敗（",
    villageLoadFailedSuffix: "）",
    nationLabel: "全國",
    censusSnapshotNote: "人口普查快照",
    noVillageDataNote: "無村里資料（最細至鄉鎮）",
    sourceFooterText: "資料來源：鄉鎮多指標統計（民國 102–107）；鄉鎮界圖：政府開放資料。本站為研究用途之非官方作品。",
    noDataLabel: "無資料",
    tooltipPopulationPrefix: "｜人口 ",
    regionChannelLabel: "區域",
    axisXLabel: "X 軸",
    axisYLabel: "Y 軸",
    colorChannelLabel: "顏色",
    sizeChannelLabel: "大小",
    colorChannelRegionNoRank: "顏色通道＝區域，無排名數值",
    topFiveSuffix: " 前五名",
    villageFallbackLabel: "村里",
    villageTopFiveSuffix: " 村里前五名",
    deathRateNoVillageData: "死亡率無村里資料（最細至鄉鎮）",
    trendSparklineAriaLabel: "歷年趨勢",
    selectedEntityInfoAriaLabel: "選取單位資訊",
    selectModeButton: "選取",
    clearModeButton: "清除",
    helpButton: "使用說明",
    helpBulletMapClick: "點左側地圖任一縣市可看整縣。",
    helpBulletSelectMode: "按「選取」開啟後，拖曳框選一批鄉鎮，或單擊泡泡逐一加入名單。",
    helpBulletClearMode: "按「清除」開啟後，拖曳框選要移出的鄉鎮，或單擊已選泡泡移出。",
    helpBulletZoom: "滑鼠移到圖上滾動滾輪可縮放；縮放後可拖曳平移；雙擊空白處還原。",
    selectedCountPrefix: "已選 ",
    selectedCountSuffix: " 鄉鎮：雙擊已選泡泡可移出；切年份或通道，名單都會保留。",
    returnToNationClears: "回全國即可清空選取。",
    noSelectionYetHelp: "尚未選取：用上面的框選功能開始，或點左側地圖任一縣市。",
    gotItCloseHint: "知道了,關閉提示",
    brushHintText: "按上方「選取」後可拖曳框選或單擊泡泡",
    tooltipSeparator: "｜",
    basicIndicatorsGroup: "基本指標",
    topTenCausesGroup: "十大死因",
  },
  en: {
    deathRateVillageFallbackNotice: "Death-rate data is only available down to the township level; automatically switched to population density.",
    brandTitleLine1: "Taiwan Township",
    brandTitleLine2: "Statistical Atlas",
    navIndicatorsAriaLabel: "Indicators",
    darkModeButton: "Dark mode",
    lightModeButton: "Light mode",
    langToggleToZh: "中文",
    langToggleToEn: "English",
    yearRangeFooterPrefix: "ROC ",
    yearRangeFooterSuffix: " · County › Township › Village",
    loadingData: "Loading data…",
    yearSelectLabel: "Select year (ROC)",
    yearTablistAriaLabel: "Year",
    pauseLabel: "Pause",
    playLabel: "Play",
    yearSuffix: "",
    hintNation: "Click a county to drill into townships; Kinmen and Lienchiang are shown in the dashed boxes on the left",
    hintCounty: "Click a township to drill into villages",
    hintTown: "Click a village to see three indicators; village population is a census snapshot",
    breadcrumbNavAriaLabel: "Drill-down level",
    villageDataLoading: "Loading village map data…",
    closeNoticeAriaLabel: "Close notice",
    villageLoadFailedPrefix: "Failed to load village data (",
    villageLoadFailedSuffix: ")",
    nationLabel: "Nation",
    censusSnapshotNote: "Census snapshot",
    noVillageDataNote: "No village-level data (available down to township only)",
    sourceFooterText: "Data source: township multi-indicator statistics (ROC 102–107); township boundary map: government open data. This site is an unofficial research project.",
    noDataLabel: "No data",
    tooltipPopulationPrefix: " | Pop. ",
    regionChannelLabel: "Region",
    axisXLabel: "X Axis",
    axisYLabel: "Y Axis",
    colorChannelLabel: "Color",
    sizeChannelLabel: "Size",
    colorChannelRegionNoRank: "Color channel = region; no rank values",
    topFiveSuffix: " – Top 5",
    villageFallbackLabel: "Village",
    villageTopFiveSuffix: " Village Top 5",
    deathRateNoVillageData: "Death-rate data unavailable at village level (available down to township only)",
    trendSparklineAriaLabel: "Historical trend",
    selectedEntityInfoAriaLabel: "Selected entity info",
    selectModeButton: "Select",
    clearModeButton: "Clear",
    helpButton: "Help",
    helpBulletMapClick: "Click any county on the map on the left to view the whole county.",
    helpBulletSelectMode: "Turn on \"Select,\" then drag to lasso a group of townships, or click bubbles one at a time to add them.",
    helpBulletClearMode: "Turn on \"Clear,\" then drag to lasso townships to remove, or click a selected bubble to remove it.",
    helpBulletZoom: "Hover over the chart and scroll to zoom; drag to pan once zoomed; double-click empty space to reset.",
    selectedCountPrefix: "Selected ",
    selectedCountSuffix: " townships: double-click a selected bubble to remove it; the list is kept when switching year or channel.",
    returnToNationClears: "Return to the nation view to clear the selection.",
    noSelectionYetHelp: "No selection yet: use the lasso tool above to start, or click any county on the map on the left.",
    gotItCloseHint: "Got it, close hint",
    brushHintText: "Turn on \"Select\" above, then drag to lasso or click bubbles",
    tooltipSeparator: " · ",
    basicIndicatorsGroup: "Basic indicators",
    topTenCausesGroup: "Top 10 causes of death",
  },
};

export function t(lang: Language): Dict {
  return translations[lang];
}

// 「label（unit）」/「role（label）」共用括號格式:中文全形括號緊貼,英文半形括號前留空格。
export function formatParen(a: string, b: string, lang: Language): string {
  return lang === "zh" ? `${a}（${b}）` : `${a} (${b})`;
}
```

- [ ] **Step 2: 更新 `src/lib/placeName.ts` 改用共用 `Language` 型別**

修改第一行 import：

```typescript
import { pinyin } from "pinyin-pro";
import type { Language } from "./i18n";
```

並刪掉原本 `export type Language = "zh" | "en";` 那一行（現在從 `i18n.ts` 匯入，避免兩個型別各自宣告卻不共通）。

- [ ] **Step 3: 寫 `metricI18n.ts` 失敗測試**

```typescript
// src/lib/metricI18n.test.ts
import { describe, it, expect } from "vitest";
import { metricLabel, metricUnit, regionLabel } from "./metricI18n";

describe("metricI18n", () => {
  it("zh 模式回傳原始 label", () => {
    expect(metricLabel("density", "人口密度", "zh")).toBe("人口密度");
  });
  it("en 模式回傳指標英文名", () => {
    expect(metricLabel("density", "人口密度", "en")).toBe("Population density");
  });
  it("en 模式回傳死因英文名", () => {
    expect(metricLabel("death_c06", "惡性腫瘤", "en")).toBe("Malignant neoplasms");
  });
  it("en 模式查無對照時退回原始 label", () => {
    expect(metricLabel("unknown_key", "某指標", "en")).toBe("某指標");
  });
  it("metricUnit en 模式回傳英文單位", () => {
    expect(metricUnit("income", "千元/戶", "en")).toBe("NT$1,000/household");
  });
  it("regionLabel en 模式回傳英文區域名", () => {
    expect(regionLabel("北", "en")).toBe("North");
    expect(regionLabel("東·離島", "en")).toBe("East · Outlying Islands");
  });
  it("regionLabel zh 模式原樣回傳", () => {
    expect(regionLabel("北", "zh")).toBe("北");
  });
});
```

- [ ] **Step 4: 執行測試確認失敗**

Run: `npx vitest run src/lib/metricI18n.test.ts`
Expected: FAIL（模組不存在）

- [ ] **Step 5: 實作 `src/lib/metricI18n.ts`**

```typescript
import type { Language } from "./i18n";

// 指標/死因/區域集合小且固定(5+11+6項),用資料既有的英文 key 當索引直接對照,
// 不需要像地名一樣做程式化音譯。key 來自 meta.json 的 indicators[].key / deathCauses[].key。
const INDICATOR_LABEL_EN: Record<string, string> = {
  density: "Population density",
  income: "Average income",
  death: "Death rate",
  clinic: "Clinic medical staff",
  hospital: "Hospital medical staff",
};

const INDICATOR_UNIT_EN: Record<string, string> = {
  density: "people/km²",
  income: "NT$1,000/household",
  death: "per 100,000",
  clinic: "per 10,000",
  hospital: "per 10,000",
};

const DEATH_CAUSE_LABEL_EN: Record<string, string> = {
  death: "All causes",
  death_c06: "Malignant neoplasms",
  death_c16: "Heart disease",
  death_c17: "Cerebrovascular disease",
  death_c21: "Pneumonia",
  death_c09: "Diabetes mellitus",
  death_c38: "Accidents",
  death_c23: "Chronic lower respiratory disease",
  death_c15: "Hypertensive disease",
  death_c32: "Nephritis, nephrotic syndrome and nephrosis",
  death_c28: "Chronic liver disease and cirrhosis",
};

const REGION_LABEL_EN: Record<string, string> = {
  "北": "North",
  "中": "Central",
  "南": "South",
  "東": "East",
  "離島": "Outlying Islands",
  "東·離島": "East · Outlying Islands",
};

// zhLabel 當找不到對照時的安全 fallback(退回原始中文,不留白)。
export function metricLabel(key: string, zhLabel: string, lang: Language): string {
  if (lang === "zh") return zhLabel;
  return DEATH_CAUSE_LABEL_EN[key] ?? INDICATOR_LABEL_EN[key] ?? zhLabel;
}

export function metricUnit(key: string, zhUnit: string, lang: Language): string {
  if (lang === "zh") return zhUnit;
  return INDICATOR_UNIT_EN[key] ?? zhUnit;
}

export function regionLabel(region: string, lang: Language): string {
  if (lang === "zh") return region;
  return REGION_LABEL_EN[region] ?? region;
}
```

- [ ] **Step 6: 執行測試確認通過**

Run: `npx vitest run src/lib/metricI18n.test.ts src/lib/placeName.test.ts`
Expected: PASS（全過，`placeName.test.ts` 因型別匯入來源改變需一併確認不受影響）

- [ ] **Step 7: 全專案測試+型別檢查**

Run: `npm run test && npx tsc --noEmit`
Expected: 既有測試全綠、無型別錯誤

- [ ] **Step 8: Commit**

```bash
git add src/lib/i18n.ts src/lib/metricI18n.ts src/lib/metricI18n.test.ts src/lib/placeName.ts
git commit -m "feat: 翻譯字典 i18n.ts + 指標/死因/區域英文對照 metricI18n.ts"
```

---

### Task 3: LanguageContext + App.tsx 接線

**Files:**
- Create: `src/state/LanguageContext.tsx`
- Modify: `src/App.tsx:1-19,74-79,142-144`

**Interfaces:**
- Consumes: `translations`, `type Dict`, `type Language` from `../lib/i18n`（Task 2）
- Produces: `LanguageProvider`（React 元件）、`useLanguage(): { lang: Language; tr: Dict; toggle: () => void }`——**注意變數名 `tr` 不是 `t`**（Global Constraints 已說明原因）

- [ ] **Step 1: 建立 `src/state/LanguageContext.tsx`**

```typescript
import { createContext, useContext, useState, type ReactNode } from "react";
import { translations, type Dict, type Language } from "../lib/i18n";

interface LanguageValue {
  lang: Language;
  tr: Dict;
  toggle: () => void;
}

const LanguageContext = createContext<LanguageValue | null>(null);

// 比照 useTokens.tsx 深色模式 state 的寫法:純 useState,不持久化——重新整理回到預設中文。
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>("zh");
  return (
    <LanguageContext.Provider value={{ lang, tr: translations[lang], toggle: () => setLang((v) => (v === "zh" ? "en" : "zh")) }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
```

- [ ] **Step 2: `App.tsx` 包上 `LanguageProvider`，翻譯降級提示**

在檔案開頭 import 區塊（現有第 1-10 行）加入：

```typescript
import { LanguageProvider, useLanguage } from "./state/LanguageContext";
```

`Inner()` 函式內（現有第 12-13 行附近）加入語言 hook：

```typescript
function Inner() {
  const t = useTokens();
  const { lang, tr } = useLanguage();
```

現有第 73-79 行（村里層 X 自動降級提示）：

```typescript
  // 村里層 X 無資料（死亡率/死因）→ X 自動降級為人口密度並提示（X=全頁指標,降級一體適用）
  useEffect(() => {
    if (data && !indicatorAvailable(data.meta, indicator, view)) {
      setScatter((s) => patchChannels(s, { x: "density" }));
      setNotice("死亡率資料最細至鄉鎮，已自動切換為人口密度");
    }
  }, [data, indicator, view]);
```

改為：

```typescript
  // 村里層 X 無資料（死亡率/死因）→ X 自動降級為人口密度並提示（X=全頁指標,降級一體適用）
  useEffect(() => {
    if (data && !indicatorAvailable(data.meta, indicator, view)) {
      setScatter((s) => patchChannels(s, { x: "density" }));
      setNotice(tr.deathRateVillageFallbackNotice);
    }
  }, [data, indicator, view, tr]);
```

村里圖資載入失敗提示（原本 `setNotice(e instanceof Error ? e.message : String(e))`，在村里 lazy-load 的 `.catch()` 區塊）改為用 `tr` 組譯文而非顯示原始 Error message（避免英文模式下訊息夾雜中文）：

```typescript
      .catch((e) => {
        if (!cancelled) {
          console.error(e);
          setNotice(`${tr.villageLoadFailedPrefix}${view.towncode}${tr.villageLoadFailedSuffix}`);
          setNav((cur) => applyView(cur, up(cur.view), townsOfCounty));
        }
      });
```

該 `useEffect` 的依賴陣列（原 `[view, townsOfCounty]`）加入 `tr`：`[view, townsOfCounty, tr]`。

檔案最下方 `App()` 函式（現有第 142-144 行）：

```typescript
export default function App() {
  return <ThemeProvider><Inner /></ThemeProvider>;
}
```

改為：

```typescript
export default function App() {
  return <LanguageProvider><ThemeProvider><Inner /></ThemeProvider></LanguageProvider>;
}
```

- [ ] **Step 3: 型別檢查+既有測試**

Run: `npx tsc --noEmit && npm run test`
Expected: 無型別錯誤、既有測試全綠（`Inner()` 目前還沒有測試直接覆蓋這兩段提示文字，若既有測試斷言到這兩句中文字串會失敗——若失敗則更新該測試改用 `tr.deathRateVillageFallbackNotice`/組出的村里失敗訊息斷言，語言預設為 `"zh"` 不影響其原本斷言值）

- [ ] **Step 4: Commit**

```bash
git add src/state/LanguageContext.tsx src/App.tsx
git commit -m "feat: LanguageContext 接線,App.tsx 降級/村里載入失敗提示改用翻譯字典"
```

---

### Task 4: 語言切換按鈕 + taste Shell 自身文字

**Files:**
- Modify: `src/designs/taste/Shell.tsx`（全檔，接 `useLanguage()`）

**Interfaces:**
- Consumes: `useLanguage()` from `../../state/LanguageContext`（Task 3）

- [ ] **Step 1: import 與 hook**

第 1-2 行加入：

```typescript
import { useTokens } from "../../lib/useTokens";
import { useLanguage } from "../../state/LanguageContext";
```

第 21 行 `const t = useTokens();` 後加一行：

```typescript
  const { lang, tr, toggle: toggleLang } = useLanguage();
```

- [ ] **Step 2: 品牌標題（第 41 行）**

```typescript
            臺灣鄉鎮<br />統計圖集
```

改為：

```typescript
            {tr.brandTitleLine1}<br />{tr.brandTitleLine2}
```

- [ ] **Step 3: 側欄指標鈕 aria-label（第 44 行）**

```typescript
        <nav style={{ display: "flex", flexDirection: "column", gap: 6 }} aria-label="指標">
```

改為：

```typescript
        <nav style={{ display: "flex", flexDirection: "column", gap: 6 }} aria-label={tr.navIndicatorsAriaLabel}>
```

指標鈕的 `v.label`/`v.desc`（第 55-56 行）套用指標英文對照（`metricLabel`/`metricUnit`，Task 2）。第 1 行 import 區塊加：

```typescript
import { metricLabel, metricUnit } from "../../lib/metricI18n";
```

第 55-56 行原本：

```typescript
                <span style={{ fontSize: S.body, fontWeight: on ? 700 : 500 }}>{v.label}</span>
                <span style={{ display: "block", fontSize: S.footnote, color: on ? t.accent : t.textMuted, opacity: on ? 0.85 : 1, marginTop: 2 }}>{v.desc}</span>
```

改為：

```typescript
                <span style={{ fontSize: S.body, fontWeight: on ? 700 : 500 }}>{metricLabel(v.key, v.label, lang)}</span>
                <span style={{ display: "block", fontSize: S.footnote, color: on ? t.accent : t.textMuted, opacity: on ? 0.85 : 1, marginTop: 2 }}>{metricUnit(v.key, v.desc, lang)}</span>
```

（`v.desc` 其實是 `Indicator.unit`，`navItems` 建構在第 27 行 `data?.meta.indicators.map((i) => ({ key: i.key, label: i.label, desc: i.unit }))`，`key` 已在，可直接傳進 `metricUnit`。）

- [ ] **Step 4: 新增語言切換鈕（深色模式鈕正上方）**

第 61-68 行原本：

```typescript
        <div className="flex flex-col items-center text-center" style={{ marginTop: "auto", gap: 10, display: "flex" }}>
          {/* 與年份鈕同款青綠膠囊(.year-like:淡青底/青字/青框+hover 加深+按壓縮小) */}
          <button className="year-like" onClick={t.toggle} style={{ background: t.surface, color: t.text, border: `1px solid ${t.border}`, borderRadius: C.pill.radius, padding: "6px 16px", cursor: "pointer", fontSize: S.control, fontFamily: sd.typography.fontFamily, transition: "all 150ms ease-in-out" }}>
            {t.dark ? "淺色模式" : "深色模式"}
          </button>
          <p style={{ fontSize: 10, color: t.textMuted, opacity: 0.8, margin: 0, fontVariantNumeric: "tabular-nums" }}>民國 {yrRange} · 縣市›鄉鎮›村里</p>
        </div>
```

改為（語言切換鈕緊貼在深色模式鈕正上方，同一顆 `.year-like` 膠囊樣式）：

```typescript
        <div className="flex flex-col items-center text-center" style={{ marginTop: "auto", gap: 10, display: "flex" }}>
          {/* 語言切換鈕(使用者 8/11 要求,放深色模式鈕正上方):同款 .year-like 膠囊,
              文字＝按下去會變成的語言(比照 gapminder-bubble-globe-app 語言鈕邏輯)。 */}
          <button className="year-like" onClick={toggleLang} style={{ background: t.surface, color: t.text, border: `1px solid ${t.border}`, borderRadius: C.pill.radius, padding: "6px 16px", cursor: "pointer", fontSize: S.control, fontFamily: sd.typography.fontFamily, transition: "all 150ms ease-in-out" }}>
            {lang === "zh" ? tr.langToggleToEn : tr.langToggleToZh}
          </button>
          {/* 與年份鈕同款青綠膠囊(.year-like:淡青底/青字/青框+hover 加深+按壓縮小) */}
          <button className="year-like" onClick={t.toggle} style={{ background: t.surface, color: t.text, border: `1px solid ${t.border}`, borderRadius: C.pill.radius, padding: "6px 16px", cursor: "pointer", fontSize: S.control, fontFamily: sd.typography.fontFamily, transition: "all 150ms ease-in-out" }}>
            {t.dark ? tr.lightModeButton : tr.darkModeButton}
          </button>
          <p style={{ fontSize: 10, color: t.textMuted, opacity: 0.8, margin: 0, fontVariantNumeric: "tabular-nums" }}>{tr.yearRangeFooterPrefix}{yrRange}{tr.yearRangeFooterSuffix}</p>
        </div>
```

- [ ] **Step 5: 標題（`title`，第 26 行）與載入中文字（第 83 行）**

第 26 行 `title` 是 `scatterVars(data.meta).find(...).label`（X 軸當前指標名稱），改為：

```typescript
  const title = data ? metricLabel(scatter.x, scatterVars(data.meta).find((v) => v.key === scatter.x)?.label ?? "", lang) : "";
```

（`scatterVars` 已從 `../../lib/data` import，此行本來就有；只是包一層 `metricLabel`。）

第 83 行：

```typescript
        {!data ? <p style={{ color: t.textMuted }}>載入資料中…</p> : (
```

改為：

```typescript
        {!data ? <p style={{ color: t.textMuted }}>{tr.loadingData}</p> : (
```

- [ ] **Step 6: 型別檢查+build**

Run: `npx tsc --noEmit && npm run build`
Expected: 無錯誤

- [ ] **Step 7: 本機啟動人工檢查按鈕位置**

Run: `npm run dev`（背景執行或另開終端），瀏覽器開 `http://localhost:5173`，確認：
1. 左側欄底部由上而下依序是「語言切換鈕」「深色模式鈕」「年份範圍註記」，間距與深色模式鈕本身一致
2. 點語言鈕，鈕文字在「English」/「中文」間切換，品牌標題/指標鈕跟著切換語言（其餘元件此時仍是中文，屬預期——後續 Task 才處理）

- [ ] **Step 8: Commit**

```bash
git add src/designs/taste/Shell.tsx
git commit -m "feat: 語言切換鈕(深色模式鈕正上方)+taste Shell 自身文字翻譯"
```

---

### Task 5: YearTabs.tsx

**Files:**
- Modify: `src/components/YearTabs.tsx`（全檔）

- [ ] **Step 1: 接 `useLanguage()`，替換所有中文字串**

第 4 行加：

```typescript
import { useLanguage } from "../state/LanguageContext";
```

第 15 行 `const t = useTokens();` 後加：

```typescript
  const { tr } = useLanguage();
```

第 37 行：

```typescript
      <span style={{ fontSize: S.footnote, color: t.textMuted, letterSpacing: "0.04em" }}>選擇年度（民國）</span>
```

改為：

```typescript
      <span style={{ fontSize: S.footnote, color: t.textMuted, letterSpacing: "0.04em" }}>{tr.yearSelectLabel}</span>
```

第 38 行 `aria-label="年度"` 改為 `aria-label={tr.yearTablistAriaLabel}`。

第 39 行 `aria-label={playing ? "暫停" : "播放"}` 改為 `aria-label={playing ? tr.pauseLabel : tr.playLabel}`。

第 64 行：

```typescript
              {y} 年
```

改為：

```typescript
              {y}{tr.yearSuffix}
```

- [ ] **Step 2: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無錯誤

- [ ] **Step 3: 既有測試**

Run: `npm run test`
Expected: 全綠（若有測試斷言 `"選擇年度（民國）"` 等固定字串，語言預設 zh 不受影響應仍過；若失敗，確認是否測試直接 render `<YearTabs>` 卻沒包 `<LanguageProvider>`——需要的話在該測試檔用 `render(<LanguageProvider><YearTabs .../></LanguageProvider>)` 包一層）

- [ ] **Step 4: Commit**

```bash
git add src/components/YearTabs.tsx
git commit -m "feat: YearTabs 翻譯"
```

---

### Task 6: MapBreadcrumb.tsx + lib/nav.ts 麵包屑地名/根節點翻譯

**Files:**
- Modify: `src/components/MapBreadcrumb.tsx`（全檔）
- Modify: `src/lib/nav.ts:34-40`（不改函式簽名，只在使用端翻譯）

**Interfaces:**
- Consumes: `useLanguage()`、`romanizePlaceName` from `../lib/placeName`

- [ ] **Step 1: 接 `useLanguage()` + `romanizePlaceName`，翻譯 hints/aria-label**

第 3 行後加：

```typescript
import { useLanguage } from "../state/LanguageContext";
import { romanizePlaceName } from "../lib/placeName";
```

第 13 行 `const t = useTokens();` 後加：

```typescript
  const { lang, tr } = useLanguage();
```

第 15-19 行：

```typescript
  const hints: Record<string, string> = {
    nation: "點擊縣市下鑽至鄉鎮；金門、連江見左側虛線框",
    county: "點擊鄉鎮下鑽至村里",
    town: `點選村里可看三指標；村里人口為普查快照`,
  };
```

改為：

```typescript
  const hints: Record<string, string> = {
    nation: tr.hintNation,
    county: tr.hintCounty,
    town: tr.hintTown,
  };
```

第 23 行 `aria-label="下鑽層級"` 改為 `aria-label={tr.breadcrumbNavAriaLabel}`。

第 40 行 `<span>村里圖資載入中…</span>` 改為 `<span>{tr.villageDataLoading}</span>`。

第 46 行 `aria-label="關閉提示"` 改為 `aria-label={tr.closeNoticeAriaLabel}`。

- [ ] **Step 2: 麵包屑地名翻譯（根節點「全國」+ 縣市/鄉鎮地名音譯）**

第 29-33 行原本：

```typescript
                {last ? <b style={{ color: t.text }}>{c.label}</b> : (
                  <button className="icon-btn crumb-btn" onClick={() => onView(c.view)}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: t.accent, fontSize: S.caption, textDecoration: "underline" }}>
                    {c.label}
                  </button>
                )}
```

改為（`crumbLabel` helper 在 `trail.map` 之前定義；根節點 `i===0` 一律是 `crumbs()` 回傳的 `"全國"`，其餘節點是縣市/鄉鎮名稱，套用地名音譯）：

在第 14 行 `const trail = crumbs(view);` 之後加一行：

```typescript
  const crumbLabel = (label: string, i: number) => (i === 0 ? tr.nationLabel : romanizePlaceName(label, lang));
```

第 29-33 行改為：

```typescript
                {last ? <b style={{ color: t.text }}>{crumbLabel(c.label, i)}</b> : (
                  <button className="icon-btn crumb-btn" onClick={() => onView(c.view)}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: t.accent, fontSize: S.caption, textDecoration: "underline" }}>
                    {crumbLabel(c.label, i)}
                  </button>
                )}
```

`lib/nav.ts` 的 `crumbs()`（第 34-40 行）**維持原樣不動**——它是純函式、有既有測試覆蓋，翻譯與地名音譯全部留在 render 端（`MapBreadcrumb.tsx`）處理，不動它的簽名與回傳內容。

- [ ] **Step 3: 型別檢查+既有測試**

Run: `npx tsc --noEmit && npm run test`
Expected: 無錯誤；`nav.test.ts`（若存在）不受影響因為 `crumbs()` 沒改

- [ ] **Step 4: Commit**

```bash
git add src/components/MapBreadcrumb.tsx
git commit -m "feat: MapBreadcrumb 翻譯+麵包屑地名音譯(根節點/縣市/鄉鎮)"
```

---

### Task 7: MapLegend.tsx + SourceFooter.tsx

**Files:**
- Modify: `src/components/MapLegend.tsx`（全檔）
- Modify: `src/components/SourceFooter.tsx`（全檔）

- [ ] **Step 1: MapLegend.tsx**

第 1-5 行 import 區塊：

```typescript
import { typography as __ty, components as C } from "../lib/styleDictionary";
const S = __ty.sizes; // type scale:字級一律具名(見 styleDictionary)
import { useTokens } from "../lib/useTokens";
import { useLanguage } from "../state/LanguageContext";
import { dataLevelOf, type View } from "../lib/nav";
import { resolveMetric, type Meta, type IndicatorKey } from "../lib/data";
import { metricLabel, metricUnit } from "../lib/metricI18n";
import { formatParen } from "../lib/i18n";
```

第 10 行 `const t = useTokens();` 後加：

```typescript
  const { lang, tr } = useLanguage();
```

第 18-20 行：

```typescript
      <div style={{ fontWeight: 600, color: t.text, fontSize: S.caption, marginBottom: 6 }}>
        {ind.label}（{ind.unit}）
      </div>
```

改為：

```typescript
      <div style={{ fontWeight: 600, color: t.text, fontSize: S.caption, marginBottom: 6 }}>
        {formatParen(metricLabel(ind.key, ind.label, lang), metricUnit(ind.key, ind.unit, lang), lang)}
      </div>
```

第 34 行 `<span style={{ color: t.textMuted }}>人口普查快照</span>` 改為 `<span style={{ color: t.textMuted }}>{tr.censusSnapshotNote}</span>`。

- [ ] **Step 2: SourceFooter.tsx**

第 3 行後加：

```typescript
import { useLanguage } from "../state/LanguageContext";
```

第 7 行 `export default function SourceFooter() {` 內第一行加：

```typescript
  const { tr } = useLanguage();
```

第 10 行：

```typescript
      資料來源：鄉鎮多指標統計（民國 102–107）；鄉鎮界圖：政府開放資料。本站為研究用途之非官方作品。
```

改為：

```typescript
      {tr.sourceFooterText}
```

- [ ] **Step 3: 型別檢查+既有測試**

Run: `npx tsc --noEmit && npm run test`
Expected: 無錯誤

- [ ] **Step 4: Commit**

```bash
git add src/components/MapLegend.tsx src/components/SourceFooter.tsx
git commit -m "feat: MapLegend+SourceFooter 翻譯"
```

---

### Task 8: Choropleth.tsx（tooltip + inset 縣名）

**Files:**
- Modify: `src/charts/Choropleth.tsx`（第 1-32, 320, 364-370 行區段）

**Interfaces:**
- Consumes: `useLanguage()`、`romanizePlaceName`、`metricUnit`

- [ ] **Step 1: import + hook**

第 4 行後加：

```typescript
import { useLanguage } from "../state/LanguageContext";
import { romanizePlaceName } from "../lib/placeName";
import { metricUnit } from "../lib/metricI18n";
```

第 30 行 `const t = useTokens();` 後加：

```typescript
  const { lang, tr } = useLanguage();
```

- [ ] **Step 2: inset 縣名（第 238-239 行）**

```typescript
        g.append("text").attr("x", B.x + 8).attr("y", B.y + 16).attr("font-size", S.note)
          .attr("fill", t.textMuted).text(ins.county);
```

改為：

```typescript
        g.append("text").attr("x", B.x + 8).attr("y", B.y + 16).attr("font-size", S.note)
          .attr("fill", t.textMuted).text(romanizePlaceName(ins.county, lang));
```

第 320 行（大 `useEffect` 依賴陣列）原本：

```typescript
  }, [geo, counties, villages, values, meta, indicator, ind.key, deathCause, year, t, view, level, breaks, onView, selectedVillage, onSelectVillage, selectedTowns, onHoverCounty]);
```

改為（加入 `lang`，因為 inset 縣名文字現在依賴語言）：

```typescript
  }, [geo, counties, villages, values, meta, indicator, ind.key, deathCause, year, t, lang, view, level, breaks, onView, selectedVillage, onSelectVillage, selectedTowns, onHoverCounty]);
```

- [ ] **Step 3: tooltip（第 364-370 行）**

```typescript
          {hover && (
            <div style={{ position: "absolute", left: hover.x + 12, top: hover.y + 12, pointerEvents: "none",
              background: t.tooltip.bg, color: t.tooltip.fg, padding: C.tooltip.padding, borderRadius: C.tooltip.radius, fontSize: S.small,
              fontVariantNumeric: "tabular-nums" }}>
              {hover.name}｜{hover.val === undefined ? "無資料" : `${hover.val.toFixed(1)} ${ind.unit}`}
              {hover.pop != null && <span>｜人口 {hover.pop.toLocaleString()}</span>}
            </div>
          )}
```

改為：

```typescript
          {hover && (
            <div style={{ position: "absolute", left: hover.x + 12, top: hover.y + 12, pointerEvents: "none",
              background: t.tooltip.bg, color: t.tooltip.fg, padding: C.tooltip.padding, borderRadius: C.tooltip.radius, fontSize: S.small,
              fontVariantNumeric: "tabular-nums" }}>
              {romanizePlaceName(hover.name, lang)}{tr.tooltipSeparator}{hover.val === undefined ? tr.noDataLabel : `${hover.val.toFixed(1)} ${metricUnit(ind.key, ind.unit, lang)}`}
              {hover.pop != null && <span>{tr.tooltipPopulationPrefix}{hover.pop.toLocaleString()}</span>}
            </div>
          )}
```

（第 341-357 行的 `legend && ...` 區塊維持原樣不動——`TasteShell` 恆傳 `legend={false}`，此區塊只有已排除的 `directionA` 殼會用到，非本次範圍。）

- [ ] **Step 4: 型別檢查+既有測試**

Run: `npx tsc --noEmit && npm run test`
Expected: 無錯誤（若 Choropleth 既有測試對 `hover.name`/tooltip 文字有斷言，確認測試預設語言為 zh，`tr.tooltipSeparator` zh 值為 `"｜"` 與原字串一致，不需改測試）

- [ ] **Step 5: Commit**

```bash
git add src/charts/Choropleth.tsx
git commit -m "feat: Choropleth tooltip+inset 縣名翻譯與地名音譯"
```

---

### Task 9: RegionRank.tsx

**Files:**
- Modify: `src/charts/RegionRank.tsx`（全檔）

**Interfaces:**
- Consumes: `useLanguage()`、`romanizePlaceName`、`metricLabel`、`regionLabel`、`formatParen`

- [ ] **Step 1: import**

第 4 行後加：

```typescript
import { useLanguage } from "../state/LanguageContext";
import { romanizePlaceName } from "../lib/placeName";
import { metricLabel, regionLabel } from "../lib/metricI18n";
import { formatParen } from "../lib/i18n";
```

- [ ] **Step 2: `RankList`（第 19-71 行）—「無資料」+地名（township 標籤）**

第 22 行 `const t = useTokens();` 後加：

```typescript
  const { lang, tr } = useLanguage();
```

第 44 行：

```typescript
        const label = stripPrefix ? r.township.replace(stripPrefix, "") : r.township;
```

改為（地名音譯；`stripPrefix` 本身是縣市中文名，先做字串處理再音譯，避免音譯後前綴比對失效）：

```typescript
        const label = romanizePlaceName(stripPrefix ? r.township.replace(stripPrefix, "") : r.township, lang);
```

第 67 行 `<div ...>無資料</div>` 改為 `<div ...>{tr.noDataLabel}</div>`。

- [ ] **Step 3: `Box`（第 73-82 行）不用改**——它只是包裝容器，`title` 由呼叫端傳入已翻譯字串。

- [ ] **Step 4: 主函式（第 85-160 行）**

第 89 行 `const t = useTokens();` 後加：

```typescript
  const { lang, tr } = useLanguage();
```

第 99-106 行：

```typescript
    const vars = scatterVars(meta);
    const labelOf = (k: ScatterKey) => vars.find((v) => v.key === k)?.label ?? k;
    const chBoxes: { role: string; label: string; dataKey: ScatterKey | null }[] = [
      { role: "X軸", label: labelOf(channels.x), dataKey: channels.x },
      { role: "Y軸", label: labelOf(channels.y), dataKey: channels.y },
      { role: "顏色", label: channels.color === "region" ? "區域" : labelOf(channels.color), dataKey: channels.color === "region" ? null : channels.color },
      { role: "大小", label: labelOf(channels.size), dataKey: channels.size },
    ];
```

改為：

```typescript
    const vars = scatterVars(meta);
    const labelOf = (k: ScatterKey) => metricLabel(k, vars.find((v) => v.key === k)?.label ?? k, lang);
    const chBoxes: { role: string; label: string; dataKey: ScatterKey | null }[] = [
      { role: tr.axisXLabel, label: labelOf(channels.x), dataKey: channels.x },
      { role: tr.axisYLabel, label: labelOf(channels.y), dataKey: channels.y },
      { role: tr.colorChannelLabel, label: channels.color === "region" ? tr.regionChannelLabel : labelOf(channels.color), dataKey: channels.color === "region" ? null : channels.color },
      { role: tr.sizeChannelLabel, label: labelOf(channels.size), dataKey: channels.size },
    ];
```

第 111 行 `<Box key={cb.role} title={\`${cb.role}（${cb.label}）\`}>` 改為：

```typescript
          <Box key={cb.role} title={formatParen(cb.role, cb.label, lang)}>
```

第 115 行 `<div ...>顏色通道＝區域，無排名數值</div>` 改為 `<div ...>{tr.colorChannelRegionNoRank}</div>`。

第 128 行：

```typescript
        <Box title={`${view.county} 前五名`}>
```

改為：

```typescript
        <Box title={`${romanizePlaceName(view.county, lang)}${tr.topFiveSuffix}`}>
```

第 137 行：

```typescript
  const title = view.town && view.county ? view.town.replace(view.county, "") : "村里";
```

改為（只有真正的中文地名走音譯；`tr.villageFallbackLabel` 已是完整翻譯字串，不能再丟進 `romanizePlaceName`，否則英文模式下會把 `"Village"` 當成中文誤轉成拼音亂碼）：

```typescript
  const title = view.town && view.county
    ? romanizePlaceName(view.town.replace(view.county, ""), lang)
    : tr.villageFallbackLabel;
```

第 153 行：

```typescript
        <Box title={`${title} 村里前五名`}>
```

改為：

```typescript
        <Box title={`${title}${tr.villageTopFiveSuffix}`}>
```

第 155 行 `<div ...>死亡率無村里資料（最細至鄉鎮）</div>` 改為 `<div ...>{tr.deathRateNoVillageData}</div>`。

- [ ] **Step 5: 型別檢查+既有測試**

Run: `npx tsc --noEmit && npm run test`
Expected: 無錯誤

- [ ] **Step 6: Commit**

```bash
git add src/charts/RegionRank.tsx
git commit -m "feat: RegionRank 翻譯+地名音譯"
```

---

### Task 10: InfoPanel.tsx

**Files:**
- Modify: `src/charts/InfoPanel.tsx`（全檔）

**Interfaces:**
- Consumes: `useLanguage()`、`romanizePlaceName`、`metricLabel`

- [ ] **Step 1: import + hook**

第 3 行後加：

```typescript
import { useLanguage } from "../state/LanguageContext";
import { romanizePlaceName } from "../lib/placeName";
import { metricLabel } from "../lib/metricI18n";
```

- [ ] **Step 2: `Sparkline` aria-label（第 17 行）**

`Sparkline` 本身沒呼叫 `useTokens()`，需要新增 `useLanguage()`：

```typescript
function Sparkline({ series, year, color, muted }: { series: [number, number][]; year: number; color: string; muted: string }) {
  const { tr } = useLanguage();
  const W = 110, H = 30, PAD = 3;
```

第 17 行 `aria-label="歷年趨勢"` 改為 `aria-label={tr.trendSparklineAriaLabel}`。

- [ ] **Step 3: `Card`（第 29-45 行）—「無資料」+指標名稱翻譯**

第 30 行 `const t = useTokens();` 後加：

```typescript
  const { lang, tr } = useLanguage();
```

第 34 行：

```typescript
      <div style={{ fontSize: S.note, color: t.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={item.label}>{item.label}</div>
```

改為（`item.key` 是 `IndicatorKey`，套用 `metricLabel`）：

```typescript
      <div style={{ fontSize: S.note, color: t.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={metricLabel(item.key, item.label, lang)}>{metricLabel(item.key, item.label, lang)}</div>
```

第 36 行 `{item.value === undefined ? <span ...>無資料</span> : fmt(item.value)}` 改為 `{item.value === undefined ? <span ...>{tr.noDataLabel}</span> : fmt(item.value)}`。

第 42 行 `{item.note && <div ...>{item.note}</div>}` 改為（`item.note` 是 `entityInfo()` 產出的固定中文字串，不改該函式簽名，用對照表在 render 端替換——見 Task Notes）：

```typescript
      {item.note && <div style={{ fontSize: S.note, color: t.textMuted, marginTop: 3 }}>{NOTE_MAP[item.note] ?? item.note}</div>}
```

在檔案 `fmt()` 函式（第 24-26 行）之後、`Card` 定義之前加入對照表（`entityInfo()` 在 `lib/data.ts` 只會產出這兩種固定 note 字串，語言判斷交給 `useLanguage()` 讀出的 `tr`；因為是 module-level 常數不能直接用 hook,改在 `Card` 元件內部用 `useMemo` 或直接以區域變數建表）：

在 `Card` 函式內、`return` 之前加：

```typescript
  const NOTE_MAP: Record<string, string> = { "人口普查快照": tr.censusSnapshotNote, "無村里資料（最細至鄉鎮）": tr.noVillageDataNote };
```

- [ ] **Step 4: `InfoPanel`（第 49-66 行）—`info.title` 地名音譯**

第 50 行 `const t = useTokens();` 後加：

```typescript
  const { lang } = useLanguage();
```

第 55 行：

```typescript
      <div style={{ fontSize: S.panelTitle, fontWeight: 700, color: t.text, marginBottom: 10, padding: "0 10px" }}>{info.title}</div>
```

改為：

```typescript
      <div style={{ fontSize: S.panelTitle, fontWeight: 700, color: t.text, marginBottom: 10, padding: "0 10px" }}>{romanizePlaceName(info.title, lang)}</div>
```

第 53 行 `aria-label="選取單位資訊"` 改為 `aria-label={tr.selectedEntityInfoAriaLabel}`（`InfoPanel` 本身要另外解構 `tr`：把上面 Step 4 的 `const { lang } = useLanguage();` 改成 `const { lang, tr } = useLanguage();`）。

- [ ] **Step 5: 型別檢查+既有測試**

Run: `npx tsc --noEmit && npm run test`
Expected: 無錯誤

- [ ] **Step 6: Commit**

```bash
git add src/charts/InfoPanel.tsx
git commit -m "feat: InfoPanel 翻譯+地名音譯+指標名稱英譯"
```

---

### Task 11: scatterCaption.ts（雙語白話解說)

**Files:**
- Modify: `src/lib/scatterCaption.ts`（全檔）
- Test: `src/lib/scatterCaption.test.ts`（若既有測試檔已存在則擴充；若不存在則新建）

**Interfaces:**
- Consumes: `type Language` from `./i18n`
- Produces: `buildScatterCaption(ch: ScatterChannels, vars: CaptionVar[], lang: Language): string`（**簽名變更**：新增第三參數 `lang`，呼叫端 Task 12 會更新）

- [ ] **Step 1: 檢查既有測試檔是否存在**

Run: `ls src/lib/scatterCaption.test.ts 2>&1 || echo "not found"`（PowerShell: `Test-Path src/lib/scatterCaption.test.ts`）

若存在，先讀取內容確認既有呼叫是否用兩參數呼叫 `buildScatterCaption(ch, vars)`——這些呼叫會因新增必要參數 `lang` 而型別錯誤,Step 2 一併修正（改成三參數呼叫，補 `"zh"`）。

- [ ] **Step 2: 修改實作，支援雙語**

```typescript
import type { ScatterChannels } from "./scatterChannels";
import type { Language } from "./i18n";
import { metricLabel } from "./metricI18n";

export type CaptionVar = { key: string; label: string };

// 關係散布圖白話解說(7/23 使用者回饋:很多人看不懂泡泡圖):
// 一句話講清楚「一顆泡泡=一個鄉鎮」+四個視覺通道各自編碼什麼、往哪個方向讀。
// 跟著下拉即時更新;顏色=區域時改講分區。8/11 加雙語:中英文各自完整造句(非逐詞替換),
// 語序差異大(中文「泡泡越靠右代表X越高」vs 英文「further right means higher X」)不適合共用模板。
export function buildScatterCaption(ch: ScatterChannels, vars: CaptionVar[], lang: Language): string {
  const lab = (k: string) => metricLabel(k, vars.find((v) => v.key === k)?.label ?? k, lang);
  if (lang === "en") {
    const color = ch.color === "region"
      ? "bubble color represents region (one color each for North/Central/South/East/Outlying Islands)"
      : `darker bubble color means higher "${lab(ch.color)}"`;
    return `Each bubble represents one township. Further right means higher "${lab(ch.x)}", ` +
      `further up means higher "${lab(ch.y)}"; bigger bubbles mean higher "${lab(ch.size)}"; ${color}.`;
  }
  const color = ch.color === "region"
    ? "泡泡的顏色代表所屬區域(北/中/南/東/離島各一色)"
    : `泡泡的顏色越深代表「${lab(ch.color)}」越高`;
  return `每顆泡泡代表一個鄉鎮。泡泡越靠右代表「${lab(ch.x)}」越高、` +
    `越靠上代表「${lab(ch.y)}」越高;泡泡越大代表「${lab(ch.size)}」越高;${color}。`;
}
```

- [ ] **Step 3: 若既有測試檔存在，補英文案例**

在既有 `describe` 區塊內加（沿用該檔既有的 `vars`/`ch` fixture，若命名不同依實際變數名調整）：

```typescript
  it("en 模式產出英文白話解說", () => {
    const result = buildScatterCaption(ch, vars, "en");
    expect(result).toContain("Each bubble represents one township");
  });
  it("en 模式顏色=region 時講區域", () => {
    const result = buildScatterCaption({ ...ch, color: "region" }, vars, "en");
    expect(result).toContain("bubble color represents region");
  });
```

- [ ] **Step 4: 執行測試**

Run: `npx vitest run src/lib/scatterCaption.test.ts`
Expected: PASS（若之前是兩參數呼叫因型別錯誤而編譯失敗，Step 1/3 已修正後應全過）

- [ ] **Step 5: 型別檢查**（此時 `Scatter.tsx` 呼叫端還沒更新，預期 `tsc` 會報 `buildScatterCaption` 少一個參數的錯誤，這是預期中的暫時狀態，留給 Task 12 修）

Run: `npx tsc --noEmit`
Expected: 僅 `Scatter.tsx` 兩處 `buildScatterCaption` 呼叫報少參數錯誤，其餘無錯誤——確認錯誤範圍符合預期後繼續

- [ ] **Step 6: Commit**

```bash
git add src/lib/scatterCaption.ts src/lib/scatterCaption.test.ts
git commit -m "feat: buildScatterCaption 支援雙語(新增 lang 參數,中英文各自完整造句)"
```

---

### Task 12: Scatter.tsx + ScatterControls（本次範圍最大的元件）

**Files:**
- Modify: `src/charts/Scatter.tsx`（全檔）

**Interfaces:**
- Consumes: `useLanguage()`、`romanizePlaceName`、`metricLabel`、`metricUnit`、`regionLabel`、`formatParen`、`buildScatterCaption(ch, vars, lang)`（Task 11 新簽名）

- [ ] **Step 1: import + hook（`Scatter` 主函式）**

第 6 行後加：

```typescript
import { useTokens } from "../lib/useTokens";
import { useLanguage } from "../state/LanguageContext";
```

第 13 行後（原本的 lib import 區塊末尾）加：

```typescript
import { countyOf } from "../lib/counties";
import { romanizePlaceName } from "../lib/placeName";
import { metricLabel, metricUnit, regionLabel } from "../lib/metricI18n";
import { formatParen } from "../lib/i18n";
```

第 34 行 `const t = useTokens();` 後加：

```typescript
  const { lang, tr } = useLanguage();
```

- [ ] **Step 2: 軸標籤（第 212-213 行，d3 imperative text）**

```typescript
    axes.append("text").attr("x", W / 2).attr("y", H - 8).attr("fill", t.textMuted).attr("text-anchor", "middle").attr("font-size", S.small).text(`${lab(xKey).label}（${lab(xKey).unit}）`);
    axes.append("text").attr("transform", "rotate(-90)").attr("x", -(H / 2)).attr("y", 16).attr("fill", t.textMuted).attr("text-anchor", "middle").attr("font-size", S.small).text(`${lab(yKey).label}（${lab(yKey).unit}）`);
```

改為：

```typescript
    axes.append("text").attr("x", W / 2).attr("y", H - 8).attr("fill", t.textMuted).attr("text-anchor", "middle").attr("font-size", S.small).text(formatParen(metricLabel(xKey, lab(xKey).label, lang), metricUnit(xKey, lab(xKey).unit, lang), lang));
    axes.append("text").attr("transform", "rotate(-90)").attr("x", -(H / 2)).attr("y", 16).attr("fill", t.textMuted).attr("text-anchor", "middle").attr("font-size", S.small).text(formatParen(metricLabel(yKey, lab(yKey).label, lang), metricUnit(yKey, lab(yKey).unit, lang), lang));
```

該 `useEffect` 依賴陣列（第 214 行）`[x, y, t, xKey, yKey, meta, xTicks, yTicks, W, H]` 加入 `lang`：`[x, y, t, lang, xKey, yKey, meta, xTicks, yTicks, W, H]`。

- [ ] **Step 3: 顏色圖例（第 461, 484-489 行）**

第 461 行：

```typescript
          <span>{lab(colorKey).label}（{lab(colorKey).unit}）</span>
```

改為：

```typescript
          <span>{formatParen(metricLabel(colorKey, lab(colorKey).label, lang), metricUnit(colorKey, lab(colorKey).unit, lang), lang)}</span>
```

第 483-490 行：

```typescript
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: S.small, color: t.textMuted }}>
          <span>區域</span>
          {REGIONS.map((rg) => (
            <span key={rg} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: S.small, color: t.textMuted }}>
              <span style={{ width: 12, height: 12, borderRadius: C.dot.radius, background: regionColor(rg, t.categorical), display: "inline-block" }} />{rg}
            </span>
          ))}
        </div>
```

改為：

```typescript
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: S.small, color: t.textMuted }}>
          <span>{tr.regionChannelLabel}</span>
          {REGIONS.map((rg) => (
            <span key={rg} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: S.small, color: t.textMuted }}>
              <span style={{ width: 12, height: 12, borderRadius: C.dot.radius, background: regionColor(rg, t.categorical), display: "inline-block" }} />{regionLabel(rg, lang)}
            </span>
          ))}
        </div>
```

- [ ] **Step 4: 大小圖例（第 495 行）**

```typescript
        <span className="size-legend-unit">大小（{lab(sizeKey).unit}）</span>
```

改為：

```typescript
        <span className="size-legend-unit">{formatParen(tr.sizeChannelLabel, metricUnit(sizeKey, lab(sizeKey).unit, lang), lang)}</span>
```

- [ ] **Step 5: 選取/清除/使用說明按鈕（第 527, 539, 551 行）**

```typescript
          選取
```
→
```typescript
          {tr.selectModeButton}
```

```typescript
          清除
```
→
```typescript
          {tr.clearModeButton}
```

```typescript
          使用說明
```
→
```typescript
          {tr.helpButton}
```

- [ ] **Step 6: 使用說明彈窗（第 569, 572-583 行）**

第 569 行：

```typescript
          <p className="scatter-caption" style={{ margin: 0, color: t.textMuted }}>{buildScatterCaption(channels, vars)}</p>
```

改為：

```typescript
          <p className="scatter-caption" style={{ margin: 0, color: t.textMuted }}>{buildScatterCaption(channels, vars, lang)}</p>
```

第 571-584 行：

```typescript
          <ul style={{ margin: "8px 0 0", paddingLeft: 20, listStyleType: "disc", display: "flex", flexDirection: "column", gap: 4 }}>
            <li>點左側地圖任一縣市可看整縣。</li>
            <li>按「選取」開啟後，拖曳框選一批鄉鎮，或單擊泡泡逐一加入名單。</li>
            <li>按「清除」開啟後，拖曳框選要移出的鄉鎮，或單擊已選泡泡移出。</li>
            <li>滑鼠移到圖上滾動滾輪可縮放；縮放後可拖曳平移；雙擊空白處還原。</li>
            {hasSel ? (
              <>
                <li className="sel-count mini-count">已選 {selected!.length} 鄉鎮：雙擊已選泡泡可移出；切年份或通道，名單都會保留。</li>
                <li className="mini-hint">回全國即可清空選取。</li>
              </>
            ) : (
              <li className="mini-hint">尚未選取：用上面的框選功能開始，或點左側地圖任一縣市。</li>
            )}
          </ul>
```

改為：

```typescript
          <ul style={{ margin: "8px 0 0", paddingLeft: 20, listStyleType: "disc", display: "flex", flexDirection: "column", gap: 4 }}>
            <li>{tr.helpBulletMapClick}</li>
            <li>{tr.helpBulletSelectMode}</li>
            <li>{tr.helpBulletClearMode}</li>
            <li>{tr.helpBulletZoom}</li>
            {hasSel ? (
              <>
                <li className="sel-count mini-count">{tr.selectedCountPrefix}{selected!.length}{tr.selectedCountSuffix}</li>
                <li className="mini-hint">{tr.returnToNationClears}</li>
              </>
            ) : (
              <li className="mini-hint">{tr.noSelectionYetHelp}</li>
            )}
          </ul>
```

- [ ] **Step 7: coach mark（第 609, 618 行）**

```typescript
          <button className="brush-hint" onClick={hideBrushHint} title="知道了,關閉提示"
```
→
```typescript
          <button className="brush-hint" onClick={hideBrushHint} title={tr.gotItCloseHint}
```

```typescript
            按上方「選取」後可拖曳框選或單擊泡泡
```
→
```typescript
            {tr.brushHintText}
```

- [ ] **Step 8: tooltip（第 622-627 行）**

```typescript
      {hover && (
        <div style={{ position: "absolute", left: hover.x + 12, top: hover.y + 12, pointerEvents: "none",
          background: t.tooltip.bg, color: t.tooltip.fg, padding: C.tooltip.padding, borderRadius: C.tooltip.radius, fontSize: S.small, fontVariantNumeric: "tabular-nums" }}>
          {hover.p.township}{tipKeys.map((k) => `｜${lab(k).label} ${fmtV(hover.p[k])}`).join("")}
        </div>
      )}
```

改為：

```typescript
      {hover && (
        <div style={{ position: "absolute", left: hover.x + 12, top: hover.y + 12, pointerEvents: "none",
          background: t.tooltip.bg, color: t.tooltip.fg, padding: C.tooltip.padding, borderRadius: C.tooltip.radius, fontSize: S.small, fontVariantNumeric: "tabular-nums" }}>
          {romanizePlaceName(hover.p.township, lang)}{tipKeys.map((k) => `${tr.tooltipSeparator}${metricLabel(k, lab(k).label, lang)} ${fmtV(hover.p[k])}`).join("")}
        </div>
      )}
```

- [ ] **Step 9: `ScatterControls`（第 635-672 行）—獨立函式元件，需自己的 `useLanguage()`**

第 638 行 `const t = useTokens();` 後加：

```typescript
  const { lang, tr } = useLanguage();
```

第 644-647 行：

```typescript
  const groups = [
    { label: "基本指標", opts: vars.filter((v) => v.group === "ind").map((v) => ({ key: v.key, label: v.label })) },
    { label: "十大死因", opts: vars.filter((v) => v.group === "cause").map((v) => ({ key: v.key, label: v.label })) },
  ];
```

改為：

```typescript
  const groups = [
    { label: tr.basicIndicatorsGroup, opts: vars.filter((v) => v.group === "ind").map((v) => ({ key: v.key, label: metricLabel(v.key, v.label, lang) })) },
    { label: tr.topTenCausesGroup, opts: vars.filter((v) => v.group === "cause").map((v) => ({ key: v.key, label: metricLabel(v.key, v.label, lang) })) },
  ];
```

第 664-670 行：

```typescript
      {chSelect("x", "X 軸", channels.x)}
      {chSelect("y", "Y 軸", channels.y)}
      {chSelect("color", "顏色", channels.color, [{ key: "region", label: "區域" }])}
      {chSelect("size", "大小", channels.size)}
```

改為：

```typescript
      {chSelect("x", tr.axisXLabel, channels.x)}
      {chSelect("y", tr.axisYLabel, channels.y)}
      {chSelect("color", tr.colorChannelLabel, channels.color, [{ key: "region", label: tr.regionChannelLabel }])}
      {chSelect("size", tr.sizeChannelLabel, channels.size)}
```

- [ ] **Step 10: 型別檢查+既有測試**

Run: `npx tsc --noEmit && npm run test`
Expected: 無錯誤、無失敗（此時 `buildScatterCaption` 兩處呼叫都已補上 `lang`，Task 11 留下的暫時性型別錯誤應消失）

- [ ] **Step 11: 本機互動檢查**

Run: `npm run dev`，瀏覽器切到英文模式，逐一檢查：
1. 散布圖 X/Y 軸標籤、顏色/大小圖例、下拉選單（含「基本指標」「十大死因」optgroup）全英文
2. hover 泡泡顯示英文 tooltip（地名羅馬拼音+指標名稱英文+分隔符號 `·`）
3. 「使用說明」彈窗四條 bullet、白話解說句、選取狀態文字全英文
4. 框選 coach mark 文字為英文

- [ ] **Step 12: Commit**

```bash
git add src/charts/Scatter.tsx
git commit -m "feat: Scatter+ScatterControls 全翻(軸/圖例/下拉/tooltip/使用說明/coach mark)"
```

---

### Task 13: 全套驗證

**Files:** 無新增/修改（純驗證）

- [ ] **Step 1: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 0 錯誤

- [ ] **Step 2: 單元測試**

Run: `npm run test`
Expected: 全綠（含 Task 1-11 新增的 `placeName.test.ts`、`metricI18n.test.ts`、`scatterCaption.test.ts` 新案例）

- [ ] **Step 3: build**

Run: `npm run build`
Expected: 成功，無警告新增（`pinyin-pro` 套件體積留意 `dist` 輸出大小是否合理，若明顯暴增檢查是否不小心整包被打進主 bundle 而非依需求分包——此專案目前無 code-splitting 慣例，整包屬預期，不用額外處理）

- [ ] **Step 4: 本機手動 Playwright（或手動瀏覽器）全語言切換走查**

Run: `npm run dev`，用瀏覽器依序操作（每步中英文各測一次）：
1. 首次載入＝中文；點語言鈕→英文；重新整理→回中文（驗證不持久化,比照 gapminder）
2. 語言鈕與深色模式鈕的相對位置（語言鈕在上、深色模式鈕在下，間距一致）在中英文模式下都不跑版
3. 下鑽（全國→縣→鄉鎮→村里）在英文模式下，麵包屑/地圖 tooltip/排名卡標題/資訊面板標題全部顯示羅馬拼音地名，無殘留中文字或 `undefined`
4. 十大死因下拉、散布圖四通道切換、使用說明彈窗，在英文模式下全部正確
5. 金門/連江（inset 框）在英文模式下框內縣名顯示羅馬拼音

- [ ] **Step 5: 若第 4 步發現任何殘留中文字或版面跑版，回對應 Task 修正後重新跑 Step 1-4**

- [ ] **Step 6: 更新 README（若 README 有列出功能清單/測試數）**

Read `README.md`，若有「功能」或「測試」章節，加入語言切換功能一行說明+更新測試總數，比照本專案既有慣例（如 gapminder README 記錄語言切換上線時的寫法）。

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "docs: README 同步中英文語言切換功能與測試數"
```
