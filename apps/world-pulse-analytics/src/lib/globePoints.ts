import type { CountryMeta, Region } from "../data/types";
import { colorForRegion } from "./regionColors";
import { makeColorNormalizer, rampColor, TEAL_RAMP, TEAL_RAMP_DARK, type ColorKey } from "./channels";
import { formatCountryDisplayName } from "./countryDisplayName";

export interface BoundaryFeature {
  type: "Feature";
  properties: { geo: string };
  geometry: GeoJSON.Geometry;
}

export interface DecorativeFeature {
  type: "Feature";
  properties: { name: string };
  geometry: GeoJSON.Geometry;
}

// 老師 8/3 回饋:南極洲/格陵蘭等沒有 Gapminder 統計數字的地區,不用呈現數據,
// 但地球儀當背景地圖形狀顯示就好——這個型別故意不帶 geo 鍵,WorldGlobe 的 accessor
// 用「'geo' in d」判斷該筆是資料國家還是裝飾地形,裝飾地形固定中性色、不參與
// 選取/hover/灰化互動。
export interface DecorativeDatum {
  name: string;
  nameZh: string;
  geometry: GeoJSON.Geometry;
}

// 這 10 個地區是 Natural Earth 110m 邊界裡對不到 Gapminder 195 國清單的固定集合
// (南極洲、格陵蘭等,見 prepare-boundaries.js 執行時印出的清單)——數量小且穩定,
// 加上北賽普勒斯/索馬利蘭這類爭議地區根本沒有標準 ISO 代碼可用 Intl.DisplayNames
// 查詢,不像 195 國那樣適合用平台 API 即時算,直接對照表更單純可靠。
const DECORATIVE_NAME_ZH: Record<string, string> = {
  "W. Sahara": "西撒哈拉",
  "Falkland Is.": "福克蘭群島",
  "Greenland": "格陵蘭",
  "Fr. S. Antarctic Lands": "法屬南部和南極領地",
  "Puerto Rico": "波多黎各",
  "New Caledonia": "新喀里多尼亞",
  "Antarctica": "南極洲",
  "N. Cyprus": "北賽普勒斯",
  "Somaliland": "索馬利蘭",
  "Kosovo": "科索沃",
};

export function buildDecorativePolygonData(features: DecorativeFeature[]): DecorativeDatum[] {
  return features.map((f) => ({
    name: f.properties.name,
    nameZh: DECORATIVE_NAME_ZH[f.properties.name] ?? f.properties.name,
    geometry: f.geometry,
  }));
}

// 只放「選了哪些國家」才會變的欄位(geo/name/region/geometry)，不放 hover/focus 衍生的
// 顏色——後者滑鼠一移動就變，若跟著烤進這個物件，每次 hover 都得整批建新 reference
// 餵回 polygonsData，three-globe 的資料綁定會把它們當成全新資料，整批拆掉重建 3D
// 網格造成閃爍(hover 移過地球儀肉眼可見的閃爍就是這樣來的)。顏色改用 capColorFor/
// strokeColorFor 當 accessor function，只在 hover/focus 變動時重新指定，不動 polygonsData。
export interface GlobePolygonDatum {
  geo: string;
  nameZh: string;
  nameEn: string;
  region: Region;
  geometry: GeoJSON.Geometry;
}

// 8/4 語言切換:name 改名 nameZh,跟 DecorativeDatum 的欄位命名(name=英文原名/
// nameZh=中文)對齊——兩種資料點的語言判斷邏輯才能共用同一套 accessor(見 WorldGlobe.tsx
// polygonLabel)。中文名不再綁死烤進資料(語言切換不用重建 polygonsData,只是換 accessor)。
export function buildGlobePolygonData(
  boundaryFeatures: BoundaryFeature[],
  countries: CountryMeta[],
  selected: Set<string>
): GlobePolygonDatum[] {
  const countryByGeo = new Map(countries.map((c) => [c.geo, c]));
  const result: GlobePolygonDatum[] = [];
  for (const feature of boundaryFeatures) {
    const geo = feature.properties.geo;
    if (!selected.has(geo)) continue;
    const country = countryByGeo.get(geo);
    if (!country) continue;
    result.push({
      geo,
      nameZh: formatCountryDisplayName(country.name, country.iso2, "zh"),
      nameEn: country.name,
      region: country.region,
      geometry: feature.geometry,
    });
  }
  return result;
}

// 淺色模式灰化色貼近白底(讓灰化國家「淡出」);深色模式改用中灰(貼近深色卡片底色
// 而非亮灰,才有同樣「淡出、不搶眼」的效果——直接沿用亮灰在深底上反而會太顯眼)。
const DIMMED_COLOR = "#CBD5E1";
const DIMMED_COLOR_DARK = "#475569";
// three-globe 的多邊形圖層沒有可調的邊框粗細(WebGL 線寬受限)，改用 strokeColor
// 表達 hover 強調：一般國界是白色細線(經典 choropleth 觀感)，hover 中的國家邊框
// 換成強調色，比改變線寬更醒目也更可靠。
// 8/4 使用者回饋:原本強調色沿用 --accent(青綠),跟歐洲洲別色(REGION_COLORS.europe
// 剛好也是同一個青綠 #0D9488/#2DD4BF)撞色——選到歐洲國家時邊框幾乎融進自己的填色裡,
// 完全看不出來。改用玫紅色系,跟現有四色洲別色盤(鋼藍/青綠/赭橘/苔綠)在色相上都拉開
// 距離,不論選哪一洲的國家都不會撞色。
const STROKE_DEFAULT = "#ffffff";
const STROKE_HIGHLIGHT = "#DB2777";
const STROKE_HIGHLIGHT_DARK = "#F472B6";
// 8/4 使用者回饋②:邊框想要更粗——WebGL 線寬這條路真的走不通(見上方註解),改讓
// 選取國家的側壁(polygonSideColor,extrusion 的立面)也换成同一個強調色、不透明度
// 拉高,搭配 WorldGlobe.tsx 的 polygonAltitude 墊高,側壁繞著整個國界一圈,視覺上
// 就是一圈有寬度的色帶,比單純的 1px 描邊更接近「加粗邊框」的訴求。
const SIDE_DEFAULT = "rgba(15, 23, 42, 0.08)";
const SIDE_HIGHLIGHT = "rgba(219, 39, 119, 0.55)";
const SIDE_HIGHLIGHT_DARK = "rgba(244, 114, 182, 0.55)";
// 裝飾地形固定中性灰,刻意跟四個洲別色(鋼藍/青綠/赭/苔綠)與海洋深藍拉開,
// 一眼就看得出「這塊沒有資料」而非某個洲別。海洋色不隨主題變,這個也不用變。
export const DECORATIVE_COLOR = "#94A3B8";

// focus 有選取時:未選中國家灰化,選中國家維持洲別原色;無 focus 選取時全部原色。
export function capColorFor(region: Region, isFocused: boolean, hasFocus: boolean, dark = false): string {
  const dimmed = hasFocus && !isFocused;
  if (dimmed) return dark ? DIMMED_COLOR_DARK : DIMMED_COLOR;
  return colorForRegion(region, dark);
}

// 8/4 使用者回饋:選取國家在地球儀上邊框標示不明顯——原本只有 hover 中的國家會換強調色,
// 已選取(focusSelection)但滑鼠沒放上去的國家邊框跟一般國界一樣是白色細線,幾乎看不出來
// 被選取。three-globe 的多邊形圖層沒有可調的邊框粗細(WebGL 線寬受限,見上方註解),線寬
// 這條路走不通,改成選取的國家也套用跟 hover 一樣的強調色邊框(比照 BubbleChart.tsx
// 泡泡的作法:isHovered || isFocused 都吃強調色描邊),不需要滑鼠停留就看得到選取狀態。
export function strokeColorFor(isHovered: boolean, isFocused: boolean, dark = false): string {
  if (!isHovered && !isFocused) return STROKE_DEFAULT;
  return dark ? STROKE_HIGHLIGHT_DARK : STROKE_HIGHLIGHT;
}

// 8/24 使用者回饋:地球儀 hover 國家時,散布圖對應泡泡也要有同一玫紅外框(比照
// township-drilldown-app 的 Scatter 懸停高亮)。單獨匯出玫紅給 BubbleChart 用——
// 散布圖的優先權是 hover=玫紅、已選取仍走 --accent 青綠,跟 strokeColorFor
// (hover/選取都吃玫紅)不同,所以不能直接共用那個函式。
export const strokeHighlight = (dark = false): string =>
  dark ? STROKE_HIGHLIGHT_DARK : STROKE_HIGHLIGHT;

// 選取國家的側壁(polygonSideColor)——搭配 WorldGlobe.tsx 的 polygonAltitude 墊高,
// 繞國界一圈的立面換成同一個強調色系、拉高不透明度,視覺上比 1px 描邊更像「加粗邊框」。
export function sideColorFor(isFocused: boolean, dark = false): string {
  if (!isFocused) return SIDE_DEFAULT;
  return dark ? SIDE_HIGHLIGHT_DARK : SIDE_HIGHLIGHT;
}

// 8/7 老師回饋:choropleth 顏色只能呈現洲別,要能跟散布圖「顏色」通道一樣呈現
// 人均所得/平均餘命等指標。工廠函式:region 模式包裝現行 capColorFor(行為不變);
// 指標模式用散布圖同一套 normalize+青綠 ramp(深淺各自 ramp),缺值國家塗
// DECORATIVE_COLOR(語意=「這裡沒有資料」,與南極洲等裝飾地形一致)。
// focus 灰化在兩種模式都優先——選取聚焦時未選國一律淡出,與現行行為相同。
export function makeGlobeFill(
  colorKey: ColorKey,
  dark: boolean
): (region: Region, value: number | null, isFocused: boolean, hasFocus: boolean) => string {
  if (colorKey === "region") {
    return (region, _value, isFocused, hasFocus) => capColorFor(region, isFocused, hasFocus, dark);
  }
  const normalize = makeColorNormalizer(colorKey);
  const ramp = rampColor(dark ? TEAL_RAMP_DARK : TEAL_RAMP);
  return (_region, value, isFocused, hasFocus) => {
    if (hasFocus && !isFocused) return dark ? DIMMED_COLOR_DARK : DIMMED_COLOR;
    if (value === null) return DECORATIVE_COLOR;
    return ramp(normalize(value));
  };
}
