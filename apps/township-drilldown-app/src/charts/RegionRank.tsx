import { typography as __ty, components as C } from "../lib/styleDictionary";
const S = __ty.sizes; // type scale:字級一律具名(見 styleDictionary)
import { useEffect, useState } from "react";
import { useTokens } from "../lib/useTokens";
import { useLanguage } from "../state/LanguageContext";
import { romanizePlaceName } from "../lib/placeName";
import { metricLabel } from "../lib/metricI18n";
import { formatParen } from "../lib/i18n";
import {
  townScopeTop, nationTop, rankMaxTown, villageValue, resolveMetric, scatterVars,
  type Values, type Meta, type IndicatorKey, type RankRow, type VillageProps, type ScatterKey,
} from "../lib/data";
import { regionColor as _rc } from "../lib/scales";
import type { View } from "../lib/nav";
import type { ScatterChannels } from "../lib/scatterChannels";

const fmt = (v: number) => (v >= 1000 ? Math.round(v).toLocaleString() : v.toFixed(1));

// 動畫排名清單：每列＝名字＋數值一行、滿寬長條一行。
// 長條寬度 transition 伸縮；名次以 translateY 上下平滑移動（切年份時）。
// 以 township 為 key → 留任的列平滑重排，新入榜者於定位出現。
// compact(合併單頁底列卡片):列高/長條/字級縮小,輔助視覺不喧賓奪主。
function RankList({ rows, max, stripPrefix, compact }: {
  rows: RankRow[]; max: number; stripPrefix?: string; compact?: boolean;
}) {
  const t = useTokens();
  const { lang, tr } = useLanguage();
  const ROW_H = compact ? 24 : 32;
  const BAR_H = compact ? 5 : 9;
  const nameFz = compact ? S.footnote : S.small;
  const valFz = compact ? S.note : S.footnote;
  // 「長條從 0 長出」：首次有資料列時，先以 0 寬渲染，下一影格再設目標寬 → 重用既有 width transition。
  // 觸發點綁在「列首次出現」而非面板掛載，因村里層資料是 lazy load、晚於面板掛載才抵達；
  // 若綁掛載，村里長條出現時動畫早已結束、會瞬間滿寬。RankList 隨面板 key 於下鑽切層時重新掛載，
  // grown 歸零 → 每次下鑽都重播；切年份時列不重掛載、grown 保持 true，寬度變化仍由同一條 transition 補間。
  const prefersReduced = typeof window !== "undefined"
    && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [grown, setGrown] = useState(prefersReduced); // reduce → 直接定寬、不長出
  const hasRows = rows.length > 0;
  useEffect(() => {
    if (!hasRows || grown) return;
    // 雙重 rAF：先讓瀏覽器繪出 0 寬那一影格，下一影格再設目標寬，CSS width transition 才會觸發。
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setGrown(true)));
    return () => cancelAnimationFrame(raf);
  }, [hasRows, grown]);
  return (
    <div style={{ position: "relative", height: Math.max(rows.length, 1) * ROW_H }}>
      {rows.map((r, i) => {
        const label = romanizePlaceName(stripPrefix ? r.township.replace(stripPrefix, "") : r.township, lang);
        const pct = max > 0 ? Math.max((r.value / max) * 100, 1) : 0;
        return (
          <div key={r.township}
            style={{ position: "absolute", left: 0, right: 0, top: 0, height: ROW_H,
              transform: `translateY(${i * ROW_H}px)`, transition: "transform .6s cubic-bezier(.4,0,.2,1)" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: compact ? 2 : 3 }}>
              <span style={{ width: 14, fontSize: S.note, textAlign: "right", color: t.textMuted,
                fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{i + 1}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: nameFz, whiteSpace: "nowrap", overflow: "hidden",
                textOverflow: "ellipsis" }} title={r.township}>{label}</span>
              <span style={{ fontSize: valFz, textAlign: "right", color: t.text, fontWeight: 600,
                fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{fmt(r.value)}</span>
            </div>
            <div style={{ marginLeft: 20, height: BAR_H, background: t.surfaceAlt, borderRadius: C.bar.radius, overflow: "hidden" }}>
              <span style={{ display: "block", height: "100%", width: grown ? `${pct}%` : "0%",
                background: _rc(r.region, t.categorical), borderRadius: C.bar.radius,
                transition: "width .6s cubic-bezier(.4,0,.2,1)", transitionDelay: `${i * 40}ms` }} />
            </div>
          </div>
        );
      })}
      {rows.length === 0 && (
        <div style={{ fontSize: S.small, color: t.textMuted, padding: "6px 2px" }}>{tr.noDataLabel}</div>
      )}
    </div>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTokens();
  return (
    <section className="rank-box" style={{ border: `1px solid ${t.border}`, borderRadius: C.panel.radius, padding: "8px 12px 6px",
      background: t.surface }}>
      <div style={{ fontSize: S.control, fontWeight: 700, marginBottom: 6, color: t.text }}>{title}</div>
      {children}
    </section>
  );
}

// 依地圖層級呈現排名：全國=X/Y/顏色/大小四通道各前五；縣內=該縣鄉鎮前五；村里=該區村里前五。
export default function RegionRank({ values, meta, indicator, deathCause, year, view, villages, channels, compact }: {
  values: Values; meta: Meta; indicator: IndicatorKey; deathCause?: string; year: number;
  view: View; villages: GeoJSON.FeatureCollection | null; channels: ScatterChannels; compact?: boolean;
}) {
  const t = useTokens();
  const { lang, tr } = useLanguage();
  const dataKey = resolveMetric(meta, indicator, deathCause).key;   // 死亡率＋死因別時＝該死因 key
  // 層級 key：只在下鑽切層時改變 → 面板重新掛載、重播進場動畫與長條長出；
  // 切年份時 key 不變 → 不重播，維持原有「同批列重排」的年份動畫。
  const levelKey = `${view.level}:${view.county ?? ""}:${view.town ?? ""}`;

  // 全國/縣內共用:X/Y/顏色/大小四通道各自前五,順序同 ScatterControls 下拉。顏色＝區域
  // (分類,無數值)時該格保留版位改顯示提示;各通道數值範圍互不相關,長條尺度(rankMaxTown)
  // 各自獨立算,不能共用一把尺。
  const vars = scatterVars(meta);
  const labelOf = (k: ScatterKey) => metricLabel(k, vars.find((v) => v.key === k)?.label ?? k, lang);
  const chBoxes: { role: string; label: string; dataKey: ScatterKey | null }[] = [
    { role: tr.axisXLabel, label: labelOf(channels.x), dataKey: channels.x },
    { role: tr.axisYLabel, label: labelOf(channels.y), dataKey: channels.y },
    { role: tr.colorChannelLabel, label: channels.color === "region" ? tr.regionChannelLabel : labelOf(channels.color), dataKey: channels.color === "region" ? null : channels.color },
    { role: tr.sizeChannelLabel, label: labelOf(channels.size), dataKey: channels.size },
  ];

  if (view.level === "nation") {
    // 全國層(使用者要求,7/30):四格從「同一指標分北中南東離島」改成「X/Y/顏色/大小四通道各自全國前五」。
    return (
      <div key={levelKey} className="rank-panel-enter rank-grid-nation"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignContent: "start" }}>
        {chBoxes.map((cb) => (
          <Box key={cb.role} title={formatParen(cb.role, cb.label, lang)}>
            {cb.dataKey ? (
              <RankList rows={nationTop(values, meta, cb.dataKey, year, 5)} max={rankMaxTown(values, meta, cb.dataKey)} compact={compact} />
            ) : (
              <div style={{ fontSize: S.small, color: t.textMuted, padding: "4px 2px" }}>{tr.colorChannelRegionNoRank}</div>
            )}
          </Box>
        ))}
      </div>
    );
  }

  if (view.level === "county" && view.county) {
    // 老師 8/11 回饋:下鑽到縣內(鄉鎮區)層級後,排名格也要比照全國層呈現 X/Y/顏色/大小
    // 四通道各自的縣內前五名(原本只有一格、只依 X 軸指標排名)。
    const county = view.county;
    return (
      <div key={levelKey} className="rank-panel-enter rank-grid-nation"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignContent: "start" }}>
        {chBoxes.map((cb) => (
          <Box key={cb.role} title={formatParen(cb.role, cb.label, lang)}>
            {cb.dataKey ? (
              <RankList rows={townScopeTop(values, meta, cb.dataKey, year, county, 5)} max={rankMaxTown(values, meta, cb.dataKey)} stripPrefix={county} compact={compact} />
            ) : (
              <div style={{ fontSize: S.small, color: t.textMuted, padding: "4px 2px" }}>{tr.colorChannelRegionNoRank}</div>
            )}
          </Box>
        ))}
      </div>
    );
  }

  // 村里層：以載入的村里圖資排名（死亡率無村里資料 → 無資料）
  const title = view.town && view.county
    ? romanizePlaceName(view.town.replace(view.county, ""), lang)
    : tr.villageFallbackLabel;
  let rows: RankRow[] = [];
  let max = 0;
  if (villages && indicator !== "death") {
    const vr = villages.features
      .map((f) => {
        const p = f.properties as VillageProps;
        const v = villageValue(p, indicator, year);
        return v === undefined ? null : { township: p.VILLNAME, value: v, region: (meta.regions[view.town!] ?? "北") as RankRow["region"] };
      })
      .filter((x): x is RankRow => x !== null);
    max = vr.reduce((m, r) => Math.max(m, r.value), 0);
    rows = vr.sort((a, b) => b.value - a.value).slice(0, 5);
  }
  return (
    <div key={levelKey} className="rank-panel-enter" style={{ display: "grid", gap: 10, alignContent: "start" }}>
      <Box title={`${title}${tr.villageTopFiveSuffix}`}>
        {indicator === "death"
          ? <div style={{ fontSize: S.small, color: t.textMuted, padding: "4px 2px" }}>{tr.deathRateNoVillageData}</div>
          : <RankList rows={rows} max={max} compact={compact} />}
      </Box>
    </div>
  );
}
