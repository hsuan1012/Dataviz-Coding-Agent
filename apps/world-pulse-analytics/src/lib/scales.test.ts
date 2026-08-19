import { describe, it, expect } from "vitest";
import {
  createLifeExpectancyScale,
  createIncomeScale,
  createPopulationRadiusScale,
} from "./scales";

describe("createLifeExpectancyScale", () => {
  it("線性刻度，定義域邊界對應到值域邊界", () => {
    const scale = createLifeExpectancyScale([0, 600]);
    expect(scale(8)).toBeCloseTo(0);
    expect(scale(95)).toBeCloseTo(600);
  });

  it("超出定義域的值會被夾在邊界（clamp），不會畫到值域外", () => {
    const scale = createLifeExpectancyScale([0, 600]);
    expect(scale(5)).toBeCloseTo(0);
    expect(scale(200)).toBeCloseTo(600);
  });
});

describe("createIncomeScale", () => {
  it("對數刻度，幾何平均數落在值域中點", () => {
    const scale = createIncomeScale([0, 100]);
    expect(scale(300)).toBeCloseTo(0, 5);
    expect(scale(250000)).toBeCloseTo(100, 5);
    expect(scale(Math.sqrt(300 * 250000))).toBeCloseTo(50, 5);
  });

  it("超出定義域的值會被夾在邊界（clamp），不會畫到值域外", () => {
    const scale = createIncomeScale([0, 100]);
    expect(scale(100)).toBeCloseTo(0);
    expect(scale(1_000_000)).toBeCloseTo(100);
  });
});

describe("createPopulationRadiusScale", () => {
  it("開方刻度，值域邊界對應正確", () => {
    const scale = createPopulationRadiusScale([4, 40]);
    expect(scale(10000)).toBeCloseTo(4);
    expect(scale(2_000_000_000)).toBeCloseTo(40);
  });

  it("超出定義域的值會被夾在邊界（clamp），不會畫到值域外", () => {
    const scale = createPopulationRadiusScale([4, 40]);
    expect(scale(1)).toBeCloseTo(4);
    expect(scale(5_000_000_000)).toBeCloseTo(40);
  });
});
