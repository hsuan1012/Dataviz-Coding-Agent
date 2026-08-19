import { createContext, useContext, useState, type ReactNode } from "react";
import { translations, type Dict, type Language } from "../lib/i18n";

interface LanguageValue {
  lang: Language;
  tr: Dict;
  toggle: () => void;
}

const LanguageContext = createContext<LanguageValue | null>(null);

// 比照 useTokens.tsx 深色模式 state 的寫法:純 useState,不持久化——重新整理回到預設中文。
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>("zh");
  return (
    <LanguageContext.Provider value={{ lang, tr: translations[lang], toggle: () => setLang((v) => (v === "zh" ? "en" : "zh")) }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
