import { describe, expect, it } from 'vitest'
import { buildGridIndex } from './nearest'

describe('buildGridIndex', () => {
  // 3×3 規則格,間距 0.02 度
  const lon: number[] = []
  const lat: number[] = []
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) {
      lon.push(120 + c * 0.02)
      lat.push(23 + r * 0.02)
    }
  const idx = buildGridIndex(lon, lat, 0.02)

  it('命中格心回傳該格', () => {
    expect(idx.query(120.02, 23.02)).toBe(4) // 中心格
  })

  it('偏移半格內回傳最近格', () => {
    expect(idx.query(120.021, 23.019)).toBe(4)
    expect(idx.query(120.0, 23.0)).toBe(0)
  })

  it('超出 maxDist 回傳 null', () => {
    expect(idx.query(121.5, 24.5)).toBeNull()
    expect(idx.query(120.05, 23.0, 0.005)).toBeNull()
  })

  it('邊界格也查得到', () => {
    expect(idx.query(120.04, 23.04)).toBe(8)
  })
})
