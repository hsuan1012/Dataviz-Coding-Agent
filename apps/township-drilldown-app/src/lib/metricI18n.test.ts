import { describe, it, expect } from "vitest";
import { metricLabel, metricUnit, regionLabel } from "./metricI18n";

describe("metricI18n", () => {
  it("zh 模式回傳原始 label", () => {
    expect(metricLabel("density", "人口密度", "zh")).toBe("人口密度");
  });
  it("en 模式回傳指標英文名", () => {
    expect(metricLabel("density", "人口密度", "en")).toBe("Population density");
  });
  it("en 模式回傳死因英文名", () => {
    expect(metricLabel("death_c06", "惡性腫瘤", "en")).toBe("Malignant neoplasms");
  });
  it("en 模式查無對照時退回原始 label", () => {
    expect(metricLabel("unknown_key", "某指標", "en")).toBe("某指標");
  });
  it("key \"death\" 當死亡率指標用時回傳 Death rate,不撞死因表的全死因(scatterVars 已濾掉該條目)", () => {
    expect(metricLabel("death", "死亡率", "en")).toBe("Death rate");
  });
  it("metricUnit en 模式回傳英文單位", () => {
    expect(metricUnit("income", "千元/戶", "en")).toBe("NT$1,000/household");
  });
  it("regionLabel en 模式回傳英文區域名", () => {
    expect(regionLabel("北", "en")).toBe("North");
    expect(regionLabel("東·離島", "en")).toBe("East · Outlying Islands");
  });
  it("regionLabel zh 模式原樣回傳", () => {
    expect(regionLabel("北", "zh")).toBe("北");
  });
});
