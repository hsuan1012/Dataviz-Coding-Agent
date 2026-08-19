// 資料載入與型別:對齊 etl/build_data.py 的輸出格式
export interface Grids {
  n: number
  cell: [number, number] // [dlon, dlat] 度
  lon: number[]
  lat: number[]
  county: string[]
}

export interface YearTemps {
  year: number
  min: number
  max: number
  months: number[][] // 12 × n,與 Grids 索引對齊
}

export interface Meta {
  years: number[]
  nGrids: number
  tmin: number
  tmax: number
  duplicateGridCountyDropped: number
}

const base = import.meta.env.BASE_URL

export async function loadGrids(): Promise<Grids> {
  const r = await fetch(`${base}data/grids.json`)
  if (!r.ok) throw new Error(`grids.json ${r.status}`)
  return r.json()
}

export async function loadYear(year: number): Promise<YearTemps> {
  const r = await fetch(`${base}data/temps_${year}.json`)
  if (!r.ok) throw new Error(`temps_${year}.json ${r.status}`)
  return r.json()
}

export async function loadMeta(): Promise<Meta> {
  const r = await fetch(`${base}data/meta.json`)
  if (!r.ok) throw new Error(`meta.json ${r.status}`)
  return r.json()
}

export interface Trends {
  years: number[]
  island: number[][] // [month][yearIdx] 全島均溫
  county: Record<string, number[][]> // 縣市 → [month][yearIdx]
}

export async function loadTrends(): Promise<Trends> {
  const r = await fetch(`${base}data/trends.json`)
  if (!r.ok) throw new Error(`trends.json ${r.status}`)
  return r.json()
}

export const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
