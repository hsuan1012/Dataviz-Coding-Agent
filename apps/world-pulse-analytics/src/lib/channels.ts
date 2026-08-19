import { scaleLinear, scaleLog, scaleSqrt, interpolateRgb, ticks as d3Ticks } from "d3";
import { LIFE_EXPECTANCY_DOMAIN, INCOME_DOMAIN, POPULATION_DOMAIN } from "./scales";
import type { Language } from "./i18n";

export type MetricKey = "income" | "lifeExpectancy" | "population" | "childMortality" | "fertility";
export type ColorKey = "region" | MetricKey;
export interface ScatterChannels { x: MetricKey; y: MetricKey; size: MetricKey; color: ColorKey }

export interface MetricConfig {
  label: string;
  labelEn: string;
  unit: string;
  unitEn: string;
  scaleType: "log" | "linear";
  domain: [number, number];
  ticks: number[];
  format: (v: number) => string;
  // U21:每個指標各自的「大小」通道半徑範圍(像素)——不能全部共用同一組。
  // income/population 的 domain 橫跨好幾個數量級(log 型),sqrt 正規化後大多數國家
  // 自然落在小半徑、只有極端值頂到最大值,視覺分佈正常,維持較寬的 [5,56]。
  // lifeExpectancy/childMortality/fertility 是線性且定義域窄的指標,同一組 [5,56]
  // 會讓幾乎所有國家的正規化值都落在中高段,全部被推到接近最大半徑,畫面糊成一團
  // (使用者截圖回饋的真 bug)。窄定義域指標改用縮小的 [3,22],讓半徑差異重新變得可辨識。
  sizeRange: [number, number];
}

function formatCompact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return v.toFixed(0);
}

// 五指標設定。既有三指標 domain 沿用 scales.ts 的固定值(Gapminder 慣例刻度);
// 新指標 domain 為固定值+clamp,由 prepare-data.js 的極值檢查守住(超界即 ETL 紅燈)。
export const METRICS: Record<MetricKey, MetricConfig> = {
  income: {
    label: "人均所得", labelEn: "Income per Capita",
    unit: "2021 國際元,對數刻度", unitEn: "2021 int'l $, log scale",
    scaleType: "log",
    domain: INCOME_DOMAIN, ticks: [300, 1000, 3000, 10000, 30000, 100000, 250000],
    format: (v) => v.toLocaleString("en-US"),
    sizeRange: [5, 56], // log 型定義域廣,效果好,維持現況
  },
  lifeExpectancy: {
    label: "平均餘命", labelEn: "Life Expectancy",
    unit: "歲", unitEn: "years",
    scaleType: "linear",
    domain: LIFE_EXPECTANCY_DOMAIN, ticks: [20, 30, 40, 50, 60, 70, 80, 90],
    format: (v) => v.toFixed(1),
    sizeRange: [3, 22], // 線性窄定義域,縮小半徑範圍避免全部糊成一團(U21)
  },
  population: {
    label: "總人口", labelEn: "Population",
    unit: "人,對數刻度", unitEn: "people, log scale",
    scaleType: "log",
    domain: POPULATION_DOMAIN, ticks: [1e4, 1e5, 1e6, 1e7, 1e8, 1e9],
    format: formatCompact,
    sizeRange: [5, 56], // log 型定義域廣,效果好,維持現況(預設「大小」通道)
  },
  childMortality: {
    label: "兒童死亡率", labelEn: "Child Mortality",
    unit: "每千活產", unitEn: "per 1,000 live births",
    scaleType: "linear",
    domain: [0, 550], ticks: [0, 100, 200, 300, 400, 500],
    format: (v) => v.toFixed(0),
    sizeRange: [3, 22], // 線性窄定義域,縮小半徑範圍避免全部糊成一團(U21)
  },
  fertility: {
    label: "總生育率", labelEn: "Fertility Rate",
    unit: "婦女平均生育數", unitEn: "births per woman",
    scaleType: "linear",
    domain: [0, 9], ticks: [0, 2, 4, 6, 8],
    format: (v) => v.toFixed(2),
    sizeRange: [3, 22], // 線性窄定義域,縮小半徑範圍避免全部糊成一團(U21)
  },
};

// 8/4 語言切換:METRICS 的中英文標籤/單位跟指標設定綁在一起,直接放同一個物件裡
// (而非另外拆到 i18n.ts),兩個 helper 統一取值入口,呼叫端不用自己判斷 lang==="en"。
export function metricLabel(key: MetricKey, lang: Language): string {
  return lang === "en" ? METRICS[key].labelEn : METRICS[key].label;
}
export function metricUnit(key: MetricKey, lang: Language): string {
  return lang === "en" ? METRICS[key].unitEn : METRICS[key].unit;
}

// 老師 8/3 回饋:預設 X 軸=人均所得、Y 軸=平均餘命(對齊 Gapminder 經典呈現方式)。
export const DEFAULT_CHANNELS: ScatterChannels = {
  x: "income", y: "lifeExpectancy", size: "population", color: "region",
};

// 通道更新統一入口(移植鄉鎮版):X/Y 撞同指標時自動對調(被動軸接手舊值),
// 避免 X=Y 對角線退化圖。顏色/大小與軸重複是合法的。無變更時回原物件讓 setState 短路。
export function patchChannels(s: ScatterChannels, patch: Partial<ScatterChannels>): ScatterChannels {
  const next = { ...s, ...patch };
  if (next.x === next.y) {
    if ("x" in patch) next.y = s.x;
    else if ("y" in patch) next.x = s.y;
  }
  return next.x === s.x && next.y === s.y && next.size === s.size && next.color === s.color ? s : next;
}

// 縮放中(zoomDomain 有值)domain 換成縮放子範圍,但「保留」指標原本的刻度型態——
// 8/7 對數空間縮放(使用者定案,取代 U19 方案 A 的「縮放中切線性」):切線性與游標定點縮放
// 在寬對數軸上數學上不可兼得(見 scatterZoom.ts 註解),log 軸縮放中維持對數刻度,
// 軸標題的「對數刻度」字樣也因此始終為真。還原(zoomDomain=null)時完全照舊。
export function makeMetricScale(key: MetricKey, range: [number, number], zoomDomain?: [number, number] | null) {
  const m = METRICS[key];
  const domain = zoomDomain ?? m.domain;
  const scale = m.scaleType === "log" ? scaleLog() : scaleLinear();
  // clamp 只在「未縮放」時開(scales.ts 原始用意:未來資料超出完整定義域時釘在邊界不消失,
  // Rwanda 1994 案例)。縮放中必須關——clamp 會把縮放範圍外的所有國家釘在繪圖區邊框上
  // 疊成一排半圓(8/7 使用者抓到);關掉後範圍外的值外插到繪圖區外,由 BubbleChart 的
  // clipPath(#bubble-plot-clip)整顆乾淨裁掉,與 township-drilldown-app 行為一致。
  return scale.domain(domain).range(range).clamp(!zoomDomain);
}

// 縮放中的動態刻度:縮放範圍現算~6 個刻度,取代指標原本手調的固定一組刻度(那組刻度是為
// 完整範圍設計的,縮放後的窄範圍套用只會全部落在一小段甚至消失)。log 軸(8/7)用 scaleLog
// 的 ticks(1-2-5×10^n 系列,對數刻度慣例),線性軸維持 d3.ticks。
export function zoomTicks(domain: [number, number], scaleType: "log" | "linear" = "linear"): number[] {
  if (scaleType === "log") return scaleLog().domain(domain).ticks(6);
  return d3Ticks(domain[0], domain[1], 6);
}

// 縮放刻度像素稀疏化(8/7,與 township-drilldown-app 同一套):scaleLog ticks 的 1..9×10^n
// 序列在高值端像素被壓縮,相鄰標籤幾乎貼住(正式站實測「9,000|10,000」黏連)。依投影後
// 像素距離貪婪保留:與上一個「保留下來的」刻度距離裝不下兩個標籤半寬+間距就跳過。
// minGap 由呼叫端給(X 軸=依格式化字串估寬;Y 軸=固定行高),首刻度必保留。
export function thinTicks(
  values: number[],
  toPx: (v: number) => number,
  minGap: (prev: number, next: number) => number
): number[] {
  if (values.length <= 1) return values;
  const kept = [values[0]];
  for (let i = 1; i < values.length; i++) {
    const prev = kept[kept.length - 1];
    if (Math.abs(toPx(values[i]) - toPx(prev)) >= minGap(prev, values[i])) kept.push(values[i]);
  }
  return kept;
}

export function makeRadiusScale(key: MetricKey, range: [number, number]) {
  return scaleSqrt().domain(METRICS[key].domain).range(range).clamp(true);
}

// U21:控制列圖例用的同心圓比圖表本體小很多,純粹是插圖尺寸——按比例把圖表用的
// sizeRange 縮小成圖例範圍,窄定義域指標(小 sizeRange)的圖例圓自然也跟著縮小,
// 不會出現「圖表泡泡差異小、圖例圓卻異常大」的不一致觀感。LEGEND_MIN_FLOOR 確保
// 最小圓不會小到看不見/引線標籤擠在一起。
export function legendRadiusRange(chartRange: [number, number]): [number, number] {
  const LEGEND_MIN_FLOOR = 3;
  return [
    Math.max(LEGEND_MIN_FLOOR, chartRange[0] * 0.5),
    Math.max(LEGEND_MIN_FLOOR + 2, chartRange[1] * 0.32),
  ];
}

// 顏色通道:指標值 → [0,1]。對數指標走 log 正規化(與位置軸讀感一致),線性指標線性;clamp 防越界。
export function makeColorNormalizer(key: MetricKey) {
  const m = METRICS[key];
  const s = m.scaleType === "log" ? scaleLog() : scaleLinear();
  return s.domain(m.domain).range([0, 1]).clamp(true);
}

// 青綠 sequential 色階(spec §2:淺→深=低→高),與主題 accent 同色系。
export const TEAL_RAMP = ["#D1FAE5", "#6EE7B7", "#34D399", "#059669", "#065F46"];
// 深色模式色階:直接取自 township-drilldown-app styleDictionary.js 的
// themes.dark.densityScale(同一套方向 A 雙主題 token),淺→深走向不變。
export const TEAL_RAMP_DARK = ["#124F4A", "#186A63", "#25897F", "#3BB3A8", "#5FD0C7"];

// 5 段色階 → 連續插值(移植鄉鎮版):分段線性,兩端=色階端點。
export function rampColor(ramp: string[]): (t: number) => string {
  if (ramp.length < 2) return () => ramp[0] ?? "#000";
  const n = ramp.length - 1;
  return (t) => {
    const c = Math.min(Math.max(t, 0), 1) * n;
    const i = Math.min(Math.floor(c), n - 1);
    return interpolateRgb(ramp[i], ramp[i + 1])(c - i);
  };
}

// 大小圖例代表值(移植鄉鎮版):2–3 個整齊值,全部落在 domain 內
// (r 尺度用同一把,值必須在 domain 內才不外插)。
export function sizeTicks(domain: [number, number]): number[] {
  const t = d3Ticks(domain[0], domain[1], 3);
  if (t.length === 0) return [domain[0], domain[1]];
  if (t.length <= 3) return t;
  return [t[0], t[Math.floor(t.length / 2)], t[t.length - 1]];
}
