export const YEAR_MIN = 1950;
// 老師回饋:時間軸終點設為 2019,忽略 2020 之後的資料——原始資料 2020 年起有些指標
// (如少數微型國家的平均餘命)只剩推估值、且推估覆蓋不齊(見已移除的 yearGapNote 說明),
// 直接把時間軸上限收在最後一個完整年份,避免使用者滑到後面遇到資料缺口。
export const YEAR_MAX = 2019;

export function playStartYear(current: number): number {
  if (current >= YEAR_MAX) return YEAR_MIN;
  return current;
}

// 8/7 老師回饋:播放改 rAF 連續推進小數年份(取代 setInterval 每 400ms 跳一整年)。
// 速度維持原本觀感:400ms/年 = 每秒 2.5 年,總時長不變。
export const YEARS_PER_SEC = 2.5;

export function advancePlayback(
  current: number,
  dtSec: number,
  yearsPerSec: number
): { year: number; done: boolean } {
  const next = current + dtSec * yearsPerSec;
  if (next >= YEAR_MAX) return { year: YEAR_MAX, done: true };
  return { year: next, done: false };
}
