import type { YearRecord } from "../data/types";

// 8/7 老師回饋「播放要更連續平滑」:播放改小數年份(如 1987.4)後,資料層對前後兩個
// 整數年逐指標線性內插——泡泡沿資料路徑連續移動,而不是一年一跳(Gapminder 官方做法)。
export type YearIndex = Map<string, Map<number, YearRecord>>;

// records 是模組層級常數(App.tsx 載入一次),WeakMap 以陣列 reference 當 key 快取,
// 多個元件(散布圖/地球儀)各自呼叫也只建一次索引。
const indexCache = new WeakMap<YearRecord[], YearIndex>();

export function buildYearIndex(records: YearRecord[]): YearIndex {
  const cached = indexCache.get(records);
  if (cached) return cached;
  const index: YearIndex = new Map();
  for (const r of records) {
    let byYear = index.get(r.geo);
    if (!byYear) {
      byYear = new Map();
      index.set(r.geo, byYear);
    }
    byYear.set(r.year, r);
  }
  indexCache.set(records, index);
  return index;
}

const METRIC_FIELDS = ["income", "lifeExpectancy", "population", "childMortality", "fertility"] as const;

// 整數年 → 原始紀錄(zero-cost fast path,未播放時行為與改版前完全相同)。
// 小數年 → 前後兩年逐指標內插;任一側缺值該指標給 null(不捏造資料,呼叫端照
// 現行規則隱藏該泡泡);推估值旗標取 floor 年(spread 自然帶入)。
// 下一年紀錄不存在(資料尾端)→ 退回 floor 年紀錄。
export function interpolateRecord(index: YearIndex, geo: string, year: number): YearRecord | null {
  const byYear = index.get(geo);
  if (!byYear) return null;
  const y0 = Math.floor(year);
  const base = byYear.get(y0) ?? null;
  if (year === y0 || !base) return base;
  const next = byYear.get(y0 + 1);
  if (!next) return base;
  const frac = year - y0;
  const out: YearRecord = { ...base, year };
  for (const f of METRIC_FIELDS) {
    const a = base[f];
    const b = next[f];
    out[f] = a === null || b === null ? null : a + (b - a) * frac;
  }
  return out;
}
