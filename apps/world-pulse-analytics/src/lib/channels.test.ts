import { describe, expect, test } from "vitest";
import { scaleLog } from "d3";
import {
  METRICS, DEFAULT_CHANNELS, patchChannels, makeMetricScale, makeRadiusScale,
  makeColorNormalizer, rampColor, sizeTicks, legendRadiusRange, metricLabel, metricUnit, TEAL_RAMP,
  zoomTicks, thinTicks,
} from "./channels";

describe("patchChannels", () => {
  test("X 改成與 Y 相同時自動對調(Y 接手舊 X)", () => {
    const s = { x: "lifeExpectancy", y: "income", size: "population", color: "region" } as const;
    const next = patchChannels(s, { x: "income" });
    expect(next.x).toBe("income");
    expect(next.y).toBe("lifeExpectancy");
  });
  test("無變更時回傳原物件(setState 短路)", () => {
    const s = DEFAULT_CHANNELS;
    expect(patchChannels(s, { x: s.x })).toBe(s);
  });
  test("顏色/大小與軸重複是合法的", () => {
    const next = patchChannels(DEFAULT_CHANNELS, { color: DEFAULT_CHANNELS.x });
    expect(next.color).toBe(DEFAULT_CHANNELS.x);
  });
});

describe("METRICS 設定", () => {
  test("五個指標齊全且 domain 有限", () => {
    const keys = ["income", "lifeExpectancy", "population", "childMortality", "fertility"];
    for (const k of keys) {
      const m = METRICS[k as keyof typeof METRICS];
      expect(m.label).toBeTruthy();
      expect(Number.isFinite(m.domain[0]) && Number.isFinite(m.domain[1])).toBe(true);
      expect(m.ticks.length).toBeGreaterThan(2);
    }
  });
  test("對數指標的 domain 下界必須 > 0(scaleLog 不能含 0)", () => {
    for (const m of Object.values(METRICS)) {
      if (m.scaleType === "log") expect(m.domain[0]).toBeGreaterThan(0);
    }
  });

  // 8/4 語言切換:每個指標都要有中英文標籤/單位,metricLabel/metricUnit 依 lang 切換。
  test("五個指標都有 labelEn/unitEn,metricLabel/metricUnit 依語言回傳對應值", () => {
    const keys = ["income", "lifeExpectancy", "population", "childMortality", "fertility"] as const;
    for (const k of keys) {
      expect(METRICS[k].labelEn).toBeTruthy();
      expect(METRICS[k].unitEn).toBeTruthy();
      expect(metricLabel(k, "zh")).toBe(METRICS[k].label);
      expect(metricLabel(k, "en")).toBe(METRICS[k].labelEn);
      expect(metricUnit(k, "zh")).toBe(METRICS[k].unit);
      expect(metricUnit(k, "en")).toBe(METRICS[k].unitEn);
    }
  });

  // 8/7 對數空間縮放(取代方案 A):縮放中 log 軸「保留」對數刻度型態——
  // 軸標題的「對數刻度」字樣因此始終為真,metricUnit 不需要 zoomed 參數。
  test("makeMetricScale 縮放中(zoomDomain 有值):log 指標保留對數刻度型態,domain=縮放子範圍", () => {
    const s = makeMetricScale("income", [0, 100], [1000, 50000]);
    expect(s.domain()).toEqual([1000, 50000]);
    // 對數刻度的判別:幾何平均落在 range 中點(線性刻度會是算術平均落中點)
    expect(s(Math.sqrt(1000 * 50000))).toBeCloseTo(50, 6);
  });

  test("makeMetricScale 縮放中:線性指標仍是線性刻度,domain=縮放子範圍", () => {
    const s = makeMetricScale("lifeExpectancy", [0, 100], [40, 60]);
    expect(s.domain()).toEqual([40, 60]);
    expect(s(50)).toBeCloseTo(50, 6);
  });

  // 8/7 使用者抓到:放大後縮放範圍外的國家全部「疊」在繪圖區邊框上(左緣一排半圓)。
  // 根因=clamp(true) 把範圍外的值釘在邊界,泡泡中心落在裁切區邊線上→半顆可見。
  // 縮放中要關掉 clamp,讓範圍外的值外插到繪圖區外、由 clipPath 整顆裁掉。
  test("makeMetricScale 縮放中:不 clamp——範圍外的值映射到繪圖區外(交給裁切區),不堆在邊框", () => {
    const log = makeMetricScale("income", [0, 100], [1000, 50000]);
    expect(log(300)).toBeLessThan(0);
    expect(log(200000)).toBeGreaterThan(100);
    const lin = makeMetricScale("lifeExpectancy", [0, 100], [40, 60]);
    expect(lin(20)).toBeLessThan(0);
  });

  test("makeMetricScale 未縮放:維持 clamp(極端值釘在邊界不消失,Rwanda 1994 案例)", () => {
    const s = makeMetricScale("lifeExpectancy", [0, 100]);
    expect(s(5)).toBe(0);
    expect(s(120)).toBe(100);
  });

  test("zoomTicks log 型:刻度值全部落在縮放範圍內且遞增(對數刻度可用)", () => {
    const ticks = zoomTicks([1000, 50000], "log");
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    for (const v of ticks) { expect(v).toBeGreaterThanOrEqual(1000); expect(v).toBeLessThanOrEqual(50000); }
    for (let i = 1; i < ticks.length; i++) expect(ticks[i]).toBeGreaterThan(ticks[i - 1]);
  });

  test("zoomTicks 未給型態:維持線性 d3.ticks 既有行為", () => {
    expect(zoomTicks([0, 100])).toEqual([0, 20, 40, 60, 80, 100]);
  });

  // 8/7 縮放刻度擠壓:scaleLog ticks 的 1..9×10^n 序列在高值端像素被壓縮,相鄰標籤
  // 幾乎貼住(正式站實測「9,000|10,000」黏連)。thinTicks 依投影後像素距離貪婪稀疏化。
  test("thinTicks:間距足夠 → 全保留;不足 → 跳過,後續夠遠者仍保留;首刻度必保留", () => {
    const id = (v: number) => v;
    expect(thinTicks([0, 50, 100], id, () => 40)).toEqual([0, 50, 100]);
    expect(thinTicks([0, 50, 90, 95, 140], id, () => 40)).toEqual([0, 50, 90, 140]);
    expect(thinTicks([], id, () => 40)).toEqual([]);
    expect(thinTicks([7], id, () => 40)).toEqual([7]);
  });

  test("thinTicks log 實案:9,000/10,000 高值端壓縮到裝不下兩標籤 → 只留其一,且全體相鄰間距達標", () => {
    const s = scaleLog().domain([2500, 25000]).range([0, 700]);
    const fmt = (v: number) => v.toLocaleString("en-US");
    const gap = (a: number, b: number) => ((fmt(a).length + fmt(b).length) / 2) * 7 + 6;
    const out = thinTicks(zoomTicks([2500, 25000], "log"), (v) => s(v), gap);
    expect(out.includes(9000) && out.includes(10000)).toBe(false);
    for (let i = 1; i < out.length; i++) {
      expect(Math.abs(s(out[i]) - s(out[i - 1]))).toBeGreaterThanOrEqual(gap(out[i - 1], out[i]));
    }
  });
});

describe("尺度與色階", () => {
  test("makeMetricScale clamp 超界值", () => {
    const s = makeMetricScale("fertility", [0, 100]);
    expect(s(99)).toBe(100); // 遠超 domain 上界 9 → 夾在 range 上界
  });
  test("makeColorNormalizer 值域鎖 [0,1]", () => {
    const n = makeColorNormalizer("childMortality");
    expect(n(-10)).toBe(0);
    expect(n(99999)).toBe(1);
  });
  test("rampColor 兩端等於色階端點", () => {
    const f = rampColor(TEAL_RAMP);
    expect(f(0)).toBe("rgb(209, 250, 229)"); // TEAL_RAMP[0] = #D1FAE5
    expect(f(1)).toBe("rgb(6, 95, 70)");     // TEAL_RAMP[4] = #065F46
  });
  test("sizeTicks 全部落在 domain 內且最多 3 個", () => {
    const t = sizeTicks(METRICS.population.domain);
    expect(t.length).toBeLessThanOrEqual(3);
    for (const v of t) {
      expect(v).toBeGreaterThanOrEqual(METRICS.population.domain[0]);
      expect(v).toBeLessThanOrEqual(METRICS.population.domain[1]);
    }
  });
});

// U21:真 bug 修正——線性窄定義域指標(平均餘命/兒童死亡率/總生育率)不能跟
// income/population 共用同一組 [5,56] 半徑範圍,否則所有國家都被推到接近最大半徑,
// 畫面糊成一團。每個指標各自帶自己的 sizeRange,窄定義域指標改用縮小的範圍。
describe("U21:sizeRange 個別化", () => {
  test("每個指標的 sizeRange 存在且下界小於上界", () => {
    for (const m of Object.values(METRICS)) {
      expect(m.sizeRange[0]).toBeLessThan(m.sizeRange[1]);
    }
  });

  test("income/population 維持寬範圍 [5,56],窄定義域三指標改用縮小的 [3,22]", () => {
    expect(METRICS.income.sizeRange).toEqual([5, 56]);
    expect(METRICS.population.sizeRange).toEqual([5, 56]);
    expect(METRICS.lifeExpectancy.sizeRange).toEqual([3, 22]);
    expect(METRICS.childMortality.sizeRange).toEqual([3, 22]);
    expect(METRICS.fertility.sizeRange).toEqual([3, 22]);
  });

  test("同一批中段值,窄範圍算出的半徑差異明顯小於寬範圍(不再糊成一團)", () => {
    // 平均餘命 domain 中段附近取三個相近值,分別用寬/窄範圍算半徑,
    // 窄範圍的半徑差(px)必須明顯小於寬範圍算出的差,證明视觉分佈被壓縮回可辨識的區間。
    const values = [50, 60, 70];
    const wideScale = makeRadiusScale("lifeExpectancy", [5, 56]);
    const narrowScale = makeRadiusScale("lifeExpectancy", METRICS.lifeExpectancy.sizeRange);
    const wideSpread = wideScale(values[2]) - wideScale(values[0]);
    const narrowSpread = narrowScale(values[2]) - narrowScale(values[0]);
    expect(narrowSpread).toBeLessThan(wideSpread);
    // 兩次呼叫吃到不同的 range 參數,輸出也確實不同(不是誤用同一把尺度)。
    expect(wideScale(values[1])).not.toBeCloseTo(narrowScale(values[1]), 5);
  });

  test("legendRadiusRange 依比例縮小圖表 range", () => {
    const wide = legendRadiusRange([5, 56]);
    expect(wide[0]).toBeCloseTo(3, 1);
    expect(wide[1]).toBeCloseTo(17.92, 1);

    const narrow = legendRadiusRange([3, 22]);
    expect(narrow[0]).toBeCloseTo(3, 1);
    expect(narrow[1]).toBeCloseTo(7.04, 1);
  });
});
