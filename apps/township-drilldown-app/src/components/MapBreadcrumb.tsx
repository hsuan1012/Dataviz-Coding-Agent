import { typography as __ty, components as C } from "../lib/styleDictionary";
const S = __ty.sizes; // type scale:字級一律具名(見 styleDictionary)
import { useTokens } from "../lib/useTokens";
import { useLanguage } from "../state/LanguageContext";
import { romanizePlaceName } from "../lib/placeName";
import { crumbs, type View } from "../lib/nav";
import type { Meta } from "../lib/data";

// 下鑽麵包屑（全國 › 縣 › 鄉鎮…）＋操作提示＋降級通知。
// 7/14 依使用者要求：放在標題下方、排名/地圖之上（原本在地圖上方右半邊）。
export default function MapBreadcrumb({ view, meta, villagesLoading, notice, onView, onDismissNotice }: {
  view: View; meta: Meta; villagesLoading: boolean; notice: string | null;
  onView: (v: View) => void; onDismissNotice: () => void;
}) {
  const t = useTokens();
  const { lang, tr } = useLanguage();
  const trail = crumbs(view);
  const crumbLabel = (label: string, i: number) => (i === 0 ? tr.nationLabel : romanizePlaceName(label, lang));
  const hints: Record<string, string> = {
    nation: tr.hintNation,
    county: tr.hintCounty,
    town: tr.hintTown,
  };
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: S.caption, color: t.textMuted, flexWrap: "wrap" }}>
        <nav aria-label={tr.breadcrumbNavAriaLabel} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {trail.map((c, i) => {
            const last = i === trail.length - 1;
            return (
              <span key={c.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {i > 0 && <span aria-hidden>›</span>}
                {last ? <b style={{ color: t.text }}>{crumbLabel(c.label, i)}</b> : (
                  <button className="icon-btn crumb-btn" onClick={() => onView(c.view)}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: t.accent, fontSize: S.caption, textDecoration: "underline" }}>
                    {crumbLabel(c.label, i)}
                  </button>
                )}
              </span>
            );
          })}
        </nav>
        <span>{hints[view.level]}</span>
        {villagesLoading && <span>{tr.villageDataLoading}</span>}
      </div>
      {notice && (
        <div role="status" style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, padding: "7px 12px",
          background: t.surfaceAlt, border: `1px solid ${t.accent}`, borderRadius: C.control.radius, fontSize: S.caption, color: t.text, width: "fit-content" }}>
          <span>{notice}</span>
          <button className="icon-btn" onClick={onDismissNotice} aria-label={tr.closeNoticeAriaLabel}
            style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, fontSize: S.body, lineHeight: 1 }}>×</button>
        </div>
      )}
    </div>
  );
}
