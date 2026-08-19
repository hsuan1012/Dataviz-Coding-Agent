import type { CountryMeta, YearRecord, Region } from "../data/types";
import type { MetricKey } from "./channels";

// 五指標全開:排名卡通道連動需要支援全部 METRICS,直接 alias 到 MetricKey。
// getTopN 的 record[metric] 索引不用改(YearRecord 已含全部五個欄位)。
export type RacingMetric = MetricKey;

export interface RankedCountry {
  geo: string;
  name: string;
  iso2: string;
  region: Region;
  value: number;
}

export function getTopN(
  countries: CountryMeta[],
  records: YearRecord[],
  year: number,
  metric: RacingMetric,
  n: number
): RankedCountry[] {
  const countryByGeo = new Map(countries.map((c) => [c.geo, c]));
  const ranked: RankedCountry[] = [];

  for (const record of records) {
    if (record.year !== year) continue;
    const value = record[metric];
    if (value === null) continue;
    const country = countryByGeo.get(record.geo);
    if (!country) continue;
    ranked.push({
      geo: country.geo,
      name: country.name,
      iso2: country.iso2,
      region: country.region,
      value,
    });
  }

  ranked.sort((a, b) => b.value - a.value);
  return ranked.slice(0, n);
}

export function formatRacingValue(metric: RacingMetric, value: number): string {
  if (metric === "lifeExpectancy") return value.toFixed(1);
  if (metric === "childMortality") return value.toFixed(0);
  if (metric === "fertility") return value.toFixed(2);

  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toFixed(0);
}
