import { describe, it, expect } from "vitest";
import { applyView, applyBrush, applyExclude, type NavSel } from "./mergedSelect";
import { NATION, drillToCounty, drillToTown } from "./nav";

// 合併單頁 B 案「下鑽=整縣選取」五條規則(spec):
// 1 點縣=下鑽+整縣選取 2 框選=只選取不下鑽(退回全國) 3 回全國=清除
// 4 縣層點鄉鎮=村里層+單鄉鎮名單 5 剔除不動 view;剔到空回全國
const towns = (c: string) =>
  c === "臺北市" ? ["臺北市北投區", "臺北市大安區", "臺北市中山區"] : ["連江縣南竿鄉"];
const at = (view: NavSel["view"], selected: NavSel["selected"]): NavSel => ({ view, selected });

describe("mergedSelect reducer", () => {
  it("規則1:全國點縣 → 下鑽+整縣選取", () => {
    const s = applyView(at(NATION, null), drillToCounty("臺北市"), towns);
    expect(s.view.level).toBe("county");
    expect(s.selected).toEqual(towns("臺北市"));
  });
  it("規則2:框選 → 名單鎖定+退回全國(已下鑽時)", () => {
    const s = applyBrush(at(drillToCounty("臺北市"), towns("臺北市")), ["高雄市新興區"]);
    expect(s.view).toEqual(NATION);
    expect(s.selected).toEqual(["高雄市新興區"]);
  });
  it("規則2:框空集合=清除+回全國", () => {
    const s = applyBrush(at(drillToCounty("臺北市"), towns("臺北市")), []);
    expect(s.view).toEqual(NATION);
    expect(s.selected).toBeNull();
  });
  it("規則3:回全國=清除選取", () => {
    const s = applyView(at(drillToCounty("臺北市"), towns("臺北市")), NATION, towns);
    expect(s.view).toEqual(NATION);
    expect(s.selected).toBeNull();
  });
  it("規則3:麵包屑回縣層=恢復整縣選取", () => {
    const town = drillToTown(drillToCounty("臺北市"), "臺北市北投區", "63000120");
    const s = applyView(at(town, ["臺北市北投區"]), drillToCounty("臺北市"), towns);
    expect(s.selected).toEqual(towns("臺北市"));
  });
  it("規則4:縣層點鄉鎮 → 村里層+單鄉鎮名單", () => {
    const target = drillToTown(drillToCounty("臺北市"), "臺北市北投區", "63000120");
    const s = applyView(at(drillToCounty("臺北市"), towns("臺北市")), target, towns);
    expect(s.view.level).toBe("town");
    expect(s.selected).toEqual(["臺北市北投區"]);
  });
  it("規則5:剔除只編輯名單、不動 view(縣層剔除保持下鑽)", () => {
    const s = applyExclude(at(drillToCounty("臺北市"), towns("臺北市")), "臺北市大安區");
    expect(s.view.level).toBe("county");
    expect(s.selected).toEqual(["臺北市北投區", "臺北市中山區"]);
  });
  it("規則5:剔到空 → 回未選取+回全國", () => {
    const s = applyExclude(at(drillToCounty("連江縣"), ["連江縣南竿鄉"]), "連江縣南竿鄉");
    expect(s.view).toEqual(NATION);
    expect(s.selected).toBeNull();
  });
  it("規則5:剔除不在名單者 → 回原物件(setState 短路)", () => {
    const st = at(NATION, ["臺北市北投區"]);
    expect(applyExclude(st, "高雄市新興區")).toBe(st);
  });
  it("無名單時剔除 → 回原物件", () => {
    const st = at(NATION, null);
    expect(applyExclude(st, "臺北市北投區")).toBe(st);
  });
});
