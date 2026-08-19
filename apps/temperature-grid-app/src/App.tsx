import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ThemeProvider, useTokens } from './lib/useTokens'
import { LanguageProvider, useLanguage } from './lib/i18n'
import sd from './lib/styleDictionary.js'
import { loadGrids, loadMeta, loadTrends, loadYear, type Grids, type Meta, type Trends, type YearTemps } from './lib/data'
import TemperatureMap from './components/TemperatureMap'
import RidgelinePlot from './components/RidgelinePlot'
import { MonthControls, YearControls } from './components/MonthPlayBar'
import StatStrip from './components/StatStrip'
import CountySidebar from './components/CountySidebar'
import { buildCountyIndices } from './lib/countyStats'

// 家族外殼(比照臺灣鄉鎮統計圖集/世界發展數據分析平台/國小圖集):
// 頂部襯線標題+主題切換、統計卡列、左地圖右 ridgeline 並排、底部月份播放軸、來源 footer。
// 年份資料快取:切年時懶載入 temps_<year>.json,已載過即秒切
const tempsCache = new Map<number, YearTemps>()

function Inner() {
  const t = useTokens()
  const { lang, t: L, toggle: toggleLang } = useLanguage()
  const [grids, setGrids] = useState<Grids | null>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [trends, setTrends] = useState<Trends | null>(null)
  const [temps, setTemps] = useState<YearTemps | null>(null)
  const [year, setYear] = useState<number>(2024) // 預設最新年(家族慣例)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState(0)
  const [playing, setPlaying] = useState(false)
  // 縣市選取(側欄競速長條;點選→地圖聚焦+ridgeline 切該縣分布)
  const [selectedCounty, setSelectedCounty] = useState<string | null>(null)
  const countyIdx = useMemo(() => (grids ? buildCountyIndices(grids.county) : null), [grids])
  const ridgeIndices = selectedCounty && countyIdx ? countyIdx.get(selectedCounty) ?? null : null

  useEffect(() => {
    Promise.all([loadGrids(), loadMeta(), loadTrends()])
      .then(([g, m, tr]) => {
        setGrids(g)
        setMeta(m)
        setTrends(tr)
        const latest = m.years[m.years.length - 1]
        setYear(latest)
        return loadYear(latest).then((y) => {
          tempsCache.set(latest, y)
          setTemps(y)
        })
      })
      .catch((e) => setError(String(e)))
  }, [])

  const yearRef = useRef(year)
  const onYear = useCallback((y: number) => {
    yearRef.current = y
    setYear(y)
    // 預載下一年(年份播放/連點時不卡格)
    const next = y + 1
    if (next <= 2024 && !tempsCache.has(next)) {
      loadYear(next).then((d) => tempsCache.set(next, d)).catch(() => {})
    }
    const cached = tempsCache.get(y)
    if (cached) {
      setTemps(cached)
      return
    }
    loadYear(y)
      .then((d) => {
        tempsCache.set(y, d)
        // 競態守門:快速連續切年時,只採用「仍是當前選擇年」的回應
        if (yearRef.current === d.year) setTemps(d)
      })
      .catch((e) => setError(String(e)))
  }, [])

  // 年份播放(與月份播放互斥):~1s/年,到 2024 回繞 1980
  const [yearPlaying, setYearPlaying] = useState(false)
  useEffect(() => {
    if (!yearPlaying) return
    const id = window.setInterval(() => {
      const cur = yearRef.current
      onYear(cur >= 2024 ? 1980 : cur + 1)
    }, 1000)
    return () => window.clearInterval(id)
  }, [yearPlaying, onYear])
  const toggleMonthPlay = useCallback(() => {
    setPlaying((p) => {
      if (!p) setYearPlaying(false)
      return !p
    })
  }, [])
  const toggleYearPlay = useCallback(() => {
    setYearPlaying((p) => {
      if (!p) setPlaying(false)
      return !p
    })
  }, [])

  const domain = useMemo<[number, number] | null>(() => (meta ? [meta.tmin, meta.tmax] : null), [meta])
  const onMonth = useCallback((m: number) => setMonth(m), [])

  const card = (children: React.ReactNode, extra?: React.CSSProperties) => (
    <div
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: sd.spacing.borderRadius,
        padding: sd.spacing.chartPadding,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        minWidth: 0,
        ...extra,
      }}
    >
      {children}
    </div>
  )

  return (
    <div
      style={{
        background: t.bg,
        color: t.text,
        height: '100vh',
        overflowY: 'auto',
        padding: '14px 24px 10px',
        fontFamily: sd.typography.fontFamily,
        display: 'flex',
        flexDirection: 'column',
        // 原生控件配色跟主題走+pill-toggle 用的 CSS 變數(比照國小圖集)
        colorScheme: t.dark ? 'dark' : 'light',
        ['--accent' as string]: t.accent,
        ['--accent-fg' as string]: t.accentFg,
        ['--color-border' as string]: t.border,
      }}
    >
      {/* 一屏放滿+滿版(不限寬):標準桌機不出捲軸,主圖列 flex 填滿;低於可用性下限(小螢幕)才溢出捲動 */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: sd.spacing.gap, flex: 1, minHeight: 0 }}>
        {/* 頂列 */}
        {/* 按鈕底部對齊副標線,沉在頁首下緣(比照國小圖集;使用者 8/18) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1
              style={{
                margin: 0,
                fontFamily: sd.typography.fontSerif,
                fontSize: sd.typography.sizes.title,
                fontWeight: sd.typography.weights.bold,
              }}
            >
              {L.title}
            </h1>
            <div style={{ fontSize: sd.typography.sizes.subtitle, color: t.textMuted, marginTop: 2 }}>
              {L.subtitle(year)}
            </div>
          </div>
          {/* 右上控制列(比照國小圖集):語言切換+深色模式,皆 pill-toggle 家族樣式 */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="pill-toggle"
              aria-pressed={lang === 'en'}
              onClick={toggleLang}
              data-testid="lang-toggle"
              style={{
                cursor: 'pointer',
                borderRadius: sd.components.pill.radius,
                padding: '6px 14px',
                lineHeight: 1.5,
                fontSize: sd.typography.sizes.body,
                fontFamily: sd.typography.fontFamily,
                transition: 'background .15s, border-color .15s, color .15s',
                border: `1px solid ${lang === 'en' ? t.accent : t.border}`,
                background: lang === 'en' ? t.accent : t.surface,
                color: lang === 'en' ? t.accentFg : t.text,
              }}
            >
              {L.langToggleLabel}
            </button>
            <button
              className="pill-toggle"
              aria-pressed={t.dark}
              onClick={t.toggle}
              data-testid="theme-toggle"
              style={{
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                borderRadius: sd.components.pill.radius,
                padding: '6px 14px',
                lineHeight: 1.5,
                fontSize: sd.typography.sizes.body,
                fontFamily: sd.typography.fontFamily,
                transition: 'background .15s, border-color .15s, color .15s',
                border: `1px solid ${t.dark ? t.accent : t.border}`,
                background: t.dark ? t.accent : t.surface,
                color: t.dark ? t.accentFg : t.text,
              }}
            >
              {t.dark ? L.lightMode : L.darkMode}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ color: sd.colors.danger, fontSize: sd.typography.sizes.body }}>資料載入失敗:{error}</div>
        )}

        {grids && temps && meta && domain && (
          <>
            <StatStrip grids={grids} temps={temps} month={month} />

            {/* 主區:側欄拉滿到底(含歷年趨勢);右欄=上(地圖+ridgeline)+下(年份卡+月份卡),
                上下兩列同一套 flex 比例 → 年份卡寬=地圖卡、月份卡寬=ridgeline 卡(使用者 8/18) */}
            <div className="main-row" style={{ gap: sd.spacing.gap }}>
              <CountySidebar
                grids={grids}
                temps={temps}
                month={month}
                domain={domain}
                year={year}
                years={meta.years}
                onYear={onYear}
                selected={selectedCounty}
                onSelect={setSelectedCounty}
                trends={trends}
              />
              <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: sd.spacing.gap }}>
                <div className="charts-row" style={{ gap: sd.spacing.gap }}>
                  {card(
                    <>
                      <div style={{ fontSize: sd.typography.sizes.sectionLabel, color: t.textMuted, marginBottom: 6 }}>
                        {L.mapCard}
                      </div>
                      <TemperatureMap grids={grids} temps={temps} month={month} domain={domain} selectedCounty={selectedCounty} />
                    </>,
                    { flex: '0.55 1 380px', minHeight: 420 },
                  )}
                  {card(
                    <>
                      <div style={{ fontSize: sd.typography.sizes.sectionLabel, color: t.textMuted, marginBottom: 6 }}>
                        {L.ridgeCard}
                        {selectedCounty && (
                          <span style={{ color: t.accent, fontWeight: sd.typography.weights.bold }}>
                            ・{L.county(selectedCounty)}
                          </span>
                        )}
                      </div>
                      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                        <RidgelinePlot temps={temps} month={month} domain={domain} onPickMonth={onMonth} indices={ridgeIndices} />
                      </div>
                    </>,
                    { flex: '1.7 1 480px', minHeight: 420 },
                  )}
                </div>
                <div style={{ display: 'flex', gap: sd.spacing.gap, flexWrap: 'wrap' }}>
                  {card(
                    <YearControls
                      year={year}
                      years={meta.years}
                      yearPlaying={yearPlaying}
                      onYear={onYear}
                      onToggleYearPlay={toggleYearPlay}
                    />,
                    { flex: '0.55 1 380px', minWidth: 0, padding: `8px ${sd.spacing.chartPadding}px` },
                  )}
                  {card(
                    <MonthControls month={month} playing={playing} onMonth={onMonth} onTogglePlay={toggleMonthPlay} />,
                    { flex: '1.7 1 480px', minWidth: 0, padding: `8px ${sd.spacing.chartPadding}px` },
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        <footer style={{ fontSize: sd.typography.sizes.tick, color: t.textMuted, paddingTop: 2 }}>
          {L.footer}
        </footer>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <Inner />
      </LanguageProvider>
    </ThemeProvider>
  )
}
