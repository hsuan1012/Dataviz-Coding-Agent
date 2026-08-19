import { describe, it, expect } from "vitest";
import {
  buildGlobePolygonData,
  buildDecorativePolygonData,
  capColorFor,
  strokeColorFor,
  sideColorFor,
  makeGlobeFill,
  DECORATIVE_COLOR,
} from "./globePoints";
import { makeColorNormalizer, rampColor, TEAL_RAMP, TEAL_RAMP_DARK } from "./channels";
import { colorForRegion } from "./regionColors";
import { formatCountryDisplayName } from "./countryDisplayName";
import type { CountryMeta } from "../data/types";

const countries: CountryMeta[] = [
  { geo: "twn", name: "Taiwan", region: "asia", latitude: 23.7, longitude: 121.0, iso2: "TW" },
  { geo: "jpn", name: "Japan", region: "asia", latitude: 36.2, longitude: 138.3, iso2: "JP" },
];

const boundaryFeatures = [
  { type: "Feature" as const, properties: { geo: "twn" }, geometry: { type: "Polygon" as const, coordinates: [] } },
  { type: "Feature" as const, properties: { geo: "jpn" }, geometry: { type: "Polygon" as const, coordinates: [] } },
];

describe("buildGlobePolygonData", () => {
  it("只回傳有勾選且有邊界資料的國家,帶原始 geometry", () => {
    const data = buildGlobePolygonData(boundaryFeatures, countries, new Set(["twn"]));
    expect(data).toHaveLength(1);
    expect(data[0].geo).toBe("twn");
    expect(data[0].geometry).toBe(boundaryFeatures[0].geometry);
  });

  it("勾選了但沒有邊界資料的國家(未在 features 清單)不會出現,不會拋錯", () => {
    const data = buildGlobePolygonData(boundaryFeatures, countries, new Set(["twn", "nope"]));
    expect(data).toHaveLength(1);
  });

  it("帶中文顯示名稱、英文原名、洲別,供 accessor function 計算顏色", () => {
    const data = buildGlobePolygonData(boundaryFeatures, countries, new Set(["twn"]));
    expect(data[0].nameZh).toBe(formatCountryDisplayName("Taiwan", "TW", "zh"));
    expect(data[0].nameEn).toBe("Taiwan");
    expect(data[0].region).toBe("asia");
  });

  it("同一份 selectedCountries 呼叫兩次,回傳的每筆物件內容一致(供理解:reference 不同但值穩定)", () => {
    const a = buildGlobePolygonData(boundaryFeatures, countries, new Set(["twn"]));
    const b = buildGlobePolygonData(boundaryFeatures, countries, new Set(["twn"]));
    expect(a).toEqual(b);
  });
});

describe("capColorFor", () => {
  it("無 focus 選取時,回傳洲別原色", () => {
    expect(capColorFor("asia", false, false)).toBe(colorForRegion("asia"));
  });

  it("有 focus 選取且該國在選取名單內,回傳洲別原色", () => {
    expect(capColorFor("asia", true, true)).toBe(colorForRegion("asia"));
  });

  it("有 focus 選取但該國不在選取名單內,灰化", () => {
    expect(capColorFor("asia", false, true)).toBe("#CBD5E1");
  });

  it("dark=true 時,原色改用深色模式洲別色", () => {
    expect(capColorFor("asia", false, false, true)).toBe(colorForRegion("asia", true));
    expect(capColorFor("asia", false, false, true)).not.toBe(colorForRegion("asia", false));
  });

  it("dark=true 時,灰化改用深色模式的中灰(不是淺色模式的亮灰)", () => {
    expect(capColorFor("asia", false, true, true)).toBe("#475569");
  });
});

describe("strokeColorFor", () => {
  // 8/4 二次回饋:強調色原本沿用 --accent 青綠,跟歐洲洲別色(regionColors.ts 的
  // REGION_COLORS.europe/REGION_COLORS_DARK.europe)撞色,改成玫紅色系——這裡順便斷言
  // 新色跟兩個主題的歐洲色不同,避免以後又不小心改回同一組值。
  it("hover 中回傳強調色,否則回傳預設白色細線", () => {
    expect(strokeColorFor(true, false)).toBe("#DB2777");
    expect(strokeColorFor(false, false)).toBe("#ffffff");
  });

  it("dark=true 時 hover 強調色改用深色模式版本", () => {
    expect(strokeColorFor(true, false, true)).toBe("#F472B6");
    expect(strokeColorFor(false, false, true)).toBe("#ffffff"); // 未 hover 時白色細線不受主題影響
  });

  // 8/4 使用者回饋:選取的國家(即使滑鼠沒停留)也要有明顯邊框,不再只靠 hover。
  it("已選取(isFocused)且未 hover 時,也回傳強調色", () => {
    expect(strokeColorFor(false, true)).toBe("#DB2777");
    expect(strokeColorFor(false, true, true)).toBe("#F472B6");
  });

  it("強調色跟歐洲洲別色不同(避免選到歐洲國家時邊框融進填色)", () => {
    expect(strokeColorFor(true, false)).not.toBe(colorForRegion("europe", false));
    expect(strokeColorFor(true, false, true)).not.toBe(colorForRegion("europe", true));
  });
});

describe("sideColorFor", () => {
  // 8/4 使用者回饋:WebGL 線寬沒辦法真的加粗,改用選取國家的側壁(extrusion 立面)
  // 換成強調色系、拉高不透明度,搭配 polygonAltitude 墊高,視覺上更接近「加粗邊框」。
  it("未選取回傳預設的低不透明度深色", () => {
    expect(sideColorFor(false)).toBe("rgba(15, 23, 42, 0.08)");
  });

  it("已選取回傳強調色系、不透明度較高", () => {
    expect(sideColorFor(true)).toBe("rgba(219, 39, 119, 0.55)");
    expect(sideColorFor(true, true)).toBe("rgba(244, 114, 182, 0.55)");
  });
});

describe("makeGlobeFill", () => {
  // 8/7 老師回饋:choropleth 顏色要能跟散布圖「顏色」通道一樣呈現指標(人均所得/平均餘命等)。
  it("region 模式=現行洲別色,value 不參與", () => {
    const fill = makeGlobeFill("region", false);
    expect(fill("asia", null, false, false)).toBe(colorForRegion("asia", false));
  });

  it("指標模式=散布圖同一套色階(normalize+ramp 組合)", () => {
    const fill = makeGlobeFill("lifeExpectancy", false);
    const expected = rampColor(TEAL_RAMP)(makeColorNormalizer("lifeExpectancy")(70));
    expect(fill("asia", 70, false, false)).toBe(expected);
  });

  it("深色模式用深色 ramp", () => {
    const fill = makeGlobeFill("lifeExpectancy", true);
    const expected = rampColor(TEAL_RAMP_DARK)(makeColorNormalizer("lifeExpectancy")(70));
    expect(fill("asia", 70, false, false)).toBe(expected);
  });

  it("指標模式缺值 → 無資料灰(與裝飾地形同色,語意=這裡沒有資料)", () => {
    const fill = makeGlobeFill("income", false);
    expect(fill("asia", null, false, false)).toBe(DECORATIVE_COLOR);
  });

  it("focus 灰化優先於一切(指標模式也一樣)", () => {
    const fill = makeGlobeFill("income", false);
    expect(fill("asia", 1000, false, true)).toBe("#CBD5E1");
    const fillDark = makeGlobeFill("income", true);
    expect(fillDark("asia", 1000, false, true)).toBe("#475569");
  });

  it("region 模式 focus 灰化行為與 capColorFor 一致", () => {
    const fill = makeGlobeFill("region", false);
    expect(fill("asia", null, false, true)).toBe(capColorFor("asia", false, true, false));
  });
});

describe("buildDecorativePolygonData", () => {
  it("轉出 name + geometry,不帶 geo 鍵(供 accessor 判斷是不是資料國家)", () => {
    const features = [
      { type: "Feature" as const, properties: { name: "Antarctica" }, geometry: { type: "Polygon" as const, coordinates: [] } },
    ];
    const result = buildDecorativePolygonData(features);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Antarctica");
    expect("geo" in result[0]).toBe(false);
    expect(result[0].geometry).toBe(features[0].geometry);
  });

  it("已知的 10 個裝飾地形都能查到中文名稱", () => {
    const names = [
      "W. Sahara", "Falkland Is.", "Greenland", "Fr. S. Antarctic Lands",
      "Puerto Rico", "New Caledonia", "Antarctica", "N. Cyprus", "Somaliland", "Kosovo",
    ];
    const features = names.map((name) => ({
      type: "Feature" as const, properties: { name }, geometry: { type: "Polygon" as const, coordinates: [] },
    }));
    const result = buildDecorativePolygonData(features);
    expect(result.every((d) => d.nameZh !== d.name)).toBe(true);
    expect(result.find((d) => d.name === "Antarctica")?.nameZh).toBe("南極洲");
    expect(result.find((d) => d.name === "Greenland")?.nameZh).toBe("格陵蘭");
  });

  it("查不到中文名稱時退回英文原名,不拋錯", () => {
    const features = [
      { type: "Feature" as const, properties: { name: "Unknown Land" }, geometry: { type: "Polygon" as const, coordinates: [] } },
    ];
    const result = buildDecorativePolygonData(features);
    expect(result[0].nameZh).toBe("Unknown Land");
  });
});
