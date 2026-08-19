import { describe, expect, it } from 'vitest'
import * as d3 from 'd3'
import { makeTempScale, scaleSwatches } from './tempScale'
import { themes } from './styleDictionary.js'

const stops = themes.light.tempScale as string[]

describe('makeTempScale', () => {
  const scale = makeTempScale(stops, [-1.5, 31.6])

  it('domain 兩端命中色階兩端', () => {
    expect(d3.color(scale(-1.5))!.formatHex()).toBe(d3.color(stops[0])!.formatHex())
    expect(d3.color(scale(31.6))!.formatHex()).toBe(d3.color(stops[stops.length - 1])!.formatHex())
  })

  it('冷暖語意:冷端=藍色相、熱端=紅橘色相(RdYlBu;使用者 8/18 要求多色)', () => {
    const hueCold = d3.hsl(scale(-1.5)).h
    const hueHot = d3.hsl(scale(31.6)).h
    expect(hueCold).toBeGreaterThan(180)
    expect(hueCold).toBeLessThan(260)
    expect(hueHot < 45 || hueHot > 330).toBe(true)
  })

  it('兩主題色階同為 6 段冷→熱', () => {
    for (const th of ['light', 'dark'] as const) {
      const s = themes[th].tempScale as string[]
      expect(s).toHaveLength(6)
      expect(d3.hsl(s[0]).h).toBeGreaterThan(180) // 冷端藍
      const hot = d3.hsl(s[5]).h
      expect(hot < 45 || hot > 330).toBe(true) // 熱端紅橘
    }
  })
})

describe('scaleSwatches', () => {
  it('回傳 k 個色票、首尾=色階首尾', () => {
    const sw = scaleSwatches(stops, 7)
    expect(sw).toHaveLength(7)
    expect(d3.color(sw[0])!.formatHex()).toBe(d3.color(stops[0])!.formatHex())
    expect(d3.color(sw[6])!.formatHex()).toBe(d3.color(stops[stops.length - 1])!.formatHex())
  })
})
