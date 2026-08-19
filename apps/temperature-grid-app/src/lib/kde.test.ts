import { describe, expect, it } from 'vitest'
import { epanechnikov, kde } from './kde'

describe('epanechnikov kernel', () => {
  it('峰值在 0、支撐外為 0、對稱', () => {
    const k = epanechnikov(1)
    expect(k(0)).toBeCloseTo(0.75)
    expect(k(1.01)).toBe(0)
    expect(k(-1.01)).toBe(0)
    expect(k(0.5)).toBeCloseTo(k(-0.5))
  })
})

describe('kde', () => {
  const xs = Array.from({ length: 401 }, (_, i) => -10 + i * 0.1)

  it('密度積分 ≈ 1', () => {
    const values = [0, 0.5, 1, 1.5, 2, 2.5, 3]
    const dens = kde(values, xs, 0.7)
    const integral = dens.reduce((s, d) => s + d * 0.1, 0)
    expect(integral).toBeGreaterThan(0.97)
    expect(integral).toBeLessThan(1.03)
  })

  it('峰值靠近資料中心', () => {
    const values = Array.from({ length: 500 }, () => 1.0)
    const dens = kde(values, xs, 0.7)
    const peakX = xs[dens.indexOf(Math.max(...dens))]
    expect(Math.abs(peakX - 1.0)).toBeLessThan(0.2)
  })

  it('雙峰資料保留兩個峰(bandwidth 不抹平)', () => {
    const values = [
      ...Array.from({ length: 300 }, () => -3),
      ...Array.from({ length: 300 }, () => 3),
    ]
    const dens = kde(values, xs, 0.7)
    const at = (x: number) => dens[Math.round((x + 10) / 0.1)]
    expect(at(-3)).toBeGreaterThan(at(0) * 3)
    expect(at(3)).toBeGreaterThan(at(0) * 3)
  })

  it('空資料回傳全 0', () => {
    expect(kde([], xs, 0.7).every((d) => d === 0)).toBe(true)
  })
})
