import { useEffect, useMemo, useState } from "react";
import { useAppState } from "../state/AppStateContext";
import { useLanguage } from "../state/LanguageContext";
import { groupByRegion, filterBySearch } from "../lib/selection";
import { formatCountryDisplayName } from "../lib/countryDisplayName";
import { YEAR_MIN, YEAR_MAX } from "../lib/playback";
import type { CountryMeta, Region } from "../data/types";

export function CountryChecklist({ countries }: { countries: CountryMeta[] }) {
  const { state, dispatch } = useAppState();
  const { lang, t } = useLanguage();
  const [query, setQuery] = useState("");
  // 老師回饋:初始狀態只顯示各大洲標題,國家清單先收合——使用者要看某洲才點開,
  // 不用一打開就面對 195 國的長清單。
  const [collapsed, setCollapsed] = useState<Record<Region, boolean>>({
    asia: true,
    europe: true,
    africa: true,
    americas: true,
    oceania: true,
  });

  // 使用者要求:搜尋國家下方加「輸入特定年份」功能——跟底部時間軸的年份是同一份
  // state(state.currentYear),輸入框只是另一個入口,不重複管理年份。本地字串 state
  // 讓使用者能自由清空/刪字重打(不會被立刻夾回範圍卡住輸入),失焦或按 Enter 才
  // 真正 commit(夾進 [YEAR_MIN,YEAR_MAX]、四捨五入成整數)。播放中或拖動下方滑桿
  // 改了 currentYear 時,這裡也要跟著同步顯示(不能只在掛載時讀一次)。
  // 8/7 平滑播放:currentYear 播放中是小數,輸入框同步顯示取 floor(不出現 1987.43…)。
  // 8/17 修正:dep 必須綁「整數年」而非 currentYear 本身——播放中 currentYear 每個
  // rAF 幀都變,effect 每幀 setState(且播放中恆有下一幀更新排隊,React 的同值
  // eager bailout 不生效),連續 50 次 passive flush 都排程更新就觸發
  // 「Maximum update depth exceeded」警告(每 ~1 秒一次)。綁 floor 後每年才跑一次。
  const displayYear = Math.floor(state.currentYear);
  const [yearInput, setYearInput] = useState(String(displayYear));
  useEffect(() => {
    setYearInput(String(displayYear));
  }, [displayYear]);
  const commitYear = () => {
    const parsed = Number(yearInput);
    if (!Number.isFinite(parsed)) {
      setYearInput(String(Math.floor(state.currentYear)));
      return;
    }
    const clamped = Math.min(YEAR_MAX, Math.max(YEAR_MIN, Math.round(parsed)));
    dispatch({ type: "STOP_PLAYING" });
    dispatch({ type: "SET_YEAR", year: clamped });
    setYearInput(String(clamped));
  };

  const filtered = useMemo(() => filterBySearch(countries, query), [countries, query]);
  const groups = useMemo(() => groupByRegion(filtered), [filtered]);

  // 使用者要求:搜尋框/年份輸入/全選/全不選這幾個控制項不要跟著下面的國家清單一起
  // 捲動——原本整塊(控制項+清單)共用同一個 overflow-y-auto 容器,清單一長,控制項
  // 就被捲出畫面外,每次要搜尋或改年份都得先捲回頂端。拆成兩段:控制項獨立一個
  // shrink-0 區塊(不參與捲動),只有下面的洲別分組清單放進真正會捲動的容器。
  return (
    <div className="flex flex-col h-full text-sm">
      <div className="shrink-0 p-3 pb-1">
        <input
          type="text"
          placeholder={t.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="app-input mb-2 px-2 py-1 w-full"
          // 使用者 8/4 回饋:搜尋框跑出卡片外——原本這排控制項直接是外層 flex 容器
          // 的子元素,靠 flexbox 預設的 align-items:stretch 自動撐滿寬度;拆出獨立的
          // shrink-0 標頭區塊(見上方註解)後,input 變成一般 block 容器裡的子元素,
          // 不再自動 stretch,退回瀏覽器對 <input> 的內建預設寬度(比容器窄或寬,
          // 兩種情況都有可能),要自己補 w-full + border-box 才會乖乖貼齊容器寬度。
          style={{
            boxSizing: "border-box",
            borderRadius: 9,
            border: "1px solid var(--color-border)",
            fontSize: 13,
            color: "var(--color-text)",
            background: "var(--color-surface)",
          }}
        />
        <label className="mb-2 flex items-center gap-2" style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
          {t.yearInputLabel}
          {/* 自畫 spinner(使用者 8/17,比照國小圖集):原生箭頭深色模式冒亮白色塊且
              底色不可自訂 → 隱藏原生(index.css)、透明底 ±1 箭頭直接透出輸入框底色;
              到 YEAR_MIN/MAX 端點停用 */}
          <span className="relative inline-block">
            <input
              type="number"
              min={YEAR_MIN}
              max={YEAR_MAX}
              step={1}
              value={yearInput}
              onChange={(e) => setYearInput(e.target.value)}
              onBlur={commitYear}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className="app-input px-2 py-1"
              style={{
                width: 76,
                boxSizing: "border-box",
                paddingRight: 22,
                borderRadius: 9,
                border: "1px solid var(--color-border)",
                fontSize: 13,
                color: "var(--color-text)",
                background: "var(--color-surface)",
              }}
            />
            <span className="absolute flex flex-col justify-center" style={{ right: 5, top: 0, bottom: 0 }}>
              {([1, -1] as const).map((d) => {
                const target = Math.floor(state.currentYear) + d;
                const disabled = target < YEAR_MIN || target > YEAR_MAX;
                return (
                  <button
                    key={d}
                    type="button"
                    className="year-spin"
                    tabIndex={-1}
                    disabled={disabled}
                    aria-label={`${t.yearInputLabel} ${d > 0 ? "+1" : "-1"}`}
                    onClick={() => {
                      dispatch({ type: "STOP_PLAYING" });
                      dispatch({ type: "SET_YEAR", year: target });
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 14,
                      height: 10,
                      padding: 0,
                      background: "transparent",
                      border: "none",
                      color: "var(--color-text-muted)",
                      cursor: "pointer",
                    }}
                  >
                    <svg width="8" height="5" viewBox="0 0 8 5" aria-hidden focusable="false">
                      <polygon points={d > 0 ? "4,0 8,5 0,5" : "4,5 0,0 8,0"} fill="currentColor" />
                    </svg>
                  </button>
                );
              })}
            </span>
          </span>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => dispatch({ type: "SELECT_ALL", countries })}
            className="app-btn px-2 py-1"
            style={{
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              fontSize: 12.5,
              color: "var(--color-text)",
              background: "var(--color-surface)",
            }}
          >
            {t.selectAll}
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "DESELECT_ALL" })}
            className="app-btn px-2 py-1"
            style={{
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              fontSize: 12.5,
              color: "var(--color-text)",
              background: "var(--color-surface)",
            }}
          >
            {t.deselectAll}
          </button>
        </div>
      </div>
      <div className="app-scroll flex-1 min-h-0 overflow-y-auto px-3 pb-3">
      {(Object.keys(groups) as Region[]).map((region) => {
        const list = groups[region];
        if (list.length === 0) return null;
        const allSelected = list.every((c) => state.selectedCountries.has(c.geo));
        return (
          <div key={region} className="mb-2">
            <div
              className="flex items-center gap-2"
              style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text)" }}
            >
              <button
                type="button"
                onClick={() => setCollapsed((prev) => ({ ...prev, [region]: !prev[region] }))}
                style={{ color: "var(--color-text-muted)" }}
              >
                {collapsed[region] ? "▶" : "▼"}
              </button>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_REGION",
                      region,
                      countries: list,
                      selected: e.target.checked,
                    })
                  }
                />
                <span>{t.regions[region]}</span>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--accent)",
                    background: "var(--accent-soft)",
                    borderRadius: 999,
                    padding: "1px 7px",
                  }}
                >
                  {list.length}
                </span>
              </label>
            </div>
            {!collapsed[region] && (
              <ul className="ml-6">
                {list.map((c) => (
                  <li
                    key={c.geo}
                    onMouseEnter={() => dispatch({ type: "SET_HOVERED", geo: c.geo })}
                    onMouseLeave={() => dispatch({ type: "SET_HOVERED", geo: null })}
                    className="app-row-hover rounded"
                    style={{
                      backgroundColor:
                        state.hoveredCountry === c.geo ? "var(--accent-soft)" : "transparent",
                      transition: "background-color 150ms ease",
                    }}
                  >
                    <label
                      className="flex items-center gap-1.5 px-1 py-0.5"
                      style={{ fontSize: 13 }}
                      title={c.name}
                    >
                      <input
                        type="checkbox"
                        checked={state.selectedCountries.has(c.geo)}
                        onChange={() => dispatch({ type: "TOGGLE_COUNTRY", geo: c.geo })}
                      />
                      {formatCountryDisplayName(c.name, c.iso2, lang)}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
