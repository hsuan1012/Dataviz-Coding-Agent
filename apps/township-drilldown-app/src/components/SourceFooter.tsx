import { typography as __ty } from "../lib/styleDictionary";
const S = __ty.sizes; // type scale:字級一律具名(見 styleDictionary)
import { useTokens } from "../lib/useTokens";
import { useLanguage } from "../state/LanguageContext";

// 資料來源聲明（參考 taiwanvotes.tw 的 footer 誠實揭露），兩套外殼共用
export default function SourceFooter() {
  const t = useTokens();
  const { tr } = useLanguage();
  return (
    <footer style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${t.border}`, fontSize: S.footnote, color: t.textMuted, lineHeight: 1.7 }}>
      {tr.sourceFooterText}
    </footer>
  );
}
