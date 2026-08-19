// 依老師 color-matrix 的 LCH 方法生成溫度色階(d3.hcl、感知明度、色域檢查)。
// 冷→熱:深藍(h265)→淡藍灰→淡黃(低 chroma 過渡,避免掃過綠色帶)→橘→紅(h35)。
// 印出 hex 供貼進 styleDictionary;displayable=false 會標記,須調參重跑。
import { hcl } from 'd3-color'

function build(name, stops) {
  console.log(`-- ${name}`)
  const hexes = stops.map(([h, c, L]) => {
    const col = hcl(h, c, L)
    const ok = col.displayable()
    console.log(`  hcl(${h}, ${c}, ${L}) -> ${col.formatHex()} ${ok ? '' : '  ⚠ OUT OF GAMUT'}`)
    return col.formatHex()
  })
  console.log(`  ['${hexes.join("', '")}']`)
}

// 淺色主題:兩端深(L40/45)、中央亮(L86-88)、中央 chroma 壓低避開綠色帶
// (8/18 使用者:「飽和度可以高一點」→ chroma 全面拉高一級,仍逐點過色域)
// (8/18 二修:使用者「還是太淡」→中段明度 84-88 壓到 70-76、chroma 再拉高)
build('light', [
  [268, 42, 38],
  [252, 42, 54],
  [220, 32, 70],
  [85, 58, 76],
  [50, 76, 56],
  [32, 76, 42],
])

// 深色主題:整體壓低亮度上限、端點略提亮保有層次;chroma 同步拉高
build('dark', [
  [268, 44, 46],
  [252, 44, 58],
  [220, 28, 68],
  [85, 52, 72],
  [50, 70, 58],
  [32, 70, 46],
])
