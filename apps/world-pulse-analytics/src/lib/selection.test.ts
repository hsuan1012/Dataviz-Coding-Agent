import { describe, it, expect } from "vitest";
import { toggleCountry, setRegionSelection, groupByRegion, filterBySearch } from "./selection";
import type { CountryMeta } from "../data/types";

const countries: CountryMeta[] = [
  { geo: "twn", name: "Taiwan", region: "asia", latitude: 23.7, longitude: 121.0, iso2: "TW" },
  { geo: "jpn", name: "Japan", region: "asia", latitude: 36.2, longitude: 138.3, iso2: "JP" },
  { geo: "deu", name: "Germany", region: "europe", latitude: 51.2, longitude: 10.5, iso2: "DE" },
];

describe("toggleCountry", () => {
  it("已勾選則取消", () => {
    const result = toggleCountry(new Set(["twn"]), "twn");
    expect(result.has("twn")).toBe(false);
  });
  it("未勾選則加入", () => {
    const result = toggleCountry(new Set(), "twn");
    expect(result.has("twn")).toBe(true);
  });
  it("不改動原本傳入的 Set（不可變）", () => {
    const original = new Set(["twn"]);
    toggleCountry(original, "twn");
    expect(original.has("twn")).toBe(true);
  });
});

describe("setRegionSelection", () => {
  it("整組勾選只影響該洲的國家", () => {
    const result = setRegionSelection(new Set(), countries, "asia", true);
    expect(result.has("twn")).toBe(true);
    expect(result.has("jpn")).toBe(true);
    expect(result.has("deu")).toBe(false);
  });
  it("整組取消只移除該洲的國家", () => {
    const all = new Set(["twn", "jpn", "deu"]);
    const result = setRegionSelection(all, countries, "asia", false);
    expect(result.has("twn")).toBe(false);
    expect(result.has("jpn")).toBe(false);
    expect(result.has("deu")).toBe(true);
  });
});

describe("groupByRegion", () => {
  it("依洲別分成五組(亞洲/歐洲/非洲/美洲/大洋洲)", () => {
    const groups = groupByRegion(countries);
    expect(groups.asia).toHaveLength(2);
    expect(groups.europe).toHaveLength(1);
    expect(groups.africa).toHaveLength(0);
    expect(groups.americas).toHaveLength(0);
    expect(groups.oceania).toHaveLength(0);
  });

  // 8/4 使用者發現「亞洲」混了大洋洲國家後,oceania 從原本的「不存在的洲別」
  // 變成真正的第五類——這裡改用一個真正不存在的值("atlantis")測防禦分支,
  // 不能再用 "oceania" 當範例(現在是合法值,會被正常分進 groups.oceania)。
  it("region 不是五個已知值之一時，略過該筆而不拋出例外", () => {
    const withUnknownRegion: CountryMeta[] = [
      ...countries,
      { geo: "xxx", name: "Unknown", region: "atlantis" as unknown as CountryMeta["region"], latitude: 0, longitude: 0, iso2: "" },
    ];
    expect(() => groupByRegion(withUnknownRegion)).not.toThrow();
    const groups = groupByRegion(withUnknownRegion);
    const allCountries = [...groups.asia, ...groups.europe, ...groups.africa, ...groups.americas, ...groups.oceania];
    expect(allCountries.find((c) => c.geo === "xxx")).toBeUndefined();
  });

  it("大洋洲國家會被分進 groups.oceania", () => {
    const withOceania: CountryMeta[] = [
      ...countries,
      { geo: "aus", name: "Australia", region: "oceania", latitude: -25.0, longitude: 133.0, iso2: "AU" },
    ];
    const groups = groupByRegion(withOceania);
    expect(groups.oceania).toHaveLength(1);
    expect(groups.oceania[0].geo).toBe("aus");
  });
});

describe("filterBySearch", () => {
  it("依國名（不分大小寫）篩選", () => {
    expect(filterBySearch(countries, "jap")).toEqual([countries[1]]);
    expect(filterBySearch(countries, "GERMANY")).toEqual([countries[2]]);
  });
  it("空字串回傳全部", () => {
    expect(filterBySearch(countries, "")).toEqual(countries);
  });
  it("清單實際顯示的是中文名，用中文搜尋也要找得到（不能只比對英文原名）", () => {
    expect(filterBySearch(countries, "台灣")).toEqual([countries[0]]);
    expect(filterBySearch(countries, "日本")).toEqual([countries[1]]);
  });
  it("台灣的異體字「臺灣」也要能搜到（Intl.DisplayNames 只回傳「台灣」）", () => {
    expect(filterBySearch(countries, "臺灣")).toEqual([countries[0]]);
    expect(filterBySearch(countries, "臺")).toEqual([countries[0]]);
  });
});
