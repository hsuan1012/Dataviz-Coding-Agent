import { readFileSync } from "node:fs";
const values = JSON.parse(readFileSync("public/data/values.json", "utf-8"));
const geo = JSON.parse(readFileSync("public/taiwan_townships.geojson", "utf-8"));
const full = new Set(geo.features.map((f) => f.properties.FULLNAME));
const vkeys = Object.keys(values.density["102"]);
const missing = vkeys.filter((k) => !full.has(k));
console.log(`townships=${vkeys.length} matchedInGeo=${vkeys.length - missing.length} missing=${missing.length}`);
if (missing.length) { console.log("MISSING:", missing.slice(0, 20)); process.exit(1); }
