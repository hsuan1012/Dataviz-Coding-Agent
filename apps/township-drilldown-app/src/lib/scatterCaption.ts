import type { ScatterChannels } from "./scatterChannels";
import type { Language } from "./i18n";
import { metricLabel } from "./metricI18n";

export type CaptionVar = { key: string; label: string };

// 關係散布圖白話解說(7/23 使用者回饋:很多人看不懂泡泡圖):
// 一句話講清楚「一顆泡泡=一個鄉鎮」+四個視覺通道各自編碼什麼、往哪個方向讀。
// 跟著下拉即時更新;顏色=區域時改講分區。8/11 加雙語:中英文各自完整造句(非逐詞替換),
// 語序差異大(中文「泡泡越靠右代表X越高」vs 英文「further right means higher X」)不適合共用模板。
export function buildScatterCaption(ch: ScatterChannels, vars: CaptionVar[], lang: Language): string {
  const lab = (k: string) => metricLabel(k, vars.find((v) => v.key === k)?.label ?? k, lang);
  if (lang === "en") {
    const color = ch.color === "region"
      ? "bubble color represents region (one color each for North/Central/South/East/Outlying Islands)"
      : `darker bubble color means higher "${lab(ch.color)}"`;
    return `Each bubble represents one township. Further right means higher "${lab(ch.x)}", ` +
      `further up means higher "${lab(ch.y)}"; bigger bubbles mean higher "${lab(ch.size)}"; ${color}.`;
  }
  const color = ch.color === "region"
    ? "泡泡的顏色代表所屬區域(北/中/南/東/離島各一色)"
    : `泡泡的顏色越深代表「${lab(ch.color)}」越高`;
  return `每顆泡泡代表一個鄉鎮。泡泡越靠右代表「${lab(ch.x)}」越高、` +
    `越靠上代表「${lab(ch.y)}」越高;泡泡越大代表「${lab(ch.size)}」越高;${color}。`;
}
