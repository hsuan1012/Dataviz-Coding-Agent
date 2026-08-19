import { useMemo } from 'react'
import * as d3 from 'd3'
import { useTokens } from '../lib/useTokens'
import { useLanguage } from '../lib/i18n'
import sd from '../lib/styleDictionary.js'
import type { Grids, YearTemps } from '../lib/data'

interface Props {
  grids: Grids
  temps: YearTemps
  month: number
}

// 當月統計卡:全島均溫 / 最熱網格 / 最冷網格(比照國小圖集頂部統計列)
export default function StatStrip({ grids, temps, month }: Props) {
  const t = useTokens()
  const { t: L } = useLanguage()
  const stats = useMemo(() => {
    const vals = temps.months[month]
    const mean = d3.mean(vals)!
    const iMax = d3.maxIndex(vals)
    const iMin = d3.minIndex(vals)
    return {
      mean,
      max: { v: vals[iMax], county: grids.county[iMax] },
      min: { v: vals[iMin], county: grids.county[iMin] },
    }
  }, [grids, temps, month])

  // 橫排+兩行小字(使用者 8/18 兩輪回饋):左=標籤在上、補充小字在正下方,右=大數值;
  // 兩行小字高度≈大數值高度,右側不留白
  const tile = (label: string, value: string, sub?: string) => (
    <div
      style={{
        flex: 1,
        minWidth: 220,
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: sd.components.panel.radius,
        padding: '4px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between', // 小字靠左、大數字靠右(比照國小圖集 KPI;使用者 8/18)
        gap: 12,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: sd.typography.sizes.sectionLabel, color: t.textMuted }}>{label}</span>
        {sub && <span style={{ fontSize: sd.typography.sizes.tick, color: t.textMuted }}>{sub}</span>}
      </span>
      <span
        style={{
          fontSize: sd.typography.sizes.title,
          fontWeight: sd.typography.weights.bold,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.1,
        }}
        data-testid={`stat-${label}`}
      >
        {value}
      </span>
    </div>
  )

  const m = L.months[month]
  return (
    <div style={{ display: 'flex', gap: sd.spacing.gap, flexWrap: 'wrap' }}>
      {tile(L.statMean(m), `${stats.mean.toFixed(1)}°C`, L.gridCount(grids.n.toLocaleString()))}
      {tile(L.statMax(m), `${stats.max.v.toFixed(1)}°C`, L.county(stats.max.county))}
      {tile(L.statMin(m), `${stats.min.v.toFixed(1)}°C`, L.county(stats.min.county))}
    </div>
  )
}
