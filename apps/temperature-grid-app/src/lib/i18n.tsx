// 中英雙語字典＋LanguageProvider(架構比照臺灣國民小學校別矩形樹狀圖/世界發展數據分析平台)。
// 縣市名:原始資料為中文,英文模式用官方英譯對照表。
import { createContext, useContext, useState, type ReactNode } from 'react'

export type Language = 'zh' | 'en'

export interface Dict {
  title: string
  subtitle: (year: number) => string
  ridgeCard: string
  statMean: (m: string) => string
  statMax: (m: string) => string
  statMin: (m: string) => string
  gridCount: (n: string) => string
  legendLabel: string
  xAxisLabel: string
  months: string[]
  darkMode: string
  lightMode: string
  langToggleLabel: string
  playAria: string
  pauseAria: string
  footer: string
  county: (zhName: string) => string
  sidebarTitle: (monthLabel: string) => string
  clearSelection: string
  searchPlaceholder: string
  searchAria: string
  noResults: string
  yearLabel: string
  yearRangeHint: string
  yearPlayAria: string
  islandLabel: string
  trendTitle: (unit: string, monthLabel: string) => string
}

const COUNTY_EN: Record<string, string> = {
  南投縣: 'Nantou County', 嘉義市: 'Chiayi City', 嘉義縣: 'Chiayi County',
  基隆市: 'Keelung City', 宜蘭縣: 'Yilan County', 屏東縣: 'Pingtung County',
  彰化縣: 'Changhua County', 新北市: 'New Taipei City', 新竹市: 'Hsinchu City',
  新竹縣: 'Hsinchu County', 桃園市: 'Taoyuan City', 澎湖縣: 'Penghu County',
  臺中市: 'Taichung City', 臺北市: 'Taipei City', 臺南市: 'Tainan City',
  臺東縣: 'Taitung County', 花蓮縣: 'Hualien County', 苗栗縣: 'Miaoli County',
  雲林縣: 'Yunlin County', 高雄市: 'Kaohsiung City',
}

export const translations: Record<Language, Dict> = {
  zh: {
    title: '臺灣月均溫地圖',
    subtitle: (y) => `${y} 年全臺 2 公里網格的逐月平均氣溫——播放看季節冷暖,拖曳年份看 45 年變化`,
    ridgeCard: 'RIDGELINE・各月網格月均溫分布(點 ridge 可跳至該月)',
    statMean: (m) => `${m}・全島網格均溫`,
    statMax: (m) => `${m}・最熱網格`,
    statMin: (m) => `${m}・最冷網格`,
    gridCount: (n) => `${n} 個 2km 網格`,
    legendLabel: '月均溫(1980–2024 固定色階)',
    xAxisLabel: '月均溫(°C)',
    months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    darkMode: '深色模式',
    lightMode: '淺色模式',
    langToggleLabel: 'English',
    playAria: '播放',
    pauseAria: '暫停',
    footer:
      '資料來源:TCCIP 月均溫網格資料(TReAD 月平均溫,1980–2024)。已去除縣市邊界重複網格 1,101 筆/年(去重後 8,975 格,重複網格數值經驗證完全一致);含澎湖縣網格。',
    county: (n) => n,
    sidebarTitle: (m) => `縣市排名・${m}均溫`,
    clearSelection: '清除選取',
    searchPlaceholder: '搜尋縣市…',
    searchAria: '搜尋縣市',
    noResults: '找不到縣市',
    yearLabel: '年份',
    yearRangeHint: '1980–2024',
    yearPlayAria: '播放年份',
    islandLabel: '全島',
    trendTitle: (u, m) => `${u}・${m}均溫 1980–2024 趨勢`,
  },
  en: {
    title: 'Taiwan Monthly Temperature Map',
    subtitle: (y) => `Monthly mean temperatures across Taiwan on a 2 km grid, ${y} — play the months, drag through 45 years`,
    ridgeCard: 'RIDGELINE · monthly distribution of grid temperatures (click a ridge to jump)',
    statMean: (m) => `${m} · Island mean`,
    statMax: (m) => `${m} · Warmest grid`,
    statMin: (m) => `${m} · Coldest grid`,
    gridCount: (n) => `${n} grid cells (2 km)`,
    legendLabel: 'Monthly mean (fixed 1980–2024 scale)',
    xAxisLabel: 'Monthly mean temperature (°C)',
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    darkMode: 'Dark Mode',
    lightMode: 'Light Mode',
    langToggleLabel: '中文',
    playAria: 'Play',
    pauseAria: 'Pause',
    footer:
      'Source: TCCIP monthly temperature grid data (TReAD monthly mean, 1980–2024). 1,101 duplicate county-boundary rows removed per year (8,975 unique grids; duplicate values verified identical); Penghu grids included.',
    county: (n) => COUNTY_EN[n] ?? n,
    sidebarTitle: (m) => `County ranking · ${m} mean`,
    clearSelection: 'Clear',
    searchPlaceholder: 'Search counties…',
    searchAria: 'Search counties',
    noResults: 'No matches',
    yearLabel: 'Year',
    yearRangeHint: '1980–2024',
    yearPlayAria: 'Play years',
    islandLabel: 'Island-wide',
    trendTitle: (u, m) => `${u} · ${m} mean, 1980–2024`,
  },
}

interface LangCtx {
  lang: Language
  t: Dict
  toggle: () => void
}

const Ctx = createContext<LangCtx>({ lang: 'zh', t: translations.zh, toggle: () => {} })

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>('zh')
  const value: LangCtx = {
    lang,
    t: translations[lang],
    toggle: () => setLang((l) => (l === 'zh' ? 'en' : 'zh')),
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useLanguage = () => useContext(Ctx)
