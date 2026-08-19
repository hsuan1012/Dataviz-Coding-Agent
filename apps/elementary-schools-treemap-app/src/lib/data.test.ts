import { describe, expect, it } from "vitest";
import {
  UNPLACED,
  YEARS,
  YEAR_MAX,
  YEAR_MIN,
  aggregate,
  countyIndex,
  dataset,
  entityTrend,
  fmtInt,
  fmtRatio,
  loadYear,
  nodeAtPath,
  searchEntities,
  validPathPrefix,
  zeroSchools,
} from "./data";

// 基準值：2026-08-14 以 pandas 對原始 CSV 獨立實跑（etl/test_build_hierarchy.py 同源鎖定）
const BASE_114 = { students: 1_165_258, teachers: 99_724, schools: 2_663 };

describe("114 學年 dataset 對帳", () => {
  it("totals 等於 pandas 基準", () => {
    expect(dataset.totals).toEqual(BASE_114);
  });

  it("全國聚合（TS 端獨立實作）等於 totals", () => {
    expect(aggregate(dataset.tree)).toEqual(BASE_114);
  });

  it("22 個縣市", () => {
    expect(dataset.tree.children).toHaveLength(22);
  });

  it("新北市聚合抽查（pandas: 194670/14960/222）", () => {
    expect(aggregate(nodeAtPath(dataset.tree, ["新北市"]))).toEqual({ students: 194_670, teachers: 14_960, schools: 222 });
  });

  it("板橋區聚合抽查（pandas: 27836/17 校）", () => {
    const a = aggregate(nodeAtPath(dataset.tree, ["新北市", "板橋區"]));
    expect(a.students).toBe(27_836);
    expect(a.schools).toBe(17);
  });

  it("不存在的路徑丟錯誤", () => {
    expect(() => nodeAtPath(dataset.tree, ["不存在縣"])).toThrow();
  });
});

describe("多年（103–114，比照世界平台時間軸）", () => {
  it("年份範圍 103–114 共 12 年", () => {
    expect(YEAR_MIN).toBe(103);
    expect(YEAR_MAX).toBe(114);
    expect(YEARS).toHaveLength(12);
  });

  it("loadYear(103)：桃園仍為縣、22 縣市、totals 與 ETL 印出值一致", async () => {
    const ds103 = await loadYear(103);
    const names = ds103.tree.children.map((c) => c.name);
    expect(names).toContain("桃園縣");
    expect(names).not.toContain("桃園市");
    expect(ds103.tree.children).toHaveLength(22);
    expect(ds103.totals).toEqual({ students: 1_252_762, teachers: 98_580, schools: 2_670 });
  });

  it("loadYear(114) 回傳靜態初始資料（快取同一參照）", async () => {
    expect(await loadYear(114)).toBe(dataset);
  });

  it("縣市色序：桃園縣/桃園市同色（同縣市代碼 03）、union 23 名稱 22 色序", () => {
    expect(countyIndex.get("桃園縣")).toBe(countyIndex.get("桃園市"));
    expect(countyIndex.size).toBe(23);
    expect(new Set(countyIndex.values()).size).toBe(22);
    expect(countyIndex.get("新北市")).toBe(0);
  });

  it("103 年含「（鄉鎮未載明）」偽鄉鎮（31 校，scan 鎖定）", async () => {
    const ds103 = await loadYear(103);
    let count = 0;
    for (const county of ds103.tree.children) {
      if (!("children" in county)) continue;
      for (const tw of county.children) {
        if (!("children" in tw)) continue;
        if (tw.name === UNPLACED) count += tw.children.length;
      }
    }
    expect(count).toBe(31);
    expect(ds103.unplacedSchools).toBe(31);
  });

  it("validPathPrefix：切年時無效路徑退到有效前綴", async () => {
    const ds103 = await loadYear(103);
    expect(validPathPrefix(ds103.tree, ["桃園市", "中壢區"])).toEqual([]);
    expect(validPathPrefix(ds103.tree, ["新北市", "板橋區"])).toEqual(["新北市", "板橋區"]);
    expect(validPathPrefix(ds103.tree, ["新北市", "不存在區"])).toEqual(["新北市"]);
  });
});

describe("zeroSchools（零值排除的誠實註記）", () => {
  it("114：學生量值 12 校、教師量值 12 校（pandas 對帳）", () => {
    expect(zeroSchools(dataset.tree, "students")).toHaveLength(12);
    expect(zeroSchools(dataset.tree, "teachers")).toHaveLength(12);
  });

  it("名單帶縣市/鄉鎮脈絡", () => {
    const z = zeroSchools(dataset.tree, "students");
    expect(z[0]).toMatchObject({ county: "苗栗縣", township: "西湖鄉", name: "縣立僑文國小" });
  });

  it("磊川華德福：有學生但零專任教師，只出現在教師量值名單", () => {
    const byTeachers = zeroSchools(dataset.tree, "teachers");
    const byStudents = zeroSchools(dataset.tree, "students");
    expect(byTeachers.some((s) => s.name.includes("磊川華德福"))).toBe(true);
    expect(byStudents.some((s) => s.name.includes("磊川華德福"))).toBe(false);
  });

  it("下鑽子樹動態計算（臺南市學生量值 5 校）", () => {
    const z = zeroSchools(nodeAtPath(dataset.tree, ["臺南市"]), "students", "臺南市", "");
    expect(z).toHaveLength(5);
  });
});

describe("searchEntities（側欄搜尋：臺/台異體字；年份改用獨立輸入框不在此）", () => {
  it("輸入年份數字不回實體結果（年份跳轉由側欄「年份」欄位負責）", () => {
    expect(searchEntities(dataset.tree, "108").length).toBe(0);
  });

  it("搜學校：秀朗 → 新北市永和區市立秀朗國小（含導覽路徑與高亮 key）", () => {
    const r = searchEntities(dataset.tree, "秀朗").find((x) => x.type === "school");
    expect(r).toMatchObject({
      county: "新北市", township: "永和區", name: "市立秀朗國小",
      path: ["新北市", "永和區"],
    });
    expect(r?.highlightKey?.startsWith("s:")).toBe(true);
  });

  it("臺/台異體字：搜「台南」找得到臺南市", () => {
    expect(searchEntities(dataset.tree, "台南").some((r) => r.type === "county" && r.name === "臺南市")).toBe(true);
  });

  it("搜鄉鎮：永和 → 新北市永和區", () => {
    const r = searchEntities(dataset.tree, "永和區").find((x) => x.type === "township");
    expect(r).toMatchObject({ path: ["新北市", "永和區"] });
  });

  it("結果數量有上限", () => {
    expect(searchEntities(dataset.tree, "國小").length).toBeLessThanOrEqual(20);
  });
});

describe("entityTrend（側欄 sparkline）", () => {
  it("縣市趨勢跨年連續：桃園市查詢在 103 年取到桃園縣的值（同代碼）", async () => {
    const trend = await entityTrend({ type: "county", county: "桃園市", name: "桃園市" }, "students");
    expect(trend).toHaveLength(12);
    expect(trend[0].year).toBe(103);
    expect(trend[0].value).toBeGreaterThan(0); // 103 年=桃園縣，仍應取到值
    const ds103 = await loadYear(103);
    const ty103 = ds103.tree.children.find((c) => c.name === "桃園縣")!;
    expect(trend[0].value).toBe(aggregate(ty103).students);
  });

  it("學校趨勢：秀朗國小（id 取自搜尋結果）114 年值=3024", async () => {
    const r = searchEntities(dataset.tree, "秀朗").find((x) => x.type === "school")!;
    const trend = await entityTrend(
      { type: "school", county: r.county!, township: r.township, id: r.id, name: r.name },
      "students",
    );
    expect(trend.find((p) => p.year === 114)?.value).toBe(3024);
    expect(trend).toHaveLength(12);
  });

  it("查無 id 的學校回 null 而非 0", async () => {
    const trend = await entityTrend(
      { type: "school", county: "新北市", township: "永和區", id: "no-such-id", name: "不存在" },
      "students",
    );
    expect(trend.every((p) => p.value === null)).toBe(true);
  });
});

describe("縣市地理順序（比照臺灣鄉鎮統計圖集側欄）", () => {
  it("北區基隆最前、離島澎湖最後、共 22 縣市", async () => {
    const { COUNTY_GEO_ORDER, countyGeoRank } = await import("./data");
    expect(COUNTY_GEO_ORDER).toHaveLength(22);
    expect(COUNTY_GEO_ORDER[0]).toBe("基隆市");
    expect(COUNTY_GEO_ORDER[COUNTY_GEO_ORDER.length - 1]).toBe("澎湖縣");
    expect(countyGeoRank("基隆市")).toBeLessThan(countyGeoRank("屏東縣"));
  });

  it("103 年桃園縣視同桃園市的位置", async () => {
    const { countyGeoRank, countyRegionOf } = await import("./data");
    expect(countyGeoRank("桃園縣")).toBe(countyGeoRank("桃園市"));
    expect(countyRegionOf("桃園縣")).toBe("北");
  });

  it("114 年 22 縣市名全部在順序表內", async () => {
    const { countyGeoRank, COUNTY_GEO_ORDER } = await import("./data");
    for (const c of dataset.tree.children) {
      expect(countyGeoRank(c.name)).toBeLessThan(COUNTY_GEO_ORDER.length);
    }
  });
});

describe("格式化", () => {
  it("千分位", () => {
    expect(fmtInt(1165258)).toBe("1,165,258");
  });
  it("生師比，教師 0 顯示 —", () => {
    expect(fmtRatio(100, 8)).toBe("12.5");
    expect(fmtRatio(0, 0)).toBe("—");
  });
});

describe("全國趨勢（老師 8/17 回饋①：趨勢圖跟隨選取單位）", () => {
  it("nation 趨勢 12 年，114=totals、103=ETL 鎖定值", async () => {
    const { entityTrend: trend } = await import("./data");
    const pts = await trend({ type: "nation", county: "", name: "全國", en: "Nationwide" }, "students");
    expect(pts).toHaveLength(12);
    expect(pts.find((p) => p.year === 114)?.value).toBe(1_165_258);
    expect(pts.find((p) => p.year === 103)?.value).toBe(1_252_762);
  });
});

describe("生師比色階（老師 8/17 回饋③：顏色深淺對應生師比）", () => {
  it("ratioOf：一般值與教師 0 回 null", async () => {
    const { ratioOf } = await import("./data");
    expect(ratioOf({ students: 100, teachers: 8 })).toBeCloseTo(12.5);
    expect(ratioOf({ students: 5, teachers: 0 })).toBeNull();
  });

  it("ratioDomain：p10<p90、範圍合理（小校離群值被夾掉）", async () => {
    const { ratioDomain } = await import("./data");
    const [lo, hi] = ratioDomain(dataset.tree);
    expect(lo).toBeGreaterThan(0);
    expect(hi).toBeGreaterThan(lo);
    expect(lo).toBeGreaterThan(2); // 全體學校 p10 不會低於 2（極端小校已被夾掉）
    expect(hi).toBeLessThan(30); // p90 不會高於 30
  });

  it("全國聚合生師比落在 domain 內（跨層級同一把尺可比）", async () => {
    const { ratioDomain, ratioOf, aggregate: agg } = await import("./data");
    const [lo, hi] = ratioDomain(dataset.tree);
    const nation = ratioOf(agg(dataset.tree))!;
    expect(nation).toBeGreaterThan(lo);
    expect(nation).toBeLessThan(hi);
  });
});
