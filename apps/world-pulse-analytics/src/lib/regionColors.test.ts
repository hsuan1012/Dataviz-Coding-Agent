import { describe, it, expect } from "vitest";
import { colorForRegion, REGION_COLORS, REGION_COLORS_DARK } from "./regionColors";

describe("colorForRegion", () => {
  it("每個洲別對應到固定顏色", () => {
    expect(colorForRegion("asia")).toBe(REGION_COLORS.asia);
    expect(colorForRegion("europe")).toBe(REGION_COLORS.europe);
    expect(colorForRegion("africa")).toBe(REGION_COLORS.africa);
    expect(colorForRegion("americas")).toBe(REGION_COLORS.americas);
    // 8/4 新增:大洋洲從 Gapminder world_4region 的 asia 拆出來當第五類。
    expect(colorForRegion("oceania")).toBe(REGION_COLORS.oceania);
  });

  it("未知洲別退回灰色，避免地球儀/泡泡圖因髒資料而整片崩潰", () => {
    // @ts-expect-error 刻意傳入非法值測防禦分支
    expect(colorForRegion("unknown")).toBe("#9aa0a6");
  });

  it("dark=true 時改回傳深色模式類別配色", () => {
    expect(colorForRegion("asia", true)).toBe(REGION_COLORS_DARK.asia);
    expect(colorForRegion("asia", true)).not.toBe(REGION_COLORS.asia);
  });

  it("未指定 dark 時預設淺色(向下相容既有呼叫端)", () => {
    expect(colorForRegion("europe")).toBe(REGION_COLORS.europe);
  });
});
