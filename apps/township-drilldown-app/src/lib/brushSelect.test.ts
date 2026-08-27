import { describe, it, expect } from "vitest";
import { townsInRect, excludeFromSelection, visibleInPlot, type PlacedPoint } from "./brushSelect";

const PTS: PlacedPoint[] = [
  { township: "甲鎮", cx: 10, cy: 10 },
  { township: "乙鎮", cx: 50, cy: 50 },
  { township: "丙鎮", cx: 100, cy: 100 },
];

describe("townsInRect", () => {
  it("框內鄉鎮入選、框外排除", () =>
    expect(townsInRect(PTS, [[0, 0], [60, 60]])).toEqual(["甲鎮", "乙鎮"]));
  it("邊界點(等於框緣)入選", () =>
    expect(townsInRect(PTS, [[10, 10], [50, 50]])).toEqual(["甲鎮", "乙鎮"]));
  it("空框回空陣列", () =>
    expect(townsInRect(PTS, [[200, 200], [300, 300]])).toEqual([]));
  it("無點回空陣列", () =>
    expect(townsInRect([], [[0, 0], [999, 999]])).toEqual([]));
});

describe("visibleInPlot 框選前過濾(老師 8/24 bug:縮放後繪圖區外被裁掉的隱形點不得被框選)", () => {
  it("繪圖區內的點保留、區外(被 clip 裁掉)的點剔除", () =>
    expect(visibleInPlot(PTS, [[20, 20], [120, 120]])).toEqual([
      { township: "乙鎮", cx: 50, cy: 50 },
      { township: "丙鎮", cx: 100, cy: 100 },
    ]));
  it("邊界上(等於繪圖區緣)視為可見", () =>
    expect(visibleInPlot(PTS, [[10, 10], [100, 100]])).toEqual(PTS));
  it("全部在區外回空陣列", () =>
    expect(visibleInPlot(PTS, [[500, 500], [600, 600]])).toEqual([]));
});

describe("excludeFromSelection 雙擊剔除(老師 7/24 需求:只做剔除,不做加回)", () => {
  it("名單內的鄉鎮 → 移除,其餘保留順序", () =>
    expect(excludeFromSelection(["甲鎮", "乙鎮", "丙鎮"], "乙鎮")).toEqual(["甲鎮", "丙鎮"]));
  it("剔到剩 0 顆 → 回 null(=清除選取,與框空一致)", () =>
    expect(excludeFromSelection(["甲鎮"], "甲鎮")).toBeNull());
  it("不在名單 → 原物件原樣返回(參照相等,不觸發重繪)", () => {
    const sel = ["甲鎮", "乙鎮"];
    expect(excludeFromSelection(sel, "丙鎮")).toBe(sel);
  });
  it("無名單(null)→ null(未選取狀態雙擊無反應)", () =>
    expect(excludeFromSelection(null, "甲鎮")).toBeNull());
});
