import type { Language } from "./i18n";

// 指標/死因/區域集合小且固定(5+11+6項),用資料既有的英文 key 當索引直接對照,
// 不需要像地名一樣做程式化音譯。key 來自 meta.json 的 indicators[].key / deathCauses[].key。
const INDICATOR_LABEL_EN: Record<string, string> = {
  density: "Population density",
  income: "Average income",
  death: "Death rate",
  clinic: "Clinic medical staff",
  hospital: "Hospital medical staff",
};

const INDICATOR_UNIT_EN: Record<string, string> = {
  density: "people/km²",
  income: "NT$1,000/household",
  death: "per 100,000",
  clinic: "per 10,000",
  hospital: "per 10,000",
};

// 不含 key "death"("全死因"):scatterVars()(lib/data.ts)已把 deathCauses 裡的
// "death" 條目過濾掉(死亡率指標本身就代表全死因),留著會跟下面 INDICATOR_LABEL_EN 的
// death="死亡率"撞 key,讓 metricLabel("death", "死亡率", "en") 誤回"All causes"。
const DEATH_CAUSE_LABEL_EN: Record<string, string> = {
  death_c06: "Malignant neoplasms",
  death_c16: "Heart disease",
  death_c17: "Cerebrovascular disease",
  death_c21: "Pneumonia",
  death_c09: "Diabetes mellitus",
  death_c38: "Accidents",
  death_c23: "Chronic lower respiratory disease",
  death_c15: "Hypertensive disease",
  death_c32: "Nephritis, nephrotic syndrome and nephrosis",
  death_c28: "Chronic liver disease and cirrhosis",
};

const REGION_LABEL_EN: Record<string, string> = {
  "北": "North",
  "中": "Central",
  "南": "South",
  "東": "East",
  "離島": "Outlying Islands",
  "東·離島": "East · Outlying Islands",
};

// zhLabel 當找不到對照時的安全 fallback(退回原始中文,不留白)。
export function metricLabel(key: string, zhLabel: string, lang: Language): string {
  if (lang === "zh") return zhLabel;
  return DEATH_CAUSE_LABEL_EN[key] ?? INDICATOR_LABEL_EN[key] ?? zhLabel;
}

export function metricUnit(key: string, zhUnit: string, lang: Language): string {
  if (lang === "zh") return zhUnit;
  return INDICATOR_UNIT_EN[key] ?? zhUnit;
}

export function regionLabel(region: string, lang: Language): string {
  if (lang === "zh") return region;
  return REGION_LABEL_EN[region] ?? region;
}
