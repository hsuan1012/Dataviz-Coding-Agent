// 框選集合:像素矩形內的鄉鎮名單(邊界含端點)。純函式,座標換算由 Scatter 做。
export interface PlacedPoint { township: string; cx: number; cy: number }

// 雙擊剔除(老師 7/24):只做剔除不做加回。不在名單時回原物件讓 setState 短路;
// 剔到空回 null=清除選取(與框空一致),避免「空名單=全部灰階」的死狀態。
export function excludeFromSelection(selected: string[] | null, township: string): string[] | null {
  if (!selected || !selected.includes(township)) return selected;
  const next = selected.filter((t) => t !== township);
  return next.length ? next : null;
}

export function townsInRect(
  pts: PlacedPoint[],
  rect: [[number, number], [number, number]],
): string[] {
  const [[x0, y0], [x1, y1]] = rect;
  return pts
    .filter((p) => p.cx >= x0 && p.cx <= x1 && p.cy >= y0 && p.cy <= y1)
    .map((p) => p.township);
}
