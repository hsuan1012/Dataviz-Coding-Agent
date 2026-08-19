// inset 框碰撞檢查：主圖（含澎湖等近海離島）投影後的每個 feature bbox
// 不得與任何 inset 框重疊。7/13 澎湖壓框 bug 的常駐回歸檢查——數據把關，不靠肉眼。
import { readFileSync } from "node:fs";
import * as d3 from "d3";
import { INSET_BOXES } from "../src/lib/insetBoxes.js";

const geo = JSON.parse(readFileSync(new URL("../public/taiwan_townships.geojson", import.meta.url), "utf8"));
const INSET = ["金門縣", "連江縣"];
const inBox = (f) => { const [[w, s], [, n]] = d3.geoBounds(f); return w > 119 && s > 21.7 && n < 25.6; };
const main = geo.features.filter((f) => !INSET.includes(f.properties.COUNTYNAME));
const proj = d3.geoMercator().fitSize([800, 900], { type: "FeatureCollection", features: main.filter(inBox) });
const path = d3.geoPath(proj);

// MultiPolygon 拆成單一 polygon 再算 bounds，避免旗津區（含遠處南海島礁）
// 的整體 bbox 假陽性——只有實際可見的多邊形才算撞。
const polygonsOf = (f) =>
  f.geometry.type === "MultiPolygon"
    ? f.geometry.coordinates.map((c) => ({ type: "Feature", properties: f.properties, geometry: { type: "Polygon", coordinates: c } }))
    : [f];

let bad = 0;
for (const f of main) {
  for (const p of polygonsOf(f)) {
    const b = path.bounds(p);
    if (!isFinite(b[0][0])) continue;
    for (const B of INSET_BOXES) {
      if (b[0][0] < B.x + B.w && b[1][0] > B.x && b[0][1] < B.y + B.h && b[1][1] > B.y) {
        console.error(`FAIL: ${f.properties.FULLNAME} (x ${b[0][0].toFixed(0)}-${b[1][0].toFixed(0)}, y ${b[0][1].toFixed(0)}-${b[1][1].toFixed(0)}) 撞到框 (${B.x},${B.y},${B.w},${B.h})`);
        bad++;
      }
    }
  }
}
if (bad) { console.error(`== ${bad} 個 feature 與 inset 框相撞 ==`); process.exit(1); }
console.log(`PASS: 主圖 ${main.length} 個 feature 皆不與 ${INSET_BOXES.length} 個 inset 框重疊`);
