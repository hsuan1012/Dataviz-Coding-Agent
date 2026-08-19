import { useAppState } from "../state/AppStateContext";
import { useLanguage } from "../state/LanguageContext";
import { YEAR_MIN, YEAR_MAX, playStartYear } from "../lib/playback";

export function TimeControls() {
  const { state, dispatch } = useAppState();
  const { t } = useLanguage();

  const handlePlayToggle = () => {
    if (!state.isPlaying) {
      dispatch({ type: "SET_YEAR", year: playStartYear(state.currentYear) });
    }
    dispatch({ type: "TOGGLE_PLAYING" });
  };

  return (
    <div className="p-3" style={{ borderTop: "1px solid var(--color-border)" }}>
      <div className="flex items-center gap-3">
        {/* 使用者 8/4 回饋:播放中的圖示看起來沒有置中——⏸/▶ 這兩個 Unicode 符號在不同
            字型/系統下,字符本身的「墨水」在字身框裡的位置就不對稱(尤其 ⏸ 常常偏右),
            光靠 CSS 置中容器救不回來。改用手繪 SVG(比照 ChannelControls.tsx 的放大鏡
            圖示做法),兩個圖形都用同一個 16×16 viewBox 手動置中畫,不受字型影響。 */}
        <button
          type="button"
          onClick={handlePlayToggle}
          className="year-play app-btn-primary px-3 py-1"
          aria-pressed={state.isPlaying}
          aria-label={state.isPlaying ? t.pauseAriaLabel : t.playAriaLabel}
          style={{
            fontSize: 13,
            padding: "4px 14px",
            borderRadius: 999,
            fontFamily: "inherit",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background .15s, border-color .15s, color .15s",
            border: `1px solid ${state.isPlaying ? "var(--accent)" : "var(--color-border)"}`,
            background: state.isPlaying ? "var(--accent)" : "var(--color-surface)",
            color: state.isPlaying ? "var(--accent-fg)" : "var(--color-text)",
          }}
        >
          {state.isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden focusable="false">
              <rect x="4" y="3" width="3" height="10" fill="currentColor" />
              <rect x="9" y="3" width="3" height="10" fill="currentColor" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden focusable="false">
              <polygon points="4,2.5 13,8 4,13.5" fill="currentColor" />
            </svg>
          )}
        </button>
        <input
          type="range"
          min={YEAR_MIN}
          max={YEAR_MAX}
          value={Math.floor(state.currentYear)}
          onChange={(e) => {
            dispatch({ type: "STOP_PLAYING" });
            dispatch({ type: "SET_YEAR", year: Number(e.target.value) });
          }}
          className="year-range flex-1"
          // 8/4 回饋:改自訂軌道後失去瀏覽器原生的「已播放段變 accent 色」效果——
          // 用 CSS 變數把目前進度百分比傳給 index.css 的漸層軌道(inline style 到不了
          // ::-webkit-slider-runnable-track,但自訂屬性會照 CSS 繼承規則傳進去)。
          // 8/7 平滑播放:currentYear 播放中是小數,滑桿(step=1)與年份顯示取 floor 維持整數慣例。
          style={{ ["--range-progress" as string]: `${((Math.floor(state.currentYear) - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100}%` }}
        />
        <span
          className="year-display w-14 text-right tabular-nums"
          style={{ fontSize: 20, fontWeight: 600, color: "var(--color-text)", marginRight: 8 }}
        >
          {Math.floor(state.currentYear)}
        </span>
      </div>
    </div>
  );
}
