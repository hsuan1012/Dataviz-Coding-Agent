import * as d3 from "d3";
import type { IndicatorKey, ScatterKey } from "./data";

// 關係圖四通道:顏色多一個「區域」選項(分類色);其餘通道可選任一變數(指標∪十大死因)
export type ColorKey = "region" | ScatterKey;
export interface ScatterChannels { x: ScatterKey; y: ScatterKey; size: ScatterKey; color: ColorKey }

// 通道更新統一入口:X/Y 撞同指標時自動對調(被動軸接手舊值),避免 X=Y 對角線退化圖。
// 顏色/大小與軸重複是合法的(著色=X 屬常見用法),不在此限。無變更時回原物件,讓 setState 短路。
export function patchChannels(s: ScatterChannels, patch: Partial<ScatterChannels>): ScatterChannels {
  const next = { ...s, ...patch };
  if (next.x === next.y) {
    if ("x" in patch) next.y = s.x;      // patch 同時指定 X=Y 時以 X 為準(左側指標=X 的語意)
    else if ("y" in patch) next.x = s.y;
  }
  return next.x === s.x && next.y === s.y && next.size === s.size && next.color === s.color ? s : next;
}

// 合併單頁:X 軸=全頁「當前指標」。地圖塗色/排名依據/標題由 scatter.x 導出,
// App 不再另持 indicator/deathCause state(死因 key 蘊含「死亡率+該死因」)。
export function xToIndicator(x: ScatterKey): { indicator: IndicatorKey; deathCause: string } {
  if (x.startsWith("death_c")) return { indicator: "death", deathCause: x };
  return { indicator: x as IndicatorKey, deathCause: "death" };
}

function niceHi(domain: [number, number]): number {
  const [, hi] = d3.scaleLinear().domain(domain).nice().domain();
  return hi as number;
}

// 位置軸:人口密度高度右偏 → symlog(可含 0);其餘線性(自 Scatter.tsx 移入以便單元測試)
// nice=false(8/4 修 bug,滾輪縮放):傳入的 domain 若是滾輪縮放算好的精確子範圍(zoomX/zoomY),
// 不能再 .nice() 一次——nice() 是為了「完整範圍」找好看的整數刻度邊界而設計,對一個已經縮小過的
// 子範圍再 nice() 會把邊界往外round,幅度夠大時甚至可能整個 round 回跟完整範圍一樣的邊界,
// 導致滾輪縮放在畫面上完全沒反應(使用者感覺卡住,實際上 zoomX/zoomY state 有變、只是被 nice()
// 蓋掉了)。完整範圍(zoomX/zoomY 為 null)時維持原行為(nice=true,好看的整數刻度)。
// symlog 常數:位置軸/顏色正規化/滾輪縮放的轉換空間(scatterZoom 的 symlogFwd/Inv)都要用
// 同一個值,抽成具名常數避免三處魔數漂移。
export const SYMLOG_C = 2000;

export function makeScale(isLog: boolean, domain: [number, number], range: [number, number], nice = true) {
  // 8/7 對數空間縮放:nice=false=滾輪縮放中——symlog 軸保留 symlog 刻度(方案 A 退役),
  // 縮放子範圍原樣進 domain,不能強制回 [0, niceHi](否則縮放沒反應,同下方線性軸 nice bug)。
  if (isLog) {
    const s = d3.scaleSymlog().constant(SYMLOG_C).range(range);
    return nice ? s.domain([0, niceHi(domain)]) : s.domain(domain);
  }
  const s = d3.scaleLinear().domain(domain).range(range);
  return nice ? s.nice() : s;
}
// symlog 軸高值端壓縮,等差刻度會重疊 → 低端密高端疏的整齊刻度
export function logTicks(domain: [number, number]): number[] {
  const hi = niceHi(domain);
  return [0, 5000, 10000, 20000, 40000].filter((v) => v <= hi);
}

// 縮放中的動態刻度稀疏化(8/7):d3.ticks 給的是等差「值」,symlog 軸高值端像素被壓縮,
// 相鄰標籤會幾乎貼住(實測 16,000|18,000 邊距只剩 1.6px)。依投影後像素距離貪歸保留:
// 與上一個「保留下來的」刻度距離裝不下兩個標籤半寬+間距就跳過。minGap 由呼叫端給
// (X 軸=依格式化字串估寬;Y 軸=固定行高),首刻度必保留,可能捨棄最後一格(可接受)。
export function thinTicks(
  values: number[],
  toPx: (v: number) => number,
  minGap: (prev: number, next: number) => number,
): number[] {
  if (values.length <= 1) return values;
  const kept = [values[0]];
  for (let i = 1; i < values.length; i++) {
    const prev = kept[kept.length - 1];
    if (Math.abs(toPx(values[i]) - toPx(prev)) >= minGap(prev, values[i])) kept.push(values[i]);
  }
  return kept;
}

// 無資料防禦(spec 錯誤處理):domain 掃不到有限值時退 [0,1] 並警告,圖不 crash
export function safeDomain(domain: [number, number] | undefined, key: string): [number, number] {
  if (!domain || !Number.isFinite(domain[0]) || !Number.isFinite(domain[1])) {
    console.warn(`scatter: 指標 ${key} 無有限 domain,退回 [0,1]`);
    return [0, 1];
  }
  return domain;
}

// 顏色通道:指標值 → [0,1]。密度先過 symlog(與位置軸一致),其餘線性;clamp 防越界
export function makeColorNormalizer(key: ScatterKey, domain: [number, number]) {
  if (key === "density")
    return d3.scaleSymlog().constant(SYMLOG_C).domain([0, niceHi(domain)]).range([0, 1]).clamp(true);
  const nice = d3.scaleLinear().domain(domain).nice().domain() as [number, number];
  return d3.scaleLinear().domain(nice).range([0, 1]).clamp(true);
}

// 主題 5 段色階(t.densityScale)→ 連續插值;分段線性,兩端=主題端點,深淺主題各自成立
export function rampColor(ramp: string[]): (t: number) => string {
  // 防呆:不足兩段時退單色(主題 ramp 固定 5 段,理論性防護)
  if (ramp.length < 2) return () => ramp[0] ?? "#000";
  const n = ramp.length - 1;
  return (t) => {
    const c = Math.min(Math.max(t, 0), 1) * n;
    const i = Math.min(Math.floor(c), n - 1);
    return d3.interpolateRgb(ramp[i], ramp[i + 1])(c - i);
  };
}

// 大小圖例代表值:取 2–3 個整齊值(小/中/大),全部落在原始 domain 內
// (r 尺度 domain 未 nice,圖例圓圈用同一把尺,值必須在 domain 內才不外插)
export function sizeTicks(domain: [number, number]): number[] {
  const t = d3.ticks(domain[0], domain[1], 3);
  if (t.length === 0) return [domain[0], domain[1]];
  if (t.length <= 3) return t;
  return [t[0], t[Math.floor(t.length / 2)], t[t.length - 1]];
}

// 色條刻度:密度沿用 logTicks;線性用 nice domain 的 ~4 格
export function colorTicks(key: ScatterKey, domain: [number, number]): number[] {
  if (key === "density") return logTicks(domain);
  const nice = d3.scaleLinear().domain(domain).nice().domain() as [number, number];
  return d3.ticks(nice[0], nice[1], 4);
}
