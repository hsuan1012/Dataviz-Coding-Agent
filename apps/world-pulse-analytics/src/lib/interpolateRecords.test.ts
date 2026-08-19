import { describe, it, expect } from "vitest";
import { buildYearIndex, interpolateRecord } from "./interpolateRecords";
import type { YearRecord } from "../data/types";

const rec = (year: number, over: Partial<YearRecord> = {}): YearRecord => ({
  geo: "twn",
  year,
  income: 1000,
  lifeExpectancy: 70,
  population: 20_000_000,
  incomeIsProjection: false,
  lifeExpectancyIsProjection: false,
  populationIsProjection: false,
  childMortality: 10,
  fertility: 2,
  ...over,
});

describe("buildYearIndex", () => {
  it("同一份 records 陣列回傳同一個快取 index", () => {
    const records = [rec(2000)];
    expect(buildYearIndex(records)).toBe(buildYearIndex(records));
  });
});

describe("interpolateRecord", () => {
  const records = [
    rec(2000),
    rec(2001, {
      income: 2000,
      lifeExpectancy: 80,
      population: 22_000_000,
      childMortality: 20,
      fertility: 4,
      incomeIsProjection: true,
    }),
  ];
  const index = buildYearIndex(records);

  it("整數年直接回原始紀錄(不複製)", () =>
    expect(interpolateRecord(index, "twn", 2000)).toBe(records[0]));
  it("小數年逐指標線性內插,year 帶小數", () => {
    const r = interpolateRecord(index, "twn", 2000.5)!;
    expect(r.year).toBe(2000.5);
    expect(r.income).toBe(1500);
    expect(r.lifeExpectancy).toBe(75);
    expect(r.population).toBe(21_000_000);
    expect(r.childMortality).toBe(15);
    expect(r.fertility).toBe(3);
  });
  it("推估值旗標取 floor 年", () =>
    expect(interpolateRecord(index, "twn", 2000.5)!.incomeIsProjection).toBe(false));
  it("任一側缺值 → 該指標 null(其他指標照插)", () => {
    const idx = buildYearIndex([rec(2000, { income: null }), rec(2001, { income: 2000 })]);
    const r = interpolateRecord(idx, "twn", 2000.5)!;
    expect(r.income).toBeNull();
    expect(r.lifeExpectancy).toBe(70);
  });
  it("下一年紀錄不存在 → 退回 floor 年紀錄", () =>
    expect(interpolateRecord(index, "twn", 2001.5)).toBe(records[1]));
  it("查無國家 → null", () => expect(interpolateRecord(index, "xxx", 2000)).toBeNull());
});
