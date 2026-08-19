import { describe, expect, it } from 'vitest'
import { buildCountyIndices, countyMeans } from './countyStats'

describe('countyStats', () => {
  const county = ['A', 'B', 'A', 'C', 'B', 'A']
  const values = [10, 20, 12, 30, 22, 14]
  const idx = buildCountyIndices(county)

  it('索引分組正確', () => {
    expect(idx.get('A')).toEqual([0, 2, 5])
    expect(idx.get('B')).toEqual([1, 4])
    expect(idx.get('C')).toEqual([3])
  })

  it('縣均溫=網格等權平均、由高至低排序', () => {
    const means = countyMeans(idx, values)
    expect(means.map((m) => m.county)).toEqual(['C', 'B', 'A'])
    expect(means[0].mean).toBe(30)
    expect(means[1].mean).toBe(21)
    expect(means[2].mean).toBeCloseTo(12)
    expect(means[2].n).toBe(3)
  })
})
