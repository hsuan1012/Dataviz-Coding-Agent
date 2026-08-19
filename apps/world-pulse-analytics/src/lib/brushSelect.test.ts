import { describe, expect, test } from "vitest";
import { geosInRect, normalizeRect, isBrushTrivial, type PlacedBubble } from "./brushSelect";

describe("geosInRect", () => {
  const pts = [
    { geo: "twn", cx: 10, cy: 10 },
    { geo: "jpn", cx: 50, cy: 50 },
    { geo: "kor", cx: 90, cy: 90 },
  ];
  test("矩形內的國家(邊界含端點)", () => {
    expect(geosInRect(pts, [[10, 10], [50, 50]])).toEqual(["twn", "jpn"]);
  });
  test("空矩形回空陣列", () => {
    expect(geosInRect(pts, [[0, 0], [5, 5]])).toEqual([]);
  });
});

describe("normalizeRect", () => {
  test("任意順序的兩點都能正規化成 x0<=x1、y0<=y1", () => {
    expect(normalizeRect([50, 60], [10, 20])).toEqual([[10, 20], [50, 60]]);
    expect(normalizeRect([10, 20], [50, 60])).toEqual([[10, 20], [50, 60]]);
  });
  test("單點(起訖相同)退化成零面積矩形", () => {
    expect(normalizeRect([30, 30], [30, 30])).toEqual([[30, 30], [30, 30]]);
  });
});

describe("isBrushTrivial", () => {
  test("寬或高 < 3 視為誤觸", () => {
    expect(isBrushTrivial([[0, 0], [2, 50]])).toBe(true);
    expect(isBrushTrivial([[0, 0], [50, 2]])).toBe(true);
    expect(isBrushTrivial([[0, 0], [0, 0]])).toBe(true);
  });
  test("寬高皆 >= 3 才算有效框選", () => {
    expect(isBrushTrivial([[0, 0], [3, 3]])).toBe(false);
    expect(isBrushTrivial([[0, 0], [50, 50]])).toBe(false);
  });
});

// 模擬 BubbleChart 的 pointerdown→pointermove→pointerup 決策邏輯(不含 DOM/CTM 轉換,
// jsdom 對 SVGSVGElement.getScreenCTM 沒有實作,元件級 pointer 模擬不可行,改測純函式串接的
// 決策邏輯:dragStart/dragCurrent → normalizeRect → isBrushTrivial 門檻 → geosInRect)。
describe("框選拖曳決策邏輯(pointerdown→move→up 的純函式串接)", () => {
  const placed: PlacedBubble[] = [
    { geo: "twn", cx: 20, cy: 20 },
    { geo: "jpn", cx: 40, cy: 40 },
    { geo: "kor", cx: 200, cy: 200 },
  ];

  function simulateDrag(
    dragStart: [number, number],
    dragCurrent: [number, number]
  ): string[] | null {
    const rect = normalizeRect(dragStart, dragCurrent);
    if (isBrushTrivial(rect)) return null; // 誤觸:不 dispatch BRUSH_APPLY
    return geosInRect(placed, rect);
  }

  test("正常拖曳出足夠大的矩形 → 回傳框住的國家清單", () => {
    expect(simulateDrag([10, 10], [50, 50])).toEqual(["twn", "jpn"]);
  });
  test("拖曳起訖顛倒(右下往左上拖)結果相同", () => {
    expect(simulateDrag([50, 50], [10, 10])).toEqual(["twn", "jpn"]);
  });
  test("拖曳幅度 < 3 視為誤觸,回傳 null(不 dispatch)", () => {
    expect(simulateDrag([10, 10], [11, 11])).toBeNull();
  });
  test("原地點擊(起訖同點)視為誤觸", () => {
    expect(simulateDrag([10, 10], [10, 10])).toBeNull();
  });
});
