import { REGIONS, type Region } from "./data";

export function quantileClass(v: number, breaks: number[]): number {
  return breaks.filter((b) => v > b).length;
}
export function colorForValue(v: number, breaks: number[], scale: string[]): string {
  const cls = Math.min(quantileClass(v, breaks), scale.length - 1);
  return scale[cls];
}
export function regionColor(region: Region, categorical: string[]): string {
  const i = REGIONS.indexOf(region);
  return categorical[(i < 0 ? 0 : i) % categorical.length];
}

// 選取/hover 高亮外框的玫紅色系(原定義於 Choropleth,老師 8/24 回饋②後散布圖鄉鎮懸停
// 高亮也要同色 → 移到共用層當單一真相來源):accent 青綠剛好是「中」區域分類色,
// 高亮用它會融進自己的填色,玫紅與五區分類色/色階都拉開色相距離,不論哪個區域都不撞色
// (比照 gapminder-bubble-globe-app 的 strokeColorFor 解法)。
export const STROKE_HIGHLIGHT = "#DB2777";
export const STROKE_HIGHLIGHT_DARK = "#F472B6";
export const strokeHighlight = (dark: boolean) => (dark ? STROKE_HIGHLIGHT_DARK : STROKE_HIGHLIGHT);
