import { useAppState } from "../state/AppStateContext";
import { useTheme } from "../state/ThemeContext";
import { useLanguage } from "../state/LanguageContext";
import {
  METRICS, sizeTicks, makeRadiusScale, legendRadiusRange, metricLabel, TEAL_RAMP, TEAL_RAMP_DARK, type MetricKey,
} from "../lib/channels";
import { REGION_COLORS, REGION_COLORS_DARK } from "../lib/regionColors";
import type { Region } from "../data/types";

// U5:圖例移出圖表本體,改成頂部控制列左側的一般 flex 子元素(不再絕對定位浮在圖上)。
// 大小=嵌套同心圓;顏色連續=色階色條(min/max 標籤);顏色=區域時改渲染洲別色點列(見下方 region-legend)。
// 8/4 語言切換:洲別標籤改從 i18n Dict 取(t.regions),不再本地寫死中文——
// 跟 CountryChecklist.tsx 共用同一份翻譯,不會兩邊分開改到不一致。
const REGION_ORDER: Region[] = ["asia", "europe", "africa", "americas", "oceania"];

// 圖例用的同心圓半徑範圍比照鄉鎮版縮小(比圖表本體小很多),
// 純粹是圖例插圖尺寸,與圖表上實際泡泡大小的視覺映射無關,只求塞進控制列列高、標籤不被裁。
// U5 二次回饋(使用者截圖抓到標籤疊圓圈上方擠成一團):最大半徑收到 12-14px 這個量級。
// U7:圖表本體 rScale 從 [5,56] 放大(原 [3,40] 的 1.4 倍),圖例同比例放大維持
// 「圖例圓相對比例＝圖表泡泡相對比例」的視覺語意,[2.5,13]→[3.5,18]。
// U21:各指標的 sizeRange 不再共用同一組(見 channels.ts),圖例範圍改在元件內用
// legendRadiusRange 依目前選的「大小」通道動態算出——population 情境算出的範圍
// 與原本寫死的 [3.5,18] 幾乎一致(不讓既有圖例明顯跳動),窄定義域指標(lifeExpectancy/
// childMortality/fertility)算出的範圍會明顯縮小,符合「圖表泡泡差異小、圖例圓也該跟著小」
// 的直覺。

// U21 後每個指標的圖例半徑不再共用同一組(窄定義域指標的圓明顯縮小)——但若 SVG 版面
// 尺寸(含高度)也跟著指標變動,切換「大小」通道時整條控制列的高度會忽大忽小,使用者
// 截圖抓到這個問題(8/3)。修法:版面尺寸固定取「所有指標中最大」的圖例半徑計算,
// 不隨目前選的指標而變;圓圈本身仍用該指標自己的 rMax 繪製(U21 的縮小效果不受影響),
// 只是底部基線與外框寬高改成固定錨點,窄定義域指標的圓會在同一個固定版面裡偏小。
const FIXED_LEGEND_R_MAX = Math.max(
  ...Object.values(METRICS).map((m) => legendRadiusRange(m.sizeRange)[1])
);

export function ScatterLegends() {
  const { state } = useAppState();
  const { dark } = useTheme();
  const { lang, t } = useLanguage();
  const regionColors = dark ? REGION_COLORS_DARK : REGION_COLORS;
  const sizeMetric = METRICS[state.channels.size];
  const chartRange = sizeMetric.sizeRange;
  const LEGEND_R_RANGE = legendRadiusRange(chartRange);
  const rScale = makeRadiusScale(state.channels.size, LEGEND_R_RANGE);

  // 代表值+版面:比照鄉鎮版 township-drilldown-app 的 Scatter.tsx——「文字在左→
  // 嵌套同心圓(底對齊)→引線+數值標籤在右」,標籤絕不疊在圓圈正上方。
  // LG_BASE=圓底部共同基線,用固定的 FIXED_LEGEND_R_MAX 算,不用目前指標自己的 rMax
  // (見上方 U21 後續修正註解);上方留 10px 給最大圓引線標籤(貼頂會被裁)。
  const LG_BASE = FIXED_LEGEND_R_MAX * 2 + 10;
  const lgTop = (v: number) => LG_BASE - 2 * rScale(v);
  // 收斂邏輯不綁死 3 個值的情況——不論 sizeTicks 原生回幾個值(例如「大小=人均所得」
  // 只有 2 個代表值 [100000, 200000],引線 y 間距 ~7.9px,一樣會擠疊),逐一檢查相鄰
  // tick 的引線 y 差:<12px 就收斂,3 值先退到只留頭尾兩值,若那兩值仍太擠(或起點就
  // 只有 2 值)再退到只留最大值一個代表值。
  let ticks = sizeTicks(sizeMetric.domain);
  while (ticks.length > 1) {
    const tooClose = ticks.some((v, i) => i > 0 && lgTop(ticks[i - 1]) - lgTop(v) < 12);
    if (!tooClose) break;
    ticks = ticks.length > 2 ? [ticks[0], ticks[ticks.length - 1]] : [ticks[ticks.length - 1]];
  }
  // 寬度同樣固定用 FIXED_LEGEND_R_MAX 算(不用目前指標的 rMax):population 情境下
  // 這是剛好塞滿的寬度,窄定義域指標的實際圓更小,固定寬度只是留白略多,不會被裁。
  const LG_W = FIXED_LEGEND_R_MAX * 2 + 8 + 36; // 圓 + 引線 + 數值標籤寬度

  const colorIsMetric = state.channels.color !== "region";
  const colorMetric = colorIsMetric ? METRICS[state.channels.color as MetricKey] : null;

  return (
    // 老師 8/3 回饋:圖例大小樣式比照 township-drilldown-app 的 Scatter.tsx 圖例——
    // 整體字級 11→12(對齊該版樣式字典 S.small)、色點 8×8→12×12(對齊 C.dot.radius 圓點
    // 視覺份量)、區域項目間距 gap-2(8px)→gap-3(12px)、外層列距 gap-8(32px)→gap-7(28px)
    // (對齊該版 legend-row 的 columnGap:28)。
    // whiteSpace nowrap:8/4 實測窄寬度時「亞洲」「大小（總人口）」等文字會被壓到逐字換行,
    // 保證圖例組自己絕不斷行(換行單位是整組,見 App.tsx 控制列的 flex-wrap)。
    <div className="flex flex-row items-center gap-7"
      style={{ fontSize: 12, color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
      {colorMetric && (
        <div className="color-bar flex items-center gap-1">
          <span>{colorMetric.format(colorMetric.domain[0])}</span>
          <div style={{
            width: 72, height: 8, borderRadius: 4,
            background: `linear-gradient(to right, ${(dark ? TEAL_RAMP_DARK : TEAL_RAMP).join(",")})`,
          }} />
          <span>{colorMetric.format(colorMetric.domain[1])}</span>
          <span style={{ marginLeft: 2 }}>{metricLabel(state.channels.color as MetricKey, lang)}</span>
        </div>
      )}
      {!colorMetric && (
        <div className="region-legend flex items-center gap-3">
          {REGION_ORDER.map((region) => (
            <div key={region} className="flex items-center gap-1">
              <span style={{
                display: "inline-block", width: 12, height: 12, borderRadius: "50%",
                background: regionColors[region],
              }} />
              <span>{t.regions[region]}</span>
            </div>
          ))}
        </div>
      )}
      {/* 大小圖例:指標名在左、嵌套同心圓(底對齊,大圓在外)置中、引線+代表值標籤在右
          (比照鄉鎮版緊湊橫式畫法)。同一把 rScale,值一定落在 domain 內(sizeTicks 保證)。 */}
      <div className="flex items-center gap-2">
        <span>{t.sizeLegendPrefix}{metricLabel(state.channels.size, lang)}{t.sizeLegendSuffix}</span>
        <svg width={LG_W} height={LG_BASE + 2} aria-label={t.sizeLegendAriaLabel}>
          {ticks.map((v) => {
            const r = rScale(v);
            const ty = lgTop(v);
            // 圓心/引線起點固定在 FIXED_LEGEND_R_MAX(不用該指標自己的 rMax):
            // 版面錨點固定,窄定義域指標的圓自然偏小、偏左,但整條列的高寬不會變動。
            return (
              <g key={v}>
                <circle cx={FIXED_LEGEND_R_MAX} cy={LG_BASE - r} r={r}
                  fill="none" stroke="var(--color-text-muted)" strokeWidth={1} />
                <line x1={FIXED_LEGEND_R_MAX} y1={ty} x2={FIXED_LEGEND_R_MAX + r + 8} y2={ty}
                  stroke="var(--color-text-muted)" strokeWidth={0.75} />
                <text x={FIXED_LEGEND_R_MAX + r + 10} y={ty + 3} textAnchor="start" fontSize={10}
                  fill="var(--color-text-muted)">{sizeMetric.format(v)}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
