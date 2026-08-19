import type { CountryMeta, Region } from "../data/types";
import { formatCountryDisplayName } from "./countryDisplayName";

export function toggleCountry(selected: Set<string>, geo: string): Set<string> {
  const next = new Set(selected);
  if (next.has(geo)) next.delete(geo);
  else next.add(geo);
  return next;
}

export function setRegionSelection(
  selected: Set<string>,
  countries: CountryMeta[],
  region: Region,
  isSelected: boolean
): Set<string> {
  const next = new Set(selected);
  for (const country of countries) {
    if (country.region !== region) continue;
    if (isSelected) next.add(country.geo);
    else next.delete(country.geo);
  }
  return next;
}

const KNOWN_REGIONS: readonly Region[] = ["asia", "europe", "africa", "americas", "oceania"];

export function groupByRegion(countries: CountryMeta[]): Record<Region, CountryMeta[]> {
  const groups: Record<Region, CountryMeta[]> = {
    asia: [],
    europe: [],
    africa: [],
    americas: [],
    oceania: [],
  };
  for (const country of countries) {
    // 防禦：region 型別在編譯期是四選一，但資料實際上來自 CSV，
    // 若來源資料未來出現非預期值，略過該筆而非讓整個 CountryChecklist 白畫面。
    if (!KNOWN_REGIONS.includes(country.region)) continue;
    groups[country.region].push(country);
  }
  return groups;
}

// 「臺」「台」是同一個字的正異體，Intl.DisplayNames 對 zh-Hant 只回傳「台灣」，
// 但使用者可能習慣打「臺灣」——比對前都正規化成同一個字，兩種寫法都要找得到。
function normalizeTaiwanVariant(s: string): string {
  return s.replace(/臺/g, "台");
}

export function filterBySearch(countries: CountryMeta[], query: string): CountryMeta[] {
  const q = normalizeTaiwanVariant(query.trim().toLowerCase());
  if (!q) return countries;
  return countries.filter((c) => {
    if (c.name.toLowerCase().includes(q)) return true;
    // 清單實際顯示的是中文名（見 formatCountryDisplayName），
    // 只比對英文原名會讓使用者用「看得到的字」搜尋卻找不到結果。
    const zhName = normalizeTaiwanVariant(formatCountryDisplayName(c.name, c.iso2).toLowerCase());
    return zhName.includes(q);
  });
}
