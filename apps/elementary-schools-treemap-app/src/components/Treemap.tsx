import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { useTokens } from "../lib/useTokens";
import { useLanguage } from "../lib/LanguageContext";
import sd from "../lib/styleDictionary.js";
import {
  type GroupNode,
  type Measure,
  type TreeNode,
  type Aggregate,
  type TrendEntity,
  aggregate,
  countyIndex,
  fmtInt,
  fmtRatio,
  isLeaf,
  nodeAtPath,
  ratioDomain,
  ratioOf,
} from "../lib/data";

// 畫布尺寸=容器實際 px（ResizeObserver 量測）——大螢幕由外層 flex 決定高度以塞滿
// 視窗不出捲軸，小裝置由外層給固定高度退回捲動（小螢幕互動=點按，無 drag/brush 衝突）
const STRIP_H = 26; // 群組節點上緣標題帶高度

// 顯示樹節點：當前層＋下一層預覽（與 amCharts 範例一致，一次顯示兩層）
interface DisplayNode {
  key: string; // 跨視圖穩定 key（群組=名稱路徑、學校=學校代碼）→ 下鑽轉場可 morph
  name: string;
  en?: string; // 英文顯示名（key 恆為中文名，只有顯示層切換）
  county: string; // 所屬縣市（定色用）
  school: boolean;
  id?: string; // 學校代碼（鄉鎮視圖點選學校→趨勢面板用）
  agg: Aggregate;
  value?: number;
  children?: DisplayNode[];
}

function buildDisplay(current: GroupNode, path: string[], measure: Measure): DisplayNode {
  const mk = (n: TreeNode, anc: string[], depthLeft: number): DisplayNode | null => {
    const agg = aggregate(n);
    if (agg[measure] === 0) return null; // 量值 0 → 面積 0 隱形，排除（頁尾誠實註記）
    const county = anc[0] ?? n.name;
    if (isLeaf(n)) return { key: `s:${n.id}`, name: n.name, en: n.en, county, school: true, id: n.id, agg, value: n[measure] };
    const key = [...anc, n.name].join("/");
    if (depthLeft === 0) return { key, name: n.name, en: n.en, county, school: false, agg, value: agg[measure] };
    const children = n.children
      .map((c) => mk(c, [...anc, n.name], depthLeft - 1))
      .filter((c): c is DisplayNode => c !== null);
    return { key, name: n.name, en: n.en, county, school: false, agg, children };
  };
  return {
    key: "root",
    name: current.name,
    county: path[0] ?? "",
    school: false,
    agg: aggregate(current),
    children: current.children
      .map((c) => mk(c, path, 1))
      .filter((c): c is DisplayNode => c !== null),
  };
}

// WCAG 相對亮度：依填色實際亮度選標籤字色（styleDictionary 建議做法）
function labelColorFor(fill: string, t: any): string {
  const c = d3.rgb(fill);
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  return L > 0.4 ? t.node.labelLight : t.node.labelDark;
}

// 標籤寬度估算：CJK 字寬 ≈ 字級、拉丁字 ≈ 0.56 字級（英文模式名稱較長，需分字級計）
function textWidth(s: string, fontSize: number): number {
  let units = 0;
  for (const ch of s) units += ch.charCodeAt(0) > 0x2e80 ? 1 : 0.56;
  return units * fontSize;
}

function truncate(name: string, maxPx: number, fontSize: number): string {
  if (textWidth(name, fontSize) <= maxPx) return name;
  let acc = fontSize; // 保留「…」的寬度
  let cut = 0;
  for (const ch of name) {
    const w = (ch.charCodeAt(0) > 0x2e80 ? 1 : 0.56) * fontSize;
    if (acc + w > maxPx) break;
    acc += w;
    cut++;
  }
  if (cut < 1) return "";
  return [...name].slice(0, cut).join("") + "…";
}

export interface TreemapProps {
  tree: GroupNode; // 當前學年的全國樹（切年時換樹，school id 為穩定 key → 跨年 morph）
  path: string[];
  measure: Measure;
  onNavigate: (path: string[]) => void;
  onSelectSchool?: (e: TrendEntity) => void; // 鄉鎮視圖點學校→趨勢面板（老師 8/17 回饋①）
  highlightKey?: string | null; // 側欄 hover/搜尋選中的區塊高亮（與 display key 同構）
}

export default function Treemap({ tree, path, measure, onNavigate, onSelectSchool, highlightKey = null }: TreemapProps) {
  const t = useTokens();
  const { lang, t: L } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  // highlight 用 ref＋獨立輕量 effect 更新 stroke，避免側欄 hover 觸發整個 d3 join 重繪
  const highlightRef = useRef<string | null>(highlightKey);
  highlightRef.current = highlightKey;

  useEffect(() => {
    const el = containerRef.current!;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setDims((d) =>
        Math.abs(d.w - r.width) < 1 && Math.abs(d.h - r.height) < 1 ? d : { w: r.width, h: r.height },
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 生師比色階定義域（老師 8/17 回饋③）：當年全體學校 p10–p90，切年重算
  const ratioDom = useMemo(() => ratioDomain(tree), [tree]);

  const root = useMemo(() => {
    if (dims.w < 10 || dims.h < 10) return null;
    const display = buildDisplay(nodeAtPath(tree, path), path, measure);
    return d3
      .treemap<DisplayNode>()
      .size([dims.w, dims.h])
      .paddingOuter((d) => (d.depth === 0 ? 0 : 1))
      .paddingTop((d) => (d.depth === 1 && d.children ? STRIP_H : 0))
      // 老師指定：縣市間隔明顯寬於內部；8/14 縮至 6/3/1.5 後，老師 8/17 回饋④再縮 1/2–1/3
      // （全國 6→2.5、縣視圖 3→1.25、內部 1.5→0.6、群組外框 2→1）
      .paddingInner((d) => (d.depth === 0 ? (path.length === 0 ? 2.5 : 1.25) : 0.6))(
      d3
        .hierarchy(display, (d) => d.children)
        .sum((d) => (d.children ? 0 : d.value ?? 0))
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
    );
  }, [tree, path, measure, dims]);

  useEffect(() => {
    if (!root) return;
    const svg = d3.select(svgRef.current!);
    const container = containerRef.current!;
    const tooltip = d3.select(tooltipRef.current!);
    // LCH 配色（老師 8/14 調色盤 app 方法）：22 縣市＝色相環均分、彩度固定；群組標題帶用較深 stripL。
    // 葉子明度＝生師比映射（老師 8/17 回饋③）：比值小→ratioL.light（淺）、大→ratioL.dark（深）、
    // 教師 0 無定義→最深端；定義域=當年全校 p10–p90 線性夾擠（ratioDom）
    const tm = t.treemapLch;
    const hueOf = (county: string) => ((countyIndex.get(county) ?? 0) * 360) / 22;
    const leafLOf = (agg: Aggregate) => {
      const r = ratioOf(agg);
      const { light, dark } = tm.ratioL;
      if (r === null) return dark;
      const [lo, hi] = ratioDom;
      const u = hi === lo ? 0.5 : Math.min(1, Math.max(0, (r - lo) / (hi - lo)));
      return light + (dark - light) * u;
    };
    const fillOf = (d: d3.HierarchyRectangularNode<DisplayNode>) => {
      const hue = hueOf(d.data.county);
      if (d.children) return d3.hcl(hue, tm.chroma, tm.stripL).formatHex();
      return d3.hcl(hue, tm.chroma, leafLOf(d.data.agg)).formatHex();
    };

    const drillTarget = (d: d3.HierarchyRectangularNode<DisplayNode>): string[] | null => {
      if (path.length === 0) return [d.data.county];
      if (path.length === 1) {
        // 縣市視圖：鄉鎮=depth1、學校=depth2（取其鄉鎮父節點）
        const township = d.depth === 1 ? d.data.name : d.parent!.data.name;
        return [path[0], township];
      }
      return null; // 鄉鎮視圖點學校：選入趨勢面板（老師 8/17 回饋①）
    };

    const nodes = root.descendants().filter((d) => d.depth > 0);

    // 背景點擊 → 回上一層
    svg
      .style("cursor", path.length ? "zoom-out" : "default")
      .on("click", () => {
        if (path.length) onNavigate(path.slice(0, -1));
      });

    const DUR = 420;

    // --- 矩形層：以 key join，跨視圖 morph ---
    const rects = svg
      .selectAll<SVGRectElement, d3.HierarchyRectangularNode<DisplayNode>>("rect.cell")
      .data(nodes, (d) => d.data.key);

    rects
      .exit()
      .transition()
      .duration(DUR / 2)
      .style("opacity", 0)
      .remove();

    const rectsEnter = rects
      .enter()
      .append("rect")
      .attr("class", "cell")
      .attr("x", (d) => d.x0)
      .attr("y", (d) => d.y0)
      .attr("width", (d) => Math.max(0, d.x1 - d.x0))
      .attr("height", (d) => Math.max(0, d.y1 - d.y0))
      .attr("fill", fillOf)
      .style("opacity", 0);

    const strokeOf = (d: d3.HierarchyRectangularNode<DisplayNode>) =>
      d.data.key === highlightRef.current ? t.accent : t.node.stroke;
    const strokeWidthOf = (d: d3.HierarchyRectangularNode<DisplayNode>) =>
      d.data.key === highlightRef.current ? 2.5 : 1;

    const rectsAll = rectsEnter.merge(rects);
    rectsAll
      .attr("rx", sd.components.swatch.radius)
      .attr("stroke", strokeOf)
      .attr("stroke-width", strokeWidthOf)
      .style("cursor", (d) => (drillTarget(d) ? "zoom-in" : d.data.school ? "pointer" : "default"))
      .on("click", (event, d) => {
        event.stopPropagation();
        const target = drillTarget(d);
        if (target) {
          onNavigate(target);
        } else if (d.data.school && d.data.id && onSelectSchool) {
          // 鄉鎮視圖點學校 → 左下趨勢圖顯示該校（老師 8/17 回饋①）
          onSelectSchool({
            type: "school", county: d.data.county, township: path[1],
            id: d.data.id, name: d.data.name, en: d.data.en,
          });
        }
      })
      .on("mousemove", (event, d) => {
        const [mx, my] = d3.pointer(event, container);
        const a = d.data.agg;
        // 英文模式脈絡也用英文名（path 為中文 key，沿樹逐層查表取顯示名）
        const nameOf = (n: { name: string; en?: string }) => (lang === "en" && n.en ? n.en : n.name);
        const resolvePath = (names: string[]): string[] => {
          let node: GroupNode | undefined = tree;
          return names.map((nm) => {
            const next = node?.children.find((c): c is GroupNode => !isLeaf(c) && c.name === nm);
            node = next;
            return next ? nameOf(next) : nm;
          });
        };
        const crumbs =
          d.data.school && d.depth === 2
            ? `${resolvePath([d.data.county])[0]} › ${nameOf(d.parent!.data)}`
            : d.data.school
              ? resolvePath(path).join(" › ")
              : d.depth === 2 || path.length >= 1
                ? resolvePath([d.data.county])[0]
                : "";
        tooltip
          .style("display", "block")
          .html(
            `<div style="font-weight:${sd.typography.weights.bold}">${crumbs ? crumbs + " › " : ""}${nameOf(d.data)}</div>` +
              `<div>${L.ttStudents} ${fmtInt(a.students)}</div>` +
              `<div>${L.ttTeachers} ${fmtInt(a.teachers)}</div>` +
              `<div>${L.ttRatio} ${fmtRatio(a.students, a.teachers)}</div>` +
              (d.data.school ? "" : `<div>${L.ttSchools} ${fmtInt(a.schools)}</div>`),
          );
        const box = (tooltip.node() as HTMLDivElement).getBoundingClientRect();
        const cw = container.clientWidth;
        tooltip
          .style("left", `${Math.min(mx + 14, cw - box.width - 4)}px`)
          .style("top", `${Math.max(4, my - box.height - 10)}px`);
        d3.select(event.currentTarget as SVGRectElement)
          .attr("stroke", t.accent)
          .attr("stroke-width", 2);
      })
      .on("mouseleave", (event, d) => {
        tooltip.style("display", "none");
        d3.select(event.currentTarget as SVGRectElement)
          .attr("stroke", strokeOf(d))
          .attr("stroke-width", strokeWidthOf(d));
      });

    rectsAll
      .transition()
      .duration(DUR)
      .style("opacity", 1)
      .attr("x", (d) => d.x0)
      .attr("y", (d) => d.y0)
      .attr("width", (d) => Math.max(0, d.x1 - d.x0))
      .attr("height", (d) => Math.max(0, d.y1 - d.y0))
      .attr("fill", fillOf);

    // --- 標籤層：每次重建（morph 文字成本高），佈局轉場後淡入 ---
    svg.selectAll("g.labels").remove();
    const labels = svg.append("g").attr("class", "labels").attr("pointer-events", "none");
    const fs = sd.typography.sizes;

    const displayOf = (d: d3.HierarchyRectangularNode<DisplayNode>) =>
      lang === "en" && d.data.en ? d.data.en : d.data.name;

    for (const d of nodes) {
      const w = d.x1 - d.x0;
      const h = d.y1 - d.y0;
      const fill = fillOf(d);
      const color = labelColorFor(fill, t);
      if (d.children) {
        // 群組標題帶：名稱＋量值
        if (w < 46 || h < STRIP_H) continue;
        const name = truncate(displayOf(d), w - 12, fs.axis);
        if (!name) continue;
        const g = labels.append("g");
        g.append("text")
          .attr("x", d.x0 + 7)
          .attr("y", d.y0 + STRIP_H - 8)
          .attr("fill", color)
          .style("font-family", sd.typography.fontFamily)
          .style("font-size", `${fs.axis}px`)
          .style("font-weight", sd.typography.weights.bold)
          .text(name);
        const valText = fmtInt(d.data.agg[measure]);
        if (w > textWidth(name, fs.axis) + textWidth(valText, fs.tick) + 26) {
          g.append("text")
            .attr("x", d.x1 - 7)
            .attr("y", d.y0 + STRIP_H - 8)
            .attr("text-anchor", "end")
            .attr("fill", color)
            .style("font-family", sd.typography.fontFamily)
            .style("font-size", `${fs.tick}px`)
            .style("font-variant-numeric", "tabular-nums")
            .style("opacity", 0.85)
            .text(valText);
        }
      } else {
        // 葉節點：置中名稱（放得下才顯示），高度夠再加量值
        const name = truncate(displayOf(d), w - 8, fs.tick);
        if (!name || h < 20) continue;
        const withValue = h >= 40 && w >= 64;
        const cx = d.x0 + w / 2;
        const cy = d.y0 + h / 2;
        const g = labels.append("g");
        g.append("text")
          .attr("x", cx)
          .attr("y", withValue ? cy - 3 : cy + fs.tick / 3)
          .attr("text-anchor", "middle")
          .attr("fill", color)
          .style("font-family", sd.typography.fontFamily)
          .style("font-size", `${fs.tick}px`)
          .text(name);
        if (withValue) {
          g.append("text")
            .attr("x", cx)
            .attr("y", cy + fs.tick + 1)
            .attr("text-anchor", "middle")
            .attr("fill", color)
            .style("font-family", sd.typography.fontFamily)
            .style("font-size", `${fs.tick}px`)
            .style("font-variant-numeric", "tabular-nums")
            .style("opacity", 0.85)
            .text(fmtInt(d.data.agg[measure]));
        }
      }
    }
    labels
      .style("opacity", 0)
      .transition()
      .delay(DUR * 0.7)
      .duration(200)
      .style("opacity", 1);

    return () => {
      tooltip.style("display", "none");
    };
    // lang 進依賴：語言切換時 tooltip 內容的閉包要重綁
  }, [root, path, measure, t, onNavigate, onSelectSchool, ratioDom, lang, L]);

  // 高亮變化：只改 stroke，不重跑 join/轉場
  useEffect(() => {
    d3.select(svgRef.current!)
      .selectAll<SVGRectElement, d3.HierarchyRectangularNode<DisplayNode>>("rect.cell")
      .attr("stroke", (d) => (d.data.key === highlightKey ? t.accent : t.node.stroke))
      .attr("stroke-width", (d) => (d.data.key === highlightKey ? 2.5 : 1));
  }, [highlightKey, t, root]);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${Math.max(1, dims.w)} ${Math.max(1, dims.h)}`}
        role="img"
        aria-label={L.treemapAria(path.length ? path.join(" › ") : L.nationwide, L.measure[measure])}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      <div
        ref={tooltipRef}
        style={{
          display: "none",
          position: "absolute",
          pointerEvents: "none",
          background: t.tooltip.bg,
          color: t.tooltip.fg,
          borderRadius: sd.components.tooltip.radius,
          padding: sd.components.tooltip.padding,
          fontFamily: sd.typography.fontFamily,
          fontSize: sd.typography.sizes.legend,
          lineHeight: 1.5,
          whiteSpace: "nowrap",
          fontVariantNumeric: "tabular-nums",
          zIndex: 10,
        }}
      />
    </div>
  );
}
