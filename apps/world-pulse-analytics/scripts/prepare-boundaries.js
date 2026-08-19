import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { buildBoundaryFeatures, buildDecorativeFeatures } from "./transform.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_SRC = resolve(__dirname, "..", "data-src");
const OUT_DIR = resolve(__dirname, "..", "src", "data");

const raw = JSON.parse(
  readFileSync(resolve(DATA_SRC, "ne_110m_admin_0_countries.geojson"), "utf-8")
);
const countries = JSON.parse(readFileSync(resolve(OUT_DIR, "countries.json"), "utf-8"));
const knownGeoSet = new Set(countries.map((c) => c.geo));

const features = buildBoundaryFeatures(raw.features, knownGeoSet);
// 老師 8/3 回饋:南極洲/格陵蘭等沒有 Gapminder 統計數字的地區,不用呈現數據,
// 但地球儀當背景地圖形狀顯示就好——另外存一份「裝飾用」features(不含 geo 鍵,
// WorldGlobe 靠這個判斷不參與選取/hover/灰化互動)。
const decorativeFeatures = buildDecorativeFeatures(raw.features, knownGeoSet);

// Natural Earth 110m 是簡化解析度，Andorra、新加坡等小型/島國常沒有對應 feature——
// 誠實回報涵蓋率而非假設 100%（見 chart-selection.md choropleth 實作要點 #2）。
const coverage = features.length / countries.length;
console.log(
  `國界 join 涵蓋率：${features.length}/${countries.length}（${(coverage * 100).toFixed(1)}%）`
);
if (features.length < 150) {
  console.error(`[prepare-boundaries] 涵蓋率異常過低（${features.length} 筆，預期 ≥150），來源格式可能已變`);
  process.exit(1);
}
const missing = countries.filter((c) => !features.some((f) => f.properties.geo === c.geo));
if (missing.length > 0) {
  console.log(`無邊界資料的國家（${missing.length}）：${missing.map((c) => c.name).join(", ")}`);
}

writeFileSync(
  resolve(OUT_DIR, "worldBoundaries.json"),
  JSON.stringify({ type: "FeatureCollection", features, decorativeFeatures })
);
console.log(`worldBoundaries.json 已寫入，${features.length} features + ${decorativeFeatures.length} 裝飾 features`);
console.log(`裝飾地形：${decorativeFeatures.map((f) => f.properties.name).join(", ")}`);
