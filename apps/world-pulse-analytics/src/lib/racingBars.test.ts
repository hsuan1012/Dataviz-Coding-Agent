import { describe, it, test, expect } from "vitest";
import { getTopN, formatRacingValue } from "./racingBars";
import type { CountryMeta, YearRecord } from "../data/types";

const countries: CountryMeta[] = [
  { geo: "twn", name: "Taiwan", region: "asia", latitude: 23.7, longitude: 121.0, iso2: "TW" },
  { geo: "jpn", name: "Japan", region: "asia", latitude: 36.2, longitude: 138.3, iso2: "JP" },
  { geo: "deu", name: "Germany", region: "europe", latitude: 51.2, longitude: 10.5, iso2: "DE" },
  { geo: "usa", name: "United States", region: "americas", latitude: 38.0, longitude: -97.0, iso2: "US" },
];

function record(geo: string, year: number, income: number | null): YearRecord {
  return {
    geo,
    year,
    income,
    lifeExpectancy: 80,
    population: 1000,
    incomeIsProjection: false,
    lifeExpectancyIsProjection: false,
    populationIsProjection: false,
    childMortality: null,
    fertility: null,
  };
}

const records: YearRecord[] = [
  record("twn", 2000, 20000),
  record("jpn", 2000, 35000),
  record("deu", 2000, 30000),
  record("usa", 2000, 40000),
  record("twn", 2001, 21000),
];

describe("getTopN", () => {
  it("依指標值遞減排序，取前 N 名", () => {
    const result = getTopN(countries, records, 2000, "income", 3);
    expect(result.map((r) => r.geo)).toEqual(["usa", "jpn", "deu"]);
  });

  it("n 超過可用國家數時回傳實際筆數，不出錯", () => {
    const result = getTopN(countries, records, 2000, "income", 10);
    expect(result).toHaveLength(4);
  });

  it("null 值的紀錄被排除", () => {
    const recordsWithNull = [...records, record("jpn", 2005, null)];
    const result = getTopN(countries, recordsWithNull, 2005, "income", 5);
    expect(result.find((r) => r.geo === "jpn")).toBeUndefined();
  });

  it("只篩選指定年份", () => {
    const result = getTopN(countries, records, 2001, "income", 5);
    expect(result).toEqual([
      { geo: "twn", name: "Taiwan", iso2: "TW", region: "asia", value: 21000 },
    ]);
  });

  it("回傳結果不受任何『目前勾選』子集合影響——此函式本身沒有選取集合參數，" +
     "全部 195 國（此測試裡是全部 4 國）都納入排名計算", () => {
    const result = getTopN(countries, records, 2000, "income", 1);
    // usa 是全域最高值，即使它「假設」不在某個外部選取清單裡，也一定出現在結果中，
    // 因為 getTopN 根本不接受選取清單這個概念。
    expect(result[0].geo).toBe("usa");
  });
});

describe("formatRacingValue", () => {
  it("income/population 用 k/M/B 縮寫", () => {
    expect(formatRacingValue("income", 500)).toBe("500");
    expect(formatRacingValue("income", 60000)).toBe("60.0k");
    expect(formatRacingValue("population", 1_400_000_000)).toBe("1.4B");
    expect(formatRacingValue("population", 5_000_000)).toBe("5.0M");
  });

  it("lifeExpectancy 顯示到小數點一位", () => {
    expect(formatRacingValue("lifeExpectancy", 84.234)).toBe("84.2");
  });
});

test("getTopN 支援新指標 childMortality(值最高前 N)", () => {
  const countries = [
    { geo: "a", name: "A", region: "asia", latitude: 0, longitude: 0, iso2: "AA" },
    { geo: "b", name: "B", region: "asia", latitude: 0, longitude: 0, iso2: "BB" },
  ];
  const records = [
    { geo: "a", year: 2000, childMortality: 100 },
    { geo: "b", year: 2000, childMortality: 300 },
  ];
  const top = getTopN(countries as any, records as any, 2000, "childMortality", 5);
  expect(top[0].geo).toBe("b");
});

test("formatRacingValue:childMortality 整數、fertility 兩位小數", () => {
  expect(formatRacingValue("childMortality", 123.4)).toBe("123");
  expect(formatRacingValue("fertility", 3.456)).toBe("3.46");
});
