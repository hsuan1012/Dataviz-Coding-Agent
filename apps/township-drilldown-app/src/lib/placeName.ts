import { pinyin } from "pinyin-pro";
import type { Language } from "./i18n";

// 中文行政層級字尾 → 英文行政單位字尾(比照臺灣官方雙語路牌慣例)。
// 依序比對(陣列順序=比對順序),抓到第一個符合的字尾就用;抓不到則整串轉拼音不加字尾。
const SUFFIX_MAP: [string, string][] = [
  ["縣", "County"],
  ["市", "City"],
  ["區", "District"],
  ["鎮", "Town"],
  ["鄉", "Township"],
  ["里", "Village"],
  ["村", "Village"],
];

const cache = new Map<string, string>();

// 漢語拼音轉英文專有名詞慣例:字首大寫、其餘小寫、音節間不留空格(如「板橋」→「Banqiao」而非「Ban Qiao」)。
function toPinyinWord(han: string): string {
  const syllables = pinyin(han, { toneType: "none", type: "array" }) as string[];
  return syllables
    .map((s, i) => (i === 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s))
    .join("");
}

// 拼音為自動化最佳近似(非官方羅馬拼音權威來源,如「臺北」轉出「Taibei」而非郵政式「Taipei」)。
export function romanizePlaceName(name: string, lang: Language): string {
  if (lang === "zh") return name;
  const cached = cache.get(name);
  if (cached !== undefined) return cached;
  const hit = SUFFIX_MAP.find(([suffix]) => name.length > suffix.length && name.endsWith(suffix));
  const result = hit ? `${toPinyinWord(name.slice(0, -1))} ${hit[1]}` : toPinyinWord(name);
  cache.set(name, result);
  return result;
}
