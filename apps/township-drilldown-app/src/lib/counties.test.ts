import { describe, it, expect } from "vitest";
import { INSET_COUNTIES, countyOf, inTaiwanBox, splitFeatures, countyFitFeatures, insetFitFeatures } from "./counties";

// 合成 feature：正方形 Polygon。d3-geo 球面多邊形外環須「順時針」，
// 逆時針會被解讀成「全球挖掉此塊」導致 geoBounds 變成全球範圍。
const feat = (county: string, x: number, y: number, s = 0.2): GeoJSON.Feature => ({
  type: "Feature",
  properties: { COUNTYNAME: county, FULLNAME: county + "測試鄉", TOWNNAME: "測試鄉" },
  geometry: { type: "Polygon", coordinates: [[[x, y], [x, y + s], [x + s, y + s], [x + s, y], [x, y]]] },
});
const kh = feat("高雄市", 120.3, 22.6);           // 本島
const southSea = feat("高雄市", 116, 10.3);        // 南海島礁（bbox 外）
const km = feat("金門縣", 118.3, 24.4);
const lj = feat("連江縣", 119.9, 26.1);
const all = [kh, southSea, km, lj];

describe("counties", () => {
  it("countyOf 讀 COUNTYNAME", () => expect(countyOf(kh)).toBe("高雄市"));
  it("inTaiwanBox 區分本島與遠處島礁", () => {
    expect(inTaiwanBox(kh)).toBe(true);
    expect(inTaiwanBox(southSea)).toBe(false);
    expect(inTaiwanBox(km)).toBe(false);
  });
  it("splitFeatures 主圖排除 inset 縣、insets 依序分組", () => {
    const { main, insets } = splitFeatures(all);
    expect(main).toEqual([kh, southSea]);
    expect(insets.map((i) => i.county)).toEqual([...INSET_COUNTIES]);
    expect(insets[0].features).toEqual([km]);
    expect(insets[1].features).toEqual([lj]);
  });
  it("countyFitFeatures 一般縣套 bbox、inset 縣用自然邊界", () => {
    expect(countyFitFeatures(all, "高雄市")).toEqual([kh]);   // southSea 被 bbox 濾掉
    expect(countyFitFeatures(all, "金門縣")).toEqual([km]);   // 不套 bbox
  });
  it("insetFitFeatures 排除烏坵鄉（防金門框被壓小）", () => {
    const wuqiu: GeoJSON.Feature = {
      ...feat("金門縣", 119.45, 24.98),
      properties: { COUNTYNAME: "金門縣", FULLNAME: "金門縣烏坵鄉", TOWNNAME: "烏坵鄉" },
    };
    expect(insetFitFeatures([...all, wuqiu], "金門縣")).toEqual([km]);
    expect(insetFitFeatures([...all, wuqiu], "連江縣")).toEqual([lj]);
  });
});
