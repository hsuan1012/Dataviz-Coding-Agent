// ============================================================
// Taste 設計 tokens — 「現代資料編輯風」
// 暖白單色底 + 單一燒橙強調；數值色階改靛藍單色相（單調、無紅、色盲安全）；
// 無襯線重權重 display + mono 數字。形狀與 styleDictionary.themes 完全一致。
// Design Read: dashboard for 學術教學觀眾, monochrome + single pop,
// leaning toward Tailwind v4 utilities + native CSS（taste-skill §0.B）。
// Dials: VARIANCE 6 / MOTION 3 / DENSITY 5。
// ============================================================

export const tasteTypography = {
  fontFamily: "'Noto Sans TC', 'Microsoft JhengHei', system-ui, sans-serif",
  fontMono: "'IBM Plex Mono', 'Consolas', monospace",
};

export const tasteThemes = {
  light: {
    name: "taste-light",
    bg: "#FAFAF7", surface: "#FFFFFF", surfaceAlt: "#F1F0EB", border: "#E4E2DA",
    text: "#161513", textMuted: "#6B675E",
    accent: "#C2410C", accentHover: "#9A3412", accentSoft: "#FAEAE1", accentFg: "#FFFFFF",
    densityScale: ["#DCE3F5", "#A9BCE8", "#6F8DD6", "#3D5EB8", "#1E3A8A"],
    node: { stroke: "#FFFFFF", labelLight: "#10162E", labelDark: "#E8EDFB" },
    categorical: ["#4263EB", "#F59F00", "#0CA678", "#AE3EC9", "#A87C4F"],
    tooltip: { bg: "#161513", fg: "#FAFAF7" },
    flow: { increase: "#0F7A5C", decrease: "#B0413E", base: "#7A766E" },
  },
  dark: {
    name: "taste-dark",
    bg: "#131210", surface: "#1C1A17", surfaceAlt: "#24211D", border: "#343028",
    text: "#EDEAE3", textMuted: "#A39E93",
    accent: "#E8703A", accentHover: "#F08A55", accentSoft: "#33221A", accentFg: "#1A120C",
    densityScale: ["#25315C", "#33488C", "#4A66B8", "#7490D9", "#A7BCEF"],
    node: { stroke: "#1C1A17", labelLight: "#10162E", labelDark: "#E8EDFB" },
    categorical: ["#7A94F0", "#FFC24D", "#4CC9A4", "#CE7DE3", "#C29A72"],
    tooltip: { bg: "#EDEAE3", fg: "#131210" },
    flow: { increase: "#3FB89A", decrease: "#E0795E", base: "#8A97A6" },
  },
};
