// Ridgeline 用的核密度估計(KDE)。
// 參考老師提供的 d3-graph-gallery ridgeline 範例(Epanechnikov kernel),
// 但為了 8,975 格 × 12 月的量,先把值分箱(0.1°C)再對箱心做 kernel,
// 複雜度從 O(n×ticks) 降到 O(bins×ticks),結果對 0.1°C 粒度等價。

export function epanechnikov(bandwidth: number) {
  return (x: number) => {
    const u = x / bandwidth
    return Math.abs(u) <= 1 ? (0.75 * (1 - u * u)) / bandwidth : 0
  }
}

/** 對 values 在 xs 各點估計密度(積分≈1) */
export function kde(values: number[], xs: number[], bandwidth: number): number[] {
  if (values.length === 0) return xs.map(() => 0)
  const binWidth = 0.1
  const counts = new Map<number, number>()
  for (const v of values) {
    const b = Math.floor(v / binWidth)
    counts.set(b, (counts.get(b) ?? 0) + 1)
  }
  const kernel = epanechnikov(bandwidth)
  const n = values.length
  const bins = [...counts.entries()].map(([b, c]) => ({ x: (b + 0.5) * binWidth, c }))
  return xs.map((x) => {
    let sum = 0
    for (const { x: bx, c } of bins) sum += c * kernel(x - bx)
    return sum / n
  })
}
