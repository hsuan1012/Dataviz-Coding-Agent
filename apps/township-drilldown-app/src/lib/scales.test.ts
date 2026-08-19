import { describe, it, expect } from "vitest";
import { quantileClass, colorForValue, regionColor } from "./scales";

const breaks = [161, 452, 954, 2890]; // density
const scale = ["c0", "c1", "c2", "c3", "c4"];

describe("scales", () => {
  it("quantileClass buckets by breaks (break value is not > break → lower class)", () => {
    expect(quantileClass(107, breaks)).toBe(0);
    expect(quantileClass(161, breaks)).toBe(0);
    expect(quantileClass(200, breaks)).toBe(1);
    expect(quantileClass(954, breaks)).toBe(2);
    expect(quantileClass(1000, breaks)).toBe(3);
    expect(quantileClass(3000, breaks)).toBe(4);
  });
  it("colorForValue indexes the scale and clamps", () => {
    expect(colorForValue(107, breaks, scale)).toBe("c0");
    expect(colorForValue(3000, breaks, scale)).toBe("c4");
  });
  it("regionColor maps by REGIONS order", () => {
    const cat = ["r0", "r1", "r2", "r3", "r4"];
    expect(regionColor("北", cat)).toBe("r0");
    expect(regionColor("離島", cat)).toBe("r4");
  });
});
