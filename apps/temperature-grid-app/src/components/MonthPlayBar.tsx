import { useEffect, useRef } from 'react'
import { useTokens } from '../lib/useTokens'
import { useLanguage } from '../lib/i18n'
import sd from '../lib/styleDictionary.js'

// 底部播放列(8/18 定版):拆成兩張卡——月份卡右緣對齊「地圖|ridgeline 交界」
// (App 以與主列相同的 flex 比例排列,邊界自然對齊),年份卡在 ridgeline 下方。
// 12 個月份膠囊在卡內等寬平均分配(使用者 8/18)。

const TICK_MS = 900
const CONTROL_H = 30 // 播放鈕與月份膠囊統一高度(使用者 8/18:上下寬度要一致)

function PlayIcon({ playing }: { playing: boolean }) {
  return playing ? (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden focusable="false">
      <rect x="4" y="3" width="3" height="10" fill="currentColor" />
      <rect x="9" y="3" width="3" height="10" fill="currentColor" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden focusable="false">
      <polygon points="4,2.5 13,8 4,13.5" fill="currentColor" />
    </svg>
  )
}

function PlayButton({ playing, onClick, testid, ariaPlay, ariaPause }: {
  playing: boolean
  onClick: () => void
  testid: string
  ariaPlay: string
  ariaPause: string
}) {
  const t = useTokens()
  return (
    <button
      onClick={onClick}
      aria-pressed={playing}
      aria-label={playing ? ariaPause : ariaPlay}
      data-testid={testid}
      style={{
        background: playing ? t.accent : t.surface,
        color: playing ? t.accentFg : t.text,
        border: `1px solid ${playing ? t.accent : t.border}`,
        borderRadius: sd.components.pill.radius,
        height: CONTROL_H,
        boxSizing: 'border-box',
        padding: '0 14px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'background .15s, border-color .15s, color .15s',
      }}
    >
      <PlayIcon playing={playing} />
    </button>
  )
}

export function MonthControls({ month, playing, onMonth, onTogglePlay }: {
  month: number
  playing: boolean
  onMonth: (m: number) => void
  onTogglePlay: () => void
}) {
  const t = useTokens()
  const { t: L } = useLanguage()
  const monthRef = useRef(month)
  monthRef.current = month

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => onMonth((monthRef.current + 1) % 12), TICK_MS)
    return () => window.clearInterval(id)
  }, [playing, onMonth])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: sd.spacing.gap, minWidth: 0 }}>
      <PlayButton playing={playing} onClick={onTogglePlay} testid="play-toggle" ariaPlay={L.playAria} ariaPause={L.pauseAria} />
      {/* 12 個月等寬平均分配吃滿卡寬 */}
      <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 0 }}>
        {L.months.map((label, m) => {
          const active = m === month
          return (
            <button
              key={m}
              onClick={() => onMonth(m)}
              data-testid={`month-${m + 1}`}
              style={{
                flex: 1,
                minWidth: 0,
                background: active ? t.accent : t.surface,
                color: active ? t.accentFg : t.textMuted,
                border: `1px solid ${active ? t.accent : t.border}`,
                borderRadius: sd.components.pill.radius,
                height: CONTROL_H,
                boxSizing: 'border-box',
                padding: '0 2px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: sd.typography.sizes.body,
                fontFamily: 'inherit',
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function YearControls({ year, years, yearPlaying, onYear, onToggleYearPlay }: {
  year: number
  years: number[]
  yearPlaying: boolean
  onYear: (y: number) => void
  onToggleYearPlay: () => void
}) {
  const { t: L } = useLanguage()
  const yMin = years[0]
  const yMax = years[years.length - 1]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: sd.spacing.gap, minWidth: 0 }}>
      <PlayButton playing={yearPlaying} onClick={onToggleYearPlay} testid="year-play-toggle" ariaPlay={L.yearPlayAria} ariaPause={L.pauseAria} />
      <input
        type="range"
        min={yMin}
        max={yMax}
        value={year}
        onChange={(e) => onYear(Number(e.target.value))}
        aria-label={L.yearLabel}
        data-testid="year-range"
        className="year-range"
        style={{ flex: 1, minWidth: 80, ['--range-progress' as string]: `${((year - yMin) / (yMax - yMin)) * 100}%` }}
      />
      <span
        style={{
          fontSize: sd.typography.sizes.title,
          fontWeight: sd.typography.weights.bold,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
          minWidth: 76,
          textAlign: 'right',
        }}
        data-testid="year-display"
      >
        {year}
      </span>
    </div>
  )
}
