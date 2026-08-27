// 框選集合:像素矩形內的鄉鎮名單(邊界含端點)。純函式,座標換算由 Scatter 做。
export interface PlacedPoint { township: string; cx: number; cy: number }

// 雙擊剔除(老師 7/24):只做剔除不做加回。不在名單時回原物件讓 setState 短路;
// 剔到空回 null=清除選取(與框空一致),避免「空名單=全部灰階」的死狀態。
export function excludeFromSelection(selected: string[] | null, township: string): string[] | null {
  if (!selected || !selected.includes(township)) return selected;
  const next = selected.filter((t) => t !== township);
  return next.length ? next : null;
}

// 框選候選=「使用者看得見」的點(老師 8/24 bug):滾輪縮放後,繪圖區外的點被 clipPath 裁掉
// 但座標仍在,直接丟進 townsInRect 會把隱形點也框進名單(實測圈 13 顆可見點選進 32 鄉鎮)。
// 先以繪圖區矩形過濾,再做框內判定。
export function visibleInPlot(
  pts: PlacedPoint[],
  plot: [[number, number], [number, number]],
): PlacedPoint[] {
  const [[px0, py0], [px1, py1]] = plot;
  return pts.filter((p) => p.cx >= px0 && p.cx <= px1 && p.cy >= py0 && p.cy <= py1);
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
