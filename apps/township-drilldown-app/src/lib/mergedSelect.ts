// 合併單頁「下鑽=整縣選取」狀態轉移(B 案,spec 五條規則)。
// {view, selected} 的唯一變更入口:地圖點擊/麵包屑/hash 走 applyView,
// 散布圖框選走 applyBrush,雙擊剔除走 applyExclude。純函式,App 只負責 setState+hash 同步。
import { NATION, type View } from "./nav";
import { excludeFromSelection } from "./brushSelect";

export interface NavSel { view: View; selected: string[] | null }

// 視圖目標 → 選取跟著層級走:全國=清除、縣=整縣鄉鎮、村里層=單鄉鎮
export function applyView(_s: NavSel, target: View, townsOfCounty: (c: string) => string[]): NavSel {
  if (target.level === "nation") return { view: NATION, selected: null };
  if (target.level === "county") return { view: target, selected: townsOfCounty(target.county!) };
  return { view: target, selected: target.town ? [target.town] : null };
}

// 框選=只選取不下鑽:一律退回全國層(最後動作贏);空名單=清除
export function applyBrush(_s: NavSel, list: string[] | null): NavSel {
  return { view: NATION, selected: list && list.length ? list : null };
}

// 雙擊剔除=編輯名單不動 view;無變更回原物件(setState 短路);剔到空=回未選取+回全國
export function applyExclude(s: NavSel, township: string): NavSel {
  const next = excludeFromSelection(s.selected, township);
  if (next === s.selected) return s;
  return next ? { view: s.view, selected: next } : { view: NATION, selected: null };
}
