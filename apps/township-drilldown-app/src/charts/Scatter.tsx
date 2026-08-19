import { typography as __ty, components as C } from "../lib/styleDictionary";
const S = __ty.sizes; // type scale:字級一律具名(見 styleDictionary)
import { useRef, useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import * as d3 from "d3";
import { useTokens } from "../lib/useTokens";
import { useLanguage } from "../state/LanguageContext";
import { scatterPoints, scatterDomains, scatterVars, REGIONS, type Values, type Meta, type ScatterKey, type Point } from "../lib/data";
import { regionColor } from "../lib/scales";
import { makeScale, logTicks, safeDomain, makeColorNormalizer, rampColor, colorTicks, sizeTicks, thinTicks, SYMLOG_C, type ScatterChannels } from "../lib/scatterChannels";
import { townsInRect } from "../lib/brushSelect";
import { zoomDomain, panDomain, zoomDomainInSpace, panDomainInSpace, symlogFwd, symlogInv } from "../lib/scatterZoom";
import { buildScatterCaption } from "../lib/scatterCaption";
import { countyOf } from "../lib/counties";
import { romanizePlaceName } from "../lib/placeName";
import { metricLabel, metricUnit, regionLabel } from "../lib/metricI18n";
import { formatParen } from "../lib/i18n";

// Bento 版(wireframe v7):viewBox=量測到的實際顯示尺寸(1:1)——任何槽位比例都零留白、
// 軸字/泡泡像素固定清晰(W/H 在元件內隨 ResizeObserver 更新)
const M = { l: 72, r: 14, t: 14, b: 42 };
const CB_W = 220; // 色條寬(px)
const R_RANGE: [number, number] = [2.5, 16]; // 泡泡半徑(顯示尺寸≈7/20 老師回饋放大後的視覺,座標系縮小等比調整)

// 關係散布圖 crossfilter:X/Y/大小/顏色四通道皆可自由指派指標(對齊老師 bokeh 範例)。
// 顏色預設「區域」(分類色+區域圖例);選指標時改主題連續色階+漸層色條。
// 切年份/切通道皆以鄉鎮為 key 做補間動畫。
export default function Scatter({ values, meta, year, channels, geo, selected, onSelect, onExcludeTown, hoverCounty, showCaption = true }: {
  values: Values; meta: Meta; year: number;
  channels: ScatterChannels;
  geo: GeoJSON.FeatureCollection;
  selected: string[] | null; onSelect: (s: string[] | null) => void;
  onExcludeTown: (township: string) => void;   // 雙擊剔除(reducer:不動 view)
  hoverCounty: string | null;                  // 地圖懸停縣市(合併單頁:由外殼自主地圖傳入)
  showCaption?: boolean;                       // false=白話解說移交外殼(卡內右欄文字區,wireframe v5)
}) {
  const ref = useRef<SVGSVGElement>(null);
  const t = useTokens();
  const { lang, tr } = useLanguage();
  const [hover, setHover] = useState<{ x: number; y: number; p: Point } | null>(null);
  // 使用說明彈窗(使用者要求,7/31):放圖例列「清除」右邊,點下彈出小視窗列點說明操作方式。
  // 8/3 改 portal 到 document.body+position:fixed(見下方 helpPos):卡片外層有 overflow-hidden
  // (100dvh 鎖屏設計必要,不能拿掉),彈窗若留在原本的 DOM 位置絕對定位,寬版面時仍可能被那層
  // overflow 裁到;portal 讓它徹底跳出裁切範圍,用量測到的按鈕列座標換算成 fixed 定位。
  const [showHelp, setShowHelp] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);
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
  // 點彈窗以外的地方關閉(使用者要求,8/4):彈窗已經是 portal 到 document.body 的獨立節點,
  // 用「點擊事件的 target 是否在彈窗或觸發按鈕內」判斷——都不在才關閉,避免點按鈕本身時
  // 「開啟」跟「外部點擊關閉」兩個 handler 互搶導致彈窗開了又立刻被關掉。
  useEffect(() => {
    if (!showHelp) return;
    const onDocPointerDown = (ev: PointerEvent) => {
      const target = ev.target as Node;
      const helpEl = document.querySelector(".scatter-help-popup");
      const btnEl = document.querySelector(".scatter-help-toggle");
      if (helpEl?.contains(target) || btnEl?.contains(target)) return;
      setShowHelp(false);
    };
    // 用 pointerdown(capture)而非 mousedown(8/7 使用者抓到「點散布圖空白處關不掉」):
    // 散布圖空白處掛著 d3.brush overlay,d3 v7 的 brush 在 pointerdown 就 preventDefault()
    // ——這會「抑制」瀏覽器後續合成的 mousedown/click 相容事件,mousedown 監聽根本收不到
    // (掛捕獲階段也沒用,事件從未發生);其他區域都正常,最常被點的圖表空白處反而失效。
    // pointerdown 是源頭事件、必定觸發;掛捕獲階段再保險一層(比 overlay 上任何 handler 早,
    // stopPropagation 攔不到)。與觸發按鈕 onClick 的先後順序保證不變(pointerdown 先於 click)。
    document.addEventListener("pointerdown", onDocPointerDown, true);
    return () => document.removeEventListener("pointerdown", onDocPointerDown, true);
  }, [showHelp]);
  // 選取/清除模式(使用者要求,7/30 修正為對稱加減操作):兩者都是拖曳框選/單擊泡泡的工具開關,
  // 只是效果相反——選取=框內/單擊泡泡併入名單(累加),清除=框內/單擊泡泡移出名單(累減);
  // 互斥(開一個自動關另一個,同一畫布手勢不能同時做兩件相反的事)。純 UI 狀態,不進 App/reducer。
  // 雙擊剔除不受此狀態影響,任何時候都能用。
  const [mode, setMode] = useState<"select" | "clear" | null>(null);
  const selectMode = mode === "select";
  const clearMode = mode === "clear";
  // 滾輪縮放(使用者要求,8/4,取代原本的放大鏡框選按鈕):純視覺,不進 App/reducer、
  // 不影響 selected 名單。null=用全範圍(domAll 算出的完整 extent)。見下方 wheel effect。
  const [zoomX, setZoomX] = useState<[number, number] | null>(null);
  const [zoomY, setZoomY] = useState<[number, number] | null>(null);
  // 拖曳平移游標狀態(修 bug,8/4 code review):平移中每個 "drag" tick 都會 setZoomX/setZoomY,
  // 觸發下面框選 useEffect 重跑(zoomX/zoomY 在其依賴陣列裡)——bg.selectAll("*").remove() 會把
  // 當下這顆 pan rect 整個砍掉重建一顆全新的(style 又是預設 "grab"),蓋掉 drag "start" 設過的
  // "grabbing"。用兩個 ref(而非讀 DOM 節點目前 inline style)跨越這些重建:panActiveRef=手勢是否
  // 進行中(在 start/end 設,任何一版 drag 閉包都寫同一個 ref,不受重建影響)、panRectSelRef=
  // 目前這顆(最新重建出來的)pan rect selection,讓 start/end 永遠操作「現在畫面上真正那顆」
  // 而不是自己閉包捕捉到、可能早已被砍掉的舊節點。
  const panActiveRef = useRef(false);
  const panRectSelRef = useRef<d3.Selection<SVGRectElement, unknown, null, undefined> | null>(null);
  // 框選 coach mark:每次進關係頁(元件重新掛載)都出現(7/23 使用者指定,不做永久記憶);
  // 已有鎖定名單時例外(人已會用,提示是雜訊)。成功選取或點提示本身即收起。
  const [showBrushHint, setShowBrushHint] = useState(() => !(selected && selected.length));
  const hideBrushHint = () => setShowBrushHint(false);
  const select = useMemo(() => (s: string[] | null) => {
    if (s && s.length) setShowBrushHint(false);
    onSelect(s);
  }, [onSelect]);
  // 外部來的選取(點地圖整縣)也收提示章:人已有名單,提示是雜訊
  useEffect(() => { if (selected && selected.length) setShowBrushHint(false); }, [selected]);
  // 名單清空時(不論因清除模式操作或其他途徑)自動退出清除模式:沒東西可清,
  // 停用鈕若還顯示 aria-pressed=true 會很奇怪。
  useEffect(() => { if (mode === "clear" && !(selected && selected.length)) setMode(null); }, [selected, mode]);
  // 散布圖 svg 實際渲染尺寸:高 → 迷你地圖等高(spec);寬 → 白話解說同寬(右緣對齊圖右緣)。
  // 差<2px 不更新,防 flex 來回震盪。
  const [chartH, setChartH] = useState(420);
  const [chartW, setChartW] = useState(760);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const box = el.getBoundingClientRect();
      const nextH = Math.round(box.height), nextW = Math.round(box.width);
      setChartH((h) => (Math.abs(h - nextH) > 2 ? nextH : h));
      setChartW((w) => (Math.abs(w - nextW) > 2 ? nextW : w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // viewBox=元素實際尺寸(1:1):W/H 隨版面量測更新,scales/brush/軸全部跟著重算
  const W = Math.max(chartW, 320), H = Math.max(chartH, 220);
  const vars = useMemo(() => scatterVars(meta), [meta]);
  const { x: xKey, y: yKey, size: sizeKey, color: colorKey } = channels;
  const colorIsInd = colorKey !== "region";
  const lab = (k: ScatterKey) => vars.find((v) => v.key === k)!;
  // 縮放範圍是特定 X/Y 指標的資料值,換了指標舊範圍就沒意義了——切 X 或 Y 通道時自動還原;
  // 切顏色/大小通道、切年份都不影響(不動 X/Y 軸)。
  useEffect(() => { setZoomX(null); setZoomY(null); }, [xKey, yKey]);

  const domAll = useMemo(() => scatterDomains(values, meta), [values, meta]);
  // 人口密度不論落在哪個通道都走 symlog,保持一致(makeScale/logTicks/makeColorNormalizer)
  const xIsLog = xKey === "density";
  const yIsLog = yKey === "density";
  // 比例尺 range 內縮最大半徑:圓「身」完整落在軸內(7/23 使用者回饋泡泡越軸;
  // 澎湖壓框/烏坵越框同族教訓——中心在界內≠整體在界內)。
  const PAD = R_RANGE[1];
  // 滾輪縮放(7/31 邏輯,8/4 改滾輪觸發):有縮放範圍時 domain 改用 zoomX/zoomY,否則用全範圍(既有邏輯不變)
  // nice=false 只在有滾輪縮放範圍時關閉(8/4 修 bug):zoomX/zoomY 是 zoomDomain() 算好的精確
  // 子範圍,再 .nice() 一次可能把邊界round回全域邊界,導致滾輪縮放畫面上沒反應(見 scatterChannels.ts makeScale 註解)。
  const x = useMemo(() => makeScale(xIsLog, zoomX ?? safeDomain(domAll[xKey], xKey), [M.l + PAD, W - M.r - PAD], !zoomX), [domAll, xKey, xIsLog, W, zoomX]);
  const y = useMemo(() => makeScale(yIsLog, zoomY ?? safeDomain(domAll[yKey], yKey), [H - M.b - PAD, M.t + PAD], !zoomY), [domAll, yKey, yIsLog, H, zoomY]);
  const r = useMemo(() => d3.scaleSqrt().domain(safeDomain(domAll[sizeKey], sizeKey)).range(R_RANGE), [domAll, sizeKey]);
  // 滾輪縮放 clamp 用的「完整範圍」:重用 makeScale 算出跟 x/y 完全一致的 domain
  // (symlog 軸是 [0, niceHi(...)],線性軸是 .nice() 過的邊界,不是 safeDomain 的原始值)。
  const fullXDomain = useMemo(
    () => makeScale(xIsLog, safeDomain(domAll[xKey], xKey), [M.l + PAD, W - M.r - PAD]).domain() as [number, number],
    [domAll, xKey, xIsLog, W]);
  const fullYDomain = useMemo(
    () => makeScale(yIsLog, safeDomain(domAll[yKey], yKey), [H - M.b - PAD, M.t + PAD]).domain() as [number, number],
    [domAll, yKey, yIsLog, H]);
  // 縮放中的 symlog 軸(8/7 使用者定案,取代 7/31 方案 A):保留 symlog 刻度型態不切線性——
  // 「切線性」與「游標定點縮放」在對數軸上數學上不可兼得(釘住錨點需要 domain 延伸出全域,
  // 必被 clamp 推走,見 scatterZoom.ts 註解)。縮放中刻度值改用 d3.ticks 對縮放範圍現算
  // (固定 logTicks 是為完整範圍設計,窄範圍內會只剩零星幾個),並經 thinTicks 像素稀疏化
  // ——等差值在 symlog 高值端像素被壓縮,相鄰標籤會貼住(實測 16,000|18,000 邊距 1.6px);
  // X 軸依格式化字串估寬(千分位逗號字串長 ×7px+6px 間距)、Y 軸固定行高 16px。
  // 還原後變回固定對數刻度組(logTicks 本身就是為 symlog 挑過的,不需稀疏化)。
  const fmtTickStr = d3.format(",");
  const xTicks = useMemo(
    () => (xIsLog
      ? (zoomX
        ? thinTicks(d3.ticks(zoomX[0], zoomX[1], 6), (v) => x(v),
            (a, b) => ((fmtTickStr(a).length + fmtTickStr(b).length) / 2) * 7 + 6)
        : logTicks(safeDomain(domAll[xKey], xKey)))
      : null),
    [domAll, xKey, xIsLog, zoomX, x]);
  const yTicks = useMemo(
    () => (yIsLog
      ? (zoomY
        ? thinTicks(d3.ticks(zoomY[0], zoomY[1], 6), (v) => y(v), () => 16)
        : logTicks(safeDomain(domAll[yKey], yKey)))
      : null),
    [domAll, yKey, yIsLog, zoomY, y]);
  const ramp = useMemo(() => rampColor(t.densityScale), [t]);
  const colorNorm = useMemo(
    () => (colorIsInd ? makeColorNormalizer(colorKey, safeDomain(domAll[colorKey], colorKey)) : null),
    [domAll, colorKey, colorIsInd]);
  // FULLNAME→縣市(懸停預覽用);點縣 toggle 的鄉鎮名單也取自 geo(與 countyOf 同源)。
  const townCounty = useMemo(
    () => new Map(geo.features.map((f) => [(f.properties as any).FULLNAME as string, countyOf(f)])),
    [geo]);
  // 軸與標籤:切 X/Y/主題時重畫(不隨年份重建 → 泡泡動畫時軸不閃)
  useEffect(() => {
    const svg = d3.select(ref.current);
    // xMin:內容靠左貼齊(預設 xMid 會在 svg 比視框寬時左右置中,產生左側空帶,
    // 使圖跟下方圖例/解說對不齊;7/23 使用者指定與「北中南東離島」圖例左對齊)
    svg.attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "xMinYMid meet");
    // 縮放時軸外的泡泡(資料值落在縮放範圍外)會被比例尺外插到軸線之外(使用者回饋 7/31:
    // 放大縮小時泡泡跑出 X/Y 軸)——加一個裁切區,把 g.dots 限制在軸線範圍內,泡泡跑出範圍時
    // 乾淨地被裁掉而不是疊到軸線外/刻度文字上。裁切區=軸線本身(不含 PAD 留白),縮放範圍內的
    // 泡泡本來就完整落在 PAD 留白內(既有機制,不受影響)。
    let defs = svg.select<SVGDefsElement>("defs.scatter-plot-defs");
    if (defs.empty()) defs = svg.append("defs").attr("class", "scatter-plot-defs");
    defs.selectAll("*").remove();
    defs.append("clipPath").attr("id", "scatter-plot-clip")
      .append("rect").attr("x", M.l).attr("y", M.t).attr("width", W - M.l - M.r).attr("height", H - M.t - M.b);
    let axes = svg.select<SVGGElement>("g.axes");
    if (axes.empty()) axes = svg.insert("g", ":first-child").attr("class", "axes");
    axes.selectAll("*").remove();
    const fmt = (d: d3.NumberValue) => d3.format(",")(d as number);
    const xAxis = d3.axisBottom(x);
    if (xTicks) xAxis.tickValues(xTicks).tickFormat(fmt);
    const yAxis = d3.axisLeft(y);
    if (yTicks) yAxis.tickValues(yTicks).tickFormat(fmt);
    axes.append("g").attr("transform", `translate(0,${H - M.b})`).call(xAxis).attr("color", t.textMuted).style("font-size", S.tick);
    axes.append("g").attr("transform", `translate(${M.l},0)`).call(yAxis).attr("color", t.textMuted).style("font-size", S.tick);
    axes.append("text").attr("x", W / 2).attr("y", H - 8).attr("fill", t.textMuted).attr("text-anchor", "middle").attr("font-size", S.small).text(formatParen(metricLabel(xKey, lab(xKey).label, lang), metricUnit(xKey, lab(xKey).unit, lang), lang));
    axes.append("text").attr("transform", "rotate(-90)").attr("x", -(H / 2)).attr("y", 16).attr("fill", t.textMuted).attr("text-anchor", "middle").attr("font-size", S.small).text(formatParen(metricLabel(yKey, lab(yKey).label, lang), metricUnit(yKey, lab(yKey).unit, lang), lang));
  }, [x, y, t, lang, xKey, yKey, meta, xTicks, yTicks, W, H]);

  // 泡泡:以鄉鎮名為 key 做 data join,切年份/切任一通道皆 transition(位置/大小/顏色)
  useEffect(() => {
    const svg = d3.select(ref.current);
    let dots = svg.select<SVGGElement>("g.dots");
    if (dots.empty()) dots = svg.append("g").attr("class", "dots");
    dots.attr("clip-path", "url(#scatter-plot-clip)"); // 縮放時軸外泡泡裁掉,不跑出 X/Y 軸(見上方 defs)
    const fill = (p: Point) => (colorIsInd ? ramp(colorNorm!(p[colorKey])) : regionColor(p.region, t.categorical));
    const pts = scatterPoints(values, meta, year);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const dur = reduce ? 0 : 750;
    const selSet = selected ? new Set(selected) : null;

    const sel = dots.selectAll<SVGCircleElement, Point>("circle")
      .data(pts, (p) => p.township)
      .join(
        (enter) => enter.append("circle")
          .attr("cx", (p) => x(p[xKey])).attr("cy", (p) => y(p[yKey])).attr("r", 0)
          .attr("fill", (p) => fill(p))
          .attr("fill-opacity", 0.7).attr("stroke-width", 0.5),
        (update) => update,
        (exit) => exit.call((e) => e.transition().duration(dur).attr("r", 0).remove()),
      );
    // 單擊/雙擊(使用者要求,7/30 初版,8/4 改為單擊依模式分流):選取模式單擊＝加入名單、
    // 清除模式單擊＝移出名單(未選中的泡泡單擊無反應)——單顆泡泡的點擊手勢現在跟框選
    // (拖曳)一樣依模式分流,選取/清除語意一致。雙擊剔除維持原本的全域捷徑,不受模式影響、
    // 任何時候(含兩模式都關閉)都能用,跟單擊分開判斷、互不影響。
    // click 與 dblclick 同一次雙擊動作都會觸發:用短暫 timer 讓 dblclick 蓋掉單擊那次,
    // 避免「雙擊移出」被自己先誤加入名單又扣掉一次造成閃爍。
    let clickTimer: number | null = null;
    sel.attr("stroke", t.surface)
      .on("mousemove", (ev: MouseEvent, p) => setHover({ x: ev.offsetX, y: ev.offsetY, p }))
      .on("mouseleave", () => setHover(null))
      .on("click", (_ev: MouseEvent, p) => {
        if (!mode) return;
        if (clickTimer !== null) window.clearTimeout(clickTimer);
        clickTimer = window.setTimeout(() => {
          clickTimer = null;
          if (mode === "clear") {
            // 清除模式:單擊已選泡泡＝移出選取(使用者要求,8/4,取代原本單擊會誤加入名單的
            // 行為);未選中的泡泡單擊無反應(清除模式的重點是移出,不會反過來把沒選的加進來)。
            if (!selected?.includes(p.township)) return;
            onExcludeTown(p.township);
            return;
          }
          if (selected?.includes(p.township)) return; // 已在名單,單擊不重複加入
          select([...new Set([...(selected ?? []), p.township])]);
        }, 250);
      })
      // 雙擊移出(老師 7/24 命名「剔除」):名單內的泡泡移出選取;未選點/無名單時 reducer
      // 原樣返回=無反應。不受選取/清除模式影響,任何時候雙擊都能用。
      .on("dblclick", (_ev: MouseEvent, p) => {
        if (clickTimer !== null) { window.clearTimeout(clickTimer); clickTimer = null; }
        onExcludeTown(p.township);
      });
    // 未選中=灰階淡化(7/23 比稿 A彩色淡化/B隱藏/C灰階 → 選 C):
    // 灰色鬼影保留全體分布脈絡(隱藏會消滅「選取 vs 全國」的比較),顏色只留給選中者。
    const inSel = (p: Point) => !selSet || selSet.has(p.township);
    sel.transition().duration(dur).ease(d3.easeCubicInOut)
      .attr("fill", (p) => (inSel(p) ? fill(p) : t.flow.base))
      .attr("fill-opacity", (p) => (inSel(p) ? 0.7 : 0.25))
      .attr("cx", (p) => x(p[xKey])).attr("cy", (p) => y(p[yKey])).attr("r", (p) => r(p[sizeKey]));
    return () => { if (clickTimer !== null) window.clearTimeout(clickTimer); };
  }, [values, meta, year, x, y, r, t, xKey, yKey, sizeKey, colorKey, colorNorm, ramp, selected, mode, select, onExcludeTown]);

  // 懸停縣市預覽+已選泡泡邊線(使用者要求,7/30):選中的泡泡加描邊,跟未選中的(僅靠
  // fill-opacity 淡化)區分更清楚。懸停縣市預覽優先權更高(邊線較粗)。
  // 獨立 effect,不重啟補間動畫(hover 高頻變動)。
  useEffect(() => {
    const dots = d3.select(ref.current).select<SVGGElement>("g.dots");
    const selSet = selected ? new Set(selected) : null;
    const hovered = (p: Point) => !!(hoverCounty && townCounty.get(p.township) === hoverCounty);
    dots.selectAll<SVGCircleElement, Point>("circle")
      .attr("stroke", (p) => (hovered(p) || selSet?.has(p.township) ? t.accent : t.surface))
      .attr("stroke-width", (p) => (hovered(p) ? 1.8 : selSet?.has(p.township) ? 1.2 : 0.5));
  }, [hoverCounty, townCounty, t, values, meta, year, xKey, yKey, sizeKey, colorKey, selected]);

  // 框選(d3.brush):放開瞬間依模式做二選一——選取=框內泡泡併入名單(累加)、
  // 清除=框內泡泡移出名單(累減)。縮放改走滾輪(見下方 wheel effect),不再經過框選。
  // 名單存 App → 切年/切通道不清。選完即清掉框(名單已鎖定,殘框會誤導「鎖區域」)。
  // dots.raise() 把泡泡抬到 brush overlay 之上:tooltip 保留,從空白處起拖才框選。
  useEffect(() => {
    const svg = d3.select(ref.current);
    let bg = svg.select<SVGGElement>("g.brush");
    if (bg.empty()) bg = svg.append("g").attr("class", "brush");
    if (!mode) {
      // 兩個模式都關閉:拆掉 brush overlay(含游標樣式與拖曳偵測),拖曳空白處完全無反應
      bg.on(".brush", null);
      bg.selectAll("*").remove();
      // 拖曳平移(使用者要求,8/4):兩模式都關閉、且至少一軸有縮放時,拖曳空白處改成平移目前
      // 檢視範圍(比照抓著內容拖曳的直覺)。X/Y 各自只平移「目前有縮放」的那一軸;兩軸都沒縮放
      // 時完全不掛任何 pointer 互動,拖曳空白處維持縮放前的既有行為(無反應)。
      if (zoomX || zoomY) {
        const panRect = bg.append("rect")
          .attr("x", 0).attr("y", 0).attr("width", W).attr("height", H)
          .attr("fill", "none").attr("pointer-events", "all")
          // 重建當下若手勢仍在進行中(拖曳中途因 setZoomX/setZoomY 觸發這個 effect 重跑),
          // 新節點要直接接手顯示 "grabbing",不能先閃一下預設的 "grab"(見上方 panActiveRef 註解)。
          .style("cursor", panActiveRef.current ? "grabbing" : "grab");
        panRectSelRef.current = panRect;
        let panStart: { px: number; py: number; xDomain: [number, number] | null; yDomain: [number, number] | null } | null = null;
        const drag = d3.drag<SVGRectElement, unknown>()
          .on("start", (ev) => {
            panStart = { px: ev.x, py: ev.y, xDomain: zoomX, yDomain: zoomY };
            panActiveRef.current = true;
            panRectSelRef.current?.style("cursor", "grabbing");
          })
          .on("drag", (ev) => {
            if (!panStart) return;
            const dxPx = ev.x - panStart.px, dyPx = ev.y - panStart.py;
            // symlog 軸的平移在「轉換空間」做(同滾輪縮放,8/7):像素→轉換空間單位的換算
            // 用轉換空間寬度/像素寬度,拖曳距離才會與畫面位移一致(值空間換算只對線性軸成立)。
            const fwd = symlogFwd(SYMLOG_C), inv = symlogInv(SYMLOG_C);
            if (panStart.xDomain) {
              const [xr0, xr1] = x.range();
              if (xIsLog) {
                const uWidth = fwd(panStart.xDomain[1]) - fwd(panStart.xDomain[0]);
                setZoomX(panDomainInSpace(panStart.xDomain, fullXDomain, -dxPx * (uWidth / (xr1 - xr0)), fwd, inv));
              } else {
                const pxPerUnit = (xr1 - xr0) / (panStart.xDomain[1] - panStart.xDomain[0]);
                setZoomX(panDomain(panStart.xDomain, fullXDomain, -dxPx / pxPerUnit));
              }
            }
            if (panStart.yDomain) {
              const [yr0, yr1] = y.range();
              if (yIsLog) {
                const uWidth = fwd(panStart.yDomain[1]) - fwd(panStart.yDomain[0]);
                setZoomY(panDomainInSpace(panStart.yDomain, fullYDomain, -dyPx * (uWidth / (yr1 - yr0)), fwd, inv));
              } else {
                const pxPerUnit = (yr1 - yr0) / (panStart.yDomain[1] - panStart.yDomain[0]);
                setZoomY(panDomain(panStart.yDomain, fullYDomain, -dyPx / pxPerUnit));
              }
            }
          })
          .on("end", () => {
            panStart = null;
            panActiveRef.current = false;
            // 用 ref 拿「現在畫面上真正那顆」pan rect,不是這個閉包自己捕捉到的 panRect
            // (拖曳過程中很可能已經被 effect 重建過好幾輪、這顆早就不在 DOM 上了)。
            panRectSelRef.current?.style("cursor", "grab");
          });
        panRect.call(drag as any);
      }
      svg.select<SVGGElement>("g.dots").raise();
      return;
    }
    // extent=整張 SVG(不只軸內):邊緣泡泡可以「從軸外空白起拖」框起來(7/23 使用者回饋)
    const brush = d3.brush()
      .extent([[0, 0], [W, H]])
      .on("end", (ev) => {
        if (!ev.sourceEvent) return; // 程式化 brush.move(null) 不回圈
        if (!ev.selection) {
          // 點空白處(無拖曳):兩個模式都比照「再次點按鈕」退出目前模式,不動 selected 名單。
          bg.call(brush.move as any, null);
          setMode(null);
          return;
        }
        const rectSel = ev.selection as [[number, number], [number, number]];
        const pts = scatterPoints(values, meta, year)
          .map((p) => ({ township: p.township, cx: x(p[xKey]), cy: y(p[yKey]) }));
        const names = townsInRect(pts, rectSel);
        if (mode === "select") {
          select([...new Set([...(selected ?? []), ...names])]);
        } else {
          const rect = new Set(names);
          const remain = (selected ?? []).filter((tn) => !rect.has(tn));
          select(remain.length ? remain : null);
        }
        bg.call(brush.move as any, null);
      });
    bg.call(brush as any);
    svg.select<SVGGElement>("g.dots").raise();
    return () => { bg.on(".brush", null); };
  }, [values, meta, year, x, y, xKey, yKey, select, W, H, mode, selected, zoomX, zoomY, fullXDomain, fullYDomain]);

  // 雙擊圖表空白處還原縮放(使用者要求,7/31,8/4 改滾輪觸發):滾輪縮放會限縮 X/Y 軸範圍,雙擊空白處復原。
  // 泡泡自己的雙擊走既有「剔除」邏輯(見上方 dots effect)——用事件 target 是否為 circle 區分,
  // 不會互相搶(circle 的 dblclick 冒泡上來也會經過這裡,故排除 circle target)。
  useEffect(() => {
    const svg = d3.select(ref.current);
    svg.on("dblclick.zoomReset", (ev: MouseEvent) => {
      if ((ev.target as Element).tagName?.toLowerCase() === "circle") return;
      setZoomX(null); setZoomY(null);
      select(null); // 使用者要求(8/4):雙擊空白處一併回到初始無選取狀態,不分模式都適用
    });
    return () => { svg.on("dblclick.zoomReset", null); };
  }, [select]);

  // 滾輪縮放(使用者要求,8/4,取代原本的放大鏡框選按鈕):以游標位置為錨點,往上滾(deltaY<0)
  // 放大、往下滾縮小;數學細節見 zoomDomain(src/lib/scatterZoom.ts)。用原生 addEventListener
  // (而非 d3 的 .on)是為了明確傳入 { passive: false },讓 preventDefault() 能擋掉整頁捲動。
  // symlog 軸(人口密度)在「轉換空間」縮放(8/7 使用者定案):轉換空間值比例=像素比例,
  // 錨點像素級釘在游標下;值空間版在對數軸上第一格會被 clamp 推走(gapminder 實測半個繪圖區)。
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const ZOOM_STEP = 1.2;
    const fwd = symlogFwd(SYMLOG_C), inv = symlogInv(SYMLOG_C);
    const handler = (ev: WheelEvent) => {
      ev.preventDefault();
      const [px, py] = d3.pointer(ev, node);
      const factor = ev.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const xv = x.invert(px), yv = y.invert(py);
      setZoomX(xIsLog
        ? zoomDomainInSpace(x.domain() as [number, number], fullXDomain, xv, factor, fwd, inv)
        : zoomDomain(x.domain() as [number, number], fullXDomain, xv, factor));
      setZoomY(yIsLog
        ? zoomDomainInSpace(y.domain() as [number, number], fullYDomain, yv, factor, fwd, inv)
        : zoomDomain(y.domain() as [number, number], fullYDomain, yv, factor));
    };
    node.addEventListener("wheel", handler, { passive: false });
    return () => node.removeEventListener("wheel", handler);
  }, [x, y, fullXDomain, fullYDomain, xIsLog, yIsLog]);

  // tooltip 只列目前用到的通道指標(去重);千位以上整數千分位、其餘一位小數
  const tipKeys = [...new Set([xKey, yKey, sizeKey, ...(colorIsInd ? [colorKey] : [])])];
  const fmtV = (v: number) => (Math.abs(v) >= 1000 ? d3.format(",.0f")(v) : v.toFixed(1));
  const cbTicks = colorIsInd ? colorTicks(colorKey, safeDomain(domAll[colorKey], colorKey)) : [];
  const fmtTick = d3.format(",");
  // 大小圖例(嵌套同心圓,報刊慣例):代表值圓「底部對齊嵌套」,細引線從圓頂拉出標數值;
  // 用「同一把 r 尺度」→ 圖例圓=圖上泡泡實際大小。引線標籤太擠(圓頂間距<12px)時退成首尾兩顆。
  const R_MAX = R_RANGE[1];
  const LG_BASE = R_MAX * 2 + 10;             // 圓底部共同基線 y;上方留 ~10px 給最大圓的引線標籤(貼頂會被裁)
  const lgTop = (v: number) => LG_BASE - 2 * r(v); // 各圓頂 y(=引線高度)
  let sTicks = sizeTicks(safeDomain(domAll[sizeKey], sizeKey));
  if (sTicks.length === 3 && (lgTop(sTicks[1]) - lgTop(sTicks[2]) < 12 || lgTop(sTicks[0]) - lgTop(sTicks[1]) < 12))
    sTicks = [sTicks[0], sTicks[2]];
  const LG_W = R_MAX * 2 + 10 + 40;           // 圓 + 引線 + 數值標籤

  // 繪圖區的實際像素邊界:由量測到的 svg 渲染尺寸反推 viewBox 縮放比(xMin+meet ⇒ scale=min)。
  // 圖例列與白話解說都以此對齊:左緣=Y 軸線、(解說)右緣=X 軸終點(7/23 使用者指定)。
  const plotScale = Math.min(chartW / W, chartH / H);
  const plotLeft = Math.round(M.l * plotScale);
  const plotW = Math.round((W - M.r) * plotScale) - plotLeft;

  // 圖例列(7/23 使用者指定,7/30 改版+修正):放圖「上方」(控制列與圖之間),與繪圖區同寬——
  // 顏色圖例＋大小圖例都錨左緣(=Y 軸線),垂直置中;右側「選取」「清除」為互斥的框選模式切換鈕
  // (取代原本在圖表下方的一次性清除鈕):選取=框選/單擊把泡泡併入名單,清除=框選/單擊把泡泡移出名單。
  const hasSel = !!(selected && selected.length);
  const legendRow = (
    <div className="legend-row" style={{ display: "flex", alignItems: "center", columnGap: 28,
      rowGap: 8, flexWrap: "wrap", justifyContent: "space-between", marginBottom: 6,
      marginLeft: plotLeft, maxWidth: plotW }}>
    <div style={{ display: "flex", alignItems: "center", columnGap: 28, rowGap: 8, flexWrap: "wrap" }}>
      {colorIsInd ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: S.small, color: t.textMuted }}>
          <span>{formatParen(metricLabel(colorKey, lab(colorKey).label, lang), metricUnit(colorKey, lab(colorKey).unit, lang), lang)}</span>
          <svg className="colorbar" width={CB_W} height={34}>
            <defs>
              <linearGradient id="scatter-cb">
                {Array.from({ length: 11 }, (_, i) => (
                  <stop key={i} offset={`${i * 10}%`} stopColor={ramp(i / 10)} />
                ))}
              </linearGradient>
            </defs>
            <rect x={0} y={2} width={CB_W} height={10} rx={2} fill="url(#scatter-cb)" />
            {cbTicks.map((v) => {
              const cx = colorNorm!(v) * CB_W;
              return (
                <g key={v}>
                  <line x1={cx} x2={cx} y1={12} y2={16} stroke={t.textMuted} />
                  <text x={Math.min(Math.max(cx, 14), CB_W - 14)} y={28} textAnchor="middle" fontSize={S.legendTick} fill={t.textMuted}>{fmtTick(v)}</text>
                </g>
              );
            })}
          </svg>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: S.small, color: t.textMuted }}>
          <span>{tr.regionChannelLabel}</span>
          {REGIONS.map((rg) => (
            <span key={rg} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: S.small, color: t.textMuted }}>
              <span style={{ width: 12, height: 12, borderRadius: C.dot.radius, background: regionColor(rg, t.categorical), display: "inline-block" }} />{regionLabel(rg, lang)}
            </span>
          ))}
        </div>
      )}
      {/* 大小圖例(嵌套同心圓):小圓=低值、大圓=高值,圓徑=圖上實際大小;
          標籤+單位置於圓圈左側(7/23 版面調整:整列垂直置中,標籤不再疊圓圈上方) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: S.small, color: t.textMuted }}>
        <span className="size-legend-unit">{formatParen(tr.sizeChannelLabel, metricUnit(sizeKey, lab(sizeKey).unit, lang), lang)}</span>
        <svg className="size-legend" width={LG_W} height={LG_BASE + 2}>
          {sTicks.map((v) => {
            const rr = r(v);
            const ty = lgTop(v);
            return (
              <g key={v}>
                <circle cx={R_MAX} cy={LG_BASE - rr} r={rr} fill="none" stroke={t.textMuted} strokeWidth={1} />
                <line x1={R_MAX} y1={ty} x2={R_MAX * 2 + 8} y2={ty} stroke={t.textMuted} strokeWidth={0.75} />
                <text x={R_MAX * 2 + 10} y={ty + 3} textAnchor="start" fontSize={S.legendTick} fill={t.textMuted}>{fmtTick(v)}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
      {/* 選取/清除(使用者要求,7/30):兩者互斥的工具切換鈕(工具式,再按一次或切到另一顆即關閉;
          不會做完一次動作就自動退出)。清除鈕無選取時停用(沒東西可清,灰階不可點,不從 DOM 消失
          防版面跳動);名單清空後(見上方 useEffect)也會自動退出清除模式。縮放改走滾輪
          (8/4,取代原本這裡的放大鏡按鈕,見上方 wheel effect),雙擊空白處還原。 */}
      <div ref={controlsRef} className="scatter-select-controls" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexShrink: 0, flexGrow: 1, position: "relative" }}>
        {/* 樣式比照下方年份列的播放鈕(同一套 aria-pressed 開關視覺,使用者要求一致);
            class 不能共用 .year-play——會讓既有驗證腳本的 `.year-play` 選擇器同時選到
            兩顆按鈕而炸掉(strict mode 衝突),用專屬 class 名稱、CSS 規則另外掛。兩顆鈕都共用
            .scatter-select-toggle 拿視覺樣式,另外各自疊一個專屬 class 供驗證腳本精準辨識。 */}
        <button className="scatter-select-toggle scatter-mode-select" aria-pressed={selectMode}
          onClick={() => setMode((m) => (m === "select" ? null : "select"))}
          style={{ cursor: "pointer", fontSize: S.control, padding: "4px 14px", borderRadius: C.pill.radius,
            border: `1px solid ${selectMode ? t.accent : t.border}`,
            background: selectMode ? t.accent : t.surface,
            color: selectMode ? t.accentFg : t.text,
            fontFamily: "inherit", transition: "background .15s, border-color .15s, color .15s" }}>
          {tr.selectModeButton}
        </button>
        {/* 保留 .sel-clear 供既有驗證腳本辨識此鈕身分;視覺上與 .scatter-select-toggle 完全對稱
            (同一套 aria-pressed 開關視覺),只多疊加無選取時的停用樣式。 */}
        <button className="sel-clear scatter-select-toggle" aria-pressed={clearMode} disabled={!hasSel}
          onClick={() => setMode((m) => (m === "clear" ? null : "clear"))}
          style={{ fontSize: S.control, padding: "4px 14px", borderRadius: C.pill.radius,
            border: `1px solid ${clearMode ? t.accent : t.border}`,
            background: clearMode ? t.accent : t.surface,
            color: clearMode ? t.accentFg : t.text,
            cursor: hasSel ? "pointer" : "not-allowed", opacity: hasSel ? 1 : 0.4,
            fontFamily: "inherit", transition: "background .15s, border-color .15s, color .15s, opacity .15s" }}>
          {tr.clearModeButton}
        </button>
        {/* 使用說明(使用者要求,7/31):放在「清除」右邊,樣式比照「選取」鈕;點下彈出小視窗
            (絕對定位卡片,非原地展開),列點說明四個操作+目前選取狀態。內容用 .scatter-caption/
            .mini-count/.mini-hint 類名維持既有 verify 腳本可直讀 textContent 的介面不變。 */}
        <button className="scatter-select-toggle scatter-help-toggle" aria-pressed={showHelp} aria-expanded={showHelp}
          onClick={() => setShowHelp((v) => !v)}
          style={{ cursor: "pointer", fontSize: S.control, padding: "4px 14px", borderRadius: C.pill.radius,
            border: `1px solid ${showHelp ? t.accent : t.border}`,
            background: showHelp ? t.accent : t.surface,
            color: showHelp ? t.accentFg : t.text,
            fontFamily: "inherit", transition: "background .15s, border-color .15s, color .15s" }}>
          {tr.helpButton}
        </button>
      </div>
      {/* 使用說明彈窗(8/3 改 portal 到 document.body):不再用「相對按鈕列絕對定位」——那個
          做法無論怎麼調右緣/寬度,始終被外層卡片鏈上某層 overflow-hidden(100dvh 鎖屏設計
          需要,不能拿掉)限制住安全邊界,寬版面或特定視窗尺寸下仍可能被裁。改成量測按鈕列
          的 `getBoundingClientRect()`(見上方 helpPos)換算成 `position: fixed` 座標,
          `createPortal` 到 body——徹底跳出所有祖先的 overflow/裁切範圍,同時仍貼著按鈕列
          下方、右緣對齊按鈕列。維持「常駐 DOM、只切 display:block/none」不變,既有 verify
          腳本直讀 .scatter-caption/.mini-count/.mini-hint 的 textContent 不用改。 */}
      {createPortal(
        <div className="scatter-help-popup" style={{ display: showHelp ? "block" : "none", position: "fixed", top: helpPos.top, right: helpPos.right,
          // 寬度對齊 gapminder-bubble-globe-app 那邊的使用說明彈窗(540px):
          // 使用者實測比對兩個 app 發現這裡窄了 90px(450 vs 540),統一視覺規格。
          zIndex: 100, width: "min(540px, 85vw)", background: t.accentSoft,
          border: `1px solid color-mix(in srgb, ${t.accent} 35%, transparent)`,
          borderRadius: C.panel.radius, padding: "16px 20px", boxShadow: `0 12px 32px -8px ${t.text}55`,
          fontSize: S.caption, color: t.text, lineHeight: 1.8, textAlign: "left" }}>
          <p className="scatter-caption" style={{ margin: 0, color: t.textMuted }}>{buildScatterCaption(channels, vars, lang)}</p>
          {/* list-style 預設被 Tailwind preflight 歸零,使用者要求要看得到列點記號,明指 disc */}
          <ul style={{ margin: "8px 0 0", paddingLeft: 20, listStyleType: "disc", display: "flex", flexDirection: "column", gap: 4 }}>
            <li>{tr.helpBulletMapClick}</li>
            <li>{tr.helpBulletSelectMode}</li>
            <li>{tr.helpBulletClearMode}</li>
            <li>{tr.helpBulletZoom}</li>
            {hasSel ? (
              <>
                <li className="sel-count mini-count">{tr.selectedCountPrefix}{selected!.length}{tr.selectedCountSuffix}</li>
                <li className="mini-hint">{tr.returnToNationClears}</li>
              </>
            ) : (
              <li className="mini-hint">{tr.noSelectionYetHelp}</li>
            )}
          </ul>
        </div>,
        document.body
      )}
    </div>
  );

  return (
    <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column" }}>
      {legendRow}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        {/* h-full(wireframe v6):跟著卡片父容器長高,viewBox meet 等比容納 */}
        <svg ref={ref} width="100%" style={{ height: "100%", display: "block" }} />
        {/* 白話解說:每顆泡泡=一個鄉鎮+四通道怎麼讀,跟著下拉即時更新。
            wireframe v5:預設移交外殼(卡內右欄文字區),showCaption 時才在圖下渲染(方向 A 殼) */}
        {showCaption && (
          <p className="scatter-caption" style={{ marginTop: 6, marginBottom: 0, fontSize: S.caption,
            color: t.textMuted, lineHeight: 1.7, width: "100%" }}>
            {buildScatterCaption(channels, vars, lang)}
          </p>
        )}
        {/* 框選 coach mark(7/23,7/30 改版面文字):affordance 不可見的補救——圖內提示章,
            成功選取即收起。疊在圖左上(避開 Y 軸),點提示本身也可關。
            7/30:框選/單擊選取改為需先按「選取」開啟,提示文字同步更新引導。 */}
        {showBrushHint && (
          <button className="brush-hint" onClick={hideBrushHint} title={tr.gotItCloseHint}
            style={{ position: "absolute", top: 10, left: 78, display: "inline-flex", alignItems: "center",
              gap: 6, padding: "5px 12px", borderRadius: C.control.radius99, border: `1.5px dashed ${t.accent}`,
              background: t.accentSoft, color: t.accent, fontSize: S.caption, fontWeight: 600,
              cursor: "pointer", boxShadow: `0 2px 8px -4px ${t.text}44` }}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <rect x="1" y="1" width="12" height="12" rx="2" fill="none" stroke="currentColor"
                strokeWidth="1.5" strokeDasharray="3 2" />
            </svg>
            {tr.brushHintText}
          </button>
        )}
      </div>
      {hover && (
        <div style={{ position: "absolute", left: hover.x + 12, top: hover.y + 12, pointerEvents: "none",
          background: t.tooltip.bg, color: t.tooltip.fg, padding: C.tooltip.padding, borderRadius: C.tooltip.radius, fontSize: S.small, fontVariantNumeric: "tabular-nums" }}>
          {romanizePlaceName(hover.p.township, lang)}{tipKeys.map((k) => `${tr.tooltipSeparator}${metricLabel(k, lab(k).label, lang)} ${fmtV(hover.p[k])}`).join("")}
        </div>
      )}
    </div>
  );
}

// 控制列(合併單頁:提到頁首,全頁唯一控制。X 軸=全頁「當前指標」)
// token 樣式化原生 select:鍵盤/無障礙行為免費取得;下拉分「基本指標/十大死因」optgroup,
// 顏色通道另有前置「區域」選項。
export function ScatterControls({ meta, channels, onChannel }: {
  meta: Meta; channels: ScatterChannels; onChannel: (patch: Partial<ScatterChannels>) => void;
}) {
  const t = useTokens();
  const { lang, tr } = useLanguage();
  const vars = useMemo(() => scatterVars(meta), [meta]);
  const selStyle = {
    fontSize: S.caption, padding: "4px 8px", borderRadius: C.control.radius, border: `1px solid ${t.border}`,
    background: t.surface, color: t.text, cursor: "pointer", fontFamily: "inherit",
  } as const;
  const groups = [
    { label: tr.basicIndicatorsGroup, opts: vars.filter((v) => v.group === "ind").map((v) => ({ key: v.key, label: metricLabel(v.key, v.label, lang) })) },
    { label: tr.topTenCausesGroup, opts: vars.filter((v) => v.group === "cause").map((v) => ({ key: v.key, label: metricLabel(v.key, v.label, lang) })) },
  ];
  const chSelect = (ch: keyof ScatterChannels, label: string, value: string,
    pre?: { key: string; label: string }[]) => (
    <label key={ch} style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span>{label}</span>
      <select className="scatter-ch" data-ch={ch} aria-label={label} value={value} style={selStyle}
        onChange={(e) => onChannel({ [ch]: e.target.value } as Partial<ScatterChannels>)}>
        {pre?.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        {groups.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.opts.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );
  return (
    <div className="scatter-controls" style={{ display: "flex", alignItems: "center", gap: 14,
      flexWrap: "wrap", fontSize: S.caption, color: t.textMuted }}>
      {chSelect("x", tr.axisXLabel, channels.x)}
      {chSelect("y", tr.axisYLabel, channels.y)}
      {chSelect("color", tr.colorChannelLabel, channels.color, [{ key: "region", label: tr.regionChannelLabel }])}
      {chSelect("size", tr.sizeChannelLabel, channels.size)}
    </div>
  );
}
