import { describe, it, expect } from "vitest";
import { NATION, drillToCounty, drillToTown, up, crumbs, indicatorAvailable, effectiveIndicator,
  viewToHash, hashToView, sameView, depthOf, zoomDirection, type View } from "./nav";
import type { Meta } from "./data";

const meta = {
  indicators: [
    { key: "density", levels: ["county", "town", "village"] },
    { key: "income", levels: ["county", "town", "village"] },
    { key: "death", levels: ["county", "town"] },
  ],
} as unknown as Meta;

describe("nav reducer", () => {
  it("NATION is the root view", () => {
    expect(NATION).toEqual({ level: "nation", county: null, town: null, towncode: null });
  });
  it("drills nation → county → town", () => {
    const c = drillToCounty("臺北市");
    expect(c).toEqual({ level: "county", county: "臺北市", town: null, towncode: null });
    const t = drillToTown(c, "臺北市北投區", "63000110");
    expect(t).toEqual({ level: "town", county: "臺北市", town: "臺北市北投區", towncode: "63000110" });
  });
  it("up() walks back one level at a time and stops at nation", () => {
    const t = drillToTown(drillToCounty("臺北市"), "臺北市北投區", "63000110");
    const c = up(t);
    expect(c.level).toBe("county");
    expect(c.county).toBe("臺北市");
    expect(up(c)).toEqual(NATION);
    expect(up(NATION)).toEqual(NATION);
  });
  it("crumbs builds clickable trail 全國 › 縣 › 區", () => {
    const t = drillToTown(drillToCounty("臺北市"), "臺北市北投區", "63000110");
    const cs = crumbs(t);
    expect(cs.map((c) => c.label)).toEqual(["全國", "臺北市", "北投區"]);
    expect(cs[0].view).toEqual(NATION);
    expect(cs[1].view.level).toBe("county");
    // 區段標籤去掉縣市前綴（臺北市北投區 → 北投區）
    expect(cs[2].label).not.toContain("臺北市");
  });
});

describe("URL hash ↔ view（瀏覽器上一頁/下一頁整合）", () => {
  const townIndex = new Map([["臺中市和平區", "66000290"], ["臺北市北投區", "63000120"]]);
  it("viewToHash 序列化三層", () => {
    expect(viewToHash(NATION)).toBe("");
    expect(viewToHash(drillToCounty("臺中市"))).toBe("#/" + encodeURIComponent("臺中市"));
    const t = drillToTown(drillToCounty("臺中市"), "臺中市和平區", "66000290");
    expect(viewToHash(t)).toBe("#/" + encodeURIComponent("臺中市") + "/" + encodeURIComponent("和平區"));
  });
  it("hashToView 反序列化並補 towncode（round-trip）", () => {
    for (const v of [NATION, drillToCounty("臺中市"),
      drillToTown(drillToCounty("臺北市"), "臺北市北投區", "63000120")]) {
      expect(hashToView(viewToHash(v), townIndex)).toEqual(v);
    }
  });
  it("hashToView 對未知/壞值回 NATION", () => {
    expect(hashToView("", townIndex)).toEqual(NATION);
    expect(hashToView("#garbage", townIndex)).toEqual(NATION);
    expect(hashToView("#/火星市/不存在區", townIndex)).toEqual(drillToCounty("火星市")); // 縣名不驗證（geo 對不到就畫不出，無害）；區名查不到 towncode 則停在縣層
  });
  it("sameView 比對值相等", () => {
    expect(sameView(drillToCounty("臺中市"), drillToCounty("臺中市"))).toBe(true);
    expect(sameView(NATION, drillToCounty("臺中市"))).toBe(false);
  });
});

describe("indicator availability by view level", () => {
  const town: View = drillToTown(drillToCounty("臺北市"), "臺北市北投區", "63000110");
  it("death is available at nation/county views but not at town (village) view", () => {
    expect(indicatorAvailable(meta, "death", NATION)).toBe(true);
    expect(indicatorAvailable(meta, "death", drillToCounty("臺北市"))).toBe(true);
    expect(indicatorAvailable(meta, "death", town)).toBe(false);
  });
  it("effectiveIndicator downgrades death → density at town view and flags it", () => {
    expect(effectiveIndicator(meta, "death", NATION)).toEqual({ key: "death", downgraded: false });
    expect(effectiveIndicator(meta, "death", town)).toEqual({ key: "density", downgraded: true });
    expect(effectiveIndicator(meta, "income", town)).toEqual({ key: "income", downgraded: false });
  });
});

describe("zoomDirection（地圖 zoom in/out 動畫方向）", () => {
  it("depthOf 對應三層深度：nation=0、county=1、town=2", () => {
    expect(depthOf(NATION)).toBe(0);
    expect(depthOf(drillToCounty("臺北市"))).toBe(1);
    expect(depthOf(drillToTown(drillToCounty("臺北市"), "臺北市北投區", "63000110"))).toBe(2);
  });
  it("深度變深＝zoom in，變淺＝zoom out，深度不變＝null（不觸發動畫）", () => {
    const county = drillToCounty("臺北市");
    const town = drillToTown(county, "臺北市北投區", "63000110");
    expect(zoomDirection(NATION, county)).toBe("in");
    expect(zoomDirection(county, town)).toBe("in");
    expect(zoomDirection(NATION, town)).toBe("in"); // 跨層麵包屑/深連結一次到位也算 zoom in（純比深度差，不要求相鄰層）
    expect(zoomDirection(town, county)).toBe("out");
    expect(zoomDirection(town, NATION)).toBe("out");
    expect(zoomDirection(county, NATION)).toBe("out");
    expect(zoomDirection(NATION, NATION)).toBe(null);
    // 換指標/年份/主題/框選只會重跑 effect、view 本身不變 → 必須是 null（不能因為切 X 軸畫面也跳一下）
    expect(zoomDirection(county, county)).toBe(null);
  });
});
