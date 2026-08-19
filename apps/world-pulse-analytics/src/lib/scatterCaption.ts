import type { ScatterChannels, MetricKey } from "./channels";
import { metricLabel } from "./channels";
import type { Language } from "./i18n";

// 泡泡圖白話解說(移植鄉鎮版 7/23 教訓:很多人看不懂泡泡圖):
// 一句話講清楚「一顆泡泡=一個國家」+四個視覺通道各自編碼什麼、往哪個方向讀。
// 8/4 語言切換:lang 預設 "zh" 保留既有呼叫點/測試不用強制補參數。
export function buildScatterCaption(ch: ScatterChannels, lang: Language = "zh"): string {
  const lab = (k: MetricKey) => metricLabel(k, lang);
  if (lang === "en") {
    const color = ch.color === "region"
      ? "bubble color shows continent (one color each for Asia/Europe/Africa/Americas)"
      : `darker bubble color means higher "${lab(ch.color as MetricKey)}"`;
    return `Each bubble is a country. Further right means higher "${lab(ch.x)}", ` +
      `higher up means higher "${lab(ch.y)}"; a bigger bubble means higher "${lab(ch.size)}"; ${color}.`;
  }
  const color = ch.color === "region"
    ? "泡泡的顏色代表所屬洲別(亞洲/歐洲/非洲/美洲各一色)"
    : `泡泡的顏色越深代表「${lab(ch.color as MetricKey)}」越高`;
  return `每顆泡泡代表一個國家。泡泡越靠右代表「${lab(ch.x)}」越高、` +
    `越靠上代表「${lab(ch.y)}」越高;泡泡越大代表「${lab(ch.size)}」越高;${color}。`;
}

// 選取狀態列:未選=教學,已選=數量+操作提示(移植鄉鎮版狀態式說明)。
export function buildFocusCaption(count: number, lang: Language = "zh"): string {
  if (lang === "en") {
    if (count === 0) {
      return "Turn on \"Select\" and drag to box-select countries, or click a bubble to add it; click a selected " +
        "bubble again to remove it. Other countries dim once anything is selected. Turn on \"Zoom\" and drag to " +
        "zoom in; double-click blank space to reset.";
    }
    return `${count} countries selected: switching year or metric keeps the list; ` +
      "turn on \"Clear\" and drag to remove a batch, or click a selected bubble to remove it individually.";
  }
  if (count === 0) {
    return "按「選取」後在圖上拖曳框選一批國家,單擊泡泡加入,已選的泡泡再單擊一次可移出;" +
      "選取後其餘國家會灰階淡化。按「放大」後拖曳框選可縮放檢視,雙擊空白處還原。";
  }
  return `已選 ${count} 國:切換年份或指標,名單都會保留;` +
    "按「清除」後框選移出一批,單擊已選泡泡可個別移除。";
}
