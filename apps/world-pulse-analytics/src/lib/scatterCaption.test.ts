import { describe, expect, test } from "vitest";
import { buildScatterCaption, buildFocusCaption } from "./scatterCaption";
import { DEFAULT_CHANNELS } from "./channels";

describe("buildScatterCaption", () => {
  test("預設通道:講 X/Y/大小,顏色=區域講洲別", () => {
    const s = buildScatterCaption(DEFAULT_CHANNELS);
    expect(s).toContain("每顆泡泡代表一個國家");
    expect(s).toContain("平均餘命");
    expect(s).toContain("人均所得");
    expect(s).toContain("總人口");
    expect(s).toContain("所屬洲別");
  });
  test("顏色=連續指標:改講顏色深淺", () => {
    const s = buildScatterCaption({ ...DEFAULT_CHANNELS, color: "childMortality" });
    expect(s).toContain("兒童死亡率");
    expect(s).toContain("越深");
  });

  // 8/4 語言切換:lang="en" 產出英文句子,用對應的英文指標名。
  test("lang='en':產出英文句子,講 X/Y/大小的英文指標名", () => {
    const s = buildScatterCaption(DEFAULT_CHANNELS, "en");
    expect(s).toContain("Each bubble is a country");
    expect(s).toContain("Life Expectancy");
    expect(s).toContain("Income per Capita");
    expect(s).toContain("Population");
    expect(s).toContain("continent");
  });
});

describe("buildFocusCaption", () => {
  test("未選:顯示框選教學", () => {
    const s = buildFocusCaption(0);
    expect(s).toContain("選取");
    expect(s).toContain("放大"); // U19:教學句尾補放大鏡縮放操作說明
  });
  test("已選 N 國:含數量與保留說明", () => {
    const s = buildFocusCaption(14);
    expect(s).toContain("已選 14 國");
    expect(s).toContain("保留");
  });

  // 8/4 語言切換:英文版狀態文字。
  test("lang='en':未選顯示英文教學,已選顯示英文數量說明", () => {
    const empty = buildFocusCaption(0, "en");
    expect(empty).toContain("Select");
    expect(empty).toContain("Zoom");
    const selected = buildFocusCaption(14, "en");
    expect(selected).toContain("14 countries selected");
  });
});
