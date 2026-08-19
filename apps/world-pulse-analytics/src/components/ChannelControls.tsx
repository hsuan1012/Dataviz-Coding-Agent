import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useAppState } from "../state/AppStateContext";
import { useLanguage } from "../state/LanguageContext";
import { METRICS, metricLabel, type MetricKey, type ColorKey } from "../lib/channels";
import { buildScatterCaption, buildFocusCaption } from "../lib/scatterCaption";

const METRIC_KEYS = Object.keys(METRICS) as MetricKey[];

function ChannelSelect({ label, value, options, disabledKey, onChange }: {
  label: string;
  value: string;
  options: { key: string; label: string }[];
  disabledKey?: string; // X=Y 防呆:對向軸目前指標 disabled(灰項),搭配 patchChannels 對調雙保險
  onChange: (key: string) => void;
}) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
      <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{
          fontSize: 12.5, fontFamily: "inherit", border: "1px solid var(--color-border)",
          borderRadius: 9, padding: "4px 8px", background: "var(--color-surface)",
          cursor: "pointer", minWidth: 96,
        }}>
        {options.map((o) => (
          <option key={o.key} value={o.key} disabled={o.key === disabledKey}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

// 四個下拉:X/Y/顏色/大小。移到頁首標題列右側(比照鄉鎮圖集把通道列放頁首的做法),
// DOM 順序維持 X/Y/顏色/大小不變。
export function ChannelDropdowns() {
  const { state, dispatch } = useAppState();
  const { lang, t } = useLanguage();
  const ch = state.channels;
  const metricOptions = METRIC_KEYS.map((k) => ({ key: k, label: metricLabel(k, lang) }));
  const colorOptions = [{ key: "region", label: t.colorRegionOption }, ...metricOptions];
  return (
    <div className="flex flex-wrap items-center justify-end" style={{ gap: 14, fontSize: 12.5 }}>
      <ChannelSelect label={t.xAxisLabel} value={ch.x} options={metricOptions} disabledKey={ch.y}
        onChange={(k) => dispatch({ type: "SET_CHANNELS", patch: { x: k as MetricKey } })} />
      <ChannelSelect label={t.yAxisLabel} value={ch.y} options={metricOptions} disabledKey={ch.x}
        onChange={(k) => dispatch({ type: "SET_CHANNELS", patch: { y: k as MetricKey } })} />
      <ChannelSelect label={t.colorLabel} value={ch.color} options={colorOptions}
        onChange={(k) => dispatch({ type: "SET_CHANNELS", patch: { color: k as ColorKey } })} />
      <ChannelSelect label={t.sizeLabel} value={ch.size} options={metricOptions}
        onChange={(k) => dispatch({ type: "SET_CHANNELS", patch: { size: k as MetricKey } })} />
    </div>
  );
}

// U5:「選取」「清除」兩顆按鈕,現在嵌在頂部控制列右側(見 App.tsx 泡泡圖卡片內
// 那個 justify-between 的頂部控制列 div,與左側 ScatterLegends 同列)。
// U19:放大鏡鈕加在「選取」左邊,三顆互斥(同一套 aria-pressed 開關視覺)。
export function ChannelControls() {
  const { state, dispatch } = useAppState();
  const { lang, t } = useLanguage();
  const hasSel = state.focusSelection.size > 0;
  const [showHelp, setShowHelp] = useState(false);
  // 8/4 改 portal 到 document.body+position:fixed(比照 township-drilldown-app
  // Scatter.tsx 8/3 的修法):原本「相對按鈕組 absolute right-0」的做法,按鈕組一旦
  // 因版面擠壓被移到別的位置(如 flex-wrap 換行、或卡片本身變窄),彈窗錨點跟著跑,
  // 540px 寬很容易超出視窗左界。改成量測按鈕列實際的 getBoundingClientRect() 換算成
  // fixed 定位,createPortal 到 body——徹底跳出版面擠壓與祖先裁切的影響,永遠貼著
  // 按鈕列右下方,寬度再用 min(540px, 85vw) 兜底極窄視窗。
  const controlsRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [helpPos, setHelpPos] = useState({ top: 0, right: 0 });
  useEffect(() => {
    if (!showHelp) return;
    const update = () => {
      const el = controlsRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setHelpPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [showHelp]);
  // 8/4 使用者回饋:點空白處(彈窗與按鈕組以外的任何地方)要能關掉彈窗。用 mousedown
  // (不是 click)——排除按鈕組本身(controlsRef,含「使用說明」鈕):否則這裡先把
  // showHelp 設 false,按鈕自己的 onClick 緊接著又 toggle 回 true,點按鈕會變成
  // 沒反應。同時排除彈窗本體(panelRef,已 portal 到 body,不在 controlsRef 底下),
  // 點彈窗內文字不會被當成「點外面」關掉。
  useEffect(() => {
    if (!showHelp) return;
    const onPointerDown = (ev: MouseEvent) => {
      const target = ev.target as Node;
      if (controlsRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setShowHelp(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [showHelp]);
  const btn = (active: boolean): CSSProperties => ({
    fontSize: 13, padding: "4px 14px", borderRadius: 999, fontFamily: "inherit",
    cursor: "pointer", transition: "background .15s, border-color .15s, color .15s",
    border: `1px solid ${active ? "var(--accent)" : "var(--color-border)"}`,
    background: active ? "var(--accent)" : "var(--color-surface)",
    color: active ? "var(--accent-fg)" : "var(--color-text)",
  });
  return (
    // whiteSpace nowrap:8/4 實測窄寬度時「選取」「使用說明」等按鈕文字會被壓到逐字換行,
    // 保證按鈕組自己絕不斷行(換行單位是整組,見 App.tsx 控制列的 flex-wrap)。
    // marginLeft auto:按鈕組換到自己單獨一行時,justify-content:space-between 對
    // 「只有一個元素的行」等同靠左——使用說明彈窗用 right:0 貼齊本容器右緣定位,
    // 容器一旦被擠去左邊,540px 寬的彈窗就跟著超出視窗左界。margin-left:auto 讓本組
    // 不論獨佔一行與否都吃光行內剩餘空間、永遠貼右,彈窗定位錨點才不會跑掉。
    <div ref={controlsRef} className="relative flex flex-row items-center gap-3" style={{ whiteSpace: "nowrap", marginLeft: "auto" }}>
      {/* 8/4 使用者要求:移除放大鏡框選按鈕,縮放改用滑鼠滾輪直接控制(見
          BubbleChart.tsx 的 wheel effect,比照 township-drilldown-app 同一天做的
          同一個改動)——不再需要獨立的縮放「模式」可以切換,少一顆按鈕。 */}
      <button className="scatter-select-toggle scatter-mode-select" aria-pressed={state.focusMode === "select"}
        style={btn(state.focusMode === "select")}
        onClick={() => dispatch({ type: "SET_FOCUS_MODE", mode: "select" })}>{t.selectBtn}</button>
      <button className="sel-clear scatter-select-toggle" aria-pressed={state.focusMode === "clear"}
        disabled={!hasSel}
        style={{
          ...btn(state.focusMode === "clear"),
          ...(hasSel ? {} : { cursor: "not-allowed", opacity: 0.4, transition: "background .15s, border-color .15s, color .15s, opacity .15s" })
        }}
        onClick={() => dispatch({ type: "SET_FOCUS_MODE", mode: "clear" })}>{t.clearBtn}</button>
      {/* U23:移植鄉鎮圖集散布圖的使用說明鈕(township-drilldown-app Scatter.tsx)。
          display 仍用 inline style 切 block/none(關閉時 DOM 仍在、只是隱藏)——
          verify-scatter-parity.mjs 用 .mini-count 讀 textContent 不看可見性,要保留這個介面。 */}
      <button className="scatter-select-toggle scatter-help-toggle" aria-pressed={showHelp} aria-expanded={showHelp}
        style={btn(showHelp)}
        onClick={() => setShowHelp((v) => !v)}>{t.helpBtn}</button>
      {/* 深色模式回饋:bg-teal-50/border-teal-200 是寫死的淺色 Tailwind 色階,深色模式下
          會變成一塊突兀的淺色方塊——改用 --accent-soft/--accent 這兩個已隨主題切換的
          CSS 變量,結構(寬度/圓角/陰影)維持不變。 */}
      {createPortal(
        <div
          ref={panelRef}
          className="rounded-xl shadow-xl p-5"
          style={{
            display: showHelp ? "block" : "none", position: "fixed", top: helpPos.top, right: helpPos.right,
            zIndex: 100, width: "min(540px, 85vw)",
            color: "var(--color-text)", lineHeight: 1.8, textAlign: "left", fontSize: 12.5,
            background: "var(--accent-soft)", border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)",
          }}
        >
          <p className="scatter-caption" style={{ margin: 0, color: "var(--color-text-muted)" }}>
            {buildScatterCaption(state.channels, lang)}
          </p>
          {/* list-style 預設被 Tailwind preflight 歸零,明指 disc 才看得到列點記號 */}
          <ul style={{ margin: "8px 0 0", paddingLeft: 20, listStyleType: "disc", display: "flex", flexDirection: "column", gap: 4 }}>
            <li>{t.helpBulletSelect}</li>
            <li>{t.helpBulletClear}</li>
            {/* 8/7 移除中文版 nowrap:當初(8/4 U24)整句不換行是配合較短的「放大」按鈕說明,
                之後文字換成更長的滾輪縮放+拖曳平移說明,nowrap 會撐出 540px 面板被使用者抓到
                (字跑到彈窗外)。教訓:nowrap 是跟「當時那句文案長度」綁定的決策,文案改了要重評。 */}
            <li>{t.helpBulletZoom}</li>
            <li>{t.helpBulletGlobe}</li>
            <li>{t.helpBulletBlankReset}</li>
            {hasSel ? (
              <>
                <li className="mini-count">{buildFocusCaption(state.focusSelection.size, lang)}</li>
              </>
            ) : (
              <li className="mini-hint">{t.helpNotSelectedHint}</li>
            )}
          </ul>
        </div>,
        document.body
      )}
    </div>
  );
}
