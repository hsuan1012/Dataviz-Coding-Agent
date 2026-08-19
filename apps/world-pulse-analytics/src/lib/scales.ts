import { scaleLinear, scaleLog, scaleSqrt } from "d3";

// 定義域邊界需涵蓋實際資料範圍（見 scripts/transform.test.js 與資料校驗），
// 並加上 .clamp(true)：若未來資料出現超出定義域的值，會夾在邊界而非畫到畫布外消失。
// - 平均餘命最低見於 Rwanda 1994（9.5）與 Burundi 1972（17.15）
// - 人均所得最高見於 Qatar/Singapore 2048-2050（約 209,113）
// - 人口數有 23 筆超過 15 億（中國、印度）
export const LIFE_EXPECTANCY_DOMAIN: [number, number] = [8, 95];
export const INCOME_DOMAIN: [number, number] = [300, 250000];
export const POPULATION_DOMAIN: [number, number] = [10000, 2_000_000_000];

export function createLifeExpectancyScale(range: [number, number]) {
  return scaleLinear().domain(LIFE_EXPECTANCY_DOMAIN).range(range).clamp(true);
}

export function createIncomeScale(range: [number, number]) {
  return scaleLog().domain(INCOME_DOMAIN).range(range).clamp(true);
}

export function createPopulationRadiusScale(range: [number, number]) {
  return scaleSqrt().domain(POPULATION_DOMAIN).range(range).clamp(true);
}
