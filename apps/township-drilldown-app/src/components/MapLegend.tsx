import { typography as __ty, components as C } from "../lib/styleDictionary";
const S = __ty.sizes; // type scale:字級一律具名(見 styleDictionary)
import { useTokens } from "../lib/useTokens";
import { useLanguage } from "../state/LanguageContext";
import { dataLevelOf, type View } from "../lib/nav";
import { resolveMetric, REGIONS, type Meta } from "../lib/data";
import { metricLabel, metricUnit, regionLabel } from "../lib/metricI18n";
import { formatParen } from "../lib/i18n";
import { xToIndicator, type ColorKey } from "../lib/scatterChannels";
import { regionColor } from "../lib/scales";

// 地圖顏色圖例（原內嵌於 Choropleth，抽出改橫向精簡列，置於地圖下方）。
// 級距依當前層級（縣/鄉鎮/村里）取，與地圖著色同一來源（老師 8/11 回饋:改吃「顏色」通道）。
export default function MapLegend({ meta, colorChannel, view }: { meta: Meta; colorChannel: ColorKey; view: View }) {
  const t = useTokens();
  const { lang, tr } = useLanguage();
  const level = dataLevelOf(view);
  const fmtBreak = (b: number) => (b >= 100 ? b.toFixed(0) : b.toFixed(1));
  // v10(使用者):標題(變數+單位)獨立一行置頂,級距色塊列在下方 flex-wrap;色塊與數值垂直置中
  if (colorChannel === "region") {
    return (
      <div className="map-legend">
        <div style={{ fontWeight: 600, color: t.text, fontSize: S.caption, marginBottom: 6 }}>{tr.regionChannelLabel}</div>
        <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", alignItems: "center",
          columnGap: 14, rowGap: 6, fontSize: S.footnote, color: t.textMuted }}>
          {REGIONS.map((rg) => (
            <span key={rg} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 14, height: 14, background: regionColor(rg, t.categorical), display: "inline-block", borderRadius: C.swatch.radius, flexShrink: 0 }} />
              <span>{regionLabel(rg, lang)}</span>
            </span>
          ))}
        </div>
      </div>
    );
  }
  const { indicator, deathCause } = xToIndicator(colorChannel);
  const ind = resolveMetric(meta, indicator, deathCause);
  const breaks = ind.breaksByLevel[level] ?? ind.breaks;
  return (
    <div className="map-legend">
      <div style={{ fontWeight: 600, color: t.text, fontSize: S.caption, marginBottom: 6 }}>
        {formatParen(metricLabel(ind.key, ind.label, lang), metricUnit(ind.key, ind.unit, lang), lang)}
      </div>
      <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", alignItems: "center",
        columnGap: 14, rowGap: 6, fontSize: S.footnote, color: t.textMuted }}>
        {t.densityScale.map((c: string, i: number) => {
          const lo = i === 0 ? "min" : fmtBreak(breaks[i - 1]);
          const hi = i === breaks.length ? "max" : fmtBreak(breaks[i]);
          return (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 14, height: 14, background: c, display: "inline-block", borderRadius: C.swatch.radius, flexShrink: 0 }} />
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{lo}–{hi}</span>
            </span>
          );
        })}
        {level === "village" && indicator === "density" && (
          <span style={{ color: t.textMuted }}>{tr.censusSnapshotNote}</span>
        )}
      </div>
    </div>
  );
}
