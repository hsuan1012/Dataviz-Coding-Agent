import { useEffect, useMemo, useState } from "react";
import { hcl } from "d3";
import { useTokens } from "../lib/useTokens";
import { useLanguage } from "../lib/LanguageContext";
import sd from "../lib/styleDictionary.js";
import {
  type GroupNode,
  type Measure,
  type TrendEntity,
  YEARS,
  aggregate,
  countyIndex,
  displayName,
  entityTrend,
  fmtInt,
  isLeaf,
  nodeAtPath,
  searchEntities,
} from "../lib/data";

// 左側欄（預設收合，比照世界平台側欄模式）：
// 搜尋（縣市/鄉鎮/學校＋輸入年份跳學年、臺/台異體字）＋當前層級競速長條圖
// （老師 8/17 回饋②：數值排序＋換年時名次/長條動畫）＋當前選取單位歷年 sparkline（回饋①）。

export interface SidebarProps {
  tree: GroupNode;
  path: string[];
  measure: Measure;
  year: number;
  onNavigate: (path: string[]) => void;
  onYearJump: (year: number) => void;
  onHighlight: (key: string | null) => void;
  trendEntity: TrendEntity | null;
  onSelectTrend: (e: TrendEntity | null) => void;
  stacked?: boolean; // 小螢幕（非視窗貼合）時堆疊在主圖上方
}

interface Row {
  key: string;
  name: string;
  en?: string;
  value: number;
  school: boolean;
  id?: string;
}

// year＝當前學年（使用者 8/17：趨勢圖要標出當前年份點位，播放時跟著移動）
function Sparkline({ entity, measure, year }: { entity: TrendEntity; measure: Measure; year: number }) {
  const t = useTokens();
  const { lang, t: L } = useLanguage();
  const [points, setPoints] = useState<{ year: number; value: number | null }[] | null>(null);

  useEffect(() => {
    let alive = true;
    setPoints(null);
    entityTrend(entity, measure).then((p) => {
      if (alive) setPoints(p);
    });
    return () => {
      alive = false;
    };
  }, [entity, measure]);

  const fs = sd.typography.sizes;
  if (!points) {
    return <div style={{ fontSize: fs.sectionLabel, color: t.textMuted }}>{L.trendLoading}</div>;
  }
  const vals = points.filter((p) => p.value !== null).map((p) => p.value as number);
  if (!vals.length) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const W = 240;
  const H = 56;
  const pad = 4;
  const x = (i: number) => pad + (i / (points.length - 1)) * (W - pad * 2);
  const y = (v: number) => (max === min ? H / 2 : pad + (1 - (v - min) / (max - min)) * (H - pad * 2));
  // 該校不存在的年份（null）留斷點，不硬連線
  const segments: string[] = [];
  let cur: string[] = [];
  points.forEach((p, i) => {
    if (p.value === null) {
      if (cur.length > 1) segments.push(cur.join(" "));
      cur = [];
    } else {
      cur.push(`${x(i)},${y(p.value)}`);
    }
  });
  if (cur.length > 1) segments.push(cur.join(" "));
  const first = points.find((p) => p.value !== null);
  const last = [...points].reverse().find((p) => p.value !== null);
  // 當前學年標記（使用者 8/17）：垂直參考線＋放大點＋數值標籤，換年/播放時平滑移動
  const curIdx = points.findIndex((p) => p.year === year);
  const curPoint = curIdx >= 0 ? points[curIdx] : null;
  const curX = curIdx >= 0 ? x(curIdx) : 0;
  const LABEL_H = 13; // 標籤帶高度（畫布上緣預留，避免與折線重疊）
  const markMove = { transition: "x .25s ease, cx .25s ease, cy .25s ease, x1 .25s ease, x2 .25s ease" } as const;
  // 標籤只放數值（使用者 8/17：年份滑桿/大字已有年份脈絡，不重複）
  const curLabel = curPoint ? (curPoint.value === null ? "—" : fmtInt(curPoint.value)) : "";
  // 標籤置中於當前點、夾在畫布內（估寬：全形≈字級、半形≈0.56 字級）
  const labelW = [...curLabel].reduce((acc, ch) => acc + (ch.charCodeAt(0) > 0x2e80 ? 1 : 0.56) * fs.eyebrow, 0);
  const labelX = Math.max(labelW / 2, Math.min(W - labelW / 2, curX));
  return (
    <div>
      <div style={{ fontSize: fs.sectionLabel, color: t.textMuted, marginBottom: 2 }}>
        {L.trendTitle(displayName(entity, lang), L.measure[measure])}
      </div>
      <svg viewBox={`0 0 ${W} ${H + LABEL_H}`} style={{ width: "100%", display: "block" }} role="img"
        aria-label={L.trendTitle(displayName(entity, lang), L.measure[measure])}>
        {/* 當前學年垂直參考線 */}
        {curPoint && (
          <line x1={curX} x2={curX} y1={LABEL_H} y2={H + LABEL_H - 2} stroke={t.textMuted} strokeWidth={1} strokeDasharray="2,3" opacity={0.6} style={markMove} />
        )}
        <g transform={`translate(0, ${LABEL_H})`}>
          {segments.map((s, i) => (
            <polyline key={i} points={s} fill="none" stroke={t.accent} strokeWidth={2} />
          ))}
          {points.map((p, i) =>
            p.value === null ? null : (
              <circle key={i} cx={x(i)} cy={y(p.value)} r={1.5} fill={t.accent} />
            ),
          )}
          {/* 當前學年放大點 */}
          {curPoint && curPoint.value !== null && (
            <circle cx={curX} cy={y(curPoint.value)} r={3.5} fill={t.accent} stroke={t.surface} strokeWidth={1.5} style={markMove} />
          )}
        </g>
        {/* 當前學年數值標籤（頂端標籤帶，夾在畫布內） */}
        {curPoint && (
          <text x={labelX} y={fs.eyebrow - 1} textAnchor="middle" fill={t.accent}
            style={{ fontSize: fs.eyebrow, fontFamily: sd.typography.fontFamily, fontVariantNumeric: "tabular-nums", fontWeight: sd.typography.weights.bold, ...markMove }}>
            {curLabel}
          </text>
        )}
      </svg>
      {/* 首末端點字級縮小（使用者 8/17：eyebrow=type scale 最小級） */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: fs.eyebrow, color: t.textMuted, fontVariantNumeric: "tabular-nums" }}>
        <span>{first?.year}：{fmtInt(first?.value ?? 0)}</span>
        <span>{last?.year}：{fmtInt(last?.value ?? 0)}</span>
      </div>
    </div>
  );
}

export default function Sidebar({
  tree, path, measure, year, onNavigate, onYearJump, onHighlight, trendEntity, onSelectTrend, stacked = false,
}: SidebarProps) {
  const t = useTokens();
  const { lang, t: L } = useLanguage();
  const fs = sd.typography.sizes;
  const [query, setQuery] = useState("");
  // 年份輸入框（比照世界平台獨立欄位）：輸入中允許不完整值，值有效（103–114）即跳年
  const [yearInput, setYearInput] = useState(String(year));
  useEffect(() => {
    setYearInput(String(year)); // 滑桿/播放改年時同步
  }, [year]);
  const handleYearInput = (raw: string) => {
    setYearInput(raw);
    const y = Number(raw);
    if (/^\d{3}$/.test(raw) && YEARS.includes(y)) onYearJump(y);
  };

  const rows: Row[] = useMemo(() => {
    const current = nodeAtPath(tree, path);
    const list = current.children.map((c): Row => {
      if (isLeaf(c)) return { key: `s:${c.id}`, name: c.name, en: c.en, value: c[measure], school: true, id: c.id };
      const key = path.length === 0 ? c.name : `${path[0]}/${c.name}`;
      return { key, name: c.name, en: c.en, value: aggregate(c)[measure], school: false };
    });
    // 全層級量值排序（老師 8/17 回饋②競速長條圖：名次要隨年份跑動，
    // 縣市層原 8/14 的地理排序讓位給數值排名）
    return list.sort((a, b) => b.value - a.value);
  }, [tree, path, measure]);
  const maxValue = rows.length ? Math.max(...rows.map((r) => r.value)) : 1;

  // 競速長條的列高與換年動畫時長（top/width 同步過渡；key 穩定 → FLIP 名次移動）
  const ROW_H = 30;
  const RACE_MS = 550;
  // 長條底色＝該列所屬縣市的 LCH 色相（與 treemap 同一把尺）
  const tm = t.treemapLch;
  const barColor = (r: Row): string => {
    const county = path.length === 0 ? r.name : path[0];
    const hue = ((countyIndex.get(county) ?? 0) * 360) / 22;
    return hcl(hue, tm.chroma, tm.stripL).formatHex();
  };

  // 趨勢圖預設實體＝當前下鑽單位（老師 8/17 回饋①）；點選學校時暫以該校覆蓋，
  // 換層級由 App.navigate 清空回落
  const pathEntity = useMemo<TrendEntity>(() => {
    if (path.length === 0) return { type: "nation", county: "", name: "全國", en: "Nationwide" };
    const node = nodeAtPath(tree, path);
    return path.length === 1
      ? { type: "county", county: path[0], name: node.name, en: node.en }
      : { type: "township", county: path[0], township: path[1], name: node.name, en: node.en };
  }, [tree, path]);
  const effectiveTrend = trendEntity ?? pathEntity;

  const results = useMemo(() => searchEntities(tree, query), [tree, query]);

  const rowEntity = (r: Row): TrendEntity =>
    r.school
      ? { type: "school", county: path[0], township: path[1], id: r.id, name: r.name, en: r.en }
      : path.length === 0
        ? { type: "county", county: r.name, name: r.name, en: r.en }
        : { type: "township", county: path[0], township: r.name, name: r.name, en: r.en };

  const rowStyle = { display: "flex", alignItems: "center", gap: 8, width: "100%", background: "none", border: "none", cursor: "pointer", padding: "4px 6px", borderRadius: sd.components.control.radius, fontFamily: sd.typography.fontFamily, color: t.text, textAlign: "left" as const };

  return (
    <aside
      aria-label={L.sidebarAria}
      style={{ width: stacked ? "100%" : 232, maxHeight: stacked ? 340 : undefined, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0, overflowX: "hidden", background: t.surface, border: `1px solid ${t.border}`, borderRadius: sd.spacing.borderRadius, padding: 10, gap: 8 }}
    >
      {/* 樣式對齊世界平台 CountryChecklist 搜尋框：surface 底/border/radius 9/字級 13，
          hover與focus 互動態見 index.css .app-input */}
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={L.searchPlaceholder}
        aria-label={L.searchAria}
        className="app-input"
        style={{ boxSizing: "border-box", width: "100%", padding: "4px 8px", fontSize: fs.axis, fontFamily: sd.typography.fontFamily, color: t.text, background: t.surface, border: `1px solid ${t.border}`, borderRadius: sd.components.control.radius }}
      />
      {/* 年份獨立輸入框（比照世界平台「年份」欄位；與時間軸/播放雙向同步） */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <label htmlFor="year-input" style={{ fontSize: fs.body, color: t.text, flexShrink: 0 }}>
          {L.yearLabel}
        </label>
        {/* 自畫 spinner（使用者 8/17：原生箭頭底色不隨主題且無法自訂 → 透明底自畫，
            底色直接透出輸入框 surface；±1 年、到 103/114 端點停用） */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <input
            id="year-input"
            type="number"
            min={YEARS[0]}
            max={YEARS[YEARS.length - 1]}
            value={yearInput}
            onChange={(e) => handleYearInput(e.target.value)}
            aria-label={L.syAxisAria}
            className="app-input"
            style={{ width: 76, padding: "4px 22px 4px 8px", boxSizing: "border-box", fontSize: fs.axis, fontFamily: sd.typography.fontFamily, fontVariantNumeric: "tabular-nums", color: t.text, background: t.surface, border: `1px solid ${t.border}`, borderRadius: sd.components.control.radius }}
          />
          <div style={{ position: "absolute", right: 5, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {([1, -1] as const).map((d) => {
              const target = year + d;
              const disabled = !YEARS.includes(target);
              return (
                <button
                  key={d}
                  type="button"
                  className="year-spin"
                  tabIndex={-1}
                  disabled={disabled}
                  aria-label={`${L.yearLabel} ${d > 0 ? "+1" : "-1"}`}
                  onClick={() => onYearJump(target)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 14, height: 10, padding: 0, background: "transparent", border: "none", color: t.textMuted, cursor: "pointer" }}
                >
                  <svg width="8" height="5" viewBox="0 0 8 5" aria-hidden focusable="false">
                    <polygon points={d > 0 ? "4,0 8,5 0,5" : "4,5 0,0 8,0"} fill="currentColor" />
                  </svg>
                </button>
              );
            })}
          </div>
        </div>
        <span style={{ fontSize: fs.sectionLabel, color: t.textMuted }}>{L.yearRangeHint}</span>
      </div>
      {query.trim() ? (
        // 搜尋結果（取代排名清單）
        <div className="app-scroll" style={{ overflowY: "auto", overflowX: "hidden", minHeight: 0, flex: 1 }} onMouseLeave={() => onHighlight(null)}>
          {results.length === 0 && (
            <div style={{ fontSize: fs.sectionLabel, color: t.textMuted, padding: 6 }}>{L.noResults}</div>
          )}
          {results.map((r) => (
            <button
              key={`${r.type}:${r.id ?? r.label}`}
              style={rowStyle}
              onMouseEnter={() => r.highlightKey && onHighlight(r.highlightKey)}
              onClick={() => {
                onNavigate(r.path!);
                onHighlight(r.highlightKey ?? null);
                onSelectTrend({
                  type: r.type, county: r.county!, township: r.township, id: r.id, name: r.name, en: r.nameEn,
                });
                setQuery("");
              }}
            >
              <span style={{ fontSize: fs.sectionLabel, color: t.accent, flexShrink: 0 }}>
                {r.type === "county" ? L.typeCounty : r.type === "township" ? L.typeTownship : L.typeSchool}
              </span>
              {/* title=完整名稱：截斷時滑鼠停留可見全名（使用者 8/14） */}
              <span
                title={lang === "en" && r.labelEn ? r.labelEn : r.label}
                style={{ fontSize: fs.body, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {lang === "en" && r.labelEn ? r.labelEn : r.label}
              </span>
            </button>
          ))}
        </div>
      ) : (
        // 當前層級競速長條圖（老師 8/17 回饋②）：列=絕對定位依名次排、換年時
        // top（名次）與長條寬同步過渡；key 穩定（縣名/縣/鄉鎮/學校代碼）→ 名次互換有追逐感
        <div className="app-scroll" style={{ overflowY: "auto", overflowX: "hidden", minHeight: 0, flex: 1 }} onMouseLeave={() => onHighlight(null)}>
          <div style={{ position: "relative", height: rows.length * ROW_H }}>
            {rows.map((r, i) => (
              <button
                key={r.key}
                style={{
                  ...rowStyle,
                  position: "absolute",
                  top: i * ROW_H,
                  left: 0,
                  height: ROW_H,
                  padding: "0 6px",
                  transition: `top ${RACE_MS}ms ease`,
                }}
                onMouseEnter={() => onHighlight(r.key)}
                onClick={() => {
                  onSelectTrend(rowEntity(r));
                  if (r.school) {
                    onHighlight(r.key);
                  } else {
                    onNavigate([...path, r.name]);
                  }
                }}
              >
                {/* 競速長條：鋪在文字底下、寬=值/當前最大值，換年時寬度動畫 */}
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 4,
                    bottom: 4,
                    width: `${maxValue ? (r.value / maxValue) * 100 : 0}%`,
                    background: barColor(r),
                    opacity: t.dark ? 0.42 : 0.3,
                    borderRadius: sd.components.bar.radius,
                    transition: `width ${RACE_MS}ms ease`,
                  }}
                />
                {/* 名次欄（量值排序，全層級皆顯示） */}
                <span style={{ position: "relative", fontSize: fs.sectionLabel, color: t.textMuted, width: 18, flexShrink: 0, fontVariantNumeric: "tabular-nums", textAlign: "right", whiteSpace: "nowrap" }}>
                  {i + 1}
                </span>
                {/* title=完整名稱：截斷時滑鼠停留可見全名（使用者 8/14） */}
                <span
                  title={displayName(r, lang)}
                  style={{ position: "relative", fontSize: fs.body, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {displayName(r, lang)}
                </span>
                <span style={{ position: "relative", fontSize: fs.sectionLabel, color: t.textMuted, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{fmtInt(r.value)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {/* 趨勢圖常駐（老師 8/17 回饋①）：預設=當前下鑽單位，點選學校時=該校 */}
      <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 8 }}>
        <Sparkline entity={effectiveTrend} measure={measure} year={year} />
      </div>
    </aside>
  );
}
