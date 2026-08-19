import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useTokens } from '../lib/useTokens'
import { useLanguage } from '../lib/i18n'
import sd from '../lib/styleDictionary.js'
import type { Grids, YearTemps } from '../lib/data'
import { makeTempScale, scaleSwatches } from '../lib/tempScale'
import { buildGridIndex } from '../lib/nearest'

interface Props {
  grids: Grids
  temps: YearTemps
  month: number // 0-11
  domain: [number, number] // 全期(1980-2024)固定色階域,跨年可比
  selectedCounty?: string | null // 側欄選取縣市:其餘網格淡出聚焦
}

interface Hover {
  i: number
  px: number
  py: number
}

// 縣市界(政府開放資料,沿用鄉鎮圖集 counties.geojson);模組級快取,只抓一次
let boundariesPromise: Promise<GeoJSON.FeatureCollection> | null = null
function loadBoundaries(): Promise<GeoJSON.FeatureCollection> {
  if (!boundariesPromise) {
    boundariesPromise = fetch(`${import.meta.env.BASE_URL}data/counties.geojson`).then((r) => {
      if (!r.ok) throw new Error(`counties.geojson ${r.status}`)
      return r.json()
    })
  }
  return boundariesPromise
}

// 動態 heatmap 地圖:canvas 逐格上色(8,975 格 × 2km),月份切換時整層重繪。
// 色階=方向 A densityScale(全年固定 domain,逐月可比);hover 顯示網格明細。
export default function TemperatureMap({ grids, temps, month, domain, selectedCounty = null }: Props) {
  const t = useTokens()
  const { t: L } = useLanguage()
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ w: 480, h: 560 })
  const [hover, setHover] = useState<Hover | null>(null)
  const [boundaries, setBoundaries] = useState<GeoJSON.FeatureCollection | null>(null)

  useEffect(() => {
    loadBoundaries().then(setBoundaries).catch(() => {})
  }, [])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      setSize({ w: Math.max(280, r.width), h: Math.max(360, r.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const projection = useMemo(() => {
    const pts: [number, number][] = grids.lon.map((x, i) => [x, grids.lat[i]])
    return d3
      .geoMercator()
      .fitExtent(
        [
          [8, 8],
          [size.w - 8, size.h - 8],
        ],
        { type: 'MultiPoint', coordinates: pts },
      )
  }, [grids, size])

  const index = useMemo(
    () => buildGridIndex(grids.lon, grids.lat, Math.max(grids.cell[0], grids.cell[1])),
    [grids],
  )

  const color = useMemo(() => makeTempScale(t.tempScale, domain), [t.tempScale, domain])

  // cell 的螢幕尺寸:投影相距 (dlon, dlat) 的兩點;乘 1.12 蓋住網格旋轉造成的縫隙
  const cellPx = useMemo(() => {
    const [dlon, dlat] = grids.cell
    const cLon = (d3.min(grids.lon)! + d3.max(grids.lon)!) / 2
    const cLat = (d3.min(grids.lat)! + d3.max(grids.lat)!) / 2
    const a = projection([cLon, cLat])!
    const b = projection([cLon + dlon, cLat - dlat])!
    return { w: Math.abs(b[0] - a[0]) * 1.12, h: Math.abs(b[1] - a[1]) * 1.12 }
  }, [projection, grids])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = size.w * dpr
    canvas.height = size.h * dpr
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size.w, size.h)
    const values = temps.months[month]
    const { w, h } = cellPx
    for (let i = 0; i < grids.n; i++) {
      const p = projection([grids.lon[i], grids.lat[i]])
      if (!p) continue
      // 縣市聚焦:非選取縣的網格淡出(仍可見輪廓脈絡)
      ctx.globalAlpha = selectedCounty && grids.county[i] !== selectedCounty ? 0.14 : 1
      ctx.fillStyle = color(values[i])
      ctx.fillRect(p[0] - w / 2, p[1] - h / 2, w, h)
    }
    ctx.globalAlpha = 1
    // 縣市分隔線(使用者 8/18):真實縣市界疊在網格上;線色用 surface(淺=白/深=深底色),
    // 與飽和網格色對比清楚且兩主題皆協調
    if (boundaries) {
      const geoPath = d3.geoPath(projection, ctx)
      ctx.beginPath()
      geoPath(boundaries)
      ctx.strokeStyle = t.surface
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.85
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    if (hover) {
      const p = projection([grids.lon[hover.i], grids.lat[hover.i]])
      if (p) {
        ctx.strokeStyle = t.accent
        ctx.lineWidth = 2
        ctx.strokeRect(p[0] - w / 2 - 1, p[1] - h / 2 - 1, w + 2, h + 2)
      }
    }
  }, [size, projection, grids, temps, month, color, cellPx, hover, t.accent, t.surface, selectedCounty, boundaries])

  function onMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const ll = projection.invert?.([px, py])
    if (!ll) return setHover(null)
    const i = index.query(ll[0], ll[1], Math.max(grids.cell[0], grids.cell[1]))
    setHover(i === null ? null : { i, px, py })
  }

  const swatches = useMemo(() => scaleSwatches(t.tempScale, 7), [t.tempScale])
  const fmt = (v: number) => `${v.toFixed(1)}°C`

  return (
    <div ref={wrapRef} style={{ position: 'relative', flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        // 游標=小圓點(使用者 8/18:十字改圓點):自訂 SVG cursor,accent 圓+白描邊,熱點在圓心
        style={{
          width: size.w,
          height: size.h,
          display: 'block',
          cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Ccircle cx='8' cy='8' r='4.5' fill='%230D9488' stroke='white' stroke-width='1.5'/%3E%3C/svg%3E") 8 8, default`,
        }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        data-testid="temp-map"
      />
      {/* 圖例:色帶 + 全年固定 domain 端點 */}
      <div
        style={{
          position: 'absolute',
          left: 8,
          bottom: 8,
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: sd.components.panel.radius,
          padding: '8px 10px',
          fontSize: sd.typography.sizes.legend,
          color: t.textMuted,
        }}
      >
        <div style={{ display: 'flex', gap: 0, marginBottom: 4 }}>
          {swatches.map((c, i) => (
            <span key={i} style={{ width: 18, height: 8, background: c }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontVariantNumeric: 'tabular-nums' }}>
          <span>{fmt(domain[0])}</span>
          <span>{fmt(domain[1])}</span>
        </div>
        <div style={{ marginTop: 2 }}>{L.legendLabel}</div>
      </div>
      {hover && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(hover.px + 14, size.w - 170),
            top: Math.max(hover.py - 14, 0),
            background: t.tooltip.bg,
            color: t.tooltip.fg,
            borderRadius: sd.components.tooltip.radius,
            padding: sd.components.tooltip.padding,
            fontSize: sd.typography.sizes.tick,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            fontVariantNumeric: 'tabular-nums',
          }}
          data-testid="map-tooltip"
        >
          <div style={{ fontWeight: sd.typography.weights.bold }}>
            {L.county(grids.county[hover.i])}・{L.months[month]} {temps.months[month][hover.i].toFixed(1)}°C
          </div>
          <div>
            ({grids.lon[hover.i].toFixed(3)}, {grids.lat[hover.i].toFixed(3)})
          </div>
        </div>
      )}
    </div>
  )
}
