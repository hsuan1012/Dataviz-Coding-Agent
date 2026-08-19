import { themes } from "./styleDictionary.js";

// 使用者 8/11 要求:方向 A 舊外殼(切換器已隱藏多時、正式功能只剩 Taste)整個移除，
// 這裡只留「深淺主題」這一軸，不再有設計版型切換。
export function resolveTheme(dark: boolean) {
  return dark ? themes.dark : themes.light;
}
