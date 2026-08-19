import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ThemeProvider, useTokens } from "./lib/useTokens";
import { LanguageProvider, useLanguage } from "./lib/LanguageContext";
import sd from "./lib/styleDictionary.js";
import { FIT_QUERY, useMedia } from "./lib/useMedia";
import Treemap from "./components/Treemap";
import Sidebar from "./components/Sidebar";
import {
  type Dataset,
  type GroupNode,
  type Measure,
  type TrendEntity,
  YEAR_MAX,
  YEAR_MIN,
  aggregate,
  dataset as dataset114,
  displayName,
  fmtInt,
  isLeaf,
  loadYear,
  nodeAtPath,
  validPathPrefix,
  zeroSchools,
} from "./lib/data";

const MEASURES: Measure[] = ["students", "teachers"];
const PLAY_INTERVAL_MS = 1200; // 播放：每年停留時間（含 420ms morph 轉場）

function Inner() {
  const t = useTokens();
  const { lang, t: L, toggle: toggleLang } = useLanguage();
  const [path, setPath] = useState<string[]>([]);
  const [measure, setMeasure] = useState<Measure>("students");
  const [year, setYear] = useState(YEAR_MAX);
  const [ds, setDs] = useState<Dataset>(dataset114);
  const [playing, setPlaying] = useState(false);
  // 側欄常駐（使用者 8/14：不要切換鈕，比照世界平台一直都在）＋treemap 高亮＋趨勢選中項
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const [trendEntity, setTrendEntity] = useState<TrendEntity | null>(null);
  // 頁尾零值名單：句尾小按鈕觸發彈窗（比照鄉鎮圖集使用說明彈窗：portal+fixed、
  // 再點按鈕或點空白處關閉；使用者 8/14）
  const [zeroOpen, setZeroOpen] = useState(false);
  const zeroBtnRef = useRef<HTMLButtonElement>(null);
  const zeroPopRef = useRef<HTMLDivElement>(null);
  const [zeroPos, setZeroPos] = useState({ bottom: 0, right: 0 });
  useEffect(() => {
    if (!zeroOpen) return;
    const update = () => {
      const r = zeroBtnRef.current?.getBoundingClientRect();
      if (!r) return;
      setZeroPos({ bottom: window.innerHeight - r.top + 8, right: Math.max(8, window.innerWidth - r.right) });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [zeroOpen]);
  // 點彈窗與按鈕以外的地方關閉（都不在才關，避免與按鈕 toggle 互搶）
  useEffect(() => {
    if (!zeroOpen) return;
    const onDocPointerDown = (ev: PointerEvent) => {
      const target = ev.target as Node;
      if (zeroPopRef.current?.contains(target) || zeroBtnRef.current?.contains(target)) return;
      setZeroOpen(false);
    };
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [zeroOpen]);

  const navigate = (p: string[]) => {
    setPath(p);
    setHighlightKey(null);
    // 換層級清掉學校選取 → 趨勢圖回落到當前單位（全國/縣市/鄉鎮；老師 8/17 回饋①）
    setTrendEntity(null);
  };

  // 切年：懶載入該年資料；舊下鑽路徑在新年份不存在（如 103 年無桃園市）退到有效前綴
  useEffect(() => {
    let alive = true;
    loadYear(year).then((next) => {
      if (!alive) return;
      setDs(next);
      setPath((p) => validPathPrefix(next.tree, p));
    });
    return () => {
      alive = false;
    };
  }, [year]);

  // 播放：逐年前進，到 114 自動停（比照世界平台 TimeControls；按播放時若已在終點則從頭）
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setYear((y) => {
        if (y >= YEAR_MAX) {
          setPlaying(false);
          return y;
        }
        return y + 1;
      });
    }, PLAY_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [playing]);

  const handlePlayToggle = () => {
    if (!playing && year >= YEAR_MAX) setYear(YEAR_MIN);
    setPlaying((v) => !v);
  };

  const current = useMemo(() => nodeAtPath(ds.tree, path), [ds, path]);
  const agg = useMemo(() => aggregate(current), [current]);
  const zeros = useMemo(() => {
    const county = path[0] ?? "";
    const township = path[1] ?? "";
    return zeroSchools(current, measure, county, township);
  }, [current, measure, path]);

  // 大螢幕：整頁塞進視窗不出捲軸（treemap 彈性填滿剩餘高度）；小裝置退回捲動版面
  const fit = useMedia(FIT_QUERY);
  const fs = sd.typography.sizes;
  const kpis = [
    { label: L.measure.students, value: agg.students },
    { label: L.measure.teachers, value: agg.teachers },
    { label: L.kpiSchools, value: agg.schools },
  ];
  // 麵包屑/KPI 顯示名：path 為中文 key，沿樹查表取當前語言顯示名
  const crumbs = useMemo(() => {
    const labels = [L.nationwide];
    let node: GroupNode = ds.tree;
    for (const nm of path) {
      const next = node.children.find((c): c is GroupNode => !isLeaf(c) && c.name === nm);
      if (next) {
        labels.push(displayName(next, lang));
        node = next;
      } else {
        labels.push(nm);
      }
    }
    return labels;
  }, [ds, path, lang, L]);

  return (
    <div
      style={{
        background: t.bg,
        color: t.text,
        // 原生控件（spinner/捲軸/搜尋框清除鈕等）配色跟著主題，避免深色下冒出亮白元件
        colorScheme: t.dark ? "dark" : "light",
        fontFamily: sd.typography.fontFamily,
        // 青綠膠囊互動語言用的 CSS 變數（index.css .pill-toggle），隨主題切換
        ["--accent" as string]: t.accent,
        ["--accent-fg" as string]: t.accentFg,
        ["--color-border" as string]: t.border,
        ...(fit
          ? { height: "100vh", overflow: "hidden", padding: "18px 24px", display: "flex", flexDirection: "column" }
          : { minHeight: "100vh", padding: "28px 24px" }),
      }}
    >
      <div
        style={{
          // 滿版（使用者 8/14：不限寬置中，左右空間吃滿）
          width: "100%",
          ...(fit ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } : {}),
        }}
      >
        {/* 頂列：標題左、按鈕右——按鈕底部對齊副標線（沉在頁首下緣、位於圖表區上方；使用者 8/14） */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: fit ? 12 : 18 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: fs.title, fontWeight: sd.typography.weights.bold, fontFamily: sd.typography.fontSerif }}>
              {L.title}
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: fs.subtitle, color: t.textMuted }}>
              {L.subtitle(year, L.measure[measure])}
            </p>
          </div>
          {/* 老師 8/14 回饋：English/深色模式集中到右上，與量值切換鈕擺一起 */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {/* 量值切換：兩顆獨立膠囊按鈕（2026-08-14 使用者要求分開） */}
            {MEASURES.map((m) => (
              <button
                key={m}
                onClick={() => setMeasure(m)}
                aria-pressed={measure === m}
                style={{
                  cursor: "pointer",
                  borderRadius: sd.components.pill.radius,
                  padding: "6px 14px",
                  fontSize: fs.body,
                  fontFamily: sd.typography.fontFamily,
                  border: `1px solid ${measure === m ? t.accent : t.border}`,
                  background: measure === m ? t.accent : t.surface,
                  color: measure === m ? t.accentFg : t.textMuted,
                  fontWeight: measure === m ? sd.typography.weights.bold : sd.typography.weights.normal,
                }}
              >
                {L.measure[m]}
              </button>
            ))}
            {/* 語言切換（按鈕文字=按下去會變成的語言） */}
            <button
              className="pill-toggle"
              aria-pressed={lang === "en"}
              onClick={toggleLang}
              style={{
                cursor: "pointer",
                borderRadius: sd.components.pill.radius,
                padding: "6px 14px",
                lineHeight: 1.5,
                fontSize: fs.body,
                fontFamily: sd.typography.fontFamily,
                transition: "background .15s, border-color .15s, color .15s",
                border: `1px solid ${lang === "en" ? t.accent : t.border}`,
                background: lang === "en" ? t.accent : t.surface,
                color: lang === "en" ? t.accentFg : t.text,
              }}
            >
              {L.langToggleLabel}
            </button>
            {/* 深色模式 */}
            <button
              className="pill-toggle"
              aria-pressed={t.dark}
              onClick={t.toggle}
              style={{
                whiteSpace: "nowrap",
                cursor: "pointer",
                borderRadius: sd.components.pill.radius,
                padding: "6px 14px",
                lineHeight: 1.5,
                fontSize: fs.body,
                fontFamily: sd.typography.fontFamily,
                transition: "background .15s, border-color .15s, color .15s",
                border: `1px solid ${t.dark ? t.accent : t.border}`,
                background: t.dark ? t.accent : t.surface,
                color: t.dark ? t.accentFg : t.text,
              }}
            >
              {t.dark ? L.lightMode : L.darkMode}
            </button>
          </div>
        </div>

        {/* 主要區：左側欄（可收合）＋右欄（KPI＋主圖卡） */}
        <div
          style={{
            display: "flex",
            flexDirection: fit ? "row" : "column",
            gap: sd.spacing.gap,
            ...(fit ? { flex: 1, minHeight: 0 } : {}),
          }}
        >
          <Sidebar
            tree={ds.tree}
            path={path}
            measure={measure}
            year={year}
            onNavigate={navigate}
            onYearJump={(y) => {
              setPlaying(false);
              setYear(y);
            }}
            onHighlight={setHighlightKey}
            trendEntity={trendEntity}
            onSelectTrend={setTrendEntity}
            stacked={!fit}
          />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", ...(fit ? { minHeight: 0 } : {}) }}>
        {/* KPI 條：跟著當前下鑽層級 */}
        <div style={{ display: "flex", gap: sd.spacing.gap, flexWrap: "wrap", marginBottom: sd.spacing.gap }}>
          {/* KPI 卡緊湊版（使用者 8/14：縮小讓空間留給下方 treemap）：標籤與數字同列 */}
          {kpis.map((k) => (
            <div
              key={k.label}
              style={{ flex: "1 1 180px", display: "flex", alignItems: "baseline", gap: 10, background: t.surface, border: `1px solid ${t.border}`, borderRadius: sd.components.panel.radius, padding: fit ? "6px 14px" : "8px 14px" }}
            >
              <span style={{ fontSize: fs.body, color: t.textMuted, whiteSpace: "nowrap" }}>
                {crumbs[crumbs.length - 1]}・{k.label}
              </span>
              <span style={{ fontSize: 20, fontWeight: sd.typography.weights.bold, fontVariantNumeric: "tabular-nums", marginLeft: "auto" }}>
                {fmtInt(k.value)}
              </span>
            </div>
          ))}
        </div>

        {/* 主圖卡：麵包屑＋treemap（fit 模式彈性填滿剩餘高度） */}
        <div
          style={{
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: sd.spacing.borderRadius,
            padding: sd.spacing.chartPadding,
            ...(fit ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } : {}),
          }}
        >
          <nav aria-label={L.navAria} style={{ marginBottom: 10, fontSize: fs.body, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
            {crumbs.map((c, i) => {
              const isLast = i === crumbs.length - 1;
              return (
                <span key={c} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {i > 0 && <span style={{ color: t.textMuted }}>›</span>}
                  {isLast ? (
                    <span style={{ fontWeight: sd.typography.weights.bold }}>{c}</span>
                  ) : (
                    <button
                      onClick={() => navigate(path.slice(0, i))}
                      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: t.accent, fontSize: fs.body, fontFamily: sd.typography.fontFamily }}
                    >
                      {c}
                    </button>
                  )}
                </span>
              );
            })}
            <span style={{ marginLeft: "auto", color: t.textMuted, fontSize: fs.sectionLabel }}>
              {/* 生師比色階說明（老師 8/17 回饋③）＋原下鑽提示 */}
              {L.ratioLegend}・{path.length < 2 ? L.hintDrill : ""}{L.hintBack}
            </span>
          </nav>
          <div style={fit ? { flex: 1, minHeight: 0 } : { height: "min(62vw, 640px)", minHeight: 380 }}>
            <Treemap
              tree={ds.tree}
              path={path}
              measure={measure}
              onNavigate={navigate}
              onSelectSchool={(e) => {
                setTrendEntity(e);
                if (e.id) setHighlightKey(`s:${e.id}`);
              }}
              highlightKey={highlightKey}
            />
          </div>
          {/* 年份時間軸：播放膠囊鈕＋滑桿＋大字年份（比照世界發展數據分析平台 TimeControls） */}
          <div style={{ borderTop: `1px solid ${t.border}`, marginTop: 10, paddingTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              className="pill-toggle"
              aria-pressed={playing}
              aria-label={playing ? L.pauseAria : L.playAria}
              onClick={handlePlayToggle}
              style={{
                fontSize: fs.axis,
                padding: "4px 14px",
                borderRadius: sd.components.pill.radius,
                fontFamily: "inherit",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background .15s, border-color .15s, color .15s",
                border: `1px solid ${playing ? t.accent : t.border}`,
                background: playing ? t.accent : t.surface,
                color: playing ? t.accentFg : t.text,
              }}
            >
              {/* 手繪 SVG 圖示：⏸/▶ Unicode 字符在字身框內不對稱，光靠 CSS 置中救不回來 */}
              {playing ? (
                <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden focusable="false">
                  <rect x="4" y="3" width="3" height="10" fill="currentColor" />
                  <rect x="9" y="3" width="3" height="10" fill="currentColor" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden focusable="false">
                  <polygon points="4,2.5 13,8 4,13.5" fill="currentColor" />
                </svg>
              )}
            </button>
            <input
              type="range"
              min={YEAR_MIN}
              max={YEAR_MAX}
              step={1}
              value={year}
              aria-label={L.syAxisAria}
              onChange={(e) => {
                setPlaying(false);
                setYear(Number(e.target.value));
              }}
              className="year-range"
              style={{
                flex: 1,
                // 已播放段的 accent 漸層進度（CSS 變數傳進偽元素軌道，見 index.css）
                ["--range-progress" as string]: `${((year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100}%`,
              }}
            />
            <span style={{ fontSize: 20, fontWeight: sd.typography.weights.bold, color: t.text, fontVariantNumeric: "tabular-nums", marginRight: 8, whiteSpace: "nowrap" }}>
              {year}
              <span style={{ fontSize: fs.sectionLabel, color: t.textMuted, marginLeft: 4 }}>{L.sySuffix}</span>
            </span>
          </div>
        </div>
          </div>
        </div>

        {/* 頁尾：來源＋零值學校誠實註記 */}
        {/* 頁尾：註記與來源（深色模式鈕已依老師 8/14 回饋移到右上按鈕列） */}
        <footer style={{ marginTop: fit ? 10 : 14, fontSize: fs.sectionLabel, color: t.textMuted, lineHeight: 1.7 }}>
          {year <= 108 && <div>{L.backfillNote(ds.unplacedSchools)}</div>}
          {/* 零值註記併在資料來源同一行，句尾放小按鈕展開名單（使用者 8/14） */}
          <div>
            {L.sourceLine(year)}
            {zeros.length > 0 && (
              <>
                {" "}{L.zeroNote(zeros.length, L.measure[measure])}{" "}
                <button
                  ref={zeroBtnRef}
                  className="pill-toggle"
                  aria-pressed={zeroOpen}
                  onClick={() => setZeroOpen((v) => !v)}
                  style={{
                    cursor: "pointer",
                    borderRadius: sd.components.pill.radius,
                    padding: "1px 10px",
                    fontSize: fs.sectionLabel,
                    lineHeight: 1.5,
                    fontFamily: sd.typography.fontFamily,
                    verticalAlign: "middle",
                    transition: "background .15s, border-color .15s, color .15s",
                    border: `1px solid ${zeroOpen ? t.accent : t.border}`,
                    background: zeroOpen ? t.accent : t.surface,
                    color: zeroOpen ? t.accentFg : t.text,
                  }}
                >
                  {zeroOpen ? L.zeroHideList : L.zeroShowList}
                </button>
              </>
            )}
          </div>
          {/* 名單彈窗：樣式比照鄉鎮圖集使用說明彈窗（accentSoft 底/portal 到 body 跳脫裁切），
              從按鈕上方彈出，名單過長時內部捲動 */}
          {zeroOpen && zeros.length > 0 && createPortal(
            <div
              ref={zeroPopRef}
              style={{
                position: "fixed",
                bottom: zeroPos.bottom,
                right: zeroPos.right,
                zIndex: 100,
                width: "min(400px, 85vw)", // 名單內容較窄，縮窄彈窗（使用者 8/14）
                background: t.accentSoft,
                border: `1px solid color-mix(in srgb, ${t.accent} 35%, transparent)`,
                borderRadius: sd.components.panel.radius,
                padding: "16px 20px",
                boxShadow: `0 12px 32px -8px ${t.text}55`,
                fontSize: fs.sectionLabel,
                color: t.text,
                lineHeight: 1.8,
                textAlign: "left",
              }}
            >
              <p style={{ margin: 0, color: t.textMuted }}>
                {L.zeroNote(zeros.length, L.measure[measure])}
              </p>
              <ul className="app-scroll" style={{ margin: "8px 0 0", paddingLeft: 20, listStyleType: "disc", maxHeight: 260, overflowY: "auto" }}>
                {zeros.map((z) => (
                  <li key={`${z.county}${z.township}${z.name}`}>
                    {lang === "en"
                      ? [z.countyEn || z.county, z.townshipEn || z.township, z.en || z.name].filter(Boolean).join(" · ")
                      : [z.county, z.township, z.name].filter(Boolean).join("・")}
                    {L.zeroItem(fmtInt(z.students), fmtInt(z.teachers))}
                  </li>
                ))}
              </ul>
            </div>,
            document.body,
          )}
        </footer>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <Inner />
      </ThemeProvider>
    </LanguageProvider>
  );
}
