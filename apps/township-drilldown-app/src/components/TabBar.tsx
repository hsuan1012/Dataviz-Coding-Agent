import { typography as __ty } from "../lib/styleDictionary";
const S = __ty.sizes; // type scale:字級一律具名(見 styleDictionary)
import { useTokens } from "../lib/useTokens";
import type { Meta, IndicatorKey } from "../lib/data";
// 指標選擇列（人口密度/平均所得/死亡率）＝X 軸/著色指標；檢視切換（分區排名×地圖｜關係）在標題旁 TitleToggle。
export type TabKey = "main" | "scatter";

export default function TabBar({ indicator, meta, onIndicator }: {
  indicator: IndicatorKey; meta: Meta; onIndicator: (k: IndicatorKey) => void;
}) {
  const t = useTokens();
  return (
    <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${t.border}`, marginBottom: 16, flexWrap: "wrap" }}>
      {meta.indicators.map((i) => {
        const on = indicator === i.key;
        return (
          <button key={i.key} className="tab-btn" onClick={() => onIndicator(i.key as IndicatorKey)} style={{
            padding: "8px 16px", border: "none", cursor: "pointer", fontSize: S.body,
            background: "transparent", color: on ? t.accent : t.textMuted,
            borderBottom: `2px solid ${on ? t.accent : "transparent"}`, fontWeight: on ? 600 : 400,
          }}>{i.label}</button>
        );
      })}
    </div>
  );
}
