import type { CountryMeta, Region } from "../data/types";
import { toggleCountry, setRegionSelection } from "../lib/selection";
import { YEAR_MAX } from "../lib/playback";
import type { ScatterChannels } from "../lib/channels";
import { DEFAULT_CHANNELS, patchChannels } from "../lib/channels";

export type FocusMode = "select" | "clear" | null;

// U19 縮放範圍:X/Y 軸暫時的資料值範圍(純視覺,不影響 focusSelection)。
// 8/4 使用者要求改用滑鼠滾輪縮放(取代原本的放大鏡框選模式,見 BubbleChart.tsx 的
// wheel effect)——兩軸各自獨立,滾輪縮小到超出某一軸的完整範圍時,那一軸自己先變回
// null(退回該指標原本的固定刻度/對數刻度),不再像框選版本一定兩軸同進退,所以
// SET_ZOOM_DOMAIN 兩個欄位都各自允許 null。
export interface ZoomDomain {
  x: [number, number] | null;
  y: [number, number] | null;
}

export interface AppState {
  selectedCountries: Set<string>;
  hoveredCountry: string | null;
  currentYear: number;
  isPlaying: boolean;
  focusSelection: Set<string>;
  focusMode: FocusMode;
  channels: ScatterChannels;
  zoomDomain: ZoomDomain;
}

export type AppAction =
  | { type: "TOGGLE_COUNTRY"; geo: string }
  | { type: "SET_REGION"; region: Region; countries: CountryMeta[]; selected: boolean }
  | { type: "SELECT_ALL"; countries: CountryMeta[] }
  | { type: "DESELECT_ALL" }
  | { type: "SET_HOVERED"; geo: string | null }
  | { type: "SET_YEAR"; year: number }
  | { type: "TOGGLE_PLAYING" }
  | { type: "STOP_PLAYING" }
  | { type: "SET_FOCUS_MODE"; mode: FocusMode }
  | { type: "BRUSH_APPLY"; geos: string[] }
  | { type: "FOCUS_ADD"; geo: string }
  | { type: "FOCUS_REMOVE"; geo: string }
  | { type: "FOCUS_TOGGLE"; geo: string }
  | { type: "FOCUS_CLEAR" }
  | { type: "SET_CHANNELS"; patch: Partial<ScatterChannels> }
  | { type: "SET_ZOOM_DOMAIN"; x: [number, number] | null; y: [number, number] | null }
  | { type: "EXIT_ZOOM" };

// 顯示範圍優先:勾選清單縮小時,focus 名單只留仍顯示的國家(spec §3)。
function pruneFocus(focus: Set<string>, displayed: Set<string>): Set<string> {
  if (focus.size === 0) return focus;
  const next = new Set([...focus].filter((g) => displayed.has(g)));
  return next.size === focus.size ? focus : next;
}

export function createInitialState(countries: CountryMeta[]): AppState {
  return {
    selectedCountries: new Set(countries.map((c) => c.geo)),
    hoveredCountry: null,
    // 使用者 8/17：初始停在最新一年（2019）——開站先看最新現況，按播放才從 1950 跑起
    currentYear: YEAR_MAX,
    isPlaying: false,
    focusSelection: new Set(),
    focusMode: null,
    channels: DEFAULT_CHANNELS,
    zoomDomain: { x: null, y: null },
  };
}

export function appStateReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "TOGGLE_COUNTRY": {
      const selectedCountries = toggleCountry(state.selectedCountries, action.geo);
      return {
        ...state,
        selectedCountries,
        focusSelection: pruneFocus(state.focusSelection, selectedCountries),
      };
    }
    case "SET_REGION": {
      const selectedCountries = setRegionSelection(
        state.selectedCountries,
        action.countries,
        action.region,
        action.selected
      );
      return {
        ...state,
        selectedCountries,
        focusSelection: pruneFocus(state.focusSelection, selectedCountries),
      };
    }
    case "SELECT_ALL":
      return { ...state, selectedCountries: new Set(action.countries.map((c) => c.geo)) };
    case "DESELECT_ALL":
      return { ...state, selectedCountries: new Set(), focusSelection: new Set() };
    case "SET_HOVERED":
      return { ...state, hoveredCountry: action.geo };
    case "SET_YEAR":
      return { ...state, currentYear: action.year };
    case "TOGGLE_PLAYING":
      return { ...state, isPlaying: !state.isPlaying };
    case "STOP_PLAYING":
      return { ...state, isPlaying: false };
    case "SET_FOCUS_MODE":
      return { ...state, focusMode: action.mode === state.focusMode ? null : action.mode };
    case "BRUSH_APPLY": {
      if (state.focusMode === null || action.geos.length === 0) return state;
      const next = new Set(state.focusSelection);
      for (const g of action.geos) {
        if (state.focusMode === "select") next.add(g);
        else next.delete(g);
      }
      return { ...state, focusSelection: next };
    }
    case "FOCUS_ADD": {
      if (state.focusSelection.has(action.geo)) return state;
      return { ...state, focusSelection: new Set(state.focusSelection).add(action.geo) };
    }
    case "FOCUS_REMOVE": {
      if (!state.focusSelection.has(action.geo)) return state;
      const next = new Set(state.focusSelection);
      next.delete(action.geo);
      return { ...state, focusSelection: next };
    }
    case "FOCUS_TOGGLE":
      return state.focusSelection.has(action.geo)
        ? appStateReducer(state, { type: "FOCUS_REMOVE", geo: action.geo })
        : appStateReducer(state, { type: "FOCUS_ADD", geo: action.geo });
    case "FOCUS_CLEAR":
      return state.focusSelection.size === 0 ? state : { ...state, focusSelection: new Set() };
    case "SET_CHANNELS": {
      const channels = patchChannels(state.channels, action.patch);
      if (channels === state.channels) return state;
      // 換 X/Y 指標時縮放範圍自動還原(舊範圍是針對舊指標的資料值,換了指標就沒意義);
      // 只換顏色/大小不動 X/Y 軸,縮放範圍原樣保留。
      const xyChanged = channels.x !== state.channels.x || channels.y !== state.channels.y;
      const zoomDomain = xyChanged && (state.zoomDomain.x !== null || state.zoomDomain.y !== null)
        ? { x: null, y: null }
        : state.zoomDomain;
      return { ...state, channels, zoomDomain };
    }
    case "SET_ZOOM_DOMAIN":
      return { ...state, zoomDomain: { x: action.x, y: action.y } };
    case "EXIT_ZOOM": {
      // 雙擊圖表空白處的還原手勢(見 BubbleChart.tsx onSvgDoubleClick):清空兩軸縮放
      // 範圍,一次還原成全範圍。8/4 改滾輪縮放後,兩軸各自的縮小-到-null 已經在
      // SET_ZOOM_DOMAIN 裡處理(見 scatterZoom.ts zoomDomain),這裡單純是「整個重來」
      // 的一次性出口,不用再管 focusMode(滾輪縮放不是獨立模式,不會互斥掉 select/clear)。
      if (state.zoomDomain.x === null && state.zoomDomain.y === null) return state;
      return { ...state, zoomDomain: { x: null, y: null } };
    }
    default:
      return state;
  }
}
