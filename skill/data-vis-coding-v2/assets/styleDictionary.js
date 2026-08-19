// ============================================================
// 樣式字典 (Style Dictionary) — 方向 A「精緻公民資料風」
// 冷石板中性 + 青綠強調；強調色與數值色階「分離」；
// 數值色階單一色相、單調、無紅（色盲安全）。深淺雙主題。
// 單一真實來源：改這裡，所有圖表風格一起變。
// ============================================================

// --- 1. 色彩（淺色主題基準）---
export const colors = {
  // 強調色（青綠）—— 只點互動元素，不進數值色階
  primary: '#0D9488',
  primaryLight: '#14B8A6',
  primaryDark: '#0F766E',

  // 冷石板中性
  text: '#0F1B2D',
  textMuted: '#55657A',
  border: '#E2E8F0',
  background: '#F6F8FA',
  surface: '#FFFFFF',

  // 語意色
  success: '#0E7C66',
  warning: '#C77D3E',
  danger: '#B4472E',
}

// 強調色別名（語意更清楚；= colors.primary）
export const accent = {
  base: '#0D9488', hover: '#0F766E', soft: '#E6F4F1', fg: '#FFFFFF',
}

// --- 2. 類別配色序列（冷調、色盲可辨；北/中/南/東/離島）---
export const categoricalPalette = [
  '#2A6F97', // 鋼藍
  '#0D9488', // 青綠
  '#C77D3E', // 赭
  '#6A8E3C', // 苔綠
  '#8C5C9E', // 霧紫
  '#457B9D',
  '#B5651D',
  '#5F8D4E',
]

// --- 3. 連續色階 ---
export const sequentialScale = { from: '#CDEAE5', to: '#0F4C5C' }

// --- 3b. 分位色階（quantile 5 級，單一色相青綠、單調、無紅）---
export const quantileScale = ['#CDEAE5', '#7FCABF', '#2A9D8F', '#14746F', '#0F4C5C']

// --- 3c. 標籤對比字色對 ---
// 建議做法：以「填色實際亮度算 WCAG 對比」取對比較高者（見 verification.md），
// 比固定 index 門檻更穩健（深/淺主題色階明暗方向相反時亦正確）。
// 中間色調對純黑/白皆難達 4.5 時，改為標籤加「對比描邊 halo」保證可讀。
export const labelContrast = {
  labelOnLight: '#04231F', // 淺底用深字
  labelOnDark: '#E0F2F0',  // 深底用淺字
  darkFrom: 3,             // 舊式 index 門檻（保留相容；新專案建議改用亮度法）
}

// --- 3d. 增減語意色（waterfall）---
export const flowColors = { increase: '#0E7C66', decrease: '#B4472E', base: '#6B7280' }

// --- 3e. Tooltip ---
export const tooltip = { bg: '#0F1B2D', fg: '#F9FAFB' }

// --- 4. 字型 ---
export const typography = {
  // 標題用襯線（思源宋體）帶權威感；內文用黑體
  fontSerif: "'Noto Serif TC', 'Songti TC', serif",
  fontFamily: "'Noto Sans TC', 'Microsoft JhengHei', system-ui, sans-serif",
  fontMono: "'Consolas', 'Courier New', monospace",
  // 數據一律等寬：font-variant-numeric: tabular-nums
  // 字級只能從這裡取(type scale);要新字級先在此命名角色再用,元件內禁止裸數字 fontSize
  // (驗證層有 grep 檢查,見 references/verification.md ④)
  sizes: { eyebrow: 11, title: 28, subtitle: 14, sectionLabel: 12, body: 14, axis: 13, tick: 12, legend: 12 },
  weights: { normal: 400, medium: 500, bold: 700 },
}

// --- 5. 間距與尺寸 ---
export const spacing = { chartPadding: 16, gap: 12, borderRadius: 16, borderRadiusControl: 9, borderRadiusBar: 6 }

// --- 5b. 元件層 tokens(第三層,對齊 M3 ref→sys→comp) ---
// 「這類元件長什麼樣」的決策集中在此;元件內禁止裸數字圓角/元件內距
// (驗證層有 grep 檢查,見 references/verification.md ④)。依專案實際元件增減角色。
export const components = {
  panel:   { radius: 8 },                       // 卡片/圖例卡/資訊面板
  button:  { radius: 8 },                       // 實色按鈕
  control: { radius: 9 },                       // 下拉/icon 鈕/通知框
  pill:    { radius: 999 },                     // 膠囊(切換器/年份標籤/提示章)
  tooltip: { radius: 6, padding: "4px 8px" },   // 懸停提示(所有圖表共用一份)
  bar:     { radius: 3 },                       // 長條(軌+填)
  swatch:  { radius: 2 },                       // 圖例方形色塊
}

// --- 6. 陰影 ---
export const shadows = { card: '0 8px 30px -14px rgba(15, 27, 45, 0.25)' }

// --- 7. 雙主題 token（深淺兩套；元件透過 useTokens() 取當前主題）---
export const themes = {
  light: {
    name: 'light',
    bg: '#F6F8FA', surface: '#FFFFFF', surfaceAlt: '#EDF1F5', border: '#E2E8F0',
    text: '#0F1B2D', textMuted: '#55657A',
    accent: '#0D9488', accentHover: '#0F766E', accentSoft: '#E6F4F1', accentFg: '#FFFFFF',
    densityScale: ['#CDEAE5', '#7FCABF', '#2A9D8F', '#14746F', '#0F4C5C'],
    node: { stroke: '#FFFFFF', labelLight: '#04231F', labelDark: '#E0F2F0' },
    categorical: ['#2A6F97', '#0D9488', '#C77D3E', '#6A8E3C', '#8C5C9E'],
    tooltip: { bg: '#0F1B2D', fg: '#F9FAFB' },
    flow: { increase: '#0E7C66', decrease: '#B4472E', base: '#6B7280' },
  },
  dark: {
    name: 'dark',
    bg: '#0E1620', surface: '#16212E', surfaceAlt: '#1B2836', border: '#26333F',
    text: '#E6EDF3', textMuted: '#9FB0C0',
    accent: '#2DD4BF', accentHover: '#14B8A6', accentSoft: '#0F2E2A', accentFg: '#04231F',
    densityScale: ['#124F4A', '#186A63', '#25897F', '#3BB3A8', '#5FD0C7'],
    node: { stroke: '#16212E', labelLight: '#04231F', labelDark: '#E0F2F0' },
    categorical: ['#5FA8D3', '#2DD4BF', '#E0A567', '#9CC06B', '#B98FC9'],
    tooltip: { bg: '#E6EDF3', fg: '#0E1620' },
    flow: { increase: '#3FB89A', decrease: '#E0795E', base: '#8A97A6' },
  },
}

// --- 便利匯出：整包 ---
const styleDictionary = {
  colors, accent, categoricalPalette, sequentialScale, quantileScale,
  labelContrast, flowColors, tooltip, typography, spacing, shadows, themes,
}

export default styleDictionary
