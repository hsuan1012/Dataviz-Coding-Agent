import type { Meta, IndicatorKey } from "./data";

// 三層下鑽導覽模型：view.level 是「目前所在層」，地圖著色的是下一層行政區
// （nation 畫縣市、county 畫鄉鎮、town 畫村里）。
export type ViewLevel = "nation" | "county" | "town";
export interface View {
  level: ViewLevel;
  county: string | null;   // 縣市名（如 臺北市）
  town: string | null;     // 鄉鎮 FULLNAME（如 臺北市北投區）
  towncode: string | null; // TOWNCODE，村里檔檔名
}

export const NATION: View = { level: "nation", county: null, town: null, towncode: null };

export function drillToCounty(county: string): View {
  return { level: "county", county, town: null, towncode: null };
}

export function drillToTown(view: View, townFullname: string, towncode: string): View {
  return { level: "town", county: view.county, town: townFullname, towncode };
}

export function up(view: View): View {
  if (view.level === "town" && view.county) return drillToCounty(view.county);
  return NATION;
}

// 各 view 層著色用的「資料層級」（meta.indicators[].levels / breaksByLevel 的鍵）
export type DataLevel = "county" | "town" | "village";
export function dataLevelOf(view: View): DataLevel {
  return view.level === "nation" ? "county" : view.level === "county" ? "town" : "village";
}

export function crumbs(view: View): { label: string; view: View }[] {
  const out = [{ label: "全國", view: NATION }];
  if (view.county) out.push({ label: view.county, view: drillToCounty(view.county) });
  if (view.level === "town" && view.town && view.towncode)
    out.push({ label: view.county ? view.town.replace(view.county, "") : view.town, view });
  return out;
}

// --- URL hash 同步（瀏覽器上一頁/下一頁、重新整理、分享網址皆保留下鑽位置）---
// 格式：""（全國）、#/臺中市（縣）、#/臺中市/和平區（區）。FULLNAME = 縣名+區名。
export function viewToHash(view: View): string {
  if (view.level === "nation" || !view.county) return "";
  if (view.level === "county") return "#/" + encodeURIComponent(view.county);
  const townName = view.town && view.county ? view.town.replace(view.county, "") : "";
  return "#/" + encodeURIComponent(view.county) + "/" + encodeURIComponent(townName);
}

// townIndex: FULLNAME → TOWNCODE（村里檔檔名）。區名查不到 towncode 時停在縣層。
export function hashToView(hash: string, townIndex: Map<string, string>): View {
  if (!hash.startsWith("#/")) return NATION;
  const parts = hash.slice(2).split("/").map((s) => decodeURIComponent(s)).filter(Boolean);
  if (parts.length === 0) return NATION;
  const county = parts[0];
  if (parts.length === 1) return drillToCounty(county);
  const full = county + parts[1];
  const towncode = townIndex.get(full);
  return towncode ? drillToTown(drillToCounty(county), full, towncode) : drillToCounty(county);
}

export function sameView(a: View, b: View): boolean {
  return a.level === b.level && a.county === b.county && a.town === b.town && a.towncode === b.towncode;
}

export function indicatorAvailable(meta: Meta, key: IndicatorKey, view: View): boolean {
  const ind = meta.indicators.find((i) => i.key === key);
  return !!ind?.levels?.includes(dataLevelOf(view));
}

// 進入村里層時死亡率無資料 → 自動降級為人口密度並回報 downgraded 供 UI 提示
export function effectiveIndicator(meta: Meta, key: IndicatorKey, view: View): { key: IndicatorKey; downgraded: boolean } {
  if (indicatorAvailable(meta, key, view)) return { key, downgraded: false };
  return { key: "density", downgraded: true };
}

// 地圖 zoom in/out 動畫方向：nation=0、county=1、town=2。只有「深度」用來判斷方向——
// 換指標/年份/主題/框選會讓 Choropleth 的 effect 重跑，但 view 本身沒變，必須回傳 null 不觸發動畫。
export function depthOf(view: View): number {
  return view.level === "nation" ? 0 : view.level === "county" ? 1 : 2;
}
export type ZoomDirection = "in" | "out" | null;
export function zoomDirection(prev: View, next: View): ZoomDirection {
  const d = depthOf(next) - depthOf(prev);
  if (d > 0) return "in";
  if (d < 0) return "out";
  return null;
}
