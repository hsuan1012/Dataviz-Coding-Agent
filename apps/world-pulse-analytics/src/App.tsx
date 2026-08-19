import type { CSSProperties } from "react";
import countriesData from "./data/countries.json";
import gapminderData from "./data/gapminder.json";
import type { CountryMeta, YearRecord } from "./data/types";
import { AppStateProvider, useAppState } from "./state/AppStateContext";
import { ThemeProvider, useTheme } from "./state/ThemeContext";
import { LanguageProvider, useLanguage } from "./state/LanguageContext";
import { CountryChecklist } from "./components/CountryChecklist";
import { BubbleChart } from "./components/BubbleChart";
import { ChannelControls, ChannelDropdowns } from "./components/ChannelControls";
import { TimeControls } from "./components/TimeControls";
import { WorldGlobe } from "./components/WorldGlobe";
import { RacingBarChart } from "./components/RacingBarChart";
import { ScatterLegends } from "./components/ScatterLegends";
import { metricLabel, type MetricKey } from "./lib/channels";

const countries = countriesData as CountryMeta[];
const records = gapminderData as YearRecord[];

const panelCardStyle: CSSProperties = {
  background: "var(--color-surface)",
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  boxShadow: "0 8px 30px -14px rgba(15, 27, 45, 0.25)",
};

// 深色模式切換鈕:功能對齊 township-drilldown-app 的 useTokens().toggle
// (純 useState,不持久化、不讀 prefers-color-scheme,見 ThemeContext.tsx)。
// 浮在地球儀卡片右上角(absolute,父層需 position:relative)。
function DarkModeToggle() {
  const { dark, toggle } = useTheme();
  const { t } = useLanguage();
  // 樣式對齊 ChannelControls.tsx 的 btn(active)——同一顆「青綠膠囊」互動語言。
  // 用 aria-pressed 而非只靠 inline style,才吃得到 index.css 的
  // .scatter-select-toggle[aria-pressed="false"] 那組 !important 規則
  // (未啟用時的淡綠底、hover/active 過渡),不然視覺會跟「選取」等按鈕不一致。
  return (
    <button
      className="scatter-select-toggle"
      aria-pressed={dark}
      onClick={toggle}
      style={{
        // 老師 8/4 回饋:與「使用說明」按鈕列高度不齊。實測 ChannelControls 那排
        // items-center 因跟大小圖例(47.8px)置中,把「使用說明」按鈕往下推了 9.15625px,
        // 這裡的 top 要跟著加回來,兩顆鈕頂邊才真正切齊(見 App.tsx 量測紀錄)。
        position: "absolute", top: 21.15625, right: 12, zIndex: 10,
        fontSize: 13, padding: "4px 14px", borderRadius: 999, fontFamily: "inherit",
        cursor: "pointer", transition: "background .15s, border-color .15s, color .15s",
        border: `1px solid ${dark ? "var(--accent)" : "var(--color-border)"}`,
        background: dark ? "var(--accent)" : "var(--color-surface)",
        color: dark ? "var(--accent-fg)" : "var(--color-text)",
      }}
    >
      {dark ? t.lightMode : t.darkMode}
    </button>
  );
}

// 8/4 使用者要求:語言切換鈕,樣式大小完全比照「選取」按鈕(同一顆 scatter-select-toggle
// 膠囊語言)——放在標題文字「資料視覺化 · 全球指標」旁邊。中文模式顯示「English」
// (提示切去英文)、英文模式顯示「中文」(提示切回中文),文字本身就是「按下去會變成的
// 語言」,不用額外圖示。
function LanguageToggle() {
  const { lang, t, toggle } = useLanguage();
  return (
    <button
      className="scatter-select-toggle"
      aria-pressed={lang === "en"}
      onClick={toggle}
      style={{
        fontSize: 13, padding: "4px 14px", borderRadius: 999, fontFamily: "inherit",
        cursor: "pointer", transition: "background .15s, border-color .15s, color .15s",
        border: `1px solid ${lang === "en" ? "var(--accent)" : "var(--color-border)"}`,
        background: lang === "en" ? "var(--accent)" : "var(--color-surface)",
        color: lang === "en" ? "var(--accent-fg)" : "var(--color-text)",
      }}
    >
      {lang === "zh" ? t.langToggleToEn : t.langToggleToZh}
    </button>
  );
}

// 排名卡區:四張連動(X/Y/顏色/大小各一張),顏色=區域時該格改顯示無排名數值的說明。
function RankRow({ countries, records }: { countries: CountryMeta[]; records: YearRecord[] }) {
  const { state } = useAppState();
  const { lang, t } = useLanguage();
  const ch = state.channels;
  const card = (key: MetricKey, prefix: string) => (
    <RacingBarChart
      key={prefix}
      title={`${prefix}(${metricLabel(key, lang)})${t.rankTop5Suffix}`}
      countries={countries}
      records={records}
      metric={key}
    />
  );
  return (
    <div
      className="grid grid-cols-4 gap-2 rounded-lg p-2 h-full"
      style={{ background: "color-mix(in srgb, var(--color-border) 35%, transparent)" }}
    >
      {card(ch.x, t.rankPrefixX)}
      {card(ch.y, t.rankPrefixY)}
      {ch.color === "region" ? (
        <div className="rounded-lg shadow-sm p-2 h-full flex flex-col" style={{ background: "var(--color-surface)" }}>
          <h3 className="text-sm font-bold mb-1 truncate shrink-0" style={{ color: "var(--color-text)" }}>{t.colorByRegionCardTitle}</h3>
          <div className="flex-1 flex items-center justify-center text-xs"
            style={{ color: "var(--color-text-muted)" }}>{t.colorByRegionNoRank}</div>
        </div>
      ) : card(ch.color as MetricKey, t.rankPrefixColor)}
      {card(ch.size, t.rankPrefixSize)}
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
    <ThemeProvider>
    <AppStateProvider countries={countries}>
      <AppShell />
    </AppStateProvider>
    </ThemeProvider>
    </LanguageProvider>
  );
}

function AppShell() {
  const { t } = useLanguage();
  return (
      <div className="app-root h-screen w-full flex flex-col overflow-hidden p-4" style={{ background: "var(--color-bg)" }}>
        {/* 標題區：固定高度，不佔用主視覺區的寶貴空間；四通道下拉比照鄉鎮圖集放在標題列最右側 */}
        <div className="shrink-0 mb-3 flex flex-row items-end justify-between gap-4">
          <div>
            {/* 8/4 使用者要求:語言切換鈕放在「資料視覺化 · 全球指標」這行字旁邊 */}
            <div className="flex flex-row items-center gap-3">
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--accent)",
                  fontWeight: 600,
                }}
              >
                {t.headerEyebrow}
              </p>
              <LanguageToggle />
            </div>
            <h1
              style={{
                margin: "2px 0 0",
                fontFamily: "var(--font-serif)",
                fontSize: 32,
                fontWeight: 600,
                letterSpacing: "-0.01em",
                color: "var(--color-text)",
              }}
            >
              {t.headerTitle}
            </h1>
          </div>
          <ChannelDropdowns />
        </div>

        {/* 主要內容區：左側清單／中央（泡泡圖＋競賽長條圖）／右側地球儀，三者並排佔滿剩餘高度 */}
        <div className="charts-row flex-1 flex flex-row gap-4 min-h-0 mb-4">
          {/* 使用者 8/4 回饋:CountryChecklist 拆出固定不捲動的搜尋/年份/全選區塊後,
              這裡外層 aside 自己的 overflow-y-auto 就多餘了——兩層各自的捲動容器疊在
              一起,把搜尋框擠歪、也讓卡片圓角裁切跟著壞掉(跟地球儀卡片同一類問題,
              見下方 overflow:hidden 註解)。改成單純的 flex 容器,捲動完全交給
              CountryChecklist 內層自己那個 .app-scroll 處理。 */}
          <aside
            className="h-full min-h-0 flex flex-col shrink-0"
            style={{ ...panelCardStyle, width: 190, overflow: "hidden" }}
          >
            <CountryChecklist countries={countries} />
          </aside>

          <div className="flex-1 flex flex-col gap-4 min-w-0 min-h-0">
            <div className="flex-1 min-h-0 flex flex-col" style={panelCardStyle}>
              {/* U5:頂部控制列——圖例(左)與選取/清除鈕(右)整合成獨立一列,和下方繪圖區徹底分開
                  (比照鄉鎮圖集散布圖版面)。
                  老師 8/3 回饋按鈕偏下:量測發現大小圖例的同心圓 SVG(47.8px)比按鈕列
                  (29.5px)高很多,items-end 貼底對齊時,按鈕的視覺中心比圖例矮小內容的
                  視覺中心低了 9px。改 items-center 讓兩邊以同一個列高置中,量測後兩者
                  中心完全對齊。
                  老師 8/3 再回饋:拿掉底線(border-b border-gray-100),不要控制列與繪圖區
                  之間的分隔線。
                  8/4 實測 1366px 寬筆電:圖例與按鈕組原本被 justify-between 硬擠在同一行,
                  空間不夠時兩邊各自的文字(「亞洲」「選取」等)被壓到逐字換行,很醜。改
                  flex-wrap,空間不夠時讓「圖例」「按鈕組」整組換到下一行(維持組內單行),
                  不會影響空間夠時(桌機)的原樣。 */}
              <div className="flex flex-row flex-wrap justify-between items-center w-full pb-4 mb-2 px-3 pt-3 shrink-0"
                style={{ rowGap: 8 }}>
                <ScatterLegends />
                <ChannelControls />
              </div>
              <div className="flex-1 w-full min-h-0">
                <BubbleChart countries={countries} records={records} />
              </div>
            </div>
            <div className="h-48 shrink-0">
              <RankRow countries={countries} records={records} />
            </div>
          </div>

          {/* 使用者 8/4 回饋:卡片下緣圓角看得到、上緣卻是直角——地球儀的 canvas 本身是
              globe.gl 設定過 backgroundColor 的不透明矩形,填滿容器到邊緣,卡片(aside)
              本身沒有 overflow:hidden,canvas 的直角自然蓋過卡片圓角的裁切範圍;下緣
              剛好是純文字說明(沒有不透明矩形背景),所以圓角才「看起來」正常。加
              overflow:hidden 讓卡片真的裁切住裡面的 canvas。 */}
          <aside className="w-1/3 h-full min-h-0 flex flex-col" style={{ ...panelCardStyle, overflow: "hidden" }}>
            <div className="relative flex-1 min-h-0">
              {/* 老師 8/3 回饋:地球儀右上角加深色模式切換鈕,功能對齊
                  township-drilldown-app 的深色模式(見 ThemeContext.tsx)。 */}
              <DarkModeToggle />
              <WorldGlobe countries={countries} records={records} />
            </div>
            {/* 老師 8/3 回饋:南極洲/格陵蘭等 10 個裝飾地形(灰色、不可點選)要在地球儀下方
                說明,不是留給使用者自己猜「這塊灰色是什麼」。 */}
            <p className="shrink-0 px-3 pb-2" style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
              {t.decorativeNote}
            </p>
          </aside>
        </div>

        {/* 全局時間軸：固定貼在畫面最下方，不會被上方內容擠出視窗 */}
        <div className="shrink-0 w-full" style={panelCardStyle}>
          <TimeControls />
        </div>
      </div>
  );
}
