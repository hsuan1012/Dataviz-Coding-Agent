import { typography as __ty, components as C } from "../lib/styleDictionary";
const S = __ty.sizes; // type scale:字級一律具名(見 styleDictionary)
import { useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import { useTokens } from "../lib/useTokens";
import { useLanguage } from "../state/LanguageContext";
import { romanizePlaceName } from "../lib/placeName";
import { metricLabel, metricUnit, regionLabel } from "../lib/metricI18n";
import { formatParen } from "../lib/i18n";
import { valueAt, villageValue, resolveMetric, REGIONS, type Values, type Meta, type IndicatorKey, type Region, type VillageProps } from "../lib/data";
import { colorForValue, regionColor } from "../lib/scales";
import { splitFeatures, countyFitFeatures, insetFitFeatures, countyOf, inTaiwanBox } from "../lib/counties";
import { drillToCounty, drillToTown, dataLevelOf, zoomDirection, type View } from "../lib/nav";
import { xToIndicator, type ColorKey } from "../lib/scatterChannels";
// 框位置與 scripts/check-inset-collision.mjs 共用真實來源（位置須通過碰撞檢查）
import { INSET_BOXES } from "../lib/insetBoxes.js";

// 顏色=區域時沒有 breaks 可用，固定的空陣列參照（不要在 render 內寫 []──那樣每次 render
// 都是新 reference，會讓下面 useEffect 的依賴陣列判定「breaks 變了」而每次 render 都重跑，
// 重跑一開頭的 setHover(null) 又把剛設好的 hover 立刻清空,滑鼠移上去 tooltip 顯示不出來）。
const NO_BREAKS: number[] = [];

// 使用者回饋:選取/hover 的縣市外框改玫紅色系(比照 gapminder-bubble-globe-app 的
// strokeColorFor)——這裡的 accent(青綠 #0D9488)剛好也是「中」區域的分類色(見
// styleDictionary.js categorical[1]),選到中部縣市時外框會融進自己的填色裡看不出來,
// 跟 gapminder 當初撞歐洲洲別色是同一個問題,同樣改玫紅色系解決(跟五個洲別色/區域色
// 都拉開色相距離,不論選哪個區域都不會撞色)。
const STROKE_HIGHLIGHT = "#DB2777";
const STROKE_HIGHLIGHT_DARK = "#F472B6";

export default function Choropleth({ geo, counties, values, meta, colorChannel, year, view, villages, selectedVillage, onView, onSelectVillage, legend = true, selectedTowns = null, onHoverCounty, fluid = false }: {
  geo: GeoJSON.FeatureCollection; counties: GeoJSON.FeatureCollection;
  values: Values; meta: Meta; colorChannel: ColorKey; year: number;
  view: View; villages: GeoJSON.FeatureCollection | null;
  selectedVillage: VillageProps | null;
  onView: (v: View) => void;
  onSelectVillage: (v: VillageProps | null) => void;
  legend?: boolean;   // 內建圖例（方向 A 外殼用）；Taste 外殼移到右側面板欄，設 false
  selectedTowns?: string[] | null;               // 合併單頁:選取鄉鎮名單 → accent 疊加層(縣級聚合語意不變)
  onHoverCounty?: (c: string | null) => void;    // 全國層懸停縣市 → 散布圖泡泡描邊預覽
  fluid?: boolean;    // 合併單頁窄欄:寬度驅動(height:auto 隨 viewBox 比例),不用舊版 72vh 高度公式(窄欄會上下 letterbox)
}) {
  const ref = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);          // 縮放動畫容器(svg 的父層,絕對定位分身用)
  const prevViewRef = useRef<View>(view);                   // 上一次的 view,用來算深度差＝縮放方向
  const clickAnchorRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null); // 縮放中心點(相對 svg 容器像素)
  const ghostTimerRef = useRef<number | null>(null);        // 分身移除的 timer,供並發保護清除用
  const t = useTokens();
  const { lang, tr } = useLanguage();
  const [hover, setHover] = useState<{ x: number; y: number; name: string; val: number | undefined; pop?: number | null; region?: Region } | null>(null);
  // 老師 8/11 回饋:地圖塗色改跟隨散布圖「顏色」通道(取代原本綁死 X 軸指標)。
  // 顏色=區域時走分類色(regionColor),不解析出 ind;其餘情形沿用既有 resolveMetric 連續色階。
  const colorIsRegion = colorChannel === "region";
  const { indicator: fillIndicator, deathCause: fillDeathCause } = colorIsRegion
    ? { indicator: "density" as IndicatorKey, deathCause: undefined as string | undefined }
    : xToIndicator(colorChannel);
  const ind = colorIsRegion ? null : resolveMetric(meta, fillIndicator, fillDeathCause);
  const level = dataLevelOf(view);
  const breaks = ind ? (ind.breaksByLevel[level] ?? ind.breaks) : NO_BREAKS;

  useEffect(() => {
    const svgNode = ref.current;
    const svg = d3.select(svgNode);

    // --- 縮放動畫(老師建議):偵測 view 深度是否改變,只有下鑽/返回才觸發；
    // 換指標/年份/主題/框選也會重跑這個 effect,但 view 沒變,direction 會是 null、不動作 ---
    const direction = zoomDirection(prevViewRef.current, view);
    prevViewRef.current = view;
    const anchor = clickAnchorRef.current;
    clickAnchorRef.current = null; // 用過即清，防止陳舊點擊座標被下一次無關的重繪誤用
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let ghostImg: HTMLImageElement | null = null;
    if (direction) {
      // 並發保護:先清掉任何殘留分身——但只在「這一輪真的要下鑽/返回」時做。
      // 若對每一輪重繪都無條件清，會誤殺村里 lazy-load 那一輪(direction=null)造成的
      // 「動畫仍在播放中」的舊分身與其 timer(見 final review Critical bug：白閃)。
      if (ghostTimerRef.current !== null) { window.clearTimeout(ghostTimerRef.current); ghostTimerRef.current = null; }
      wrapperRef.current?.querySelectorAll("img[data-zoom-ghost]").forEach((el) => el.remove());
    }
    if (direction && !reduceMotion && svgNode && wrapperRef.current) {
      // 分身尺寸需在 D3 重繪、真實 svg 改變外觀比例前先量好(見 final review：方向 A 外殼
      // 非 fluid 模式下，wrapper 的框會隨新層級的 svg 內在尺寸改變，分身若用 inset:0 百分比
      // 會被硬塞進新層級的框形狀，造成明顯縮放走位)
      const svgRect = svgNode.getBoundingClientRect();
      // 分身用 position:fixed + viewport 座標(而非相對 wrapper 的 position:absolute)：
      // 非 fluid 模式下 wrapper 外層是 width:fit-content + margin:0 auto 的置中 flex 列，
      // D3 重繪後真實 svg 變窄會讓整列跟著置中重新定位，wrapper 自己的 viewport 座標也會位移
      // (除錯實測抓到約 65px 位移)；分身若仍相對 wrapper 定位就會被一起拖走。position:fixed
      // 直接釘住當下量到的 viewport 座標，不受之後 wrapper/外層列位移影響(此元件周邊祖先皆無
      // transform/filter/perspective，不會把 fixed 改成相對某個祖先定位)。
      // 分身用 <img>(序列化目前 svg 為 data URI),不是 cloneNode 插入真的 <svg>——
      // 這樣動畫期間不會被任何既有驗證腳本的 `svg path` 查詢誤數到（見 plan Global Constraints）
      const clone = svgNode.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.removeAttribute("style"); // 清掉可能殘留的 transform/opacity/transition 行內樣式，避免分身從錯誤狀態開始播放
      // 序列化後的獨立 SVG 拿不到外部 CSS/webfont，地名文字會退回不搭的系統字體——明確指定行內字體
      clone.style.fontFamily = "'Microsoft JhengHei', system-ui, sans-serif";
      const svgStr = new XMLSerializer().serializeToString(clone);
      ghostImg = document.createElement("img");
      ghostImg.dataset.zoomGhost = "true";
      ghostImg.setAttribute("aria-hidden", "true");
      ghostImg.alt = "";
      ghostImg.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);
      // max-width:none/max-height:none 必須明講——Tailwind Preflight 對 <img> 套用
      // max-width:100%(隨容器即時重算,不是建立當下就定案的值)。wrapper 的寬度在非 fluid
      // 模式下是被真實 svg 撐出來的，D3 重繪後 svg 變窄，wrapper 也跟著變窄，若沒有這行，
      // 分身這裡設的明確 px 寬度會被 max-width:100% 依「重繪後」的新容器寬度重新夾住，
      // 等於繞了一圈又被壓縮回本來要修的那個走位 bug（除錯時實測抓到，明確 px 寬高本身還不夠）。
      ghostImg.style.cssText = `position:fixed;left:${svgRect.left}px;top:${svgRect.top}px;width:${svgRect.width}px;height:${svgRect.height}px;max-width:none;max-height:none;object-fit:contain;pointer-events:none;z-index:1;`;
      wrapperRef.current.appendChild(ghostImg);
    }

    svg.selectAll("*").remove();
    const W = 800, H = 900;
    svg.attr("viewBox", `0 0 ${W} ${H}`);
    setHover(null);

    // 各層級的名稱/取值/點擊行為（nation 畫縣市、county 畫鄉鎮、town 畫村里）
    const nameOf = (f: GeoJSON.Feature): string => {
      const p = f.properties as any;
      return level === "county" ? p.COUNTYNAME : level === "town" ? p.FULLNAME : p.VILLNAME;
    };
    // 縣→區域 對照(meta.regions 以鄉鎮 FULLNAME 為鍵,全國層畫的是縣多邊形,要從隨便一個
    // 屬於該縣的鄉鎮回推區域——同縣鄉鎮的區域一律相同,取第一筆即可)。
    const countyRegionCache = new Map<string, Region | undefined>();
    const regionOfCounty = (countyName: string): Region | undefined => {
      if (countyRegionCache.has(countyName)) return countyRegionCache.get(countyName);
      const f = geo.features.find((gf) => countyOf(gf) === countyName);
      const r = f ? meta.regions[(f.properties as any).FULLNAME as string] : undefined;
      countyRegionCache.set(countyName, r);
      return r;
    };
    const villageRegion = view.town ? meta.regions[view.town] : undefined; // 村里層:同一區的所有村里共用該區的區域
    const regionOfFeature = (f: GeoJSON.Feature): Region | undefined => {
      if (level === "county") return regionOfCounty(nameOf(f));
      if (level === "town") return meta.regions[(f.properties as any).FULLNAME as string];
      return villageRegion;
    };
    const valOf = (f: GeoJSON.Feature): number | undefined => {
      if (colorIsRegion || !ind) return undefined;
      const p = f.properties as any;
      if (level === "village") return villageValue(p as VillageProps, fillIndicator, year);
      return valueAt(values, ind.key, level, year, nameOf(f));
    };
    const clickOf = (f: GeoJSON.Feature): (() => void) | null => {
      const p = f.properties as any;
      if (level === "county") return () => onView(drillToCounty(p.COUNTYNAME));
      if (level === "town") return () => onView(drillToTown(view, p.FULLNAME, p.TOWNCODE));
      return () => onSelectVillage(p as VillageProps); // 村里=最末層：點選顯示資訊面板
    };
    const fillOf = (f: GeoJSON.Feature) => {
      if (colorIsRegion) {
        const r = regionOfFeature(f);
        return r ? regionColor(r, t.categorical) : t.surfaceAlt;
      }
      const v = valOf(f);
      return v === undefined ? t.surfaceAlt : colorForValue(v, breaks, t.densityScale);
    };
    const baseStroke = level === "village" ? 0.6 : 0.4;
    const highlightStroke = t.dark ? STROKE_HIGHLIGHT_DARK : STROKE_HIGHLIGHT;
    const isSelected = (f: GeoJSON.Feature) =>
      level === "village" && !!selectedVillage && (f.properties as any)?.VILLCODE === selectedVillage.VILLCODE;
    const strokeOf = (f: GeoJSON.Feature) => (isSelected(f) ? highlightStroke : t.border);
    const strokeWOf = (f: GeoJSON.Feature) => (isSelected(f) ? 2.2 : baseStroke);
    const wire = (selection: any) => {
      selection
        .attr("stroke", strokeOf).attr("stroke-width", strokeWOf)
        .style("cursor", "pointer")
        .on("mouseover", function (this: SVGPathElement, _ev: MouseEvent, f: GeoJSON.Feature) {
          d3.select(this).raise().attr("stroke", highlightStroke).attr("stroke-width", 1.8);
          // 全國層懸停縣市 → 散布圖該縣泡泡描邊預覽(合併單頁,7/22 雙向互動沿用)
          if (level === "county") onHoverCounty?.((f.properties as any).COUNTYNAME as string);
        })
        .on("mousemove", (ev: MouseEvent, f: GeoJSON.Feature) => {
          const p = f.properties as any;
          setHover({ x: ev.offsetX, y: ev.offsetY, name: nameOf(f), val: valOf(f),
            pop: level === "village" ? (p as VillageProps).pop : undefined,
            region: colorIsRegion ? regionOfFeature(f) : undefined });
        })
        .on("mouseleave", function (this: SVGPathElement, f: GeoJSON.Feature) {
          d3.select(this).attr("stroke", strokeOf(f)).attr("stroke-width", strokeWOf(f));
          setHover(null);
          if (level === "county") onHoverCounty?.(null);
        })
        .on("click", (ev: MouseEvent, f: GeoJSON.Feature) => {
          // 縣市/鄉鎮點擊會下鑽(觸發 zoom in)：先記錄點擊位置供縮放中心點用；
          // 村里點擊只顯示資訊面板、view 不變，不需要——即使意外設了也會在下一輪 effect
          // 開頭被無條件清掉，不會被日後無關的下鑽誤用（見 Step 5）
          if (level === "county" || level === "town") {
            const svgEl = (ev.currentTarget as SVGPathElement).ownerSVGElement;
            const rect = svgEl?.getBoundingClientRect();
            if (rect) clickAnchorRef.current = { x: ev.clientX - rect.left, y: ev.clientY - rect.top, w: rect.width, h: rect.height };
          }
          clickOf(f)?.();
        });
      // 選取的村里保持高亮在最上層
      selection.filter((f: GeoJSON.Feature) => isSelected(f)).raise();
    };
    // 合併單頁:選取名單的地圖表現=「灰階淡化」語言(與散布圖 7/23 定案一致)——
    // 底圖(縣級聚合)整層調暗保留脈絡,選中鄉鎮以「鄉鎮層級值」上色疊加(誠實顯示鄉鎮值,
    // 同下鑽後所見)。疊加層 pointer-events:none 不擋下鑽點擊;繪製集合由呼叫端給
    // (主圖/各 inset 各自投影與裁切,與 fit 排除集合一致——投影三件套教訓)。
    const selSet = selectedTowns && selectedTowns.length ? new Set(selectedTowns) : null;
    const townBreaks = ind ? (ind.breaksByLevel["town"] ?? ind.breaks) : [];
    const townFillOf = (f: GeoJSON.Feature) => {
      const full = (f.properties as any).FULLNAME as string;
      if (colorIsRegion) {
        const r = meta.regions[full];
        return r ? regionColor(r, t.categorical) : t.surfaceAlt;
      }
      if (!ind) return t.surfaceAlt;
      const v = valueAt(values, ind.key, "town", year, full);
      return v === undefined ? t.surfaceAlt : colorForValue(v, townBreaks, t.densityScale);
    };
    const DIM = 0.3; // 未選取底圖不透明度(灰階淡化)
    const drawSelOverlay = (parent: d3.Selection<SVGGElement, unknown, null, undefined>,
      feats: GeoJSON.Feature[], path: d3.GeoPath) => {
      if (!selSet) return;
      const sel = feats.filter((f) => selSet.has((f.properties as any).FULLNAME as string));
      if (!sel.length) return;
      parent.append("g").attr("class", "sel-overlay").attr("pointer-events", "none")
        .selectAll("path").data(sel).join("path")
        .attr("d", path as any)
        .attr("fill", townFillOf)
        .attr("stroke", highlightStroke).attr("stroke-width", 1);
    };
    // fontVB＝以 viewBox 座標為單位的字級；隨 viewBox 高度自動調整，讓各縣地名的「螢幕實際字級」一致可讀
    const drawLabels = (feats: GeoJSON.Feature[], path: d3.GeoPath, textOf: (f: GeoJSON.Feature) => string, minW = 28, fontVB = 11) => {
      const stroke = Math.max(2.5, fontVB * 0.3);
      const labels = svg.append("g").attr("pointer-events", "none");
      feats.forEach((f) => {
        const b = path.bounds(f as any);
        if (b[1][0] - b[0][0] < minW) return;               // 區塊太小不標
        const [cx, cy] = path.centroid(f as any);
        if (!isFinite(cx) || !isFinite(cy)) return;
        labels.append("text").attr("x", cx).attr("y", cy)
          .attr("text-anchor", "middle").attr("font-size", fontVB).attr("font-weight", 600)
          .attr("fill", t.text).attr("stroke", t.bg).attr("stroke-width", stroke)
          .attr("paint-order", "stroke")
          .text(textOf(f) ?? "");
      });
    };

    // 依實際繪出範圍裁 viewBox（去掉 fit 到 800×900 留下的空白邊）→ 小/寬扁區域填滿框、放大。
    // 回傳裁切後的 viewBox 高度（H 預設值＝沒有有效範圍時），供地名字級隨框縮放。
    const fitViewBox = (sel: typeof svg, path: d3.GeoPath, feats: GeoJSON.Feature[]): number => {
      const b = path.bounds({ type: "FeatureCollection", features: feats } as any);
      if (!isFinite(b[0][0]) || !isFinite(b[1][0])) return H;
      const pad = 16;
      const x = b[0][0] - pad, y = b[0][1] - pad;
      const w = b[1][0] - b[0][0] + pad * 2, h = b[1][1] - b[0][1] + pad * 2;
      if (w > 0 && h > 0) { sel.attr("viewBox", `${x} ${y} ${w} ${h}`); return h; }
      return H;
    };
    // 由裁切後 viewBox 高度推地名字級（viewBox 座標），使螢幕實際字級約一致（~13px）；夾在合理範圍
    const labelFont = (vbH: number) => Math.max(11, Math.min(20, vbH * 0.025));

    if (view.level === "nation") {
      // ---- 全國模式：縣市著色。主圖投影沿用鄉鎮界 fit（視野與舊版一致），離島 inset 框 ----
      const { main: mainTowns } = splitFeatures(geo.features);
      const { main: mainCounties, insets } = splitFeatures(counties.features);
      const proj = d3.geoMercator().fitSize([W, H],
        { type: "FeatureCollection", features: mainTowns.filter(inTaiwanBox) } as any);
      const path = d3.geoPath(proj);
      const gMain = svg.append("g");
      wire(gMain.selectAll<SVGPathElement, GeoJSON.Feature>("path").data(mainCounties).join("path")
        .attr("d", path as any).attr("fill", fillOf));
      if (selSet) gMain.attr("opacity", DIM); // 有名單:縣級底圖整層淡化,選中鄉鎮彩色疊加
      // 疊加集合=main 全部鄉鎮(不過濾):與名單一對一;遠海島礁投影落 viewBox 外由 svg 邊界裁掉
      drawSelOverlay(svg.append("g") as any, mainTowns, path);

      // 裁掉 fitSize 到 800×900 的左右死空間(viewBox=主島實繪範圍∪inset 框):
      // 地圖在容器內明顯放大(使用者 wireframe v3),與縣/村里層 fitViewBox 同一精神
      {
        const bb = path.bounds({ type: "FeatureCollection", features: mainTowns.filter(inTaiwanBox) } as any);
        let x0 = bb[0][0], y0 = bb[0][1], x1 = bb[1][0], y1 = bb[1][1];
        insets.forEach((_ins, i) => {
          const B = INSET_BOXES[i];
          x0 = Math.min(x0, B.x); y0 = Math.min(y0, B.y);
          x1 = Math.max(x1, B.x + B.w); y1 = Math.max(y1, B.y + B.h);
        });
        const pad = 8;
        if (isFinite(x0) && x1 > x0 && y1 > y0)
          svg.attr("viewBox", `${x0 - pad} ${y0 - pad} ${x1 - x0 + pad * 2} ${y1 - y0 + pad * 2}`);
      }

      insets.forEach((ins, i) => {
        const B = INSET_BOXES[i];
        const g = svg.append("g");
        g.append("rect").attr("x", B.x).attr("y", B.y).attr("width", B.w).attr("height", B.h)
          .attr("fill", "none").attr("stroke", t.border).attr("stroke-dasharray", "4 3").attr("rx", 6);
        g.append("text").attr("x", B.x + 8).attr("y", B.y + 16).attr("font-size", S.note)
          .attr("fill", t.textMuted).text(romanizePlaceName(ins.county, lang));
        const clipId = `inset-clip-${i}`;
        g.append("clipPath").attr("id", clipId)
          .append("rect").attr("x", B.x).attr("y", B.y).attr("width", B.w).attr("height", B.h);
        // fit 沿用鄉鎮界並排除離群島（烏坵），縣多邊形以同投影繪製、超框由 clipPath 裁掉
        const subProj = d3.geoMercator().fitExtent(
          [[B.x + 10, B.y + 24], [B.x + B.w - 10, B.y + B.h - 10]],
          { type: "FeatureCollection", features: insetFitFeatures(geo.features, ins.county) } as any);
        const subPath = d3.geoPath(subProj);
        const clipped = g.append("g").attr("clip-path", `url(#${clipId})`);
        wire(clipped.selectAll<SVGPathElement, GeoJSON.Feature>("path.inset-path").data(ins.features).join("path")
          .attr("class", "inset-path")
          .attr("d", subPath as any).attr("fill", fillOf));
        if (selSet) clipped.attr("opacity", DIM);
        // 疊加集合=該縣全部鄉鎮(含烏坵):與名單一對一,主地圖高亮數==已選數;
        // 烏坵投影落框外由同一 clipPath 裁掉(疊加層有 clip 可擋,與底圖 fit 排除集合不同)。
        // 疊加層獨立 clip 群組(clipped 已被淡化,不能共用)
        drawSelOverlay(g.append("g").attr("clip-path", `url(#${clipId})`) as any,
          geo.features.filter((f) => countyOf(f) === ins.county), subPath);
      });
    } else if (view.level === "county") {
      // ---- 縣內模式：該縣鄉鎮著色＋標籤，點鄉鎮下鑽村里（fit 套 bbox 防南海島礁）----
      const cf = geo.features.filter((f) => countyOf(f) === view.county);
      const proj = d3.geoMercator().fitSize([W, H],
        { type: "FeatureCollection", features: countyFitFeatures(geo.features, view.county!) } as any);
      const path = d3.geoPath(proj);
      const cfPaths = svg.append("g").selectAll<SVGPathElement, GeoJSON.Feature>("path").data(cf).join("path")
        .attr("d", path as any).attr("fill", fillOf);
      wire(cfPaths);
      // 縣層:整縣全選=常態(下鑽即整縣)不淡化;名單≠整縣時(雙擊剔除後)未選鄉鎮灰階淡化
      if (selSet && !cf.every((f) => selSet.has((f.properties as any).FULLNAME as string)))
        cfPaths.attr("fill-opacity", (f) => (selSet.has((f.properties as any).FULLNAME as string) ? 1 : 0.25));
      const cvbH = fitViewBox(svg, path, countyFitFeatures(geo.features, view.county!)); // 裁 viewBox 到該縣範圍→小/寬扁縣(如金門)也填滿框
      drawLabels(cf, path, (f) => romanizePlaceName((f.properties as any).TOWNNAME, lang), 28, labelFont(cvbH));
    } else if (villages) {
      // ---- 村里模式：該區村里著色＋標籤（fit 過濾遠海島礁；金馬全區在框外時退回全部）----
      const vf = villages.features;
      const fitFeats = vf.filter(inTaiwanBox);
      const proj = d3.geoMercator().fitSize([W, H],
        { type: "FeatureCollection", features: fitFeats.length ? fitFeats : vf } as any);
      const path = d3.geoPath(proj);
      wire(svg.append("g").selectAll<SVGPathElement, GeoJSON.Feature>("path").data(vf).join("path")
        .attr("d", path as any).attr("fill", fillOf));
      const vvbH = fitViewBox(svg, path, fitFeats.length ? fitFeats : vf); // 裁 viewBox 到村里範圍→填滿框
      drawLabels(vf, path, (f) => romanizePlaceName((f.properties as any).VILLNAME, lang), 34, labelFont(vvbH));
    }

    // --- 縮放動畫收尾:真實內容從縮小/透明狀態長回正常,分身反向放大/縮小淡出。
    // 雙重 requestAnimationFrame 讓瀏覽器先畫出「起點」那一幀,轉場才會真的播放
    // (同排名長條「從 0 長出」動畫的既有教訓:同一輪設起點+終點,瀏覽器會合併繪製、動畫不跑)。
    if (direction && !reduceMotion && ghostImg && svgNode) {
      const clampPct = (n: number) => Math.max(0, Math.min(100, n));
      const originPct = anchor && anchor.w > 0 && anchor.h > 0
        ? `${clampPct((anchor.x / anchor.w) * 100)}% ${clampPct((anchor.y / anchor.h) * 100)}%`
        : "50% 50%"; // 無點擊座標(麵包屑/網址深連結/瀏覽器上一頁)：固定以容器正中央為縮放中心
      // clamp 防呆：合成事件(如測試腳本用 dispatchEvent 不帶 clientX/clientY)會讓錨點座標算出負值或超界，
      // 真人點擊必落在 svg 範圍內不受影響——夾在 [0,100] 避免動畫朝容器外甩
      const enterFrom = direction === "in" ? "scale(0.92)" : "scale(1.08)";
      const exitTo = direction === "in" ? "scale(1.08)" : "scale(0.92)";
      const ghost = ghostImg;
      ghost.style.transformOrigin = originPct;
      svgNode.style.transformOrigin = originPct;
      svgNode.style.transition = "none";
      svgNode.style.transform = enterFrom;
      svgNode.style.opacity = "0";
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const EASE = "750ms cubic-bezier(0.4, 0, 0.2, 1)";
        ghost.style.transition = `transform ${EASE}, opacity ${EASE}`;
        ghost.style.transform = exitTo;
        ghost.style.opacity = "0";
        svgNode.style.transition = `transform ${EASE}, opacity ${EASE}`;
        svgNode.style.transform = "scale(1)";
        svgNode.style.opacity = "1";
      }));
      ghostTimerRef.current = window.setTimeout(() => {
        ghost.remove();
        svgNode.style.transition = "";
        ghostTimerRef.current = null;
      }, 850);
    }

  }, [geo, counties, villages, values, meta, colorChannel, year, t, lang, view, level, breaks, onView, selectedVillage, onSelectVillage, selectedTowns, onHoverCounty]);

  // 分身 timer 只在元件真正 unmount 時清——放在大繪圖 effect 裡的話，React 每次重跑該 effect
  // 前都會先執行其 cleanup，等同每一輪重繪(含村里 lazy-load 那次 direction=null 的重跑)都會
  // 把還在動畫中的分身 timer 取消掉，跟 Part A 是同一個白閃問題的另一面，必須分開一個
  // 只在掛載時註冊、依賴陣列為空的 effect 來做。
  useEffect(() => {
    return () => {
      if (ghostTimerRef.current !== null) window.clearTimeout(ghostTimerRef.current);
    };
  }, []);

  const fmtBreak = (b: number) => (b >= 100 ? b.toFixed(0) : b.toFixed(1));

  return (
    <div style={fluid ? { height: "100%", minHeight: 0 } : undefined}>
      {/* 麵包屑/提示/降級通知已移至外殼標題下方（MapBreadcrumb）*/}
      {/* 圖例放版面流（左欄），不再 absolute 疊在地圖上——大甲區等向西北延伸的形狀曾被圖例卡片遮住 */}
      <div style={fluid
        ? { display: "flex", width: "100%", height: "100%", minHeight: 0 }
        : { display: "flex", gap: 16, alignItems: "flex-start", width: "fit-content", maxWidth: "100%", margin: "0 auto" }}>
        {legend && <div className="map-legend" style={{ flexShrink: 0, background: t.surface, color: t.text,
          border: `1px solid ${t.border}`, borderRadius: C.panel.radius, padding: 8, fontSize: S.small }}>
          {colorIsRegion ? (
            <>
              <div style={{ marginBottom: 4 }}>{tr.regionChannelLabel}</div>
              {REGIONS.map((rg) => (
                <div key={rg} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 14, height: 14, background: regionColor(rg, t.categorical), display: "inline-block", borderRadius: C.swatch.radius }} />
                  <span>{regionLabel(rg, lang)}</span>
                </div>
              ))}
            </>
          ) : ind && (
            <>
              <div style={{ marginBottom: 4 }}>{formatParen(metricLabel(ind.key, ind.label, lang), metricUnit(ind.key, ind.unit, lang), lang)}</div>
              {t.densityScale.map((c: string, i: number) => {
                const lo = i === 0 ? "min" : fmtBreak(breaks[i - 1]);
                const hi = i === breaks.length ? "max" : fmtBreak(breaks[i]);
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 14, height: 14, background: c, display: "inline-block", borderRadius: C.swatch.radius }} />
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{lo}–{hi}</span>
                  </div>
                );
              })}
              {level === "village" && fillIndicator === "density" && (
                <div style={{ marginTop: 6, color: t.textMuted, maxWidth: 140 }}>{tr.censusSnapshotNote}</div>
              )}
            </>
          )}
        </div>}
        {/* fluid(Bento 左欄):svg 撐滿容器寬高,viewBox meet=object-contain 等比置中放大;
            非 fluid(方向 A):地圖高度=視窗高減固定框 */}
        <div ref={wrapperRef} style={fluid ? { position: "relative", minWidth: 0, flex: 1, minHeight: 0 } : { position: "relative", minWidth: 0 }}>
          <svg ref={ref} style={fluid
            ? { width: "100%", height: "100%", display: "block" }
            : { height: "min(72vh, calc(100dvh - 285px))", width: "auto", maxWidth: "100%", display: "block" }} />
          {hover && (
            <div style={{ position: "absolute", left: hover.x + 12, top: hover.y + 12, pointerEvents: "none",
              background: t.tooltip.bg, color: t.tooltip.fg, padding: C.tooltip.padding, borderRadius: C.tooltip.radius, fontSize: S.small,
              fontVariantNumeric: "tabular-nums" }}>
              {romanizePlaceName(hover.name, lang)}{tr.tooltipSeparator}
              {hover.region !== undefined ? regionLabel(hover.region, lang)
                : hover.val === undefined ? tr.noDataLabel
                : `${hover.val.toFixed(1)} ${ind ? metricUnit(ind.key, ind.unit, lang) : ""}`}
              {hover.pop != null && <span>{tr.tooltipPopulationPrefix}{hover.pop.toLocaleString()}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
