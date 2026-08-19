// 8/4 使用者要求:加語言切換鈕(繁中/English),介面全翻——集中放這裡當唯一真相來源,
// 每個元件從這裡取翻譯,不要各自散落硬寫的中文字串。METRICS 的 label/unit 例外
// (跟指標設定綁在一起,見 channels.ts 的 metricLabel/metricUnit)。
import type { Region } from "../data/types";

export type Language = "zh" | "en";

export interface Dict {
  headerEyebrow: string;
  headerTitle: string;
  langToggleToZh: string; // 英文模式時,切換鈕顯示的文字(切回中文)
  langToggleToEn: string; // 中文模式時,切換鈕顯示的文字(切去英文)
  darkMode: string;
  lightMode: string;
  searchPlaceholder: string;
  yearInputLabel: string;
  selectAll: string;
  deselectAll: string;
  regions: Record<Region, string>;
  xAxisLabel: string;
  yAxisLabel: string;
  colorLabel: string;
  sizeLabel: string;
  colorRegionOption: string;
  selectBtn: string;
  clearBtn: string;
  helpBtn: string;
  decorativeNote: string;
  playAriaLabel: string;
  pauseAriaLabel: string;
  rankPrefixX: string;
  rankPrefixY: string;
  rankPrefixColor: string;
  rankPrefixSize: string;
  rankTop5Suffix: string;
  colorByRegionCardTitle: string;
  colorByRegionNoRank: string;
  sizeLegendPrefix: string; // 「大小（」
  sizeLegendSuffix: string; // 「）」
  sizeLegendAriaLabel: string;
  scatterSvgAriaLabel: string;
  projectionSuffix: string; // 「・推估值」
  helpBulletSelect: string;
  helpBulletClear: string;
  helpBulletZoom: string;
  helpBulletGlobe: string;
  helpBulletBlankReset: string;
  helpNotSelectedHint: string;
}

export const translations: Record<Language, Dict> = {
  zh: {
    headerEyebrow: "資料視覺化 · 全球指標",
    headerTitle: "世界發展數據分析平台",
    langToggleToZh: "中文",
    langToggleToEn: "English",
    darkMode: "深色模式",
    lightMode: "淺色模式",
    searchPlaceholder: "搜尋國家…",
    yearInputLabel: "年份",
    selectAll: "全選",
    deselectAll: "全不選",
    regions: { asia: "亞洲", europe: "歐洲", africa: "非洲", americas: "美洲", oceania: "大洋洲" },
    xAxisLabel: "X 軸",
    yAxisLabel: "Y 軸",
    colorLabel: "顏色",
    sizeLabel: "大小",
    colorRegionOption: "區域(洲別)",
    selectBtn: "選取",
    clearBtn: "清除",
    helpBtn: "使用說明",
    decorativeNote:
      "註：地球儀上灰色區塊（南極洲、格陵蘭、波多黎各等 10 個地區）不在 Gapminder 195 國統計清單內，僅供地圖形狀參考，無法點選或呈現數據。",
    playAriaLabel: "播放",
    pauseAriaLabel: "暫停",
    rankPrefixX: "X軸",
    rankPrefixY: "Y軸",
    rankPrefixColor: "顏色",
    rankPrefixSize: "大小",
    rankTop5Suffix: " · 全球前5",
    colorByRegionCardTitle: "顏色(區域)",
    colorByRegionNoRank: "顏色通道=區域,無排名數值",
    sizeLegendPrefix: "大小（",
    sizeLegendSuffix: "）",
    sizeLegendAriaLabel: "大小圖例",
    scatterSvgAriaLabel: "Gapminder 泡泡圖",
    projectionSuffix: "・推估值",
    helpBulletSelect: "按「選取」開啟後,拖曳框選一批國家,或單擊泡泡逐一加入名單。",
    helpBulletClear: "按「清除」開啟後,拖曳框選要移出的國家,或單擊已選泡泡移出。",
    helpBulletZoom: "滑鼠移到圖上滾動滾輪可縮放;縮放後可拖曳平移;雙擊空白處還原。",
    helpBulletGlobe: "地球儀上的國家點也能點擊加入/移出選取,與泡泡圖雙向連動。",
    helpBulletBlankReset: "雙擊散佈圖或地球儀的空白處,會清空目前所有選取,回到初始狀態。",
    helpNotSelectedHint: "尚未選取:用上面的框選功能開始,或直接點一顆泡泡。",
  },
  en: {
    headerEyebrow: "DATA VISUALIZATION · GLOBAL INDICATORS",
    headerTitle: "World Development Data Analytics Platform",
    langToggleToZh: "中文",
    langToggleToEn: "English",
    darkMode: "Dark Mode",
    lightMode: "Light Mode",
    searchPlaceholder: "Search countries…",
    yearInputLabel: "Year",
    selectAll: "Select All",
    deselectAll: "Deselect All",
    regions: { asia: "Asia", europe: "Europe", africa: "Africa", americas: "Americas", oceania: "Oceania" },
    xAxisLabel: "X Axis",
    yAxisLabel: "Y Axis",
    colorLabel: "Color",
    sizeLabel: "Size",
    colorRegionOption: "Region (Continent)",
    selectBtn: "Select",
    clearBtn: "Clear",
    helpBtn: "Help",
    decorativeNote:
      "Note: The gray shapes on the globe (Antarctica, Greenland, Puerto Rico, and 10 other regions) are not part of Gapminder's 195-country dataset. They are shown for map reference only and cannot be selected or show data.",
    playAriaLabel: "Play",
    pauseAriaLabel: "Pause",
    rankPrefixX: "X Axis",
    rankPrefixY: "Y Axis",
    rankPrefixColor: "Color",
    rankPrefixSize: "Size",
    rankTop5Suffix: " · Top 5",
    colorByRegionCardTitle: "Color (Region)",
    colorByRegionNoRank: "Color channel = Region, no ranking values",
    sizeLegendPrefix: "Size (",
    sizeLegendSuffix: ")",
    sizeLegendAriaLabel: "Size legend",
    scatterSvgAriaLabel: "Gapminder bubble chart",
    projectionSuffix: " · projected",
    helpBulletSelect: "Turn on \"Select\", then drag to box-select countries, or click a bubble to add it individually.",
    helpBulletClear: "Turn on \"Clear\", then drag to box-select countries to remove, or click a selected bubble to remove it.",
    helpBulletZoom: "Scroll the mouse wheel over the chart to zoom (scroll up to zoom in, down to zoom out); after zooming, drag to pan; double-click blank chart space to reset.",
    helpBulletGlobe: "Country points on the globe can also be clicked to add/remove selection, linked both ways with the bubble chart.",
    helpBulletBlankReset: "Double-clicking blank space on the bubble chart or globe clears all current selections, back to the initial state.",
    helpNotSelectedHint: "No selection yet: use the box-select tools above, or click a bubble directly.",
  },
};

export function t(lang: Language): Dict {
  return translations[lang];
}
