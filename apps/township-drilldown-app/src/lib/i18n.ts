export type Language = "zh" | "en";

export interface Dict {
  deathRateVillageFallbackNotice: string;
  brandTitleLine1: string;
  brandTitleLine2: string;
  countyNavAriaLabel: string;
  countyNavSearchPlaceholder: string;
  expandAllButton: string;
  collapseAllButton: string;
  darkModeButton: string;
  lightModeButton: string;
  langToggleToZh: string;
  langToggleToEn: string;
  yearRangeFooterPrefix: string;
  yearRangeFooterSuffix: string;
  loadingData: string;
  yearSelectLabel: string;
  yearTablistAriaLabel: string;
  yearSuffix: string;
  hintNation: string;
  hintCounty: string;
  hintTown: string;
  breadcrumbNavAriaLabel: string;
  villageDataLoading: string;
  closeNoticeAriaLabel: string;
  villageLoadFailedPrefix: string;
  villageLoadFailedSuffix: string;
  nationLabel: string;
  censusSnapshotNote: string;
  noVillageDataNote: string;
  sourceFooterText: string;
  noDataLabel: string;
  tooltipPopulationPrefix: string;
  regionChannelLabel: string;
  axisXLabel: string;
  axisYLabel: string;
  colorChannelLabel: string;
  sizeChannelLabel: string;
  colorChannelRegionNoRank: string;
  villageFallbackLabel: string;
  villageTopFiveSuffix: string;
  deathRateNoVillageData: string;
  trendSparklineAriaLabel: string;
  selectedEntityInfoAriaLabel: string;
  selectModeButton: string;
  clearModeButton: string;
  helpButton: string;
  helpBulletMapClick: string;
  helpBulletSelectMode: string;
  helpBulletClearMode: string;
  helpBulletZoom: string;
  selectedCountPrefix: string;
  selectedCountSuffix: string;
  returnToNationClears: string;
  noSelectionYetHelp: string;
  gotItCloseHint: string;
  brushHintText: string;
  tooltipSeparator: string;
  basicIndicatorsGroup: string;
  topTenCausesGroup: string;
}

export const translations: Record<Language, Dict> = {
  zh: {
    deathRateVillageFallbackNotice: "死亡率資料最細至鄉鎮，已自動切換為人口密度",
    brandTitleLine1: "臺灣鄉鎮",
    brandTitleLine2: "統計圖集",
    countyNavAriaLabel: "縣市／鄉鎮區導覽",
    countyNavSearchPlaceholder: "搜尋縣市／鄉鎮…",
    expandAllButton: "展開全部",
    collapseAllButton: "收合全部",
    darkModeButton: "深色模式",
    lightModeButton: "淺色模式",
    langToggleToZh: "中文",
    langToggleToEn: "English",
    yearRangeFooterPrefix: "民國 ",
    yearRangeFooterSuffix: " · 縣市›鄉鎮›村里",
    loadingData: "載入資料中…",
    yearSelectLabel: "選擇年度（民國）",
    yearTablistAriaLabel: "年度",
    yearSuffix: " 年",
    hintNation: "點擊縣市下鑽至鄉鎮；金門、連江見左側虛線框",
    hintCounty: "點擊鄉鎮下鑽至村里",
    hintTown: "點選村里可看三指標；村里人口為普查快照",
    breadcrumbNavAriaLabel: "下鑽層級",
    villageDataLoading: "村里圖資載入中…",
    closeNoticeAriaLabel: "關閉提示",
    villageLoadFailedPrefix: "村里檔載入失敗（",
    villageLoadFailedSuffix: "）",
    nationLabel: "全國",
    censusSnapshotNote: "人口普查快照",
    noVillageDataNote: "無村里資料（最細至鄉鎮）",
    sourceFooterText: "資料來源：鄉鎮多指標統計（民國 102–107）；鄉鎮界圖：政府開放資料。本站為研究用途之非官方作品。",
    noDataLabel: "無資料",
    tooltipPopulationPrefix: "｜人口 ",
    regionChannelLabel: "區域",
    axisXLabel: "X 軸",
    axisYLabel: "Y 軸",
    colorChannelLabel: "顏色",
    sizeChannelLabel: "大小",
    colorChannelRegionNoRank: "顏色通道＝區域，無排名數值",
    villageFallbackLabel: "村里",
    villageTopFiveSuffix: " 村里前五名",
    deathRateNoVillageData: "死亡率無村里資料（最細至鄉鎮）",
    trendSparklineAriaLabel: "歷年趨勢",
    selectedEntityInfoAriaLabel: "選取單位資訊",
    selectModeButton: "選取",
    clearModeButton: "清除",
    helpButton: "使用說明",
    helpBulletMapClick: "點左側地圖任一縣市可看整縣。",
    helpBulletSelectMode: "按「選取」開啟後，拖曳框選一批鄉鎮，或單擊泡泡逐一加入名單。",
    helpBulletClearMode: "按「清除」開啟後，拖曳框選要移出的鄉鎮，或單擊已選泡泡移出。",
    helpBulletZoom: "滑鼠移到圖上滾動滾輪可縮放；縮放後可拖曳平移；雙擊空白處還原。",
    selectedCountPrefix: "已選 ",
    selectedCountSuffix: " 鄉鎮：雙擊已選泡泡可移出；切年份或通道，名單都會保留。",
    returnToNationClears: "回全國即可清空選取。",
    noSelectionYetHelp: "尚未選取：用上面的框選功能開始，或點左側地圖任一縣市。",
    gotItCloseHint: "知道了,關閉提示",
    brushHintText: "按上方「選取」後可拖曳框選或單擊泡泡",
    tooltipSeparator: "｜",
    basicIndicatorsGroup: "基本指標",
    topTenCausesGroup: "十大死因",
  },
  en: {
    deathRateVillageFallbackNotice: "Death-rate data is only available down to the township level; automatically switched to population density.",
    brandTitleLine1: "Taiwan Township",
    brandTitleLine2: "Statistical Atlas",
    countyNavAriaLabel: "County / township navigation",
    countyNavSearchPlaceholder: "Search county / township…",
    expandAllButton: "Expand all",
    collapseAllButton: "Collapse all",
    darkModeButton: "Dark mode",
    lightModeButton: "Light mode",
    langToggleToZh: "中文",
    langToggleToEn: "English",
    yearRangeFooterPrefix: "ROC ",
    yearRangeFooterSuffix: " · County › Township › Village",
    loadingData: "Loading data…",
    yearSelectLabel: "Select year (ROC)",
    yearTablistAriaLabel: "Year",
    yearSuffix: "",
    hintNation: "Click a county to drill into townships; Kinmen and Lienchiang are shown in the dashed boxes on the left",
    hintCounty: "Click a township to drill into villages",
    hintTown: "Click a village to see three indicators; village population is a census snapshot",
    breadcrumbNavAriaLabel: "Drill-down level",
    villageDataLoading: "Loading village map data…",
    closeNoticeAriaLabel: "Close notice",
    villageLoadFailedPrefix: "Failed to load village data (",
    villageLoadFailedSuffix: ")",
    nationLabel: "Nation",
    censusSnapshotNote: "Census snapshot",
    noVillageDataNote: "No village-level data (available down to township only)",
    sourceFooterText: "Data source: township multi-indicator statistics (ROC 102–107); township boundary map: government open data. This site is an unofficial research project.",
    noDataLabel: "No data",
    tooltipPopulationPrefix: " | Pop. ",
    regionChannelLabel: "Region",
    axisXLabel: "X Axis",
    axisYLabel: "Y Axis",
    colorChannelLabel: "Color",
    sizeChannelLabel: "Size",
    colorChannelRegionNoRank: "Color channel = region; no rank values",
    villageFallbackLabel: "Village",
    villageTopFiveSuffix: " Village Top 5",
    deathRateNoVillageData: "Death-rate data unavailable at village level (available down to township only)",
    trendSparklineAriaLabel: "Historical trend",
    selectedEntityInfoAriaLabel: "Selected entity info",
    selectModeButton: "Select",
    clearModeButton: "Clear",
    helpButton: "Help",
    helpBulletMapClick: "Click any county on the map on the left to view the whole county.",
    helpBulletSelectMode: "Turn on \"Select,\" then drag to lasso a group of townships, or click bubbles one at a time to add them.",
    helpBulletClearMode: "Turn on \"Clear,\" then drag to lasso townships to remove, or click a selected bubble to remove it.",
    helpBulletZoom: "Hover over the chart and scroll to zoom; drag to pan once zoomed; double-click empty space to reset.",
    selectedCountPrefix: "Selected ",
    selectedCountSuffix: " townships: double-click a selected bubble to remove it; the list is kept when switching year or channel.",
    returnToNationClears: "Return to the nation view to clear the selection.",
    noSelectionYetHelp: "No selection yet: use the lasso tool above to start, or click any county on the map on the left.",
    gotItCloseHint: "Got it, close hint",
    brushHintText: "Turn on \"Select\" above, then drag to lasso or click bubbles",
    tooltipSeparator: " · ",
    basicIndicatorsGroup: "Basic indicators",
    topTenCausesGroup: "Top 10 causes of death",
  },
};

export function t(lang: Language): Dict {
  return translations[lang];
}

// 「label（unit）」/「role（label）」共用括號格式:中文全形括號緊貼,英文半形括號前留空格。
export function formatParen(a: string, b: string, lang: Language): string {
  return lang === "zh" ? `${a}（${b}）` : `${a} (${b})`;
}
