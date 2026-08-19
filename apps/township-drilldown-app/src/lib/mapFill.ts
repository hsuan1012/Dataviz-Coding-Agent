import type { Point, ScatterKey } from "./data";
import { regionColor } from "./scales";

// 鄉鎮→填色對應(迷你地圖塗色跟隨散布圖顏色通道):
// 區域=分類色、指標=同一條連續色階。缺資料鄉鎮不進 Map(元件端回淺灰)。
export function townFillMap(
  pts: Point[],
  colorKey: ScatterKey | "region",
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
