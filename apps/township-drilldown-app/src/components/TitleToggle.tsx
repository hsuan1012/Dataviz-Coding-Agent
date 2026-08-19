import { typography as __ty, components as C } from "../lib/styleDictionary";
const S = __ty.sizes; // type scale:字級一律具名(見 styleDictionary)
import { useTokens } from "../lib/useTokens";
import type { TabKey } from "./TabBar";

// 標題旁的檢視切換：分區排名×地圖 ｜ 關係（散布圖）。關係圖的 X 軸＝當前指標。
// 7/23 使用者測試回饋：合體膠囊讀起來像標題徽章，有人不知可點。拆成兩顆獨立膠囊按鈕
// （呼應年份選擇器的「可點膠囊」既有語言），未選中者白底＋邊框，hover 轉青綠並微浮起。
export default function TitleToggle({ tab, onMain, onScatter }: {
  tab: TabKey; onMain: () => void; onScatter: () => void;
}) {
  const t = useTokens();
  const seg = (on: boolean) => ({
    cursor: "pointer", fontSize: S.subtitle, padding: "7px 16px", borderRadius: C.pill.radius,
    border: `1.5px solid ${on ? t.accent : t.border}`,
    background: on ? t.accent : t.surface,
    color: on ? t.accentFg : t.text,
    fontWeight: on ? 700 : 600,
  } as const);
  return (
    <div role="tablist" aria-label="檢視" style={{ display: "inline-flex", alignItems: "center",
      gap: 10, verticalAlign: "middle" }}>
      <button role="tab" aria-selected={tab === "main"} className="view-toggle" onClick={onMain} style={seg(tab === "main")}>分區排名 × 地圖</button>
      <button role="tab" aria-selected={tab === "scatter"} className="view-toggle" onClick={onScatter} style={seg(tab === "scatter")}>關係</button>
    </div>
  );
}
