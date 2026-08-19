import { describe, it, expect } from "vitest";
import { playStartYear, advancePlayback, YEAR_MIN, YEAR_MAX } from "./playback";

describe("playStartYear", () => {
  it("末年按播放→從頭年重播", () => expect(playStartYear(YEAR_MAX)).toBe(YEAR_MIN));
  it("中段按播放→原年起播", () => expect(playStartYear(2000)).toBe(2000));
});

describe("advancePlayback", () => {
  it("依 dt×速度推進小數年份", () =>
    expect(advancePlayback(2000, 0.4, 2.5)).toEqual({ year: 2001, done: false }));
  it("半格 dt 推進半年", () =>
    expect(advancePlayback(2000, 0.2, 2.5)).toEqual({ year: 2000.5, done: false }));
  it("到 YEAR_MAX 夾住並回報 done", () =>
    expect(advancePlayback(YEAR_MAX - 0.1, 1, 2.5)).toEqual({ year: YEAR_MAX, done: true }));
  it("dt=0 原地不動", () =>
    expect(advancePlayback(2000, 0, 2.5)).toEqual({ year: 2000, done: false }));
});
