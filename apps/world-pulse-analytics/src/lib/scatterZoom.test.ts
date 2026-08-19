import { describe, it, expect } from "vitest";
import { zoomDomain, panDomain, zoomDomainInSpace, panDomainInSpace } from "./scatterZoom";

// 移植自 township-drilldown-app 的 scatterZoom.test.ts(8/4 同一天做的同一個改動,
// 純數學函式,兩邊行為要一致)。
describe("zoomDomain", () => {
  it("放大:錨點在中心,domain 對稱縮小", () =>
    expect(zoomDomain([0, 100], [0, 100], 50, 2)).toEqual([25, 75]));

  it("放大:錨點偏左,錨點在新舊 domain 中的比例(t)不變", () =>
    expect(zoomDomain([0, 100], [0, 100], 20, 2)).toEqual([10, 60]));

  it("縮小到超過全域寬度 → 回 null(還原全範圍)", () =>
    expect(zoomDomain([25, 75], [0, 100], 50, 0.5)).toBeNull());

  it("縮小但未達全域寬度 → 正常擴大", () =>
    expect(zoomDomain([40, 60], [0, 100], 50, 0.5)).toEqual([30, 70]));

  it("放大超過 5% 下限 → clamp 在 minFrac(預設 0.05)對應的寬度", () =>
    expect(zoomDomain([45, 55], [0, 100], 50, 4)).toEqual([47.5, 52.5]));

  it("放大貼左邊界 → clamp 平移(不改變寬度),不超出全域下界", () =>
    expect(zoomDomain([0, 20], [0, 100], 5, 0.5)).toEqual([0, 40]));

  it("放大貼右邊界 → clamp 平移(不改變寬度),不超出全域上界", () =>
    expect(zoomDomain([80, 100], [0, 100], 95, 0.5)).toEqual([60, 100]));

  it("degenerate domain(寬度 0)→ 退回中心錨點(t=0.5),不除以零", () =>
    expect(zoomDomain([50, 50], [0, 100], 50, 2)).toEqual([47.5, 52.5]));

});

// 8/7 對數空間縮放(使用者定案,取代「縮放中切線性」方案 A):log 軸縮放中保留對數刻度,
// 縮放數學在「刻度轉換空間」做——轉換空間值比例=像素比例,錨點像素級釘在游標下。
// 值空間版在人均所得軸(300–250000,三個數量級)第一格會被 clamp 推走半個繪圖區(實測)。
describe("zoomDomainInSpace(轉換空間縮放,log 軸用 Math.log/Math.exp)", () => {
  const fwd = Math.log, inv = Math.exp;
  const full: [number, number] = [300, 250000];

  it("log 空間放大:錨點在轉換空間的比例不變(=游標像素位置不動)", () => {
    const anchor = Math.sqrt(300 * 250000); // log 軸繪圖區正中央的資料值(幾何平均)
    const d = zoomDomainInSpace(full, full, anchor, 2, fwd, inv)!;
    const t0 = (fwd(anchor) - fwd(full[0])) / (fwd(full[1]) - fwd(full[0]));
    const t1 = (fwd(anchor) - fwd(d[0])) / (fwd(d[1]) - fwd(d[0]));
    expect(t1).toBeCloseTo(t0, 10);
    expect(fwd(d[1]) - fwd(d[0])).toBeCloseTo((fwd(full[1]) - fwd(full[0])) / 2, 10);
  });

  it("恆等轉換=與 zoomDomain 完全相同(線性軸行為不變)", () => {
    const id = (x: number) => x;
    expect(zoomDomainInSpace([0, 100], [0, 100], 20, 2, id, id)).toEqual(
      zoomDomain([0, 100], [0, 100], 20, 2),
    );
  });

  it("縮小超過全域寬度 → 回 null(還原全範圍,軸變回固定對數刻度)", () =>
    expect(zoomDomainInSpace([1000, 8000], full, 3000, 0.1, fwd, inv)).toBeNull());
});

describe("panDomainInSpace(轉換空間平移)", () => {
  const fwd = Math.log, inv = Math.exp;
  const full: [number, number] = [300, 250000];

  it("log 空間平移 delta,轉換空間寬度不變", () => {
    const cur: [number, number] = [1000, 8000];
    const d = panDomainInSpace(cur, full, 0.4, fwd, inv);
    expect(fwd(d[1]) - fwd(d[0])).toBeCloseTo(fwd(cur[1]) - fwd(cur[0]), 10);
    expect(fwd(d[0])).toBeCloseTo(fwd(cur[0]) + 0.4, 10);
  });

  it("平移貼到全域邊界 → clamp(轉換空間寬度不變)", () => {
    const cur: [number, number] = [1000, 8000];
    const d = panDomainInSpace(cur, full, -99, fwd, inv);
    expect(d[0]).toBeCloseTo(300, 6);
    expect(fwd(d[1]) - fwd(d[0])).toBeCloseTo(fwd(cur[1]) - fwd(cur[0]), 10);
  });

  it("恆等轉換=與 panDomain 完全相同(線性軸行為不變)", () => {
    const id = (x: number) => x;
    expect(panDomainInSpace([30, 50], [0, 100], 10, id, id)).toEqual(
      panDomain([30, 50], [0, 100], 10),
    );
  });
});

// 8/4 使用者實測滾輪縮放後追加需求:「放大後的散布圖可以上下左右用滑鼠移動」——
// 移植自 township-drilldown-app 同一天做的同一個追加功能。
describe("panDomain", () => {
  it("範圍內平移", () => expect(panDomain([30, 50], [0, 100], 10)).toEqual([40, 60]));

  it("往左平移貼到左邊界 → clamp(不改寬度),不超出全域下界", () =>
    expect(panDomain([0, 20], [0, 100], -10)).toEqual([0, 20]));

  it("往右平移貼到右邊界 → clamp(不改寬度),不超出全域上界", () =>
    expect(panDomain([80, 100], [0, 100], 30)).toEqual([80, 100]));

  it("delta=0 → 不變", () => expect(panDomain([40, 60], [0, 100], 0)).toEqual([40, 60]));

  it("小幅平移,尚未貼到邊界 → 正常平移不 clamp", () =>
    expect(panDomain([10, 30], [0, 100], -5)).toEqual([5, 25]));
});
