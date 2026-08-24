import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useTokens } from '../lib/useTokens'
import { useLanguage } from '../lib/i18n'
import sd from '../lib/styleDictionary.js'
import type { YearTemps } from '../lib/data'
import { kde } from '../lib/kde'
import { makeTempScale } from '../lib/tempScale'

interface Props {
  temps: YearTemps
  month: number // 高亮的月份 0-11
  domain: [number, number] // 全期固定 x 域與色階域
  onPickMonth?: (m: number) => void
  indices?: number[] | null // 縣市選取:只取這些網格的分布(null=全島)
  // 月份多選(老師 8/24):集內月份保留原始色彩,集外淡出;空集=全部保留原色
  selectedMonths?: Set<number> | null
}

// Ridgeline plot:x=月均溫、y=12 個月份,每條 ridge 是該月全部網格的 KDE 分布。
// 作法參考老師提供的 d3-graph-gallery ridgeline 範例(Epanechnikov KDE、
// 各月共用 x 軸、垂直堆疊 + 部分重疊);填色取該月中位數對應的地圖色階色,
// 與左圖視覺對齊;當前月以強調色描邊高亮。
// bottom 52:刻度列(H-bottom+18)與軸標題(H-8)要留 ≥24px,否則重疊(使用者 8/18)
const M = { top: 34, right: 18, bottom: 52, left: 56 }
const MORPH_MS = 520 // 換年/換縣市時 ridge 形狀 morph(參考 d3-graph-gallery ridgeline_animation)

// d 屬性用 d3 transition 補間(CSS 不能動畫 path d;xs 網格固定 → 前後點數一致可補間)。
// d 不經 React 控制(避免 re-render 打斷動畫),fill 走 CSS transition。
function MorphPath({ d, fill, fillOpacity, stroke, strokeWidth }: {
  d: string
  fill: string
  fillOpacity: number
  stroke: string
  strokeWidth: number
}) {
  const ref = useRef<SVGPathElement>(null)
  const prev = useRef<string | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (prev.current === null || prev.current === d) {
      el.setAttribute('d', d)
    } else {
      const from = prev.current
      d3.select(el)
        .interrupt()
        .attr('d', from)
        .transition()
        .duration(MORPH_MS)
        .ease(d3.easeCubicInOut)
        .attrTween('d', () => d3.interpolateString(from, d))
    }
    prev.current = d
  }, [d])
  return (
    <path
      ref={ref}
      fill={fill}
      fillOpacity={fillOpacity}
      stroke={stroke}
      strokeWidth={strokeWidth}
      style={{ transition: `fill ${MORPH_MS}ms ease, fill-opacity ${MORPH_MS}ms ease` }}
    />
  )
}
const BANDWIDTH = 0.7 // °C;0.1°C 資料粒度下平滑但不抹平雙峰
const OVERLAP = 1.9 // ridge 高度可越界到鄰行的倍率

export default function RidgelinePlot({ temps, month, domain, onPickMonth, indices = null, selectedMonths = null }: Props) {
  const t = useTokens()
  const { t: L } = useLanguage()
  // 量容器實際尺寸繪製(比照 TemperatureMap):固定 viewBox 會保持長寬比留白,
  // 寬卡片時左右浪費空間(使用者 8/18 回饋)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 520, h: 560 })
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      setSize({ w: Math.max(320, r.width), h: Math.max(340, r.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const W = size.w
  const H = size.h

  const x = useMemo(
    () => d3.scaleLinear().domain([domain[0] - 1, domain[1] + 1]).range([M.left, W - M.right]),
    [domain, W],
  )
  const y = useMemo(
    () =>
      d3
        .scalePoint<number>()
        .domain(d3.range(12))
        .range([M.top, H - M.bottom])
        .padding(0.6),
    [H],
  )

  const ridges = useMemo(() => {
    const xs = d3.range(domain[0] - 1, domain[1] + 1.001, 0.25)
    const pick = (vals: number[]) => (indices ? indices.map((i) => vals[i]) : vals)
    const densities = temps.months.map((vals) => kde(pick(vals), xs, BANDWIDTH))
    const dMax = d3.max(densities.flat())!
    const rowH = (y(1)! - y(0)!) * OVERLAP
    const area = (dens: number[], base: number) => {
      const gen = d3
        .area<number>()
        .x((_, i) => x(xs[i]))
        .y0(base)
        .y1((d) => base - (d / dMax) * rowH)
        .curve(d3.curveBasis)
      return gen(dens)!
    }
    return densities.map((dens, m) => ({ path: area(dens, y(m)!), median: d3.median(pick(temps.months[m]))! }))
  }, [temps, x, y, indices, domain])

  const color = useMemo(() => makeTempScale(t.tempScale, domain), [t.tempScale, domain])

  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ display: 'block' }}
      data-testid="ridgeline"
      role="img"
      aria-label={L.ridgeCard}
    >
      {/* x 軸 */}
      {x.ticks(7).map((v) => (
        <g key={v} transform={`translate(${x(v)},0)`}>
          <line y1={M.top - 8} y2={H - M.bottom} stroke={t.border} strokeDasharray="2 4" />
          <text
            y={H - M.bottom + 18}
            textAnchor="middle"
            fill={t.textMuted}
            fontSize={sd.typography.sizes.tick}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {v}°
          </text>
        </g>
      ))}
      <text
        x={(M.left + W - M.right) / 2}
        y={H - 8}
        textAnchor="middle"
        fill={t.textMuted}
        fontSize={sd.typography.sizes.axis}
      >
        {L.xAxisLabel}
      </text>

      {/* ridges:由 12 月往 1 月畫,讓上方的月疊在後方 */}
      {ridges
        .map((r, m) => ({ ...r, m }))
        .reverse()
        .map(({ path, median, m }) => {
          const active = m === month
          // 多選淡出:有選任何月份時,集外的 ridge 降 fill-opacity(MorphPath 已有
          // CSS transition,淡入淡出自帶動畫);空集不淡出任何月份
          const dimmed = !!selectedMonths && selectedMonths.size > 0 && !selectedMonths.has(m)
          return (
            <g
              key={m}
              onClick={() => onPickMonth?.(m)}
              style={{ cursor: onPickMonth ? 'pointer' : 'default' }}
              data-testid={`ridge-${m + 1}`}
            >
              {/* 填色=該月中位溫對照溫度色階(與地圖同源);換年/換縣市時形狀 morph */}
              <MorphPath
                d={path}
                fill={color(median)}
                fillOpacity={dimmed ? 0.12 : active ? 0.98 : 0.9}
                stroke={active ? t.accent : t.border}
                strokeWidth={active ? 2 : 1}
              />
              <text
                x={M.left - 8}
                y={y(m)!}
                textAnchor="end"
                dominantBaseline="middle"
                fill={active ? t.text : t.textMuted}
                fontSize={sd.typography.sizes.axis}
                fontWeight={active ? sd.typography.weights.bold : sd.typography.weights.normal}
              >
                {L.months[m]}
              </text>
            </g>
          )
        })}
    </svg>
    </div>
  )
}
