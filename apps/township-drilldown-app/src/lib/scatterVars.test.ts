import { describe, it, expect } from "vitest";
import { scatterVars, scatterPoints, scatterDomains, type Meta, type Values } from "./data";

const meta = {
  years: [102, 103],
  indicators: [
    { key: "density", label: "人口密度", unit: "人/km²" },
    { key: "income", label: "平均所得", unit: "千元/戶" },
    { key: "death", label: "死亡率", unit: "每10萬人" },
    { key: "clinic", label: "診所醫事人力", unit: "人/萬人" },
    { key: "hospital", label: "醫院醫事人力", unit: "人/萬人" },
  ],
  deathCauses: [
    { key: "death", label: "全死因" },
    { key: "death_c06", label: "惡性腫瘤" },
    { key: "death_c21", label: "肺炎" },
  ],
  regions: { 臺北市中正區: "北" },
} as unknown as Meta;

const town = (v: number) => ({ 臺北市中正區: v });
const values = {
  density: { town: { "102": town(100), "103": town(110) } },
  income: { town: { "102": town(700), "103": town(710) } },
  death: { town: { "102": town(600), "103": town(610) } },
  clinic: { town: { "102": town(20), "103": town(21) } },
  hospital: { town: { "102": town(30), "103": town(31) } },
  death_c06: { town: { "102": town(180), "103": town(190) } },
  death_c21: { town: { "102": town(40), "103": town(45) } },
} as unknown as Values;

describe("scatterVars", () => {
  it("=指標+死因(排除重複 death),死因 unit=死亡率單位", () => {
    const v = scatterVars(meta);
    expect(v.map((x) => x.key)).toEqual(["density", "income", "death", "clinic", "hospital", "death_c06", "death_c21"]);
    expect(v.find((x) => x.key === "death_c06")).toMatchObject({ label: "惡性腫瘤", unit: "每10萬人", group: "cause" });
    expect(v.filter((x) => x.group === "ind")).toHaveLength(5);
  });
});

describe("scatterPoints 含死因", () => {
  it("點的欄位含死因值(對照 fixture 真值)", () => {
    const pts = scatterPoints(values, meta, 102);
    expect(pts).toHaveLength(1);
    expect(pts[0].death_c06).toBe(180);
    expect(pts[0].death_c21).toBe(40);
    expect(pts[0].density).toBe(100);
  });
  it("死因缺值的鄉鎮被剔除(維持點集完整可比)", () => {
    const v2 = JSON.parse(JSON.stringify(values)) as Values;
    delete (v2 as any).death_c06.town["102"]["臺北市中正區"];
    expect(scatterPoints(v2, meta, 102)).toHaveLength(0);
  });
});

describe("scatterDomains 含死因", () => {
  it("死因 domain=跨年 extent", () => {
    const d = scatterDomains(values, meta);
    expect(d.death_c06).toEqual([180, 190]);
    expect(d.death_c21).toEqual([40, 45]);
  });
});
