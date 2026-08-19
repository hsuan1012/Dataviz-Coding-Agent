import { createContext, useContext, useState, type ReactNode } from "react";
import { resolveTheme } from "./designs";
// 深淺主題 token context。t.accent / t.bg 等來自當前深淺；t.dark / t.toggle 供深色模式鈕使用。
const ThemeCtx = createContext<any>(resolveTheme(false));
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(false);
  const theme = resolveTheme(dark);
  return (
    <ThemeCtx.Provider value={{ ...theme, dark, toggle: () => setDark((v) => !v) }}>
      {children}
    </ThemeCtx.Provider>
  );
}
export const useTokens = () => useContext(ThemeCtx);
