import { useTokens } from '../lib/useTokens'
import { useLanguage } from '../lib/i18n'
import sd from '../lib/styleDictionary.js'

// 底部播放列(8/18 定版):拆成兩張卡——月份卡右緣對齊「地圖|ridgeline 交界」
// (App 以與主列相同的 flex 比例排列,邊界自然對齊),年份卡在 ridgeline 下方。
// 12 個月份膠囊在卡內等寬平均分配(使用者 8/18)。
// 8/24 老師回饋:月份卡移除 Play 鈕(播放只留年份);月份膠囊改多選——
// 單擊=切換選取(選入時同時把地圖切到該月,再點一次取消);選取集僅影響 ridgeline 淡出。

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

export function MonthControls({ month, selected, onToggle }: {
  month: number
  selected: Set<number>
  onToggle: (m: number) => void
}) {
  const t = useTokens()
  const { t: L } = useLanguage()

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: sd.spacing.gap, minWidth: 0 }}>
      {/* 12 個月等寬平均分配吃滿卡寬 */}
      <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 0 }}>
        {L.months.map((label, m) => {
          const isSel = selected.has(m) // 多選集內:實心 accent
          const isCurrent = m === month // 地圖當前月:accent 描邊+粗體(與多選態區分)
          return (
            <button
              key={m}
              onClick={() => onToggle(m)}
              aria-pressed={isSel}
              data-testid={`month-${m + 1}`}
              style={{
                flex: 1,
                minWidth: 0,
                background: isSel ? t.accent : t.surface,
                color: isSel ? t.accentFg : isCurrent ? t.text : t.textMuted,
                border: `1px solid ${isSel || isCurrent ? t.accent : t.border}`,
                boxShadow: isCurrent ? `inset 0 0 0 1px ${t.accent}` : 'none',
                borderRadius: sd.components.pill.radius,
                height: CONTROL_H,
                boxSizing: 'border-box',
                padding: '0 2px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: sd.typography.sizes.body,
                fontWeight: isCurrent ? sd.typography.weights.bold : sd.typography.weights.normal,
                fontFamily: 'inherit',
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
                transition: 'background .15s, border-color .15s, color .15s',
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
