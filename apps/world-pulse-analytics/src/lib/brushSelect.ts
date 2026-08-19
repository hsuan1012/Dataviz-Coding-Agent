// 框選集合:viewBox 座標矩形內的國家名單(邊界含端點)。純函式,座標換算由 BubbleChart 做。
export interface PlacedBubble {
  geo: string;
  cx: number;
  cy: number;
}

export function geosInRect(
  pts: PlacedBubble[],
  rect: [[number, number], [number, number]]
): string[] {
  const [[x0, y0], [x1, y1]] = rect;
  return pts
    .filter((p) => p.cx >= x0 && p.cx <= x1 && p.cy >= y0 && p.cy <= y1)
    .map((p) => p.geo);
}

// 框選矩形正規化:任意兩點(拖曳起訖,順序不拘)→ [[x0,y0],[x1,y1]](x0<=x1、y0<=y1)。
export function normalizeRect(
  a: [number, number],
  b: [number, number]
): [[number, number], [number, number]] {
  const x0 = Math.min(a[0], b[0]);
  const x1 = Math.max(a[0], b[0]);
  const y0 = Math.min(a[1], b[1]);
  const y1 = Math.max(a[1], b[1]);
  return [[x0, y0], [x1, y1]];
}

// 誤觸門檻:寬或高 < 3(viewBox 單位)視為誤觸,不套用框選(避免單擊被誤判成極小矩形)。
export function isBrushTrivial(rect: [[number, number], [number, number]]): boolean {
  const [[x0, y0], [x1, y1]] = rect;
  return x1 - x0 < 3 || y1 - y0 < 3;
}
