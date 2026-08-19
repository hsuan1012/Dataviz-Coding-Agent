import { useTokens } from '../lib/useTokens'
import sd from '../lib/styleDictionary.js'

interface Props {
  title: string
  years: number[]
  values: number[] // 與 years 對齊的歷年均溫
  year: number // 當前年:垂直參考線+放大點+數值標籤,換年/播放時平滑移動
}

// 側欄歷年趨勢 sparkline(比照臺灣國民小學校別圖集 Sidebar Sparkline):
// 折線+全點+當前年標記(參考線/放大點/頂帶數值標籤,transition 平滑移動)+首末端點註記。
const W = 240
const H = 56
const PAD = 4
const LABEL_H = 13

export default function TrendSpark({ title, years, values, year }: Props) {
  const t = useTokens()
  const fs = sd.typography.sizes
  const min = Math.min(...values)
  const max = Math.max(...values)
  const x = (i: number) => PAD + (i / (years.length - 1)) * (W - PAD * 2)
  const y = (v: number) => (max === min ? H / 2 : PAD + (1 - (v - min) / (max - min)) * (H - PAD * 2))
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  const curIdx = years.indexOf(year)
  const curX = curIdx >= 0 ? x(curIdx) : 0
  const curV = curIdx >= 0 ? values[curIdx] : null
  const markMove = { transition: 'x .25s ease, cx .25s ease, cy .25s ease, x1 .25s ease, x2 .25s ease' } as const
  const fmt = (v: number) => `${v.toFixed(1)}°`
  const label = curV === null ? '' : fmt(curV)
  // 標籤置中於當前點、夾在畫布內(估寬:半形≈0.56 字級)
  const labelW = label.length * 0.56 * fs.eyebrow
  const labelX = Math.max(labelW / 2, Math.min(W - labelW / 2, curX))
  return (
    <div>
      <div style={{ fontSize: fs.sectionLabel, color: t.textMuted, marginBottom: 2 }}>{title}</div>
      <svg viewBox={`0 0 ${W} ${H + LABEL_H}`} style={{ width: '100%', display: 'block' }} role="img" aria-label={title} data-testid="trend-spark">
        {curV !== null && (
          <line x1={curX} x2={curX} y1={LABEL_H} y2={H + LABEL_H - 2} stroke={t.textMuted} strokeWidth={1} strokeDasharray="2,3" opacity={0.6} style={markMove} />
        )}
        <g transform={`translate(0, ${LABEL_H})`}>
          <polyline points={pts} fill="none" stroke={t.accent} strokeWidth={2} />
          {values.map((v, i) => (
            <circle key={i} cx={x(i)} cy={y(v)} r={1.5} fill={t.accent} />
          ))}
          {curV !== null && (
            <circle cx={curX} cy={y(curV)} r={3.5} fill={t.accent} stroke={t.surface} strokeWidth={1.5} style={markMove} />
          )}
        </g>
        {curV !== null && (
          <text
            x={labelX}
            y={fs.eyebrow - 1}
            textAnchor="middle"
            fill={t.accent}
            style={{ fontSize: fs.eyebrow, fontFamily: sd.typography.fontFamily, fontVariantNumeric: 'tabular-nums', fontWeight: sd.typography.weights.bold, ...markMove }}
          >
            {label}
          </text>
        )}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: fs.eyebrow, color: t.textMuted, fontVariantNumeric: 'tabular-nums' }}>
        <span>
          {years[0]}:{fmt(values[0])}
        </span>
        <span>
          {years[years.length - 1]}:{fmt(values[values.length - 1])}
        </span>
      </div>
    </div>
  )
}
