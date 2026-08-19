export type IndicatorKey = "density" | "income" | "death" | "clinic" | "hospital";
// 散布圖可用變數 key:5 指標 ∪ 死因(death_c*)。template literal pattern 涵蓋全部死因碼,
// 不逐一列舉(死因清單由 meta.json 資料驅動)。
export type ScatterKey = IndicatorKey | `death_c${string}`;
export interface ScatterVar { key: ScatterKey; label: string; unit: string; group: "ind" | "cause" }
export type Region = "北" | "中" | "南" | "東" | "離島";
export const REGIONS: Region[] = ["北", "中", "南", "東", "離島"];

export type DataLevel = "county" | "town" | "village";
export interface Indicator {
  key: IndicatorKey; label: string; unit: string;
  breaks: number[];                                  // 鄉鎮層（排名/關係分頁沿用）
  levels: DataLevel[];                               // 該指標可用的資料層級
  breaksByLevel: Partial<Record<DataLevel, number[]>>;
  note?: string;                                     // 誠實註記（如醫院跨區服務歸戶說明）
}
// 「死亡率」指標的死因別選項（全死因＋十大死因）；key＝values 裡的資料 key（death / death_c<碼>）。
export interface DeathCause {
  key: string; label: string;
  breaks: number[];
  breaksByLevel: Partial<Record<DataLevel, number[]>>;
}
export interface Meta { years: number[]; villagePopLabel: string; indicators: Indicator[]; deathCauses?: DeathCause[]; regions: Record<string, Region>; }
// values[key][county|town][year][name]；key＝指標或死因（death_c*）；村里值嵌在村里 geojson 的 properties
export type ValueLevel = "county" | "town";
export type Values = Record<string, Record<ValueLevel, Record<string, Record<string, number>>>>;

// 當前著色/排名實際使用的 metric：死亡率＋選了死因別時，切到該死因的 values key 與色階；其餘指標回傳自身。
export interface ResolvedMetric {
  key: string; label: string; unit: string;
  breaks: number[]; breaksByLevel: Partial<Record<DataLevel, number[]>>;
  levels: DataLevel[]; note?: string;
}
export function resolveMetric(meta: Meta, indicator: IndicatorKey, deathCause?: string): ResolvedMetric {
  const ind = meta.indicators.find((i) => i.key === indicator)!;
  if (indicator === "death" && deathCause && deathCause !== "death") {
    const dc = meta.deathCauses?.find((d) => d.key === deathCause);
    if (dc) return { key: dc.key, label: dc.label, unit: ind.unit, breaks: dc.breaks, breaksByLevel: dc.breaksByLevel, levels: ind.levels };
  }
  return { key: ind.key, label: ind.label, unit: ind.unit, breaks: ind.breaks, breaksByLevel: ind.breaksByLevel, levels: ind.levels, note: ind.note };
}

export function valueAt(values: Values, ind: string, level: ValueLevel, year: number, name: string): number | undefined {
  return values[ind]?.[level]?.[String(year)]?.[name];
}
// 鄉鎮層捷徑（排名/關係分頁與既有測試沿用）
export function valueOf(values: Values, ind: string, year: number, town: string): number | undefined {
  return valueAt(values, ind, "town", year, town);
}
export function regionOf(meta: Meta, town: string): Region | undefined {
  return meta.regions[town];
}

// 村里 feature properties（ETL 嵌入）：pop/density=108年2月快照、income=逐年
export interface VillageProps {
  VILLCODE: string; VILLNAME: string; TOWNCODE: string; TOWNNAME: string; COUNTYNAME: string;
  AREA_KM2: number; pop: number | null; density: number | null; income: Record<string, number>;
}
export function villageValue(p: VillageProps, ind: IndicatorKey, year: number): number | undefined {
  if (ind === "density") return p.density ?? undefined;
  if (ind === "income") return p.income?.[String(year)];
  return undefined; // death 無村里資料
}

// --- 當前選取單位（縣/鄉鎮/村里）的三指標資訊，供 InfoPanel 顯示 ---
import type { View } from "./nav";
export interface IndicatorInfo {
  key: IndicatorKey; label: string; unit: string;
  value?: number;                 // 當前年度值（無資料則 undefined）
  series?: [number, number][];    // [年, 值] 逐年序列（可畫 sparkline；單時點資料無此欄）
  note?: string;                  // 誠實註記（快照時點／無村里資料）
}
export interface EntityInfo { title: string; items: IndicatorInfo[]; }

export function entityInfo(meta: Meta, values: Values, view: View, village: VillageProps | null, year: number): EntityInfo | null {
  // 村里選取優先；否則顯示當前下鑽單位本身；全國層不顯示
  if (view.level === "town" && village) {
    const items: IndicatorInfo[] = meta.indicators.map((ind) => {
      if (ind.key === "density")
        return { key: ind.key, label: ind.label, unit: ind.unit,
          value: village.density ?? undefined, note: `人口普查快照` };
      if (ind.key === "income") {
        const series = Object.entries(village.income ?? {})
          .map(([y, v]) => [Number(y), v] as [number, number]).sort((a, b) => a[0] - b[0]);
        return { key: ind.key, label: ind.label, unit: ind.unit,
          value: village.income?.[String(year)], series: series.length ? series : undefined };
      }
      return { key: ind.key, label: ind.label, unit: ind.unit, note: "無村里資料（最細至鄉鎮）" };
    });
    return { title: village.VILLNAME, items };
  }
  const level: ValueLevel | null = view.level === "county" ? "county" : view.level === "town" ? "town" : null;
  if (!level) return null;
  const name = level === "county" ? view.county! : view.town!;
  const title = level === "town" && view.county ? name.replace(view.county, "") : name;
  const items: IndicatorInfo[] = meta.indicators.map((ind) => {
    const series = meta.years
      .map((y) => [y, valueAt(values, ind.key, level, y, name)] as [number, number | undefined])
      .filter((p): p is [number, number] => p[1] !== undefined);
    return { key: ind.key, label: ind.label, unit: ind.unit,
      value: valueAt(values, ind.key, level, year, name), series: series.length ? series : undefined };
  });
  return { title, items };
}

export interface Row { township: string; value: number; region: Region; }
export function topBottomN(values: Values, meta: Meta, ind: IndicatorKey, year: number, n: number): { top: Row[]; bottom: Row[] } {
  const rows: Row[] = [];
  const byYear = values[ind]?.town?.[String(year)] ?? {};
  for (const town of Object.keys(byYear)) {
    const region = meta.regions[town];
    if (region === undefined) continue;
    rows.push({ township: town, value: byYear[town], region });
  }
  const asc = [...rows].sort((a, b) => a.value - b.value);
  const desc = [...rows].sort((a, b) => b.value - a.value);
  return { top: desc.slice(0, n), bottom: asc.slice(0, n) };
}

// --- 分區排名（合併地圖＋排名同畫面用）：四格 北/中/南/東·離島，前五名 ---
export type RegionGroup = "北" | "中" | "南" | "東·離島";
export const REGION_GROUPS: RegionGroup[] = ["北", "中", "南", "東·離島"];
export function regionGroupOf(region: Region): RegionGroup {
  return region === "東" || region === "離島" ? "東·離島" : region;
}
export interface RankRow { township: string; value: number; region: Region; }
export interface RegionRankBox { group: RegionGroup; rows: RankRow[]; }

// 全國：依四分區各取前 n 名（town 層），rows 依值遞減
export function regionGroupsTop(values: Values, meta: Meta, ind: string, year: number, n = 5): RegionRankBox[] {
  const byYear = values[ind]?.town?.[String(year)] ?? {};
  const groups: Record<RegionGroup, RankRow[]> = { "北": [], "中": [], "南": [], "東·離島": [] };
  for (const town of Object.keys(byYear)) {
    const region = meta.regions[town];
    if (region === undefined) continue;
    groups[regionGroupOf(region)].push({ township: town, value: byYear[town], region });
  }
  return REGION_GROUPS.map((g) => ({ group: g, rows: groups[g].sort((a, b) => b.value - a.value).slice(0, n) }));
}

// 縣內：該縣鄉鎮前 n 名（下鑽時排名跟著地圖層級）
export function townScopeTop(values: Values, meta: Meta, ind: string, year: number, county: string, n = 5): RankRow[] {
  const byYear = values[ind]?.town?.[String(year)] ?? {};
  const rows: RankRow[] = Object.keys(byYear)
    .filter((t) => t.startsWith(county))
    .map((t) => ({ township: t, value: byYear[t], region: meta.regions[t] }));
  return rows.sort((a, b) => b.value - a.value).slice(0, n);
}

// 全國：不分區前 n 名（散布圖 X/Y/顏色/大小四通道排名格用；townScopeTop 拿掉縣市過濾的版本）
export function nationTop(values: Values, meta: Meta, ind: string, year: number, n = 5): RankRow[] {
  const byYear = values[ind]?.town?.[String(year)] ?? {};
  const rows: RankRow[] = Object.keys(byYear)
    .map((t) => ({ township: t, value: byYear[t], region: meta.regions[t] }));
  return rows.sort((a, b) => b.value - a.value).slice(0, n);
}

// 四區共用一把尺 & 跨年份固定：全年份鄉鎮最大值
export function rankMaxTown(values: Values, meta: Meta, ind: string): number {
  let mx = 0;
  for (const y of meta.years)
    for (const v of Object.values(values[ind]?.town?.[String(y)] ?? {}))
      if (v > mx) mx = v;
  return mx;
}

// 散布圖變數清單:指標(group=ind)+十大死因(group=cause)。排除 deathCauses 裡與指標
// 重複的「全死因 death」;死因無 unit 欄位,沿用死亡率指標單位。下拉/軸標題/tooltip 統一查這張表。
export function scatterVars(meta: Meta): ScatterVar[] {
  const deathUnit = meta.indicators.find((i) => i.key === "death")?.unit ?? "";
  return [
    ...meta.indicators.map((i) => ({ key: i.key as ScatterKey, label: i.label, unit: i.unit, group: "ind" as const })),
    ...(meta.deathCauses ?? [])
      .filter((d) => d.key !== "death")
      .map((d) => ({ key: d.key as ScatterKey, label: d.label, unit: deathUnit, group: "cause" as const })),
  ];
}

// 關係散布圖的一個點：地名＋分區＋「每個變數一個數值」。
// 變數欄位由 scatterVars（指標＋死因）動態決定，
// 任一變數當 X/Y/泡泡大小都能索引到值，不寫死清單（避免新增變數時關係頁 crash）。
export type Point = { township: string; region: Region } & Record<ScatterKey, number>;
export function scatterPoints(values: Values, meta: Meta, year: number): Point[] {
  const y = String(year);
  const keys = scatterVars(meta).map((v) => v.key);
  const out: Point[] = [];
  for (const town of Object.keys(values.income?.town?.[y] ?? {})) {
    const region = meta.regions[town];
    if (region === undefined) continue;
    const vals = {} as Record<ScatterKey, number>;
    let complete = true;
    for (const k of keys) {
      const val = values[k]?.town?.[y]?.[town];
      if (val === undefined) { complete = false; break; }  // 任一變數缺值即跳過該鄉鎮，維持點集完整可比
      vals[k] = val;
    }
    if (!complete) continue;
    out.push({ township: town, region, ...vals });
  }
  return out;
}

// 泡泡圖跨年份固定級距：X/Y/半徑的 domain 取「所有年份」的 extent，
// 切年份時座標系與泡泡大小尺度不變，可直接比較各年。
// 每個變數一組 [min, max]，涵蓋 scatterVars 全部變數（指標＋死因，動態非寫死）。
export type ScatterDomains = Record<ScatterKey, [number, number]>;
export function scatterDomains(values: Values, meta: Meta): ScatterDomains {
  const keys = scatterVars(meta).map((v) => v.key);
  const acc = {} as Record<ScatterKey, [number, number]>;
  for (const k of keys) acc[k] = [Infinity, -Infinity];
  for (const y of meta.years)
    for (const p of scatterPoints(values, meta, y))
      for (const k of keys) {
        if (p[k] < acc[k][0]) acc[k][0] = p[k];
        if (p[k] > acc[k][1]) acc[k][1] = p[k];
      }
  return acc;
}

export function joinCoverage(values: Values, ind: IndicatorKey, year: number, fullnames: string[]): { matched: number; missingInGeo: string[]; missingInValues: string[] } {
  const vset = new Set(Object.keys(values[ind]?.town?.[String(year)] ?? {}));
  const gset = new Set(fullnames);
  const missingInGeo = [...vset].filter((k) => !gset.has(k)).sort();
  const missingInValues = [...gset].filter((k) => !vset.has(k)).sort();
  const matched = [...vset].filter((k) => gset.has(k)).length;
  return { matched, missingInGeo, missingInValues };
}

export interface AllData {
  meta: Meta; values: Values;
  geo: GeoJSON.FeatureCollection;      // 鄉鎮界
  counties: GeoJSON.FeatureCollection; // 縣市界（dissolve 自鄉鎮界）
}
// 老師要求暫時隱藏 108 年，先不呈現於網頁（年份標籤列、歷年折線、散布圖、排名皆排除）。
// 底層資料（values.json、村里 108年2月 快照）保留不動；日後還原：把此陣列清空即可。
const HIDDEN_YEARS: number[] = [108];

export async function loadAll(): Promise<AllData> {
  const [meta, values, geo, counties] = await Promise.all([
    fetch("/data/meta.json").then((r) => r.json() as Promise<Meta>),
    fetch("/data/values.json").then((r) => r.json() as Promise<Values>),
    fetch("/taiwan_townships.geojson").then((r) => r.json() as Promise<GeoJSON.FeatureCollection>),
    fetch("/counties.geojson").then((r) => r.json() as Promise<GeoJSON.FeatureCollection>),
  ]);
  const shownYears = meta.years.filter((y) => !HIDDEN_YEARS.includes(y));
  return { meta: { ...meta, years: shownYears }, values, geo, counties };
}

// 村里檔 lazy load＋快取：一鄉鎮一檔，進入該區才抓
const villageCache = new Map<string, GeoJSON.FeatureCollection>();
export async function loadVillages(towncode: string): Promise<GeoJSON.FeatureCollection> {
  const hit = villageCache.get(towncode);
  if (hit) return hit;
  const r = await fetch(`/data/villages/${towncode}.json`);
  if (!r.ok) throw new Error(`村里檔載入失敗（${towncode}: HTTP ${r.status}）`);
  const fc = (await r.json()) as GeoJSON.FeatureCollection;
  villageCache.set(towncode, fc);
  return fc;
}
export function villageCacheHas(towncode: string): boolean {
  return villageCache.has(towncode);
}
