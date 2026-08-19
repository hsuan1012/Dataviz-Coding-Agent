import { typography as __ty, components as C } from "../lib/styleDictionary";
const S = __ty.sizes; // type scale:字級一律具名(見 styleDictionary)
import { useTokens } from "../lib/useTokens";
import { useLanguage } from "../state/LanguageContext";

// 年份標籤列：一排可點的「民國102…107」標籤。
// 老師 8/11 回饋:移除自動輪播的 ▶ 播放鈕,只留手動點選年份。
export default function YearTabs({ years, year, onYear }: {
  years: number[]; year: number; onYear: (y: number) => void;
}) {
  const t = useTokens();
  const { tr } = useLanguage();

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, margin: "10px 0 2px" }}>
      <span style={{ fontSize: S.footnote, color: t.textMuted, letterSpacing: "0.04em" }}>{tr.yearSelectLabel}</span>
      <div role="tablist" aria-label={tr.yearTablistAriaLabel} style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 6 }}>
        {years.map((y) => {
          const on = y === year;
          return (
            <button key={y} role="tab" aria-selected={on} className="year-tab"
              onClick={() => onYear(y)}
              style={{
                cursor: "pointer", fontSize: S.control, fontVariantNumeric: "tabular-nums",
                padding: "4px 14px", borderRadius: C.pill.radius,
                border: `1px solid ${on ? t.accent : t.border}`,
                background: on ? t.accent : t.surface,
                color: on ? t.accentFg : t.text,
                fontWeight: on ? 700 : 500,
                transition: "background .15s, border-color .15s, color .15s",
              }}>
              {y}{tr.yearSuffix}
            </button>
          );
        })}
      </div>
    </div>
  );
}
