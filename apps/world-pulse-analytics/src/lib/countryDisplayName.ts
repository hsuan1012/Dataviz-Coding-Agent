import type { Language } from "./i18n";

const regionNames = new Intl.DisplayNames(["zh-Hant"], { type: "region" });
// 195 國、iso2 只有 195 種可能值：快取避免每次渲染（如 hover 造成整份清單重繪）
// 都重新呼叫 Intl.DisplayNames.of()。
const zhNameCache = new Map<string, string | null>();

function resolveZhName(iso2: string): string | null {
  const cached = zhNameCache.get(iso2);
  if (cached !== undefined) return cached;

  let zhName: string | undefined;
  try {
    zhName = regionNames.of(iso2);
  } catch {
    zhNameCache.set(iso2, null);
    return null;
  }
  // Intl.DisplayNames 對無法辨識的代碼有時會原樣回傳輸入值而非拋錯，
  // 這種情況視同「查無中文名」，一律退回英文原名，確保清單不會出現空白列。
  const resolved = !zhName || zhName === iso2 ? null : zhName;
  zhNameCache.set(iso2, resolved);
  return resolved;
}

// 8/4 使用者要求語言切換鈕:英文模式下直接用原始英文名(raw data 本來就是英文),
// 不查中文;lang 預設 "zh" 保留呼叫端省略時的原行為(向下相容既有呼叫點/測試)。
export function formatCountryDisplayName(name: string, iso2: string, lang: Language = "zh"): string {
  if (lang === "en") return name;
  if (!iso2) return name;
  return resolveZhName(iso2) ?? name;
}
