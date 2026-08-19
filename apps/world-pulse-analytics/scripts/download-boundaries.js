import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "..", "data-src");
const URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";
const OUT_FILE = "ne_110m_admin_0_countries.geojson";

mkdirSync(OUT_DIR, { recursive: true });
const res = await fetch(URL);
if (!res.ok) {
  console.error(`[download-boundaries] 下載失敗 ${res.status}`);
  process.exit(1);
}
const json = await res.json();
// 基本健檢：Natural Earth 110m 國界應有 170+ features，數量大幅減少代表來源格式已變。
if (!Array.isArray(json.features) || json.features.length < 150) {
  console.error(`[download-boundaries] features 數量異常：${json.features?.length ?? 0}（預期 170+）`);
  process.exit(1);
}
writeFileSync(resolve(OUT_DIR, OUT_FILE), JSON.stringify(json));
console.log(`${OUT_FILE}: ${json.features.length} features`);
