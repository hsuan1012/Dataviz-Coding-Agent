import { typography as __ty, components as C } from "../lib/styleDictionary";
const S = __ty.sizes; // type scale:字級一律具名(見 styleDictionary)
import { useTokens } from "../lib/useTokens";
import { useLanguage } from "../state/LanguageContext";
import { romanizePlaceName } from "../lib/placeName";
import { metricLabel, metricUnit } from "../lib/metricI18n";
import type { EntityInfo, IndicatorInfo } from "../lib/data";

// 迷你趨勢線：102–108 逐年序列＋當前年度圓點。以 viewBox 撐滿卡片寬（橫向並排用）。
function Sparkline({ series, year, color, muted }: { series: [number, number][]; year: number; color: string; muted: string }) {
  const { tr } = useLanguage();
  const W = 110, H = 30, PAD = 3;
  const xs = series.map((p) => p[0]), ys = series.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const X = (x: number) => PAD + (x1 === x0 ? 0.5 : (x - x0) / (x1 - x0)) * (W - 2 * PAD);
  const Y = (y: number) => H - PAD - (y1 === y0 ? 0.5 : (y - y0) / (y1 - y0)) * (H - 2 * PAD);
  const pts = series.map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(" ");
  const cur = series.find((p) => p[0] === year);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-label={tr.trendSparklineAriaLabel} style={{ display: "block", marginTop: 4 }}>
      <polyline points={pts} fill="none" stroke={muted} strokeWidth={1.4} />
      {cur && <circle cx={X(cur[0])} cy={Y(cur[1])} r={3} fill={color} />}
    </svg>
  );
}

function fmt(v: number): string {
  return v >= 1000 ? Math.round(v).toLocaleString() : v.toFixed(1);
}

// 單一指標卡（橫向並排時每張各占等寬一欄）
function Card({ item, year }: { item: IndicatorInfo; year: number }) {
  const t = useTokens();
  const { lang, tr } = useLanguage();
  // entityInfo()(lib/data.ts)產出的 note 是固定的兩種中文字串,語言判斷在 render 端做對照替換,
  // 不改 entityInfo() 簽名(維持純函式+既有測試不變)。
  const NOTE_MAP: Record<string, string> = { "人口普查快照": tr.censusSnapshotNote, "無村里資料（最細至鄉鎮）": tr.noVillageDataNote };
  const label = metricLabel(item.key, item.label, lang);
  return (
    <div className="info-card" style={{ flex: 1, minWidth: 0, padding: "0 10px" }}>
      {/* v13:長標題縮字級+溢出省略,窄欄不重疊 */}
      <div style={{ fontSize: S.note, color: t.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={label}>{label}</div>
      <div style={{ fontSize: S.stat, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: t.text, lineHeight: 1.3 }}>
        {item.value === undefined ? <span style={{ color: t.textMuted, fontSize: S.body, fontWeight: 500 }}>{tr.noDataLabel}</span> : fmt(item.value)}
        {item.value !== undefined && <span style={{ fontSize: S.note, fontWeight: 500, color: t.textMuted, marginLeft: 4 }}>{metricUnit(item.key, item.unit, lang)}</span>}
      </div>
      {item.series && item.series.length > 1 && (
        <Sparkline series={item.series} year={year} color={t.accent} muted={t.textMuted} />
      )}
      {item.note && <div style={{ fontSize: S.note, color: t.textMuted, marginTop: 3 }}>{NOTE_MAP[item.note] ?? item.note}</div>}
    </div>
  );
}

// 當前選取單位（縣/鄉鎮/村里）的三指標資訊面板。
// 橫向版：標題在上、三張指標卡左右等寬並排；置於左欄排名長條下方。
export default function InfoPanel({ info, year }: { info: EntityInfo; year: number }) {
  const t = useTokens();
  const { lang, tr } = useLanguage();
  // v13:h-full 填滿 grid 等高;指標欄改均分格(repeat n 欄),窄欄不重疊
  return (
    <section className="info-panel" aria-label={tr.selectedEntityInfoAriaLabel} style={{ marginTop: 10, height: "100%", boxSizing: "border-box",
      background: t.surface, border: `1px solid ${t.border}`, borderRadius: C.panel.radius, padding: "10px 4px 8px", fontSize: S.small }}>
      <div style={{ fontSize: S.panelTitle, fontWeight: 700, color: t.text, marginBottom: 10, padding: "0 10px" }}>{romanizePlaceName(info.title, lang)}</div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${info.items.length}, minmax(0, 1fr))`, gap: 4, alignItems: "start" }}>
        {info.items.map((item, i) => (
          <div key={item.key} style={{ minWidth: 0, display: "flex" }}>
            {i > 0 && <div style={{ width: 1, alignSelf: "stretch", background: t.border, flexShrink: 0 }} />}
            <Card item={item} year={year} />
          </div>
        ))}
      </div>
    </section>
  );
}
