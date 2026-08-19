import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  valueOf, valueAt, villageValue, regionOf, topBottomN, scatterPoints, scatterDomains, joinCoverage, REGIONS,
  entityInfo, resolveMetric,
  type Meta, type Values, type VillageProps,
} from "./data";
import { NATION, drillToCounty, drillToTown } from "./nav";

const meta = JSON.parse(readFileSync("public/data/meta.json", "utf-8")) as Meta;
const values = JSON.parse(readFileSync("public/data/values.json", "utf-8")) as Values;
const geo = JSON.parse(readFileSync("public/taiwan_townships.geojson", "utf-8"));
const fullnames = geo.features.map((f: any) => f.properties.FULLNAME as string);

describe("死因別（死亡率的十大死因選單）", () => {
  it("meta.deathCauses = 全死因＋十大死因（11 項），首項為全死因", () => {
    expect(meta.deathCauses).toBeDefined();
    expect(meta.deathCauses!).toHaveLength(11);
    expect(meta.deathCauses![0].key).toBe("death");
    expect(meta.deathCauses![0].label).toBe("全死因");
    expect(meta.deathCauses!.map((d) => d.label)).toContain("惡性腫瘤");
    expect(meta.deathCauses!.map((d) => d.label)).toContain("心臟疾病");
  });
  it("每個死因 key 在 values 有 368 鄉鎮資料（102–108 各年）", () => {
    for (const dc of meta.deathCauses!) {
      for (const y of meta.years) {
        expect(Object.keys(values[dc.key].town[String(y)])).toHaveLength(368);
      }
    }
  });
  it("resolveMetric：死亡率＋死因別→切到該死因 key/色階；其餘指標回自身", () => {
    expect(resolveMetric(meta, "death").key).toBe("death");                 // 未選＝全死因
    expect(resolveMetric(meta, "death", "death").key).toBe("death");
    const cancer = resolveMetric(meta, "death", "death_c06");
    expect(cancer.key).toBe("death_c06");
    expect(cancer.label).toBe("惡性腫瘤");
    expect(cancer.unit).toBe("每10萬人");
    expect(cancer.breaks).toEqual(meta.deathCauses!.find((d) => d.key === "death_c06")!.breaks);
    expect(resolveMetric(meta, "density", "death_c06").key).toBe("density"); // 非死亡率不受死因別影響
  });
  it("癌症死亡率 ≤ 全死因、且為正（惡性腫瘤是死因之首但仍是全死因子集）", () => {
    const town = "臺北市大安區", y = 107;
    const all = valueOf(values, "death", y, town)!;
    const cancer = valueOf(values, "death_c06", y, town)!;
    expect(cancer).toBeGreaterThan(0);
    expect(cancer).toBeLessThan(all);
  });
});

describe("data helpers", () => {
  it("valueOf reads a known value", () => {
    expect(valueOf(values, "density", 102, "南投縣中寮鄉")).toBe(107);
  });
  it("regionOf reads region", () => {
    expect(regionOf(meta, "南投縣中寮鄉")).toBe("中");
  });
  it("REGIONS has the five regions in order", () => {
    expect(REGIONS).toEqual(["北", "中", "南", "東", "離島"]);
  });
  it("topBottomN is sorted and sized", () => {
    const { top, bottom } = topBottomN(values, meta, "density", 102, 15);
    expect(top).toHaveLength(15);
    expect(bottom).toHaveLength(15);
    for (let i = 1; i < top.length; i++) expect(top[i - 1].value).toBeGreaterThanOrEqual(top[i].value);
    for (let i = 1; i < bottom.length; i++) expect(bottom[i - 1].value).toBeLessThanOrEqual(bottom[i].value);
    expect(top[0].value).toBeGreaterThan(bottom[0].value);
  });
  it("scatterPoints returns all townships for 108 with every indicator as a numeric field", () => {
    const pts = scatterPoints(values, meta, 108);
    expect(pts).toHaveLength(368);
    const p = pts.find((x) => x.township === "南投縣中寮鄉")!;
    expect(p.death).toBeCloseTo(1303.8978958, 3);
    expect(p.income).toBeCloseTo(472.0955799, 3);
    expect(REGIONS).toContain(p.region);
    // 每個 meta 指標（含 7/16 新增的 clinic/hospital）都要能在點上索引到有限數值，
    // 否則關係頁把該指標當 X/Y 軸時 d3 scale 會拿到 undefined 而整頁 crash。
    for (const ind of meta.indicators) {
      expect(typeof (p as Record<string, unknown>)[ind.key]).toBe("number");
      expect(Number.isFinite((p as Record<string, number>)[ind.key])).toBe(true);
    }
  });
  it("joinCoverage is perfect against geojson FULLNAME", () => {
    const c = joinCoverage(values, "density", 102, fullnames);
    expect(c.matched).toBe(368);
    expect(c.missingInGeo).toEqual([]);
    expect(c.missingInValues).toEqual([]);
  });
});

describe("three-level values", () => {
  it("county level has all 22 counties for every indicator/year", () => {
    for (const ind of ["density", "income", "death"] as const) {
      for (const y of meta.years) {
        expect(Object.keys(values[ind].county[String(y)])).toHaveLength(22);
      }
    }
  });
  it("縣級密度是加權聚合（Σ人口/Σ面積），不等於鄉鎮值的未加權平均", () => {
    const towns = Object.entries(values.density.town["108"]).filter(([k]) => k.startsWith("臺北市"));
    const unweighted = towns.reduce((s, [, v]) => s + v, 0) / towns.length;
    const county = valueAt(values, "density", "county", 108, "臺北市")!;
    expect(county).toBeGreaterThan(0);
    expect(Math.abs(county - unweighted) / county).toBeGreaterThan(0.01); // 兩者必須明顯不同
  });
  it("death has no village level in meta", () => {
    const death = meta.indicators.find((i) => i.key === "death")!;
    expect(death.levels).toEqual(["county", "town"]);
    const density = meta.indicators.find((i) => i.key === "density")!;
    expect(density.levels).toContain("village");
    expect(density.breaksByLevel.village).toHaveLength(4);
  });
  it("village file has embedded pop/density/income and villageValue reads them", () => {
    // 北投區 TOWNCODE=63000120（臺北市）
    const g = JSON.parse(readFileSync("public/data/villages/63000120.json", "utf-8"));
    const hutian = g.features.find((f: any) => f.properties.VILLNAME === "湖田里");
    expect(hutian).toBeDefined();
    const p = hutian.properties as VillageProps;
    expect(p.pop).toBeGreaterThan(0);
    expect(p.density).toBeCloseTo(p.pop! / p.AREA_KM2, 0);
    expect(villageValue(p, "density", 108)).toBe(p.density);
    expect(villageValue(p, "death", 108)).toBeUndefined();
  });
});

describe("entityInfo（當前選取單位的三指標資訊）", () => {
  const county = drillToCounty("臺北市");
  const town = drillToTown(county, "臺北市北投區", "63000120");
  const beitou = JSON.parse(readFileSync("public/data/villages/63000120.json", "utf-8"));
  const datun = beitou.features.find((f: any) => f.properties.VILLNAME === "大屯里").properties as VillageProps;

  it("全國層無選取 → null", () => {
    expect(entityInfo(meta, values, NATION, null, 108)).toBeNull();
  });
  it("縣層 → 臺北市三指標齊，含 102–108 序列與當年值", () => {
    const info = entityInfo(meta, values, county, null, 108)!;
    expect(info.title).toBe("臺北市");
    expect(info.items).toHaveLength(meta.indicators.length);
    const density = info.items.find((i) => i.key === "density")!;
    expect(density.value).toBeCloseTo(9731.6, 1);          // ETL 加權驗算值
    expect(density.series).toHaveLength(7);                 // 102..108
    expect(info.items.every((i) => i.value !== undefined)).toBe(true);
  });
  it("鄉鎮層（未選村里）→ 北投區三指標", () => {
    const info = entityInfo(meta, values, town, null, 108)!;
    expect(info.title).toBe("北投區");
    expect(info.items.find((i) => i.key === "death")!.value).toBeGreaterThan(0);
  });
  it("選取大屯里 → 密度快照＋所得序列＋死亡率誠實無資料", () => {
    const info = entityInfo(meta, values, town, datun, 108)!;
    expect(info.title).toBe("大屯里");
    const density = info.items.find((i) => i.key === "density")!;
    expect(density.value).toBe(datun.density);
    expect(density.note).toContain("普查快照");
    const income = info.items.find((i) => i.key === "income")!;
    expect(income.value).toBe(datun.income["108"]);
    expect(income.series!.length).toBeGreaterThan(3);
    const death = info.items.find((i) => i.key === "death")!;
    expect(death.value).toBeUndefined();
    expect(death.note).toContain("鄉鎮");
  });
});

describe("scatterDomains（泡泡圖跨年份固定級距）", () => {
  const d = scatterDomains(values, meta);
  const allKeys = meta.indicators.map((i) => i.key);
  it("每個指標皆回 [min, max]、min < max（含 clinic/hospital）", () => {
    expect(allKeys).toContain("clinic");
    expect(allKeys).toContain("hospital");
    for (const k of allKeys) {
      expect(d[k]).toHaveLength(2);
      expect(d[k][0]).toBeLessThan(d[k][1]);
    }
  });
  it("固定範圍必須涵蓋每一年的資料 extent（切年份不會超出座標系）", () => {
    for (const y of meta.years) {
      const pts = scatterPoints(values, meta, y);
      for (const k of allKeys) {
        const lo = Math.min(...pts.map((p) => p[k]));
        const hi = Math.max(...pts.map((p) => p[k]));
        expect(lo).toBeGreaterThanOrEqual(d[k][0]);
        expect(hi).toBeLessThanOrEqual(d[k][1]);
      }
    }
  });
  it("與年份無關（同一份 values 每次結果相同）", () => {
    expect(scatterDomains(values, meta)).toEqual(d);
  });
});

import { regionGroupsTop, townScopeTop, nationTop, rankMaxTown, REGION_GROUPS, regionGroupOf } from "./data";

describe("分區排名（四格：北/中/南/東·離島，前五名）", () => {
  it("REGION_GROUPS 為四組、東與離島合併", () => {
    expect(REGION_GROUPS).toEqual(["北", "中", "南", "東·離島"]);
    expect(regionGroupOf("東")).toBe("東·離島");
    expect(regionGroupOf("離島")).toBe("東·離島");
    expect(regionGroupOf("北")).toBe("北");
  });
  it("regionGroupsTop 回四格、各前五名遞減", () => {
    const boxes = regionGroupsTop(values, meta, "density", 108, 5);
    expect(boxes.map((b) => b.group)).toEqual(["北", "中", "南", "東·離島"]);
    for (const b of boxes) {
      expect(b.rows.length).toBeLessThanOrEqual(5);
      for (let i = 1; i < b.rows.length; i++)
        expect(b.rows[i - 1].value).toBeGreaterThanOrEqual(b.rows[i].value);
    }
    // 北部密度第一名應為新北市永和區（108 年最高密度鄉鎮）
    expect(boxes[0].rows[0].township).toBe("新北市永和區");
  });
  it("rankMaxTown 為跨全年份鄉鎮最大值（四區共用一把尺）", () => {
    const mx = rankMaxTown(values, meta, "density");
    for (const y of meta.years)
      for (const v of Object.values(values.density.town[String(y)]))
        expect(v).toBeLessThanOrEqual(mx);
    expect(mx).toBeGreaterThan(38000); // 永和區密度量級
  });
  it("townScopeTop 回某縣內鄉鎮前五（下鑽用）", () => {
    const rows = townScopeTop(values, meta, "density", 108, "臺北市", 5);
    expect(rows.length).toBe(5);
    expect(rows.every((r) => r.township.startsWith("臺北市"))).toBe(true);
    for (let i = 1; i < rows.length; i++)
      expect(rows[i - 1].value).toBeGreaterThanOrEqual(rows[i].value);
  });
  it("nationTop 回全國前五名（不分區，散布圖四通道排名格用）", () => {
    const rows = nationTop(values, meta, "density", 108, 5);
    expect(rows.length).toBe(5);
    for (let i = 1; i < rows.length; i++)
      expect(rows[i - 1].value).toBeGreaterThanOrEqual(rows[i].value);
    // 全國密度第一名＝新北市永和區（108 年）；不超過 rankMaxTown 的全域(跨年份)最大值
    expect(rows[0].township).toBe("新北市永和區");
    expect(rows[0].value).toBeLessThanOrEqual(rankMaxTown(values, meta, "density"));
  });
});

// —— 框選連動前置:散布圖鄉鎮名 ⊆ 地圖 FULLNAME(名對不上=迷你地圖亮不了) ——
it("scatterPoints 鄉鎮名全部對得上 geo FULLNAME", () => {
  const latest = Math.max(...meta.years);
  const missing = scatterPoints(values, meta, latest)
    .map((p) => p.township).filter((n) => !fullnames.includes(n));
  expect(missing).toEqual([]);
});
