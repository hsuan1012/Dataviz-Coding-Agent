import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import * as d3 from "d3";
import { scatterPoints, scatterDomains, type Meta, type Values, type IndicatorKey } from "./data";
import {
  makeScale, logTicks, safeDomain, makeColorNormalizer, rampColor, colorTicks, sizeTicks,
  patchChannels, xToIndicator, thinTicks, type ColorKey, type ScatterChannels,
} from "./scatterChannels";

// X 軸=全頁「當前指標」:地圖塗色/排名依據/標題皆由 scatter.x 導出(合併單頁 spec)
describe("xToIndicator", () => {
  it("十大死因 key → 死亡率指標+該死因", () => {
    expect(xToIndicator("death_c1")).toEqual({ indicator: "death", deathCause: "death_c1" });
  });
  it("五指標 → 該指標+全死因", () => {
    expect(xToIndicator("density")).toEqual({ indicator: "density", deathCause: "death" });
    expect(xToIndicator("hospital")).toEqual({ indicator: "hospital", deathCause: "death" });
  });
  it("death 本身 → 死亡率+全死因", () => {
    expect(xToIndicator("death")).toEqual({ indicator: "death", deathCause: "death" });
  });
});

const meta = JSON.parse(readFileSync("public/data/meta.json", "utf-8")) as Meta;
const values = JSON.parse(readFileSync("public/data/values.json", "utf-8")) as Values;
const dom = scatterDomains(values, meta);
const keys = meta.indicators.map((i) => i.key as IndicatorKey);
// 淺色主題 densityScale(styleDictionary.js themes.light);測試只需任一 5 段 ramp
const ramp = ["#CDEAE5", "#7FCABF", "#2A9D8F", "#14746F", "#0F4C5C"];

describe("scatterChannels 色階與防禦", () => {
  it("rampColor 兩端＝ramp 首尾色,中段單調(不丟例外)", () => {
    const f = rampColor(ramp);
    expect(f(0)).toBe(d3.interpolateRgb(ramp[0], ramp[1])(0));
    expect(f(1)).toBe(d3.interpolateRgb(ramp[3], ramp[4])(1));
    for (let i = 0; i <= 10; i++) expect(typeof f(i / 10)).toBe("string");
    expect(f(-0.5)).toBe(f(0)); // clamp
    expect(f(1.5)).toBe(f(1));
  });
  it("makeColorNormalizer 線性:nice domain 兩端→0/1,clamp 越界", () => {
    const n = makeColorNormalizer("income", dom.income);
    const [lo, hi] = d3.scaleLinear().domain(dom.income).nice().domain() as [number, number];
    expect(n(lo)).toBeCloseTo(0, 6);
    expect(n(hi)).toBeCloseTo(1, 6);
    expect(n(lo - 1e9)).toBe(0);
    expect(n(hi + 1e9)).toBe(1);
  });
  it("makeColorNormalizer 密度:symlog、0→0、單調遞增", () => {
    const n = makeColorNormalizer("density", dom.density);
    expect(n(0)).toBeCloseTo(0, 6);
    let prev = -1;
    for (const v of [0, 100, 1000, 5000, 20000]) {
      const t = n(v);
      expect(t).toBeGreaterThanOrEqual(prev);
      expect(t).toBeLessThanOrEqual(1);
      prev = t;
    }
  });
  it("safeDomain:無資料([Inf,-Inf]/undefined)退 [0,1] 並 warn;正常值原樣通過", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(safeDomain([Infinity, -Infinity], "x")).toEqual([0, 1]);
    expect(safeDomain(undefined, "x")).toEqual([0, 1]);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(safeDomain([3, 9], "x")).toEqual([3, 9]);
    warn.mockRestore();
  });
  it("sizeTicks:2–3 個遞增代表值、全部落在原始 domain 內(圓圈大小不外插)", () => {
    for (const k of keys) {
      const ticks = sizeTicks(dom[k]);
      expect(ticks.length).toBeGreaterThanOrEqual(2);
      expect(ticks.length).toBeLessThanOrEqual(3);
      for (let i = 0; i < ticks.length; i++) {
        expect(ticks[i]).toBeGreaterThanOrEqual(dom[k][0]);
        expect(ticks[i]).toBeLessThanOrEqual(dom[k][1]);
        if (i > 0) expect(ticks[i]).toBeGreaterThan(ticks[i - 1]);
      }
    }
    expect(sizeTicks([5, 5])).toEqual([5]); // 退化 domain 不炸
  });
  it("colorTicks:密度=logTicks;線性刻度落在 nice domain 內且 3–6 格", () => {
    expect(colorTicks("density", dom.density)).toEqual(logTicks(dom.density));
    const ticks = colorTicks("income", dom.income);
    const [lo, hi] = d3.scaleLinear().domain(dom.income).nice().domain() as [number, number];
    expect(ticks.length).toBeGreaterThanOrEqual(3);
    expect(ticks.length).toBeLessThanOrEqual(6);
    for (const v of ticks) { expect(v).toBeGreaterThanOrEqual(lo); expect(v).toBeLessThanOrEqual(hi); }
  });
});

// 8/4 修 bug 補測:滾輪縮放算好的 zoomX/zoomY 子範圍若再被 makeScale 內部的 .nice() 捨入,
// 特定縮放結果會整個 round 回全域邊界,畫面上滾輪完全沒反應(zoomX state 有變、只是被蓋掉)。
// 這組數字是 review 實測抓到的真實 repro case(偏右游標放大一次的結果)。
describe("makeScale nice 參數(8/4 修 bug:已縮放子範圍不能再 nice)", () => {
  const zoomedRepro: [number, number] = [599.8694560781786, 1933.2027894115122];
  it("nice=false:已縮放的精確子範圍原樣保留,不被捨入回全域邊界", () => {
    const s = makeScale(false, zoomedRepro, [0, 100], false);
    const [lo, hi] = s.domain() as [number, number];
    expect(lo).toBeCloseTo(zoomedRepro[0], 9);
    expect(hi).toBeCloseTo(zoomedRepro[1], 9);
  });
  // 8/7 對數空間縮放:symlog 軸縮放中保留 symlog 刻度(不再切線性,方案 A 退役),
  // 縮放子範圍要原樣進 symlog scale 的 domain,不能被強制回 [0, niceHi]。
  it("nice=false + symlog(縮放中):精確子範圍原樣保留,不被強制回 [0, niceHi]", () => {
    const s = makeScale(true, [3000, 9000], [0, 100], false);
    const [lo, hi] = s.domain() as [number, number];
    expect(lo).toBeCloseTo(3000, 9);
    expect(hi).toBeCloseTo(9000, 9);
  });

  it("nice 預設 + symlog(未縮放):維持既有 [0, niceHi] 行為", () => {
    const s = makeScale(true, [123, 9000], [0, 100]);
    expect((s.domain() as number[])[0]).toBe(0);
    expect((s.domain() as number[])[1]).toBeGreaterThanOrEqual(9000);
  });

  // 8/7 縮放刻度擠壓:等差刻度值在 symlog 軸高值端像素被壓縮,相鄰標籤幾乎貼住
  // (實測 16,000|18,000 邊距只剩 1.6px)。thinTicks 依投影後像素距離貪婪稀疏化。
  it("thinTicks:間距足夠 → 全保留", () =>
    expect(thinTicks([0, 50, 100], (v) => v, () => 40)).toEqual([0, 50, 100]));

  it("thinTicks:與上一個保留刻度距離不足 → 跳過,後續距離夠遠者仍保留", () =>
    expect(thinTicks([0, 50, 90, 95, 140], (v) => v, () => 40)).toEqual([0, 50, 90, 140]));

  it("thinTicks:首刻度必保留;零/單刻度原樣回傳", () => {
    expect(thinTicks([], (v) => v, () => 40)).toEqual([]);
    expect(thinTicks([7], (v) => v, () => 40)).toEqual([7]);
  });

  it("thinTicks symlog 實案:高值端 16,000/18,000 壓縮到裝不下兩標籤 → 18,000 被略過", () => {
    const s = d3.scaleSymlog().constant(2000).domain([2000, 18000]).range([0, 700]);
    const fmt = d3.format(",");
    const gap = (a: number, b: number) => ((fmt(a).length + fmt(b).length) / 2) * 7 + 6;
    const out = thinTicks([2000, 4000, 6000, 8000, 10000, 12000, 14000, 16000, 18000], (v) => s(v), gap);
    expect(out).toContain(16000);
    expect(out).not.toContain(18000);
    expect(out).toContain(2000);
  });

  it("nice 預設(省略或明寫 true):完整範圍仍照舊捨入成好看的整數刻度", () => {
    const withDefault = makeScale(false, zoomedRepro, [0, 100]);
    const withExplicitTrue = makeScale(false, zoomedRepro, [0, 100], true);
    // 400/2000 是 d3.scaleLinear().domain(zoomedRepro).nice().domain() 的實際輸出(見上方 bug 分析),
    // 湊巧跟這組 repro 數字的「全域範圍」邊界一致——這正是 bug 之所以會發生的原因。
    expect(withDefault.domain()).toEqual([400, 2000]);
    expect(withExplicitTrue.domain()).toEqual([400, 2000]);
  });
});

describe("patchChannels X=Y 防呆(同指標自動對調,不出現對角線退化圖)", () => {
  const base: ScatterChannels = { x: "density", y: "death", size: "income", color: "region" };
  it("一般 patch:改 X 不撞 Y → 只改 X", () => {
    expect(patchChannels(base, { x: "clinic" })).toEqual({ ...base, x: "clinic" });
  });
  it("X 改成現任 Y → 兩軸對調(Y 接手舊 X)", () => {
    expect(patchChannels(base, { x: "death" })).toEqual({ ...base, x: "death", y: "density" });
  });
  it("Y 改成現任 X → 兩軸對調(X 接手舊 Y)", () => {
    expect(patchChannels(base, { y: "density" })).toEqual({ ...base, x: "death", y: "density" });
  });
  it("顏色/大小與軸同指標是合法的,不觸發對調", () => {
    expect(patchChannels(base, { color: "death" })).toEqual({ ...base, color: "death" });
    expect(patchChannels(base, { size: "death" })).toEqual({ ...base, size: "death" });
  });
  it("patch 同時把 X、Y 設成同指標 → 保留 X,Y 退回舊 X", () => {
    expect(patchChannels(base, { x: "hospital", y: "hospital" }))
      .toEqual({ ...base, x: "hospital", y: "density" });
  });
  it("patch 值與現狀相同(X 重點同一指標)→ 原物件原樣返回(不觸發重繪)", () => {
    expect(patchChannels(base, { x: "density" })).toBe(base);
  });
});

describe("全組合掃描(spec 錯誤處理:任何通道組合不 crash)", () => {
  it("5×5×5×6 組合皆能建尺度並對資料點求值(有限值)", () => {
    const pts = scatterPoints(values, meta, meta.years[meta.years.length - 1]);
    const p = pts[0];
    const colorOpts: ColorKey[] = ["region", ...keys];
    for (const x of keys) for (const y of keys) for (const size of keys) for (const color of colorOpts) {
      const ch: ScatterChannels = { x, y, size, color };
      const sx = makeScale(ch.x === "density", safeDomain(dom[ch.x], ch.x), [0, 100]);
      const sy = makeScale(ch.y === "density", safeDomain(dom[ch.y], ch.y), [100, 0]);
      const sr = d3.scaleSqrt().domain(safeDomain(dom[ch.size], ch.size)).range([2, 14]);
      expect(Number.isFinite(sx(p[ch.x]))).toBe(true);
      expect(Number.isFinite(sy(p[ch.y]))).toBe(true);
      expect(Number.isFinite(sr(p[ch.size]))).toBe(true);
      if (color !== "region") {
        const n = makeColorNormalizer(color, safeDomain(dom[color], color));
        const c = rampColor(ramp)(n(p[color]));
        expect(typeof c).toBe("string");
        expect(c.length).toBeGreaterThan(0);
      }
    }
  });
});
