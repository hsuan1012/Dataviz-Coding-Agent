import { useEffect, useMemo, useState } from 'react'
import { useTokens } from '../lib/useTokens'
import { useLanguage } from '../lib/i18n'
import sd from '../lib/styleDictionary.js'
import type { Grids, Trends, YearTemps } from '../lib/data'
import { buildCountyIndices, countyMeans } from '../lib/countyStats'
import { makeTempScale } from '../lib/tempScale'
import TrendSpark from './TrendSpark'

interface Props {
  grids: Grids
  temps: YearTemps
  month: number
  domain: [number, number]
  year: number
  years: number[]
  onYear: (y: number) => void
  selected: string | null
  onSelect: (county: string | null) => void
  trends: Trends | null
}

// 搜尋正規化:臺/台異體字互通(家族教訓,鄉鎮圖集/世界平台同款)
const norm = (s: string) => s.toLowerCase().replace(/台/g, '臺')

// 縣市競速長條側欄(比照臺灣國民小學校別矩形樹狀圖 Sidebar 的競速長條圖):
// 列=絕對定位依名次排、換月時 top(名次)與長條寬同步過渡;key=縣名穩定 → FLIP 名次追逐。
// 值=當月縣內網格均溫;長條色=溫度色階(與地圖同源,換月時顏色也跟著冷暖變化);
// 點縣市=選取(地圖聚焦該縣、ridgeline 切為該縣分布),再點一次取消。
const ROW_H = 30
const RACE_MS = 550

export default function CountySidebar({ grids, temps, month, domain, year, years, onYear, selected, onSelect, trends }: Props) {
  const t = useTokens()
  const { t: L } = useLanguage()
  const fs = sd.typography.sizes
  const [query, setQuery] = useState('')
  // 年份輸入框(比照國小圖集:輸入中允許不完整值,值有效即跳年;滑桿/播放改年時同步)
  const [yearInput, setYearInput] = useState(String(year))
  useEffect(() => {
    setYearInput(String(year))
  }, [year])
  const handleYearInput = (raw: string) => {
    setYearInput(raw)
    const y = Number(raw)
    if (/^\d{4}$/.test(raw) && years.includes(y)) onYear(y)
  }

  const indices = useMemo(() => buildCountyIndices(grids.county), [grids])
  const allRows = useMemo(() => countyMeans(indices, temps.months[month]), [indices, temps, month])
  // 搜尋過濾(名次沿用全名單名次,不重排)
  const rows = useMemo(() => {
    if (!query.trim()) return allRows.map((r, i) => ({ ...r, rank: i + 1 }))
    const q = norm(query.trim())
    return allRows
      .map((r, i) => ({ ...r, rank: i + 1 }))
      .filter((r) => norm(r.county).includes(q) || norm(L.county(r.county)).includes(q))
  }, [allRows, query, L])
  const color = useMemo(() => makeTempScale(t.tempScale, domain), [t.tempScale, domain])
  // 長條寬:全期固定 domain 正規化(與地圖色階同一把尺,換月/換年整排伸縮可比)
  const frac = (v: number) => (v - domain[0]) / (domain[1] - domain[0])

  return (
    <aside
      className="county-rail"
      aria-label={L.sidebarTitle(L.months[month])}
      style={{
        width: 236,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: sd.spacing.borderRadius,
        padding: sd.spacing.chartPadding,
        gap: 8,
      }}
    >
      {/* 搜尋框(比照國小圖集 .app-input 樣式) */}
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={L.searchPlaceholder}
        aria-label={L.searchAria}
        className="app-input"
        data-testid="county-search"
        style={{
          boxSizing: 'border-box',
          width: '100%',
          padding: '4px 8px',
          fontSize: fs.axis,
          fontFamily: sd.typography.fontFamily,
          color: t.text,
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: sd.components.control.radius,
        }}
      />
      {/* 年份選擇(比照國小圖集:自畫 spinner 透明底 ±1、端點停用、範圍提示) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label htmlFor="year-input" style={{ fontSize: fs.body, color: t.text, flexShrink: 0 }}>
          {L.yearLabel}
        </label>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <input
            id="year-input"
            type="number"
            min={years[0]}
            max={years[years.length - 1]}
            value={yearInput}
            onChange={(e) => handleYearInput(e.target.value)}
            aria-label={L.yearLabel}
            className="app-input"
            data-testid="year-input"
            style={{
              width: 84,
              padding: '4px 22px 4px 8px',
              boxSizing: 'border-box',
              fontSize: fs.axis,
              fontFamily: sd.typography.fontFamily,
              fontVariantNumeric: 'tabular-nums',
              color: t.text,
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: sd.components.control.radius,
            }}
          />
          <div style={{ position: 'absolute', right: 5, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {([1, -1] as const).map((d) => {
              const target = year + d
              const disabled = !years.includes(target)
              return (
                <button
                  key={d}
                  type="button"
                  tabIndex={-1}
                  disabled={disabled}
                  aria-label={`${L.yearLabel} ${d > 0 ? '+1' : '-1'}`}
                  onClick={() => onYear(target)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 14,
                    height: 10,
                    padding: 0,
                    background: 'transparent',
                    border: 'none',
                    color: disabled ? t.border : t.textMuted,
                    cursor: disabled ? 'default' : 'pointer',
                  }}
                >
                  <svg width="8" height="5" viewBox="0 0 8 5" aria-hidden focusable="false">
                    <polygon points={d > 0 ? '4,0 8,5 0,5' : '4,5 0,0 8,0'} fill="currentColor" />
                  </svg>
                </button>
              )
            })}
          </div>
        </div>
        <span style={{ fontSize: fs.sectionLabel, color: t.textMuted }}>{L.yearRangeHint}</span>
      </div>
      <div style={{ fontSize: fs.sectionLabel, color: t.textMuted, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
        <span>{L.sidebarTitle(L.months[month])}</span>
        {selected && (
          <button
            onClick={() => onSelect(null)}
            style={{
              background: 'none',
              border: 'none',
              color: t.accent,
              cursor: 'pointer',
              fontSize: fs.eyebrow,
              fontFamily: 'inherit',
              padding: 0,
            }}
          >
            {L.clearSelection}
          </button>
        )}
      </div>
      <div className="app-scroll" style={{ overflowY: 'auto', overflowX: 'hidden', minHeight: 0, flex: 1 }}>
        {rows.length === 0 && (
          <div style={{ fontSize: fs.sectionLabel, color: t.textMuted, padding: 6 }}>{L.noResults}</div>
        )}
        <div style={{ position: 'relative', height: rows.length * ROW_H }}>
          {rows.map((r, i) => {
            const active = selected === r.county
            return (
              <button
                key={r.county}
                data-testid={`county-${r.county}`}
                aria-pressed={active}
                onClick={() => onSelect(active ? null : r.county)}
                style={{
                  position: 'absolute',
                  top: i * ROW_H,
                  left: 0,
                  height: ROW_H,
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0 6px',
                  borderRadius: sd.components.control.radius,
                  fontFamily: sd.typography.fontFamily,
                  color: t.text,
                  textAlign: 'left',
                  transition: `top ${RACE_MS}ms ease`,
                  outline: active ? `1.5px solid ${t.accent}` : 'none',
                  outlineOffset: -1.5,
                }}
              >
                {/* 競速長條:鋪在文字底下,寬與顏色隨月份動畫 */}
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 4,
                    bottom: 4,
                    width: `${Math.max(4, frac(r.mean) * 100)}%`,
                    background: color(r.mean),
                    opacity: active ? (t.dark ? 0.6 : 0.45) : t.dark ? 0.42 : 0.3,
                    borderRadius: sd.components.bar.radius,
                    transition: `width ${RACE_MS}ms ease, background ${RACE_MS}ms ease`,
                  }}
                />
                <span style={{ position: 'relative', fontSize: fs.sectionLabel, color: t.textMuted, width: 18, flexShrink: 0, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                  {r.rank}
                </span>
                <span
                  title={L.county(r.county)}
                  style={{
                    position: 'relative',
                    fontSize: fs.body,
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: active ? sd.typography.weights.bold : sd.typography.weights.normal,
                  }}
                >
                  {L.county(r.county)}
                </span>
                <span style={{ position: 'relative', fontSize: fs.sectionLabel, color: t.textMuted, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  {r.mean.toFixed(1)}°
                </span>
              </button>
            )
          })}
        </div>
      </div>
      {/* 歷年趨勢常駐(比照國小圖集):單位=當前選取縣市或全島,月份/年份/選取都會連動 */}
      {trends && (
        <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 8 }}>
          <TrendSpark
            title={L.trendTitle(selected ? L.county(selected) : L.islandLabel, L.months[month])}
            years={trends.years}
            values={selected ? trends.county[selected][month] : trends.island[month]}
            year={year}
          />
        </div>
      )}
    </aside>
  )
}
