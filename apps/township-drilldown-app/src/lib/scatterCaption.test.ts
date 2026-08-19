import { describe, it, expect } from "vitest";
import { buildScatterCaption } from "./scatterCaption";
import type { ScatterChannels } from "./scatterChannels";

const VARS = [
  { key: "density", label: "人口密度" },
  { key: "income", label: "平均所得" },
  { key: "death", label: "死亡率" },
  { key: "clinic", label: "診所醫事人力" },
  { key: "death_c1", label: "惡性腫瘤" },
  { key: "death_c3", label: "肺炎" },
];

describe("buildScatterCaption(散布圖白話解說)", () => {
  it("開頭先講「每顆泡泡=一個鄉鎮」(看不懂的人缺的正是這個心智模型)", () => {
    const ch: ScatterChannels = { x: "density", y: "death", size: "income", color: "region" };
    expect(buildScatterCaption(ch, VARS, "zh")).toContain("每顆泡泡代表一個鄉鎮");
  });

  it("X/Y/大小三通道各自帶方向敘述", () => {
    const ch: ScatterChannels = { x: "density", y: "death", size: "income", color: "region" };
    const c = buildScatterCaption(ch, VARS, "zh");
    expect(c).toContain("越靠右代表「人口密度」越高");
    expect(c).toContain("越靠上代表「死亡率」越高");
    expect(c).toContain("泡泡越大代表「平均所得」越高");
  });

  it("顏色=區域 → 講分區;顏色=指標 → 講色深", () => {
    const base = { x: "density", y: "death", size: "income" } as const;
    expect(buildScatterCaption({ ...base, color: "region" }, VARS, "zh")).toContain("所屬區域");
    expect(buildScatterCaption({ ...base, color: "clinic" }, VARS, "zh"))
      .toContain("顏色越深代表「診所醫事人力」越高");
  });

  it("十大死因變數用死因名稱敘述(死因×死因組合)", () => {
    const ch: ScatterChannels = { x: "death_c1", y: "death_c3", size: "income", color: "region" };
    const c = buildScatterCaption(ch, VARS, "zh");
    expect(c).toContain("「惡性腫瘤」");
    expect(c).toContain("「肺炎」");
  });

  it("en 模式產出英文白話解說", () => {
    const ch: ScatterChannels = { x: "density", y: "death", size: "income", color: "region" };
    const c = buildScatterCaption(ch, VARS, "en");
    expect(c).toContain("Each bubble represents one township");
    expect(c).toContain('higher "Population density"');
    expect(c).toContain('higher "Death rate"');
  });

  it("en 模式顏色=region 時講區域;顏色=指標時講色深", () => {
    const base = { x: "density", y: "death", size: "income" } as const;
    expect(buildScatterCaption({ ...base, color: "region" }, VARS, "en")).toContain("bubble color represents region");
    expect(buildScatterCaption({ ...base, color: "clinic" }, VARS, "en"))
      .toContain('darker bubble color means higher "Clinic medical staff"');
  });
});
