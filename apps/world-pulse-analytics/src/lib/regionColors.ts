import type { Region } from "../data/types";

// 方向 A 類別配色（見 township-drilldown-app/src/lib/styleDictionary.js categoricalPalette）：
// 鋼藍／青綠／赭／苔綠／霧紫，依序對應亞洲／歐洲／非洲／美洲／大洋洲。
// 8/4 新增 oceania:styleDictionary.js 的 categoricalPalette 其實原本就有 5 色
// (該色盤設計給台灣「北/中/南/東/離島」5 分區用),這個專案先前只借了前 4 色對應
// 四大洲,第 5 色(霧紫)直接沿用同一套色盤,不用另外設計新色、維持色盲可辨的既有驗證。
export const REGION_COLORS: Record<Region, string> = {
  asia: "#2A6F97",
  europe: "#0D9488",
  africa: "#C77D3E",
  americas: "#6A8E3C",
  oceania: "#8C5C9E",
};

// 深色模式類別配色，直接取自 township-drilldown-app styleDictionary.js 的
// themes.dark.categorical（同一套方向 A 雙主題 token，五色與淺色模式同順序對應）。
export const REGION_COLORS_DARK: Record<Region, string> = {
  asia: "#5FA8D3",
  europe: "#2DD4BF",
  africa: "#E0A567",
  americas: "#9CC06B",
  oceania: "#B98FC9",
};

export function colorForRegion(region: Region, dark = false): string {
  const palette = dark ? REGION_COLORS_DARK : REGION_COLORS;
  return palette[region] ?? "#9aa0a6";
}
