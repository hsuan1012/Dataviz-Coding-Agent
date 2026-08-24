import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useAppState } from "../state/AppStateContext";
import { useTheme } from "../state/ThemeContext";
import { useLanguage } from "../state/LanguageContext";
import {
  METRICS,
  makeMetricScale,
  makeRadiusScale,
  makeColorNormalizer,
  metricLabel,
  metricUnit,
  rampColor,
  zoomTicks,
  thinTicks,
  TEAL_RAMP,
  TEAL_RAMP_DARK,
  type MetricKey,
} from "../lib/channels";
import { colorForRegion } from "../lib/regionColors";
import { strokeHighlight } from "../lib/globePoints";
import { formatCountryDisplayName } from "../lib/countryDisplayName";
import { geosInRect, normalizeRect, isBrushTrivial, type PlacedBubble } from "../lib/brushSelect";
import { buildYearIndex, interpolateRecord } from "../lib/interpolateRecords";
import { zoomDomain, panDomain, zoomDomainInSpace, panDomainInSpace } from "../lib/scatterZoom";
import type { CountryMeta, YearRecord } from "../data/types";

// 螢幕座標 → SVG viewBox 座標,走 CTM 反矩陣(letterbox 縮放/位移都安全)。
function toViewBox(svg: SVGSVGElement, clientX: number, clientY: number): [number, number] {
  const pt = new DOMPoint(clientX, clientY);
  const ctm = svg.getScreenCTM();
  if (!ctm) return [0, 0];
  const p = pt.matrixTransform(ctm.inverse());
  return [p.x, p.y];
}

// U4:viewBox 不再固定 720×480——卡片長寬比不是 3:2 時,固定 viewBox+meet 會等比縮放後
// letterbox 出大片空白（比照 township-drilldown-app 的 Scatter：viewBox=元素實際量測到的
// 顯示尺寸,W/H 隨版面用 ResizeObserver 更新,繪圖區永遠撐滿卡片,不留白）。
// U5:圖例移到頂部控制列後,右上角不用再留空間放圖例,top/right margin 可以縮小
// (實測 1536×781 截圖確認軸刻度/標籤沒被裁切)。
// U6:left 從 72 加大到 88——Y 軸旋轉標題原本 x=14,與最長刻度(income 的 "250,000")
// 的文字左緣距離不夠,擠在一起(使用者截圖抓到);實測放大到 88 後配合標題 x 右移
// 才有足夠留白(見下方 Y 軸標題註解)。
// U8-2:88 仍偏窄——使用者截圖回饋軸字還是貼著卡片左緣,再加大到 100,標題錨點
// x 同步從 16→24,與刻度數字左緣保持 >=12px 淨空(見下方 Y 軸標題註解)。
// 老師 8/3 回饋 Y 軸標題偏緊(當時 Y 軸標題 x=24)修正後,實測(getBoundingClientRect)
// 發現 X 軸標題反而幾乎貼齊刻度數字(bottom 僅差 0.02px)、加到 50 後量到 ~6px 又比 Y 軸
// 的 ~46px 明顯小——兩軸間距不一致(老師再回饋)。bottom 再加到 60 把 X 軸間距拉近 Y 軸,
// 兩者一起收斂到量測值接近的區間(見下方 Y 軸標題 x 同步調整)。
const MARGIN = { top: 16, right: 24, bottom: 60, left: 100 };

// 老師回饋:「全不選」狀態(selectedCountries 為空)散布圖改顯示全部國家的淺灰色泡泡,
// 取代原本的「請選擇國家」空白訊息——與地球儀的白底黑邊界中性狀態呼應(見 WorldGlobe.tsx
// NEUTRAL_CAP_COLOR 註解),讓三個視覺區塊在「還沒挑選任何國家」時有一致的中性樣貌。
const NEUTRAL_BUBBLE_COLOR = "#D1D5DB";

// 推估值旗標只有最初三指標（income/lifeExpectancy/population）才有；
// 新增的 childMortality/fertility 資料源沒有區分推估值，對應留空即視為非推估。
const PROJECTION_FIELD: Partial<
  Record<MetricKey, "incomeIsProjection" | "lifeExpectancyIsProjection" | "populationIsProjection">
> = {
  income: "incomeIsProjection",
  lifeExpectancy: "lifeExpectancyIsProjection",
  population: "populationIsProjection",
};

export function BubbleChart({
  countries,
  records,
}: {
  countries: CountryMeta[];
  records: YearRecord[];
}) {
  const { state, dispatch } = useAppState();
  const { dark } = useTheme();
  const { lang, t } = useLanguage();

  // viewBox=元素實際尺寸(1:1):外層 div 用 ResizeObserver 量測 clientWidth/clientHeight,
  // svg 的 viewBox 直接吃這組值,不再固定 720×480+preserveAspectRatio meet——viewBox 長寬比
  // 永遠等於容器長寬比,自然不會 letterbox 出空白。掛載時先同步量一次（effect 本身是非同步
  // 排程，若只靠 ResizeObserver 的第一次回呼，首幀會撈到 0 寬高導致泡泡/軸線短暫消失）。
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { w: W, h: H } = size;

  const countryByGeo = useMemo(() => {
    const map = new Map<string, CountryMeta>();
    for (const c of countries) map.set(c.geo, c);
    return map;
  }, [countries]);

  // 老師回饋:「全不選」時改顯示全部國家(淺灰、無互動意義的中性泡泡),不再是空白訊息
  // ——見上方 NEUTRAL_BUBBLE_COLOR 註解。isNeutral 決定「要查/畫的國家集合」是全部
  // 國家還是勾選清單。
  const isNeutral = state.selectedCountries.size === 0;
  const activeGeos = useMemo(
    () => (isNeutral ? countries.map((c) => c.geo) : Array.from(state.selectedCountries)),
    [isNeutral, countries, state.selectedCountries]
  );

  // 8/7 平滑播放:年份可能是小數(rAF 播放中),改查內插層——整數年 fast path 回原始
  // 紀錄(行為與改版前相同),小數年逐指標線性內插。只查勾選中的國家,不再每次掃全表。
  const yearIndex = useMemo(() => buildYearIndex(records), [records]);
  const yearRecordByGeo = useMemo(() => {
    const map = new Map<string, YearRecord>();
    for (const geo of activeGeos) {
      const r = interpolateRecord(yearIndex, geo, state.currentYear);
      if (r) map.set(geo, r);
    }
    return map;
  }, [yearIndex, activeGeos, state.currentYear]);

  // 尺度隨通道動態重建：X/Y/大小三軸各自對應目前選的指標。range 也吃量測到的 W/H,
  // 卡片改變大小時（例如視窗縮放）繪圖區跟著重新鋪滿,不是被裁切或留白。
  // U19:zoomDomain 有值時,domain 換成放大鏡框選出的資料值範圍(makeMetricScale 內同時
  // 把該軸暫時改成線性刻度——方案 A,見該函式註解)。
  const xScale = useMemo(
    () => makeMetricScale(state.channels.x, [MARGIN.left, W - MARGIN.right], state.zoomDomain.x),
    [state.channels.x, W, state.zoomDomain.x]
  );
  const yScale = useMemo(
    () => makeMetricScale(state.channels.y, [H - MARGIN.bottom, MARGIN.top], state.zoomDomain.y),
    [state.channels.y, H, state.zoomDomain.y]
  );
  // U7:半徑範圍放大(使用者回饋原本泡泡偏小、視覺張力不足),[3,40]→[5,56]
  // (最小國家仍可見、最大國家「中國/印度」有份量);實測 1536×781 截圖確認最大泡泡
  // 沒壓到軸線或超出繪圖區太多,故未退回 [5,52] 備案。
  // U21:改吃各指標各自的 sizeRange,不再全部指標共用同一組 [5,56]——線性窄定義域指標
  // (平均餘命/兒童死亡率/總生育率)套用寬範圍會讓幾乎所有國家的正規化值落在中高段,
  // 全部推到接近最大半徑,畫面糊成一團(使用者截圖回饋的真 bug),詳見 channels.ts 註解。
  const rScale = useMemo(
    () => makeRadiusScale(state.channels.size, METRICS[state.channels.size].sizeRange),
    [state.channels.size]
  );

  // 顏色：洲別走既有分類色；連續指標走青綠色階（值缺失時退回中性灰）。
  // 深色模式回饋:洲別色/色階都要換成深色模式版本(見 regionColors.ts/channels.ts)。
  const colorOf = useMemo(() => {
    if (isNeutral) {
      return () => NEUTRAL_BUBBLE_COLOR;
    }
    if (state.channels.color === "region") {
      return (country: CountryMeta, _record: YearRecord) => colorForRegion(country.region, dark);
    }
    const normalize = makeColorNormalizer(state.channels.color as MetricKey);
    const ramp = rampColor(dark ? TEAL_RAMP_DARK : TEAL_RAMP);
    return (_country: CountryMeta, record: YearRecord) => {
      const v = record[state.channels.color as MetricKey];
      return v === null ? "var(--color-border)" : ramp(normalize(v));
    };
  }, [isNeutral, state.channels.color, dark]);

  // 8/4 使用者回饋:單擊泡泡加入/移出(toggle),不再需要雙擊——與地球儀點位的
  // FOCUS_TOGGLE 操作邏輯一致(見 WorldGlobe.tsx onPolygonClick)。原本用 200ms
  // timer 讓 dblclick 蓋過單擊的技巧(避免點兩下先加入又立刻被雙擊移除的競態)
  // 已不需要——單擊本身就同時處理加入與移出兩種情況,不再有兩個互斥的事件要協調。
  const onBubbleClick = (geo: string) => {
    dispatch({ type: "FOCUS_TOGGLE", geo });
  };

  // 框選拖曳:svgRef 供 CTM 換算與 pointer capture;dragStart/dragCurrent(state)驅動視覺重繪。
  // 另外用 ref 同步鏡射同一組值,給 endDrag 讀:pointermove 之後緊接著的 pointerup/pointercancel
  // 有時會在 React 還沒 flush 該次 setState 前就被瀏覽器連續送達(尤其是 pointercancel 這種
  // 非使用者觸發的收尾事件),此時 endDrag 若只讀 state closure 會撈到「上一輪」的舊值
  // (等於 dragStart,判定成誤觸而整段丟棄),造成偶發性框選被吃掉。ref 是同步寫入,不受
  // React 批次/commit 時機影響,才能保證 endDrag 永遠讀到最新拖曳終點。
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragStart, setDragStart] = useState<[number, number] | null>(null);
  const [dragCurrent, setDragCurrent] = useState<[number, number] | null>(null);
  const dragStartRef = useRef<[number, number] | null>(null);
  const dragCurrentRef = useRef<[number, number] | null>(null);

  // 目前實際用到的指標欄位：X/Y/大小一定用到；顏色若是連續指標也算一份。
  // 任一使用中通道值缺失（null）的國家不畫，避免座標/半徑算出 NaN。
  const usedMetricKeys: MetricKey[] = [state.channels.x, state.channels.y, state.channels.size];
  if (state.channels.color !== "region") usedMetricKeys.push(state.channels.color as MetricKey);

  const bubbles = activeGeos
    .map((geo) => {
      const country = countryByGeo.get(geo);
      const record = yearRecordByGeo.get(geo);
      if (!country || !record) return null;
      if (usedMetricKeys.some((key) => record[key] === null)) return null;
      return { country, record };
    })
    .filter((b): b is { country: CountryMeta; record: YearRecord } => b !== null)
    // 依目前的「大小」通道由大到小排序後繪製：數值大的泡泡先畫在下層，
    // 數值小的泡泡後畫在上層，避免全選 195 國時小國被完全遮住。
    .sort((a, b) => (b.record[state.channels.size] ?? 0) - (a.record[state.channels.size] ?? 0));

  const plotLeft = MARGIN.left;
  const plotRight = W - MARGIN.right;
  const plotTop = MARGIN.top;
  const plotBottom = H - MARGIN.bottom;

  const xMetric = METRICS[state.channels.x];
  const yMetric = METRICS[state.channels.y];
  // U19:縮放中該軸改用動態算出的刻度(~6 個),未縮放維持指標原本手調的固定刻度。
  // 8/7 加 thinTicks 像素稀疏化:scaleLog ticks 的 1..9×10^n 序列在高值端像素被壓縮,
  // 相鄰標籤幾乎貼住(正式站實測「9,000|10,000」黏連)——X 依格式化字串估寬(×7px+6px
  // 間距)、Y 固定行高 16px,裝不下就跳過該格。
  const xTickValues = state.zoomDomain.x
    ? thinTicks(zoomTicks(state.zoomDomain.x, xMetric.scaleType), (v) => xScale(v),
        (a, b) => ((xMetric.format(a).length + xMetric.format(b).length) / 2) * 7 + 6)
    : xMetric.ticks;
  const yTickValues = state.zoomDomain.y
    ? thinTicks(zoomTicks(state.zoomDomain.y, yMetric.scaleType), (v) => yScale(v), () => 16)
    : yMetric.ticks;

  // X 軸標題錨點:一律用「未縮放」尺度算預設刻度陣列中間刻度的像素位置——老師 8/3 要求
  // 對齊預設視圖的刻度中點(log 下幾何中心不精確對齊任何刻度);8/7 使用者回饋縮放前後
  // 標題不能有任何移動(第一版「縮放中改幾何中心」進出縮放仍跳 20px)。預設尺度不吃
  // zoomDomain,這個值對同一指標+同一寬度恆定,縮放怎麼滾都不動。
  const xTitleX = useMemo(() => {
    const defaultScale = makeMetricScale(state.channels.x, [MARGIN.left, W - MARGIN.right]);
    const ticks = METRICS[state.channels.x].ticks;
    return defaultScale(ticks[Math.floor((ticks.length - 1) / 2)]);
  }, [state.channels.x, W]);

  const hasFocus = state.focusSelection.size > 0;

  // 框選 pointer 事件:pointerdown 在透明 overlay 上起拖(僅 focusMode !== null 時渲染),
  // capture 掛在 svg 本體上,拖出圖外仍能收到 move/up(比照鄉鎮版拆 brush)。
  const onOverlayPointerDown = (ev: ReactPointerEvent<SVGRectElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.setPointerCapture(ev.pointerId);
    const pt = toViewBox(svg, ev.clientX, ev.clientY);
    dragStartRef.current = pt;
    dragCurrentRef.current = pt;
    setDragStart(pt);
    setDragCurrent(pt);
  };
  const endDrag = () => {
    // 讀 ref(同步、永遠最新),不讀 state closure,避免 pointerup/pointercancel 搶在
    // 上一次 pointermove 的 setState 被 React flush 前就送達,導致撈到舊值誤判誤觸。
    const start = dragStartRef.current;
    const current = dragCurrentRef.current;
    if (start && current) {
      const rect = normalizeRect(start, current);
      if (!isBrushTrivial(rect)) {
        const placed: PlacedBubble[] = bubbles.map(({ country, record }) => ({
          geo: country.geo,
          cx: xScale(record[state.channels.x]!),
          cy: yScale(record[state.channels.y]!),
        }));
        dispatch({ type: "BRUSH_APPLY", geos: geosInRect(placed, rect) });
      }
    }
    dragStartRef.current = null;
    dragCurrentRef.current = null;
    setDragStart(null);
    setDragCurrent(null);
  };

  // 8/4 使用者要求:縮放後可以用滑鼠拖曳上下左右平移檢視範圍(比照 township-drilldown-app
  // Scatter.tsx 同一天做的同一個追加需求,數學核心 panDomain 移植自同一份 scatterZoom.ts)。
  // 只在「未開選取/清除模式」且「至少一軸已縮放」時掛這層 overlay——與框選 overlay 互斥渲染
  // (見下方 JSX,兩者不會同時出現),故不會搶拖曳手勢。pxPerUnit 用 scale.range() 換算「螢幕
  // 像素差」對應多少「資料值差」,和 township 完全同一套算法,只是改成 React pointer 事件而非
  // d3.drag。
  const canPan = state.focusMode === null && (state.zoomDomain.x !== null || state.zoomDomain.y !== null);
  const panStartRef = useRef<{
    px: number;
    py: number;
    xDomain: [number, number] | null;
    yDomain: [number, number] | null;
  } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  const onPanPointerDown = (ev: ReactPointerEvent<SVGRectElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.setPointerCapture(ev.pointerId);
    const pt = toViewBox(svg, ev.clientX, ev.clientY);
    panStartRef.current = { px: pt[0], py: pt[1], xDomain: state.zoomDomain.x, yDomain: state.zoomDomain.y };
    setIsPanning(true);
  };
  const endPan = () => {
    panStartRef.current = null;
    setIsPanning(false);
  };

  const onSvgPointerMove = (ev: ReactPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    if (panStartRef.current) {
      const start = panStartRef.current;
      const [px, py] = toViewBox(svg, ev.clientX, ev.clientY);
      const dxPx = px - start.px;
      const dyPx = py - start.py;
      let nextX = state.zoomDomain.x;
      let nextY = state.zoomDomain.y;
      // log 軸的平移在「轉換空間」做(同滾輪縮放,8/7):像素→轉換空間單位的換算用
      // 轉換空間寬度/像素寬度,拖曳距離才與畫面位移一致(值空間換算只對線性軸成立)。
      if (start.xDomain) {
        const [xr0, xr1] = xScale.range();
        if (METRICS[state.channels.x].scaleType === "log") {
          const uWidth = Math.log(start.xDomain[1]) - Math.log(start.xDomain[0]);
          nextX = panDomainInSpace(
            start.xDomain, METRICS[state.channels.x].domain, -dxPx * (uWidth / (xr1 - xr0)), Math.log, Math.exp);
        } else {
          const pxPerUnit = (xr1 - xr0) / (start.xDomain[1] - start.xDomain[0]);
          nextX = panDomain(start.xDomain, METRICS[state.channels.x].domain, -dxPx / pxPerUnit);
        }
      }
      if (start.yDomain) {
        const [yr0, yr1] = yScale.range();
        if (METRICS[state.channels.y].scaleType === "log") {
          const uWidth = Math.log(start.yDomain[1]) - Math.log(start.yDomain[0]);
          nextY = panDomainInSpace(
            start.yDomain, METRICS[state.channels.y].domain, -dyPx * (uWidth / (yr1 - yr0)), Math.log, Math.exp);
        } else {
          const pxPerUnit = (yr1 - yr0) / (start.yDomain[1] - start.yDomain[0]);
          nextY = panDomain(start.yDomain, METRICS[state.channels.y].domain, -dyPx / pxPerUnit);
        }
      }
      dispatch({ type: "SET_ZOOM_DOMAIN", x: nextX, y: nextY });
      return;
    }
    if (!dragStartRef.current) return;
    const pt = toViewBox(svg, ev.clientX, ev.clientY);
    dragCurrentRef.current = pt;
    setDragCurrent(pt);
  };
  const onSvgPointerUp = (_ev: ReactPointerEvent<SVGSVGElement>) => {
    if (panStartRef.current) {
      endPan();
      return;
    }
    endDrag();
  };

  // 8/4 使用者要求:散布圖改用滑鼠滾輪縮放,取代原本的放大鏡框選按鈕(比照
  // township-drilldown-app Scatter.tsx 同一天做的同一個改動)。以游標位置為錨點,
  // 往上滾(deltaY<0)放大、往下滾縮小;數學細節見 zoomDomain(src/lib/scatterZoom.ts)。
  // 用原生 addEventListener(而非 React 的 onWheel)是為了明確傳入 { passive: false },
  // 讓 preventDefault() 能擋掉整頁捲動——在泡泡圖上滾滑鼠不該連帶捲動外層頁面。
  // X/Y 兩軸各自獨立縮放/還原(zoomDomain 各自可能先縮到底變回 null),不再像框選版本
  // 綁死同進退一組矩形。
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const ZOOM_STEP = 1.2;
    const handler = (ev: WheelEvent) => {
      ev.preventDefault();
      const [px, py] = toViewBox(svg, ev.clientX, ev.clientY);
      const factor = ev.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const xv = xScale.invert(px);
      const yv = yScale.invert(py);
      // log 軸在「對數轉換空間」縮放(8/7 使用者定案):轉換空間值比例=像素比例,
      // 錨點像素級釘在游標下;值空間版在人均所得軸第一格會被 clamp 推走半個繪圖區(實測)。
      // 詳見 scatterZoom.ts 註解與 scatterZoom.test.ts。
      const nextX = METRICS[state.channels.x].scaleType === "log"
        ? zoomDomainInSpace(xScale.domain() as [number, number], METRICS[state.channels.x].domain, xv, factor, Math.log, Math.exp)
        : zoomDomain(xScale.domain() as [number, number], METRICS[state.channels.x].domain, xv, factor);
      const nextY = METRICS[state.channels.y].scaleType === "log"
        ? zoomDomainInSpace(yScale.domain() as [number, number], METRICS[state.channels.y].domain, yv, factor, Math.log, Math.exp)
        : zoomDomain(yScale.domain() as [number, number], METRICS[state.channels.y].domain, yv, factor);
      dispatch({ type: "SET_ZOOM_DOMAIN", x: nextX, y: nextY });
    };
    svg.addEventListener("wheel", handler, { passive: false });
    return () => svg.removeEventListener("wheel", handler);
  }, [xScale, yScale, state.channels.x, state.channels.y, dispatch]);

  // U19:雙擊圖表空白處還原縮放(滾輪縮放的一次性重置手勢)。泡泡本身的單擊走 onBubbleClick
  // 的 toggle 邏輯,雙擊泡泡時中間那次單擊也會照樣 toggle、只是沒有專屬的雙擊效果——用
  // target 是否為 circle 排除,這裡的空白處還原手勢才不會被泡泡的點擊事件冒泡誤觸發。
  // 8/4 使用者回饋:雙擊空白處除了還原縮放,也要清空選取,回到「無國家被選取」的初始狀態。
  const onSvgDoubleClick = (ev: ReactMouseEvent<SVGSVGElement>) => {
    if ((ev.target as Element).tagName?.toLowerCase() === "circle") return;
    dispatch({ type: "EXIT_ZOOM" });
    dispatch({ type: "FOCUS_CLEAR" });
  };

  const brushRect = dragStart && dragCurrent ? normalizeRect(dragStart, dragCurrent) : null;

  return (
    // U4:外層容器負責被 ResizeObserver 量測,永遠掛載(不論有沒有勾選國家/寬高是否量到),
    // 這樣 mount 時才裝得到 ref、切分支時 ResizeObserver 不會遺失。
    <div ref={containerRef} className="w-full h-full min-h-0 min-w-0">
      {W <= 0 || H <= 0 ? null : (
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={t.scatterSvgAriaLabel}
          // 框選拖曳(pointerdown→move)途中滑鼠掃過軸刻度/標題的 <text>,瀏覽器預設會把它們
          // 當成一般文字反白選取(藍底),蓋住框選視覺、體驗很差。userSelect: "none" 關掉整張
          // SVG 的文字選取,拖曳只留下我們自繪的 brush 矩形,不影響 pointer 事件本身。
          style={{ userSelect: "none" }}
          onPointerMove={onSvgPointerMove}
          onPointerUp={onSvgPointerUp}
          onPointerCancel={onSvgPointerUp}
          onDoubleClick={onSvgDoubleClick}
        >
      {/* U19:裁切區=兩軸圍成的繪圖區(不含軸線本身留白)。縮放後範圍外的泡泡會被比例尺
          外插到軸線之外,靠這個 clipPath 把泡泡層(見下方 g.clip-path)乾淨裁掉,不會疊到
          軸線外或刻度文字上。軸/浮水印不套用,維持既有外觀。 */}
      <defs>
        <clipPath id="bubble-plot-clip">
          <rect x={plotLeft} y={plotTop} width={plotRight - plotLeft} height={plotBottom - plotTop} />
        </clipPath>
      </defs>
      {/* X 軸 */}
      <line x1={plotLeft} y1={plotBottom} x2={plotRight} y2={plotBottom} stroke="var(--color-border)" />
      {xTickValues.map((tick) => {
        const x = xScale(tick);
        return (
          <g key={`x-tick-${tick}`}>
            <line x1={x} y1={plotBottom} x2={x} y2={plotBottom + 6} stroke="var(--color-border)" />
            <text
              className="x-tick-label"
              x={x}
              y={plotBottom + 20}
              textAnchor="middle"
              fontSize={12}
              fill="var(--color-text-muted)"
              fontFamily="var(--font-sans)"
            >
              {xMetric.format(tick)}
            </text>
          </g>
        );
      })}
      {/* 老師 8/3 回饋:X 軸標題該對齊「刻度中點」的實際像素位置(x=10,000那個刻度),
          不是繪圖框的幾何中心——log 刻度下兩者不是同一點(值域中點 √(300×250000)≈8660,
          换算成像素位置會落在幾何中心偏左一點,但不精確對齊任何刻度)。改用 xScale 對齊
          目前刻度陣列的正中間那個刻度。
          8/7 使用者回饋:縮放中刻度每滾一格就重算,中間刻度的像素位置跟著跳,標題滑來
          滑去;二次回饋連「進出縮放」的一次性跳動也要消除——錨點改用上方 xTitleX
          (未縮放尺度算的恆定值),縮放前後與縮放中完全不動。 */}
      <text
        x={xTitleX}
        y={H - 6}
        textAnchor="middle"
        fontSize={13}
        fill="var(--color-text-muted)"
        fontFamily="var(--font-sans)"
      >
        {metricLabel(state.channels.x, lang)} ({metricUnit(state.channels.x, lang)})
      </text>

      {/* Y 軸 */}
      <line x1={plotLeft} y1={plotTop} x2={plotLeft} y2={plotBottom} stroke="var(--color-border)" />
      {yTickValues.map((tick) => {
        const y = yScale(tick);
        return (
          <g key={`y-tick-${tick}`}>
            <line x1={plotLeft - 6} y1={y} x2={plotLeft} y2={y} stroke="var(--color-border)" />
            <text
              className="y-tick-label"
              x={plotLeft - 10}
              y={y + 3}
              textAnchor="end"
              fontSize={12}
              fill="var(--color-text-muted)"
              fontFamily="var(--font-sans)"
            >
              {yMetric.format(tick)}
            </text>
          </g>
        );
      })}
      {/* U6:標題 x 從 14 右移到 16(離 SVG 左緣 14-16px、不裁切),同時把最長刻度
          (income 的 "250,000")的左緣往右推到 MARGIN.left=88,兩者中間留出 >=12px 淨空,
          解決標題文字貼著刻度數字的擁擠問題(使用者截圖回饋)。
          U8-2:仍嫌貼邊——x 再從 16→24,配合 MARGIN.left=100,維持與刻度數字 >=12px 淨空。
          老師 8/3 回饋①:X 軸標題與軸線間距明顯、Y 軸卻偏緊——X 改預設指標後兩軸角色對調,
          Y 軸不再固定是最長的 income 數字,但標題錨點 x 是寫死的常數不會跟著鬆動。
          x 從 24 收回到 16,實測(getBoundingClientRect)量到約 46px 間距,比 X 軸(當時
          修完約 6px)明顯寬——老師②回饋兩軸間距仍不一致。與其猜,直接用同一套量測工具
          反覆調整:x 從 16 移到 46(讓標題更靠近刻度數字),量到的間距落到與 X 軸(bottom
          從 50 加到 60)接近的個位數~十位數 px 區間,兩軸觀感一致。46 仍遠低於刻度數字
          左緣(約 x=62)與軸線(x=100),不會疊到刻度或裁到 SVG 左緣。 */}
      <text
        x={46}
        y={(plotTop + plotBottom) / 2}
        textAnchor="middle"
        fontSize={13}
        fill="var(--color-text-muted)"
        fontFamily="var(--font-sans)"
        transform={`rotate(-90, 46, ${(plotTop + plotBottom) / 2})`}
      >
        {metricLabel(state.channels.y, lang)} ({metricUnit(state.channels.y, lang)})
      </text>

      {/* U13:大年份浮水印(比照 Gapminder Bubbles 官方版)——墊在軸線之上、泡泡之下
          (JSX 順序放在軸之後、泡泡之前,同層的框選 overlay/brush 矩形不受影響:
          它們各自是獨立的 <rect>,疊在浮水印上層)。pointerEvents 關閉,不吃掉
          框選拖曳或泡泡點擊事件。播放中年份跳動:直接吃 state.currentYear,
          state 一變這裡自然重繪、不用額外處理。 */}
      {/* 置中=繪圖區(兩軸圍成的範圍)幾何中心;dominantBaseline central 對巨大字級的
          數字會偏低(em box 中心≠字形光學中心),改用 baseline+手動上移半個 cap height
          (數字 cap height≈0.7em)達到視覺置中(7/31 使用者回饋)。
          字級以繪圖區「高度」為基準放大(0.85 倍),寬度設上限(四位數約 2.4em)
          防止窄卡時水平溢出兩軸範圍——再大就會被軸切到。 */}
      <text
        x={(plotLeft + plotRight) / 2}
        y={(plotTop + plotBottom) / 2 + Math.min((plotBottom - plotTop) * 0.85, (plotRight - plotLeft) / 2.4) * 0.4}
        textAnchor="middle"
        fontSize={Math.min((plotBottom - plotTop) * 0.85, (plotRight - plotLeft) / 2.4)}
        fontWeight={600}
        fill="var(--color-border)"
        fontFamily="var(--font-sans)"
        style={{ fontVariantNumeric: "tabular-nums", pointerEvents: "none" }}
      >
        {Math.floor(state.currentYear)}
      </text>

      {/* 框選 overlay:僅 focusMode !== null 時渲染,拖曳完全無反應等於沒有這層。
          在泡泡「下層」(JSX 順序在前)渲染,單擊泡泡才不會被 overlay 吃掉,
          從空白處起拖才會框選。 */}
      {state.focusMode !== null && (
        <rect
          x={plotLeft}
          y={plotTop}
          width={plotRight - plotLeft}
          height={plotBottom - plotTop}
          fill="transparent"
          style={{ cursor: "crosshair" }}
          onPointerDown={onOverlayPointerDown}
        />
      )}
      {/* 拖曳平移 overlay:與上面的框選 overlay 互斥(focusMode===null 才會渲染這層),
          縮放後才出現、cursor 用 grab/grabbing 提示可拖曳,和框選的 crosshair 區隔。 */}
      {canPan && (
        <rect
          x={plotLeft}
          y={plotTop}
          width={plotRight - plotLeft}
          height={plotBottom - plotTop}
          fill="transparent"
          style={{ cursor: isPanning ? "grabbing" : "grab" }}
          onPointerDown={onPanPointerDown}
        />
      )}
      {brushRect && (
        <rect
          className="brush-rect"
          x={brushRect[0][0]}
          y={brushRect[0][1]}
          width={brushRect[1][0] - brushRect[0][0]}
          height={brushRect[1][1] - brushRect[0][1]}
          fill="var(--accent)"
          fillOpacity={0.08}
          stroke="var(--accent)"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          pointerEvents="none"
        />
      )}

      {/* U19:泡泡層套 clipPath——縮放後範圍外的泡泡(資料值落在縮放範圍外)會被比例尺
          外插到軸線之外,裁掉才不會疊到軸線外側或刻度文字上;未縮放時裁切區=完整繪圖區,
          泡泡本來就完整落在裡面(既有 PAD/clamp 機制不受影響)。 */}
      <g clipPath="url(#bubble-plot-clip)">
      {bubbles.map(({ country, record }) => {
        const isProjection = [state.channels.x, state.channels.y, state.channels.size].some((key) => {
          const field = PROJECTION_FIELD[key];
          return field ? record[field] : false;
        });
        const isFocused = state.focusSelection.has(country.geo);
        const isHovered = country.geo === state.hoveredCountry;
        const isDimmed = hasFocus && !isFocused;
        const xVal = record[state.channels.x]!;
        const yVal = record[state.channels.y]!;
        const sizeVal = record[state.channels.size]!;

        // U8-1:比照鄉鎮版 Scatter.tsx(144-198 行)的樣式邏輯——描邊改走 stroke 不透明、
        // 填色改走 fillOpacity,兩者分開控制(原本整體 opacity 會把描邊也一起變淡)。
        // 優先權:hover > 選中(focusSelection 內)> 一般/灰化。
        // 8/24 使用者回饋:hover 描邊從 --accent 青綠改成與地球儀邊框同一組玫紅
        // (strokeHighlight,比照鄉鎮版 Scatter 的懸停高亮)——地球儀 hover 國家時,
        // 散布圖對應泡泡同步亮玫紅外框;已選取(未 hover)仍維持 --accent 青綠。
        const fillOpacity = isDimmed ? 0.25 : isProjection ? 0.35 : 0.7;
        const strokeColor = isHovered
          ? strokeHighlight(dark)
          : isFocused
            ? "var(--accent)"
            : "var(--color-surface)";
        const strokeWidth = isHovered ? 2.5 : isFocused ? 1.2 : 0.5;

        return (
          <circle
            key={country.geo}
            className="bubble-dot"
            data-geo={country.geo}
            data-selected={isFocused ? "true" : undefined}
            cx={xScale(xVal)}
            cy={yScale(yVal)}
            r={rScale(sizeVal)}
            fill={isDimmed ? "var(--color-border)" : colorOf(country, record)}
            fillOpacity={fillOpacity}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            onMouseEnter={() => dispatch({ type: "SET_HOVERED", geo: country.geo })}
            onMouseLeave={() => dispatch({ type: "SET_HOVERED", geo: null })}
            onClick={() => onBubbleClick(country.geo)}
          >
            <title>
              {`${formatCountryDisplayName(country.name, country.iso2, lang)}（${Math.floor(record.year)}）${isProjection ? t.projectionSuffix : ""}\n` +
                `${metricLabel(state.channels.x, lang)}: ${xMetric.format(xVal)}\n` +
                `${metricLabel(state.channels.y, lang)}: ${yMetric.format(yVal)}`}
            </title>
          </circle>
        );
      })}
      {/* 老師 8/3 回饋:用「選取」框選/單擊加入的國家,泡泡旁顯示國名——
          獨立於上面的泡泡迴圈另畫一輪,確保標籤畫在所有泡泡「之上」(不被後畫的泡泡蓋住)。
          白色描邊(paintOrder="stroke")當文字底色的對比 halo,避免疊在深色泡泡或其他文字上看不清。
          pointerEvents 關閉,不擋泡泡的 hover/click。 */}
      {bubbles
        .filter(({ country }) => state.focusSelection.has(country.geo))
        .map(({ country, record }) => {
          const cx = xScale(record[state.channels.x]!);
          const cy = yScale(record[state.channels.y]!);
          const r = rScale(record[state.channels.size]!);
          return (
            <text
              key={`label-${country.geo}`}
              x={cx + r + 4}
              y={cy + 4}
              fontSize={12}
              fontWeight={600}
              fill="var(--color-text)"
              fontFamily="var(--font-sans)"
              stroke="var(--color-surface)"
              strokeWidth={3}
              paintOrder="stroke"
              style={{ pointerEvents: "none" }}
            >
              {formatCountryDisplayName(country.name, country.iso2, lang)}
            </text>
          );
        })}
      {/* 8/24:hover 中的泡泡在最上層再描一圈玫紅外框(比照鄉鎮版 Scatter 的 .raise())——
          泡泡本身的描邊會被後畫的重疊泡泡蓋住,地球儀 hover 到密集區的國家時外框可能
          整圈看不到;這圈畫在所有泡泡與選取標籤之後、pointerEvents 關閉不擋 hover/click。 */}
      {bubbles
        .filter(({ country }) => country.geo === state.hoveredCountry)
        .map(({ country, record }) => (
          <circle
            key={`hover-ring-${country.geo}`}
            className="bubble-hover-ring"
            cx={xScale(record[state.channels.x]!)}
            cy={yScale(record[state.channels.y]!)}
            r={rScale(record[state.channels.size]!)}
            fill="none"
            stroke={strokeHighlight(dark)}
            strokeWidth={2.5}
            pointerEvents="none"
          />
        ))}
      </g>
        </svg>
      )}
    </div>
  );
}
