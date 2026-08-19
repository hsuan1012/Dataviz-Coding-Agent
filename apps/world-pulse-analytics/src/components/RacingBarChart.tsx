import { useMemo } from "react";
import { useAppState } from "../state/AppStateContext";
import { useTheme } from "../state/ThemeContext";
import { useLanguage } from "../state/LanguageContext";
import { getTopN, formatRacingValue, type RacingMetric } from "../lib/racingBars";
import { colorForRegion } from "../lib/regionColors";
import { formatCountryDisplayName } from "../lib/countryDisplayName";
import type { CountryMeta, YearRecord } from "../data/types";

const TOP_N = 5;
// 26px：配合外層固定高度的緊湊條狀區（h-48 左右），5 列都要塞得下。
const ROW_HEIGHT = 26;
// 老師回饋:「全不選」狀態長條圖改深灰色——排名卡本來就不受勾選清單篩選(見 App.tsx
// RankRow 直接傳全部 countries/records),這裡只是配色跟著地球儀/散布圖的中性狀態呼應。
const NEUTRAL_BAR_COLOR = "#4B5563";

export function RacingBarChart({
  title,
  countries,
  records,
  metric,
}: {
  title: string;
  countries: CountryMeta[];
  records: YearRecord[];
  metric: RacingMetric;
}) {
  const { state } = useAppState();
  const { dark } = useTheme();
  const { lang } = useLanguage();
  const isNeutral = state.selectedCountries.size === 0;

  // 8/7 平滑播放:currentYear 播放中是小數,records 只有整數年——排名卡取 floor 查表
  // (維持逐年跳+既有 CSS transition,平滑化不在本次範圍)。
  const rankYear = Math.floor(state.currentYear);
  const ranked = useMemo(
    () => getTopN(countries, records, rankYear, metric, TOP_N),
    [countries, records, rankYear, metric]
  );

  const maxValue = ranked[0]?.value ?? 1;

  return (
    <div
      className="rounded-lg shadow-sm p-2 h-full flex flex-col min-h-0"
      style={{ background: "var(--color-surface)" }}
    >
      <h3
        className="text-sm font-bold mb-1 truncate shrink-0"
        style={{ color: "var(--color-text)" }}
        title={title}
      >
        {title}
      </h3>
      <div
        className="flex-1 relative min-h-0 overflow-hidden"
        style={{ minHeight: TOP_N * ROW_HEIGHT }}
      >
        {ranked.map((item, index) => (
          <div
            key={item.geo}
            className="absolute left-0 right-0 flex items-center gap-1.5"
            // title 掛整列而非只掛窄小的國名 span:滑鼠停在列上任一處都能看到英文原名
            // (與左側勾選清單的 label 行為一致,7/31 使用者回饋)
            title={item.name}
            style={{
              top: 0,
              height: ROW_HEIGHT,
              transform: `translateY(${index * ROW_HEIGHT}px)`,
              transition: "transform 500ms ease",
            }}
          >
            <span className="w-3.5 text-right text-xs" style={{ color: "var(--color-text-muted)" }}>
              {index + 1}
            </span>
            <span
              className="w-16 truncate text-xs"
              style={{ color: "var(--color-text)" }}
              title={item.name}
            >
              {formatCountryDisplayName(item.name, item.iso2, lang)}
            </span>
            <div
              className="flex-1 h-2.5 rounded"
              style={{ background: "var(--color-border)", minWidth: 24 }}
            >
              <div
                className="h-2.5 rounded"
                style={{
                  width: `${(item.value / maxValue) * 100}%`,
                  background: isNeutral ? NEUTRAL_BAR_COLOR : colorForRegion(item.region, dark),
                  transition: "width 500ms ease",
                }}
              />
            </div>
            <span
              className="w-11 text-right text-xs tabular-nums shrink-0"
              style={{ color: "var(--color-text-muted)" }}
            >
              {formatRacingValue(metric, item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
