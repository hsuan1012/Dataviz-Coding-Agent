import { describe, it, expect } from "vitest";
import { townFillMap } from "./mapFill";
import type { Point } from "./data";

// REGIONS 順序=["北","中","南","東","離島"] → 北=cat[0]、東=cat[3]
const pts = [
  { township: "臺北市中正區", region: "北", density: 100, death: 1, income: 2, clinic: 3, hospital: 4 },
  { township: "花蓮縣花蓮市", region: "東", density: 10, death: 2, income: 3, clinic: 4, hospital: 5 },
] as unknown as Point[];
const cat = ["#111", "#222", "#333", "#444", "#555"];

describe("townFillMap", () => {
  it("顏色通道=區域 → 區域分類色", () => {
    const m = townFillMap(pts, "region", cat, null, () => "#no");
    expect(m.get("臺北市中正區")).toBe("#111");
    expect(m.get("花蓮縣花蓮市")).toBe("#444");
  });
  it("顏色通道=指標 → ramp(norm(值))連續色階", () => {
    const m = townFillMap(pts, "density", cat, (v) => v / 100, (u) => `u${u}`);
    expect(m.get("臺北市中正區")).toBe("u1");
    expect(m.get("花蓮縣花蓮市")).toBe("u0.1");
  });
  it("不在點集的鄉鎮=查無(元件端 fallback 淺灰)", () => {
    const m = townFillMap(pts, "region", cat, null, () => "#no");
    expect(m.get("不存在鄉")).toBeUndefined();
  });
});
