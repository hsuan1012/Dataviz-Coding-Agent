import { createContext, useContext, useEffect, useReducer, useRef, type ReactNode } from "react";
import { appStateReducer, createInitialState, type AppState, type AppAction } from "./appState";
import { advancePlayback, YEARS_PER_SEC } from "../lib/playback";
import type { CountryMeta } from "../data/types";

interface AppStateContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({
  countries,
  children,
}: {
  countries: CountryMeta[];
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(appStateReducer, countries, createInitialState);

  // 8/7 老師回饋「播放要更連續平滑」:setInterval 每 400ms 跳一整年 → rAF 每幀推進
  // 小數年份(每秒 2.5 年,總時長不變),散布圖吃內插紀錄連續移動。
  // yearRef 鏡射最新年份:effect 依賴只掛 isPlaying(不隨年份重啟),幀迴圈從 ref 讀
  // 當前年份、用真實幀間隔 dt 推進——不受 React render 耗時影響播放速度。
  const yearRef = useRef(state.currentYear);
  yearRef.current = state.currentYear;
  useEffect(() => {
    if (!state.isPlaying) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const { year, done } = advancePlayback(yearRef.current, dt, YEARS_PER_SEC);
      dispatch({ type: "SET_YEAR", year });
      if (done) {
        dispatch({ type: "STOP_PLAYING" });
      } else {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state.isPlaying]);

  return (
    <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>
  );
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
