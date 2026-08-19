import * as d3 from "d3";

export const INSET_COUNTIES: readonly string[] = ["金門縣", "連江縣"];

export function countyOf(f: GeoJSON.Feature): string {
  return (f.properties as any).COUNTYNAME as string;
}

// 台灣本島＋近海離島 bbox（沿用既有投影收斂條件；金馬與南海島礁在外）
export function inTaiwanBox(f: GeoJSON.Feature): boolean {
  const [[w, s], [, n]] = d3.geoBounds(f as any);
  return w > 119 && s > 21.7 && n < 25.6;
}

export function splitFeatures(features: GeoJSON.Feature[]): {
  main: GeoJSON.Feature[];
  insets: { county: string; features: GeoJSON.Feature[] }[];
} {
  const main = features.filter((f) => !INSET_COUNTIES.includes(countyOf(f)));
  const insets = INSET_COUNTIES.map((county) => ({
    county,
    features: features.filter((f) => countyOf(f) === county),
  }));
  return { main, insets };
}

// 縣內視圖 fit 集合：一般縣套台灣 bbox（防旗津南海島礁壓小縣圖），inset 縣用自然邊界
// 金門縣的烏坵鄉遠在本島群東方外海，會把金門本島群壓成小點；縣層下鑽 fit 也一併排除，
// 讓本島群填滿框、放大（烏坵超出 viewBox 被裁掉，仍列於排名清單）。
export const INSET_FIT_EXCLUDE: Record<string, string[]> = { 金門縣: ["烏坵鄉"] };

export function countyFitFeatures(features: GeoJSON.Feature[], county: string): GeoJSON.Feature[] {
  const ex = INSET_FIT_EXCLUDE[county] ?? [];
  const cf = features.filter((f) => countyOf(f) === county && !ex.includes((f.properties as any).TOWNNAME));
  return INSET_COUNTIES.includes(county) ? cf : cf.filter(inTaiwanBox);
}

export function insetFitFeatures(features: GeoJSON.Feature[], county: string): GeoJSON.Feature[] {
  const ex = INSET_FIT_EXCLUDE[county] ?? [];
  return features.filter((f) => countyOf(f) === county && !ex.includes((f.properties as any).TOWNNAME));
}
