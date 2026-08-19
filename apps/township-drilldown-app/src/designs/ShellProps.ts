import type { AllData, IndicatorKey, VillageProps } from "../lib/data";
import type { View } from "../lib/nav";
import type { ScatterChannels } from "../lib/scatterChannels";

export type ShellData = AllData;

// 兩套外殼共用的 props 介面：狀態在 App 頂層，切設計時全部保留（含下鑽位置）。
// 合併單頁後 tab/onMain/onScatter 退役；indicator/deathCause 由 scatter.x 導出（唯讀傳入）。
export interface ShellProps {
  data: ShellData | null;
  indicator: IndicatorKey;                    // = xToIndicator(scatter.x).indicator（全頁指標）
  deathCause: string;                         // = xToIndicator(scatter.x).deathCause
  year: number;
  view: View;
  villages: GeoJSON.FeatureCollection | null; // 村里層圖資（載入中為 null）
  notice: string | null;                      // 指標降級等提示
  selectedVillage: VillageProps | null;       // 村里層點選的里（資訊面板用）
  scatter: ScatterChannels;                   // 四通道（X/Y/大小/顏色，crossfilter）
  selected: string[] | null;                  // 選取鄉鎮名單(null=無;下鑽=整縣選取)
  onSelect: (s: string[] | null) => void;     // 框選/清除（reducer:退回全國）
  onExcludeTown: (township: string) => void;  // 雙擊剔除（reducer:不動 view）
  onDeathCause: (k: string) => void;          // 相容入口：改 X=該死因
  onIndicator: (k: IndicatorKey) => void;     // 相容入口：改 X=該指標
  onScatterChannel: (patch: Partial<ScatterChannels>) => void; // 改任一通道（部分更新）
  onYear: (y: number) => void;
  onView: (v: View) => void;
  onDismissNotice: () => void;
  onSelectVillage: (v: VillageProps | null) => void;
}
