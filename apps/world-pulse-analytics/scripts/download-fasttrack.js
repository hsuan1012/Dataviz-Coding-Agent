import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "..", "data-src");
// 實際檔案在 countries_etc_datapoints/ 子目錄下(用 GitHub contents API 查到,repo 根目錄下已無 datapoints CSV)。
const BASE = "https://raw.githubusercontent.com/open-numbers/ddf--gapminder--fasttrack/master/countries_etc_datapoints/";
const FILES = [
  "ddf--datapoints--child_mortality_0_5_year_olds_dying_per_1000_born--by--country--time.csv",
  "ddf--datapoints--children_per_woman_total_fertility--by--country--time.csv",
];

mkdirSync(OUT_DIR, { recursive: true });
for (const file of FILES) {
  const res = await fetch(BASE + file);
  if (!res.ok) {
    console.error(`[download-fasttrack] 下載失敗 ${res.status}:${file}`);
    console.error("檔名可能已變更,用 GitHub API 查實際檔名:");
    console.error("  https://api.github.com/repos/open-numbers/ddf--gapminder--fasttrack/contents/");
    process.exit(1);
  }
  const text = await res.text();
  // 基本健檢:datapoints CSV 首行必含 country,time 兩欄
  if (!text.slice(0, 200).includes("country,time")) {
    console.error(`[download-fasttrack] ${file} 首行不含 country,time,格式可能已變`);
    process.exit(1);
  }
  writeFileSync(resolve(OUT_DIR, file), text);
  console.log(`${file}: ${text.split("\n").length} 行`);
}
