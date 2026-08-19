// Natural Earth 的 ISO_A3 對少數國家(挪威、法國、北賽普勒斯等)是佔位值 "-99"，
// 要退回 ADM0_A3／ISO_A3_EH 找有效代碼；三者都拿不到才視為無法對應。
export function resolveIso3(properties) {
  const candidates = [properties.ISO_A3, properties.ADM0_A3, properties.ISO_A3_EH];
  const valid = candidates.find((v) => v && v !== "-99");
  return valid ? valid.toLowerCase() : null;
}

// 把 Natural Earth 國界 GeoJSON 濾成「只保留能對應到我們 195 國清單的 features」，
// 且只留 geo 這個 join 鍵 + geometry，其餘 Natural Earth 的欄位(名稱/人口估計等)整批丟棄
// (顯示名稱一律用 countries.json + Intl.DisplayNames，不用 Natural Earth 自帶的多語名稱)。
export function buildBoundaryFeatures(features, knownGeoSet) {
  const result = [];
  for (const feature of features) {
    const geo = resolveIso3(feature.properties ?? {});
    if (geo && knownGeoSet.has(geo)) {
      result.push({ type: "Feature", properties: { geo }, geometry: feature.geometry });
    }
  }
  return result;
}

// 老師 8/3 回饋:南極洲/格陵蘭這類沒有 Gapminder 統計數字的地區,不用呈現數據,
// 但地球儀上「純粹當背景形狀」顯示就好,別讓世界地圖看起來缺一塊。
// 這裡把 buildBoundaryFeatures 濾掉的那些(對不到 195 國清單的 Natural Earth features)
// 抓出來,只留 name(供 tooltip 用)+ geometry,不帶 geo 鍵——WorldGlobe 靠「有沒有 geo」
// 判斷是資料國家還是裝飾地形,裝飾地形不參與選取/hover/灰化這些互動邏輯。
export function buildDecorativeFeatures(features, knownGeoSet) {
  const result = [];
  for (const feature of features) {
    const geo = resolveIso3(feature.properties ?? {});
    if (!geo || !knownGeoSet.has(geo)) {
      const name = feature.properties?.NAME ?? feature.properties?.NAME_EN ?? "";
      result.push({ type: "Feature", properties: { name }, geometry: feature.geometry });
    }
  }
  return result;
}

export function filterAllThree(rows) {
  return rows.filter((row) => row.all_three === "1");
}

// 老師 8/4 回饋:使用者發現「亞洲」裡混了大洋洲國家(澳洲、紐西蘭等)。查證後這不是
// ETL 算錯——Gapminder 原始資料的 world_4region 欄位本來就只分「四大洲」,是官方自己
// 定義的簡化分類法,大洋洲國家被歸進 asia(gapminder.org 自己的泡泡圖工具也是同一套
// 四分類)。這裡新增真正的第五類 oceania,對這 14 個已知的大洋洲國家(geo 代碼,全部
// 小寫 ISO3)覆寫 world_4region 給的值——固定名單比用經緯度/其他啟發式判斷可靠,
// 這 14 國是完整且封閉的集合(不會有新的大洋洲國家中途冒出來)。
const OCEANIA_GEOS = new Set([
  "aus", "fji", "kir", "mhl", "fsm", "nru", "nzl",
  "plw", "png", "wsm", "slb", "ton", "tuv", "vut",
]);

export function toCountryList(rows) {
  const byGeo = new Map();
  for (const row of rows) {
    if (!byGeo.has(row.geo)) {
      byGeo.set(row.geo, {
        geo: row.geo,
        name: row.name,
        region: OCEANIA_GEOS.has(row.geo) ? "oceania" : row.world_4region,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
      });
    }
  }
  return Array.from(byGeo.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function toYearRecords(rows) {
  return rows.map((row) => ({
    geo: row.geo,
    year: Number(row.year),
    income: row.income === "" ? null : Number(row.income),
    lifeExpectancy: row.life_expectancy === "" ? null : Number(row.life_expectancy),
    population: row.population === "" ? null : Number(row.population),
    incomeIsProjection: row.income_is_projection === "1",
    lifeExpectancyIsProjection: row.life_expectancy_is_projection === "1",
    populationIsProjection: row.population_is_projection === "1",
  }));
}

// fasttrack datapoints:country|time → 數值。空字串=缺值,不進索引;
// 非數字字串(如 "n/a")Number() 轉出來是 NaN,若照樣塞進 map,下游極值檢查
// (Math.max 含 NaN 恆為 NaN,NaN > 550 恆為 false)會靜默放行壞資料,所以這裡
// 直接跳過,行為等同缺值。
export function indexFasttrack(rows, valueColumn) {
  const map = new Map();
  for (const row of rows) {
    const v = row[valueColumn];
    if (v === "" || v === undefined) continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    map.set(`${row.country}|${row.time}`, n);
  }
  return map;
}

// 以 geo+year 併入兩個新指標;fasttrack 無 projection 欄位,一律視為觀測值(見 spec)。
export function mergeFasttrack(records, mortalityByKey, fertilityByKey) {
  return records.map((r) => ({
    ...r,
    childMortality: mortalityByKey.get(`${r.geo}|${r.year}`) ?? null,
    fertility: fertilityByKey.get(`${r.geo}|${r.year}`) ?? null,
  }));
}
