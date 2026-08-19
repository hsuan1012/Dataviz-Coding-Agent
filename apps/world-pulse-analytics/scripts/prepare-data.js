import { csvParse } from "d3";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { filterAllThree, toCountryList, toYearRecords, indexFasttrack, mergeFasttrack } from "./transform.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = resolve(__dirname, "..", "..", "supervisor", "data", "global", "gapminder_core3.csv");
const OUT_DIR = resolve(__dirname, "..", "src", "data");

// The source CSV is saved with a UTF-8 BOM, which csvParse would otherwise
// bake into the first header's key (e.g. "﻿geo" instead of "geo"),
// silently breaking every row's `geo` field. Strip it before parsing.
const csvText = readFileSync(CSV_PATH, "utf-8").replace(/^\uFEFF/, "");
const rows = csvParse(csvText);
const filtered = filterAllThree(rows);

const ENTITIES_CSV_PATH = resolve(
  __dirname,
  "..",
  "..",
  "supervisor",
  "data",
  "global",
  "ddf--entities--geo--country.csv"
);
const entitiesText = readFileSync(ENTITIES_CSV_PATH, "utf-8").replace(/^﻿/, "");
const entityRows = csvParse(entitiesText);
const iso2ByGeo = new Map(entityRows.map((row) => [row.country, row.iso3166_1_alpha2 ?? ""]));

const countries = toCountryList(filtered).map((c) => ({
  ...c,
  iso2: iso2ByGeo.get(c.geo) ?? "",
}));
const records = toYearRecords(filtered);

const DATA_SRC = resolve(__dirname, "..", "data-src");
const mortalityText = readFileSync(
  resolve(DATA_SRC, "ddf--datapoints--child_mortality_0_5_year_olds_dying_per_1000_born--by--country--time.csv"),
  "utf-8"
).replace(/^﻿/, "");
const fertilityText = readFileSync(
  resolve(DATA_SRC, "ddf--datapoints--children_per_woman_total_fertility--by--country--time.csv"),
  "utf-8"
).replace(/^﻿/, "");
const mortalityByKey = indexFasttrack(csvParse(mortalityText), "child_mortality_0_5_year_olds_dying_per_1000_born");
const fertilityByKey = indexFasttrack(csvParse(fertilityText), "children_per_woman_total_fertility");
const merged = mergeFasttrack(records, mortalityByKey, fertilityByKey);

// 防呆(spec §1):join 覆蓋率——2000 年至少 150 國兩指標皆有值,
// 否則多半是 fasttrack 檔名/geo 代碼對不上,靜默寫出全 null 會讓新通道整個空白。
const y2000 = merged.filter((r) => r.year === 2000);
const mortCover = y2000.filter((r) => r.childMortality !== null).length;
const fertCover = y2000.filter((r) => r.fertility !== null).length;
if (mortCover < 150 || fertCover < 150) {
  console.error(`[prepare-data] fasttrack join 覆蓋率異常:2000 年兒童死亡率 ${mortCover} 國、生育率 ${fertCover} 國(預期 ≥150)`);
  process.exit(1);
}
// 極值檢查:超出 channels.ts 的固定 domain 表示資料形態改變,要人工確認
const mortMax = Math.max(...merged.map((r) => r.childMortality ?? -Infinity));
const fertMax = Math.max(...merged.map((r) => r.fertility ?? -Infinity));
console.log(`childMortality max=${mortMax}, fertility max=${fertMax}`);
// mortMax/fertMax 若為 NaN(來源出現非數字字串,理論上 indexFasttrack 已濾掉,
// 這裡是雙保險),NaN > 550 恆為 false,極值檢查會靜默放行——先擋非有限數。
if (!Number.isFinite(mortMax) || !Number.isFinite(fertMax)) {
  console.error(
    `[prepare-data] 極值計算出現非有限數(mortMax=${mortMax}, fertMax=${fertMax}),` +
      `可能是 fasttrack 來源混入非數字字串或該指標完全無資料,請人工檢查來源檔`
  );
  process.exit(1);
}
if (mortMax > 550 || fertMax > 9) {
  console.error(`[prepare-data] 新指標極值超出 domain(兒童死亡率≤550、生育率≤9),請同步調整 channels.ts`);
  process.exit(1);
}

// 資料校驗：若來源 CSV 未來更新導致 region 出現非預期值，或列數異常減少，
// 在寫檔前就攔下來，避免靜默寫出壞資料讓下游元件（如 CountryChecklist）崩潰。
const KNOWN_REGIONS = new Set(["asia", "europe", "africa", "americas", "oceania"]);
const badRegionCountries = countries.filter((c) => !KNOWN_REGIONS.has(c.region));
if (badRegionCountries.length > 0) {
  console.error(
    `[prepare-data] 發現未知的 region 值，共 ${badRegionCountries.length} 筆：` +
      badRegionCountries.map((c) => `${c.name}(${c.region})`).join(", ")
  );
  process.exit(1);
}
if (countries.length === 0 || countries.length < 150) {
  console.error(`[prepare-data] 國家數量異常：${countries.length} 筆（預期約 195 筆）`);
  process.exit(1);
}
const missingIso2Count = countries.filter((c) => !c.iso2).length;
if (missingIso2Count > 10) {
  // 目前 195 國全部都有對到 iso2；一旦 entities CSV 欄位改名或格式跑掉，
  // iso2ByGeo 會靜默全部查不到（.get() ?? "" 不會拋錯），導致中文名/國旗全退回英文，
  // 建置卻是綠燈——在這裡攔下來，而不是等使用者發現介面突然變成全英文。
  console.error(
    `[prepare-data] iso2 缺漏過多：${missingIso2Count} 筆（容忍值 10，可能是 ddf--entities--geo--country.csv 欄位改名或格式跑掉）`
  );
  process.exit(1);
}
if (records.length === 0 || records.length < 15000) {
  console.error(`[prepare-data] 資料筆數異常：${records.length} 筆（預期 19,000+ 筆）`);
  process.exit(1);
}

writeFileSync(resolve(OUT_DIR, "countries.json"), JSON.stringify(countries, null, 2));
writeFileSync(resolve(OUT_DIR, "gapminder.json"), JSON.stringify(merged));

console.log(`countries: ${countries.length}, records: ${records.length}`);
