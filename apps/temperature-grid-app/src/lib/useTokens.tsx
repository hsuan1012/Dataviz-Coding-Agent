import { createContext, useContext, useState, type ReactNode } from "react";
import { themes } from "./styleDictionary.js";
// 方向 A 雙主題 token context。t.accent / t.textMuted / t.bg / t.text 皆來自字典當前主題。
const ThemeCtx = createContext<any>(themes.light);
export function ThemeProvider({ children }: { children: ReactNode }) {
  // 預設淺色
  const [dark, setDark] = useState(false);
  const theme = dark ? themes.dark : themes.light;
  return <ThemeCtx.Provider value={{ ...theme, dark, toggle: () => setDark((v) => !v) }}>{children}</ThemeCtx.Provider>;
}
export const useTokens = () => useContext(ThemeCtx);
