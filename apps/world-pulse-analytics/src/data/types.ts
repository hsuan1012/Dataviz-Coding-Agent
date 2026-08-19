// 8/4 使用者發現「亞洲」裡混了大洋洲國家——查證後是 Gapminder 原始資料的
// world_4region 欄位本來就只分四類,ETL(transform.js toCountryList)已對已知的
// 14 個大洋洲國家覆寫成 oceania,這裡新增第五類對齊。
export type Region = "asia" | "europe" | "africa" | "americas" | "oceania";

export interface CountryMeta {
  geo: string;
  name: string;
  region: Region;
  latitude: number;
  longitude: number;
  iso2: string;
}

export interface YearRecord {
  geo: string;
  year: number;
  income: number | null;
  lifeExpectancy: number | null;
  population: number | null;
  incomeIsProjection: boolean;
  lifeExpectancyIsProjection: boolean;
  populationIsProjection: boolean;
  childMortality: number | null;
  fertility: number | null;
}
