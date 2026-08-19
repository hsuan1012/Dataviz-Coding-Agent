// 滑鼠 hover → 最近網格:空間雜湊(桶=2×cell),回傳距離內最近的 grid 索引
export interface GridIndex {
  query: (lon: number, lat: number, maxDistDeg?: number) => number | null
}

export function buildGridIndex(lon: number[], lat: number[], cellDeg: number): GridIndex {
  const bucket = cellDeg * 2
  const map = new Map<string, number[]>()
  const key = (bx: number, by: number) => `${bx}:${by}`
  for (let i = 0; i < lon.length; i++) {
    const k = key(Math.floor(lon[i] / bucket), Math.floor(lat[i] / bucket))
    const arr = map.get(k)
    if (arr) arr.push(i)
    else map.set(k, [i])
  }
  return {
    query(qlon: number, qlat: number, maxDistDeg = cellDeg) {
      const bx = Math.floor(qlon / bucket)
      const by = Math.floor(qlat / bucket)
      let best = -1
      let bestD = Infinity
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const arr = map.get(key(bx + dx, by + dy))
          if (!arr) continue
          for (const i of arr) {
            const d = Math.hypot(lon[i] - qlon, lat[i] - qlat)
            if (d < bestD) {
              bestD = d
              best = i
            }
          }
        }
      }
      return best >= 0 && bestD <= maxDistDeg ? best : null
    },
  }
}
