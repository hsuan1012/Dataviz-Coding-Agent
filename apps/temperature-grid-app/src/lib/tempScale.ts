// 溫度 → 顏色:方向 A 數值色階(單一色相、無紅),取自 styleDictionary 當前主題的
// densityScale 五段,piecewise 線性插值。全年固定 domain,逐月動畫才可比。
import * as d3 from 'd3'

export function makeTempScale(stops: string[], domain: [number, number]) {
  const interp = d3.piecewise(d3.interpolateRgb.gamma(2.2), stops)
  const scale = d3.scaleSequential(interp).domain(domain)
  return (v: number) => scale(v)
}

/** 圖例用:等距取 k 個色票 */
export function scaleSwatches(stops: string[], k: number): string[] {
  const interp = d3.piecewise(d3.interpolateRgb.gamma(2.2), stops)
  return d3.range(k).map((i) => interp(k === 1 ? 0 : i / (k - 1)))
}
