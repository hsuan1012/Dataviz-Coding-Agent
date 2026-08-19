import { describe, it, expect, test } from "vitest";
import {
  filterAllThree,
  toCountryList,
  toYearRecords,
  indexFasttrack,
  mergeFasttrack,
  resolveIso3,
  buildBoundaryFeatures,
  buildDecorativeFeatures,
} from "./transform.js";

const rawRows = [
  {
    geo: "twn", name: "Taiwan", year: "2000", income: "20000", life_expectancy: "77.5",
    population: "22000000", world_4region: "asia", latitude: "23.7", longitude: "121.0",
    income_is_projection: "0", life_expectancy_is_projection: "0", population_is_projection: "0",
    all_three: "1",
  },
  {
    geo: "twn", name: "Taiwan", year: "2030", income: "30000", life_expectancy: "82.1",
    population: "23000000", world_4region: "asia", latitude: "23.7", longitude: "121.0",
    income_is_projection: "1", life_expectancy_is_projection: "1", population_is_projection: "1",
    all_three: "1",
  },
  {
    geo: "abw", name: "Aruba", year: "1960", income: "", life_expectancy: "",
    population: "45000", world_4region: "americas", latitude: "12.5", longitude: "-69.97",
    income_is_projection: "", life_expectancy_is_projection: "", population_is_projection: "0",
    all_three: "0",
  },
];

describe("filterAllThree", () => {
  it("只保留 all_three 為 1 的列", () => {
    const result = filterAllThree(rawRows);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.all_three === "1")).toBe(true);
  });
});

describe("toCountryList", () => {
  it("依 geo 去重、經緯度轉數字、依國名排序", () => {
    const result = toCountryList(filterAllThree(rawRows));
    expect(result).toEqual([
      { geo: "twn", name: "Taiwan", region: "asia", latitude: 23.7, longitude: 121.0 },
    ]);
  });

  // 8/4 使用者發現「亞洲」裡混了大洋洲國家——查證後是 Gapminder 原始資料的
  // world_4region 欄位本來就只分四類,大洋洲國家被歸進 asia。新增已知大洋洲國家
  // (geo 白名單)覆寫成 oceania,不信任來源欄位。
  it("已知大洋洲國家(如澳洲)不論 world_4region 給什麼值,region 都覆寫成 oceania", () => {
    const rows = [
      {
        geo: "aus", name: "Australia", year: "2000", income: "40000", life_expectancy: "80",
        population: "19000000", world_4region: "asia", latitude: "-25.0", longitude: "133.0",
        income_is_projection: "0", life_expectancy_is_projection: "0", population_is_projection: "0",
        all_three: "1",
      },
    ];
    const result = toCountryList(rows);
    expect(result[0].region).toBe("oceania");
  });

  it("非大洋洲國家維持原本 world_4region 給的值,不受影響", () => {
    const result = toCountryList(filterAllThree(rawRows));
    expect(result.find((c) => c.geo === "twn").region).toBe("asia");
  });
});

describe("toYearRecords", () => {
  it("轉換數值型態並標記推估值", () => {
    const result = toYearRecords(filterAllThree(rawRows));
    expect(result).toEqual([
      {
        geo: "twn", year: 2000, income: 20000, lifeExpectancy: 77.5, population: 22000000,
        incomeIsProjection: false, lifeExpectancyIsProjection: false, populationIsProjection: false,
      },
      {
        geo: "twn", year: 2030, income: 30000, lifeExpectancy: 82.1, population: 23000000,
        incomeIsProjection: true, lifeExpectancyIsProjection: true, populationIsProjection: true,
      },
    ]);
  });

  it("空字串轉為 null（結構性缺值，不可硬轉成 0）", () => {
    const result = toYearRecords(rawRows);
    const aruba = result.find((r) => r.geo === "abw");
    expect(aruba.income).toBeNull();
    expect(aruba.lifeExpectancy).toBeNull();
  });
});

test("indexFasttrack 以 country|time 建索引並轉數值、跳過空值", () => {
  const rows = [
    { country: "afg", time: "1950", child_mortality_0_5_year_olds_dying_per_1000_born: "420.5" },
    { country: "afg", time: "1951", child_mortality_0_5_year_olds_dying_per_1000_born: "" },
  ];
  const map = indexFasttrack(rows, "child_mortality_0_5_year_olds_dying_per_1000_born");
  expect(map.get("afg|1950")).toBe(420.5);
  expect(map.has("afg|1951")).toBe(false);
});

test("indexFasttrack 非數字字串(如 n/a)不進索引,避免下游極值檢查算出 NaN 而靜默放行", () => {
  const rows = [
    { country: "afg", time: "1952", child_mortality_0_5_year_olds_dying_per_1000_born: "n/a" },
  ];
  const map = indexFasttrack(rows, "child_mortality_0_5_year_olds_dying_per_1000_born");
  expect(map.has("afg|1952")).toBe(false);
});

test("mergeFasttrack 併入兩指標,查不到補 null", () => {
  const records = [{ geo: "afg", year: 1950, income: 1000 }];
  const mort = new Map([["afg|1950", 420.5]]);
  const fert = new Map(); // 生育率查不到
  const merged = mergeFasttrack(records, mort, fert);
  expect(merged[0].childMortality).toBe(420.5);
  expect(merged[0].fertility).toBeNull();
  expect(merged[0].income).toBe(1000); // 原欄位保留
});

describe("resolveIso3", () => {
  it("ISO_A3 有效值優先採用", () => {
    expect(resolveIso3({ ISO_A3: "FJI", ADM0_A3: "FJI" })).toBe("fji");
  });

  it("ISO_A3 為佔位值 -99 時退回 ADM0_A3", () => {
    expect(resolveIso3({ ISO_A3: "-99", ADM0_A3: "NOR", ISO_A3_EH: "-99" })).toBe("nor");
  });

  it("三個候選都拿不到有效值時回傳 null", () => {
    expect(resolveIso3({ ISO_A3: "-99", ADM0_A3: "-99", ISO_A3_EH: "-99" })).toBeNull();
  });

  it("欄位整個不存在也回傳 null,不拋錯", () => {
    expect(resolveIso3({})).toBeNull();
  });
});

describe("buildBoundaryFeatures", () => {
  const knownGeoSet = new Set(["fji", "nor"]);
  const features = [
    { properties: { ISO_A3: "FJI" }, geometry: { type: "Polygon", coordinates: [] } },
    { properties: { ISO_A3: "-99", ADM0_A3: "NOR" }, geometry: { type: "Polygon", coordinates: [] } },
    // Antarctica 不在 195 國清單裡,就算有有效 ISO_A3 也該被濾掉
    { properties: { ISO_A3: "ATA" }, geometry: { type: "Polygon", coordinates: [] } },
  ];

  it("只保留能對到已知國家清單的 features,且只留 geo + geometry", () => {
    const result = buildBoundaryFeatures(features, knownGeoSet);
    expect(result).toHaveLength(2);
    expect(result.map((f) => f.properties.geo).sort()).toEqual(["fji", "nor"]);
    expect(Object.keys(result[0].properties)).toEqual(["geo"]);
    expect(result[0].type).toBe("Feature");
  });
});

describe("buildDecorativeFeatures", () => {
  const knownGeoSet = new Set(["fji", "nor"]);
  const features = [
    { properties: { ISO_A3: "FJI", NAME: "Fiji" }, geometry: { type: "Polygon", coordinates: [] } },
    { properties: { ISO_A3: "-99", ADM0_A3: "NOR", NAME: "Norway" }, geometry: { type: "Polygon", coordinates: [] } },
    // Antarctica 不在 195 國清單裡(即使有有效 ISO_A3),該被收進裝飾圖層
    { properties: { ISO_A3: "ATA", NAME: "Antarctica" }, geometry: { type: "Polygon", coordinates: [] } },
    // 完全無法解析 ISO_A3 的(如 -99 三個候選都拿不到)也該被收進裝飾圖層,不是被丟棄
    { properties: { ISO_A3: "-99", ADM0_A3: "-99", NAME: "N. Cyprus" }, geometry: { type: "Polygon", coordinates: [] } },
  ];

  it("只保留對不到已知國家清單的 features(buildBoundaryFeatures 的互補集合)", () => {
    const result = buildDecorativeFeatures(features, knownGeoSet);
    expect(result.map((f) => f.properties.name).sort()).toEqual(["Antarctica", "N. Cyprus"]);
  });

  it("裝飾 feature 只帶 name(供 tooltip)+ geometry,不帶 geo 鍵", () => {
    const result = buildDecorativeFeatures(features, knownGeoSet);
    expect(Object.keys(result[0].properties)).toEqual(["name"]);
    expect(result[0].type).toBe("Feature");
  });

  it("與 buildBoundaryFeatures 加總會覆蓋全部輸入 features、不重疊", () => {
    const matched = buildBoundaryFeatures(features, knownGeoSet);
    const decorative = buildDecorativeFeatures(features, knownGeoSet);
    expect(matched.length + decorative.length).toBe(features.length);
  });
});
