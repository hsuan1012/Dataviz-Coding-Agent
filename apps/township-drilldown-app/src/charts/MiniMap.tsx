import { typography as __ty, components as C } from "../lib/styleDictionary";
const S = __ty.sizes; // type scale:字級一律具名(見 styleDictionary)
import { useMemo } from "react";
import * as d3 from "d3";
import { useTokens } from "../lib/useTokens";
import { splitFeatures, inTaiwanBox, insetFitFeatures, countyOf } from "../lib/counties";
import { INSET_BOXES } from "../lib/insetBoxes.js";

// 迷你台灣地圖(關係頁連動):沿用主地圖同一套 viewBox 800×900 座標與金馬 inset 邏輯。
// 7/22 升級(spec: 2026-07-22-minimap-linked-interactive):
// 等高(height 由 Scatter 量測散布圖實高傳入)、塗色跟隨泡泡顏色通道(fillMap)、
// 點任一鄉鎮=toggle 整縣(onToggleCounty)、懸停=縣市預覽(onHoverCounty,不改名單)。
const W = 800, H = 900;

export default function MiniMap({ geo, selected, onClear, fillMap, height, hoverCounty, onHoverCounty, onToggleCounty }: {
  geo: GeoJSON.FeatureCollection;
  selected: string[] | null;
  onClear: () => void;
  fillMap: Map<string, string>;
  height: number;
  hoverCounty: string | null;
  onHoverCounty: (c: string | null) => void;
  onToggleCounty: (c: string) => void;
}) {
  const t = useTokens();
  const selSet = useMemo(() => (selected ? new Set(selected) : null), [selected]);
  const { main, insets } = useMemo(() => splitFeatures(geo.features), [geo]);
  const mainPath = useMemo(() => {
    const proj = d3.geoMercator().fitSize([W, H],
      { type: "FeatureCollection", features: main.filter(inTaiwanBox) } as any);
    return d3.geoPath(proj);
  }, [main]);
  const insetPaths = useMemo(() => insets.map((ins, i) => {
    const B = INSET_BOXES[i];
    const proj = d3.geoMercator().fitExtent(
      [[B.x + 10, B.y + 24], [B.x + B.w - 10, B.y + B.h - 10]],
      { type: "FeatureCollection", features: insetFitFeatures(geo.features, ins.county) } as any);
    return { ins, B, path: d3.geoPath(proj) };
  }), [insets, geo]);

  const mapW = Math.max(220, Math.round((height * W) / H));
  const name = (f: GeoJSON.Feature) => (f.properties as any).FULLNAME as string;
  const isSel = (f: GeoJSON.Feature) => selSet?.has(name(f)) ?? false;
  const town = (f: GeoJSON.Feature, d: string | null) => {
    const c = countyOf(f);
    const sel = isSel(f), hov = hoverCounty === c;
    return (
      <path key={name(f)} className="mini-town" data-sel={sel ? "1" : "0"}
        data-county={c} data-hover={hov ? "1" : "0"}
        d={d ?? ""}
        fill={fillMap.get(name(f)) ?? t.border}
        fillOpacity={selSet && !sel ? 0.15 : 1}
        stroke={hov ? t.text : sel ? t.accent : t.surface}
        strokeWidth={hov ? 1.2 : sel ? 0.9 : 0.4}
        style={{ cursor: "pointer" }}
        onClick={() => onToggleCounty(c)}
        onMouseEnter={() => onHoverCounty(c)} />
    );
  };

  // 說明文字拆成兩句、各自成行(使用者 7/22:原單行換行會孤字,改平均兩行)
  const hintLines = selected
    ? ["點地圖可整縣加入或移出；雙擊散布圖泡泡可將它移出選取。", "切換年份或通道，名單都會保留；點散布圖空白處或「清除」鈕還原。"]
    : ["在左側散布圖空白處拖曳框選，或點地圖任一縣市整縣加入。", "選取的鄉鎮會同步標示在這裡。"];

  return (
    <div className="minimap-col" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: "0 0 auto" }}>
      <svg className="mini-map" viewBox={`0 0 ${W} ${H}`} width={mapW} height={height}
        aria-label="鄉鎮位置與縣市選取" role="img"
        onMouseLeave={() => onHoverCounty(null)}>
        {main.map((f) => town(f, mainPath(f as any)))}
        {insetPaths.map(({ ins, B, path }) => (
          <g key={ins.county}>
            <rect x={B.x} y={B.y} width={B.w} height={B.h} fill="none"
              stroke={t.border} strokeDasharray="4 3" rx={6} />
            {/* 用 insetFitFeatures（同 fit 排除集合）而非 ins.features：烏坵鄉不在 fit 內卻仍被畫，
                會投影到框外、疊在主圖上（越框 blob）。這裡沒有主圖 Choropleth 的 clipPath 可擋，
                最小修法＝跟著 fit 一起排除烏坵，縮圖本就不必顯示它（同 check-inset-collision 教訓）。 */}
            {insetFitFeatures(geo.features, ins.county).map((f) => town(f, path(f as any)))}
          </g>
        ))}
      </svg>
      {/* 操作說明:未選取教「怎麼開始」,已選取教「接下來能做什麼」
          (verify-brush-play 斷言:未選含「框選」、已選含「保留」,措辭改動須保留關鍵詞) */}
      {/* 7/23 使用者指定:與散布圖白話解說同規格(12.5/行高1.7/靠左、寬=圖寬);
          7/24 使用者指定:「已選 N 鄉鎮+清除鈕」獨立一行、與上方文字左對齊
          (7/23 的句尾同段內排在句子加長後必換行,縮排 8px 反成錯位) */}
      <p className="mini-hint" style={{ margin: 0, width: mapW, fontSize: S.caption, lineHeight: 1.7,
        color: t.textMuted, textAlign: "left" }}>
        <span style={{ display: "block" }}>{hintLines[0]}</span>
        <span style={{ display: "block" }}>{hintLines[1]}</span>
        <span style={{ display: "block" }}>
          <span className="mini-count">已選 {selected?.length ?? 0} 鄉鎮</span>
          {selected && (
            <button className="mini-clear" onClick={onClear}
              style={{ cursor: "pointer", fontSize: S.caption, padding: "3px 14px", borderRadius: C.button.radius,
                border: "none", background: t.accent, color: "#fff", fontWeight: 600,
                marginLeft: 8, verticalAlign: "baseline" }}>
              清除
            </button>
          )}
        </span>
      </p>
    </div>
  );
}
