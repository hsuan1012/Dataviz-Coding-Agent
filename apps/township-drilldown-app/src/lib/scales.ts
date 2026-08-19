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
