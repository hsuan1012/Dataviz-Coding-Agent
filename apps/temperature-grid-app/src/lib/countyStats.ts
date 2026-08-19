// 縣市層統計:側欄競速長條與 ridgeline 縣市過濾共用。
// 注意:縣市邊界重複網格在 ETL 去重時保留「第一次出現的縣市」,
// 邊界格只計入該縣 —— 縣均溫為近似值(footer 已註記去重規則)。

export function buildCountyIndices(county: string[]): Map<string, number[]> {
  const map = new Map<string, number[]>()
  for (let i = 0; i < county.length; i++) {
    const arr = map.get(county[i])
    if (arr) arr.push(i)
    else map.set(county[i], [i])
  }
  return map
}

export interface CountyMean {
  county: string
  mean: number
  n: number
}

/** 每縣市當月網格均溫(未加權;每格等權) */
export function countyMeans(indices: Map<string, number[]>, values: number[]): CountyMean[] {
  const out: CountyMean[] = []
  for (const [county, idx] of indices) {
    let sum = 0
    for (const i of idx) sum += values[i]
    out.push({ county, mean: sum / idx.length, n: idx.length })
  }
  return out.sort((a, b) => b.mean - a.mean)
}
