import { describe, it, expect } from "vitest";
import { createInitialState, appStateReducer } from "./appState";
import type { CountryMeta } from "../data/types";
import { YEAR_MAX } from "../lib/playback";
import { DEFAULT_CHANNELS } from "../lib/channels";

const countries: CountryMeta[] = [
  { geo: "twn", name: "Taiwan", region: "asia", latitude: 23.7, longitude: 121.0, iso2: "TW" },
  { geo: "deu", name: "Germany", region: "europe", latitude: 51.2, longitude: 10.5, iso2: "DE" },
];

describe("createInitialState", () => {
  it("預設全選、年份為 YEAR_MAX（使用者 8/17：初始停在最新的 2019）、未播放、無 hover", () => {
    const state = createInitialState(countries);
    expect(state.selectedCountries).toEqual(new Set(["twn", "deu"]));
    expect(state.currentYear).toBe(YEAR_MAX);
    expect(state.isPlaying).toBe(false);
    expect(state.hoveredCountry).toBeNull();
  });
});

describe("appStateReducer", () => {
  const initial = createInitialState(countries);

  it("TOGGLE_COUNTRY 切換單一國家", () => {
    const next = appStateReducer(initial, { type: "TOGGLE_COUNTRY", geo: "twn" });
    expect(next.selectedCountries.has("twn")).toBe(false);
  });

  it("SET_REGION 整組切換", () => {
    const next = appStateReducer(initial, {
      type: "SET_REGION", region: "asia", countries, selected: false,
    });
    expect(next.selectedCountries.has("twn")).toBe(false);
    expect(next.selectedCountries.has("deu")).toBe(true);
  });

  it("DESELECT_ALL 清空選取", () => {
    const next = appStateReducer(initial, { type: "DESELECT_ALL" });
    expect(next.selectedCountries.size).toBe(0);
  });

  it("SELECT_ALL 全選", () => {
    const empty = appStateReducer(initial, { type: "DESELECT_ALL" });
    const next = appStateReducer(empty, { type: "SELECT_ALL", countries });
    expect(next.selectedCountries).toEqual(new Set(["twn", "deu"]));
  });

  it("SET_HOVERED 設定 hover 國家", () => {
    const next = appStateReducer(initial, { type: "SET_HOVERED", geo: "twn" });
    expect(next.hoveredCountry).toBe("twn");
  });

  it("SET_YEAR 設定年份", () => {
    const next = appStateReducer(initial, { type: "SET_YEAR", year: 2000 });
    expect(next.currentYear).toBe(2000);
  });

  it("TOGGLE_PLAYING 切換播放狀態", () => {
    const next = appStateReducer(initial, { type: "TOGGLE_PLAYING" });
    expect(next.isPlaying).toBe(true);
    const next2 = appStateReducer(next, { type: "TOGGLE_PLAYING" });
    expect(next2.isPlaying).toBe(false);
  });

  it("STOP_PLAYING 強制停止播放", () => {
    const playing = appStateReducer(initial, { type: "TOGGLE_PLAYING" });
    const stopped = appStateReducer(playing, { type: "STOP_PLAYING" });
    expect(stopped.isPlaying).toBe(false);
  });
});

const focusCountries: CountryMeta[] = [
  { geo: "twn", name: "Taiwan", region: "asia", latitude: 0, longitude: 0, iso2: "TW" },
  { geo: "jpn", name: "Japan", region: "asia", latitude: 0, longitude: 0, iso2: "JP" },
  { geo: "fra", name: "France", region: "europe", latitude: 0, longitude: 0, iso2: "FR" },
];

describe("focus 選取層", () => {
  const init = () => createInitialState(focusCountries);

  it("初始:無選取、無模式、預設通道", () => {
    const s = init();
    expect(s.focusSelection.size).toBe(0);
    expect(s.focusMode).toBeNull();
    expect(s.channels).toEqual(DEFAULT_CHANNELS);
  });

  it("SET_FOCUS_MODE:再按同模式=關閉(互斥 toggle)", () => {
    let s = appStateReducer(init(), { type: "SET_FOCUS_MODE", mode: "select" });
    expect(s.focusMode).toBe("select");
    s = appStateReducer(s, { type: "SET_FOCUS_MODE", mode: "clear" });
    expect(s.focusMode).toBe("clear");
    s = appStateReducer(s, { type: "SET_FOCUS_MODE", mode: "clear" });
    expect(s.focusMode).toBeNull();
  });

  it("BRUSH_APPLY:選取模式累加、清除模式累減、無模式不動作", () => {
    let s = appStateReducer(init(), { type: "SET_FOCUS_MODE", mode: "select" });
    s = appStateReducer(s, { type: "BRUSH_APPLY", geos: ["twn", "jpn"] });
    expect([...s.focusSelection].sort()).toEqual(["jpn", "twn"]);
    s = appStateReducer(s, { type: "SET_FOCUS_MODE", mode: "clear" });
    s = appStateReducer(s, { type: "BRUSH_APPLY", geos: ["jpn", "fra"] });
    expect([...s.focusSelection]).toEqual(["twn"]);
    s = appStateReducer(s, { type: "SET_FOCUS_MODE", mode: "clear" }); // 關閉模式
    const before = s.focusSelection;
    s = appStateReducer(s, { type: "BRUSH_APPLY", geos: ["fra"] });
    expect(s.focusSelection).toBe(before); // 無模式=不動作
  });

  it("FOCUS_ADD / FOCUS_REMOVE / FOCUS_TOGGLE / FOCUS_CLEAR", () => {
    let s = appStateReducer(init(), { type: "FOCUS_ADD", geo: "twn" });
    expect(s.focusSelection.has("twn")).toBe(true);
    s = appStateReducer(s, { type: "FOCUS_TOGGLE", geo: "jpn" });
    expect(s.focusSelection.has("jpn")).toBe(true);
    s = appStateReducer(s, { type: "FOCUS_TOGGLE", geo: "jpn" });
    expect(s.focusSelection.has("jpn")).toBe(false);
    s = appStateReducer(s, { type: "FOCUS_REMOVE", geo: "twn" });
    expect(s.focusSelection.size).toBe(0);
    s = appStateReducer(s, { type: "FOCUS_ADD", geo: "twn" });
    s = appStateReducer(s, { type: "FOCUS_CLEAR" });
    expect(s.focusSelection.size).toBe(0);
  });

  it("SET_CHANNELS 走 patchChannels(X=Y 自動對調)", () => {
    const s = appStateReducer(init(), { type: "SET_CHANNELS", patch: { x: "income" } });
    expect(s.channels.x).toBe("income");
    expect(s.channels.y).toBe("lifeExpectancy"); // 原 x 被 y 接手
  });

  it("勾選清單縮小顯示範圍時,focus 名單同步剔除(顯示範圍優先)", () => {
    let s = appStateReducer(init(), { type: "FOCUS_ADD", geo: "twn" });
    s = appStateReducer(s, { type: "FOCUS_ADD", geo: "fra" });
    s = appStateReducer(s, { type: "TOGGLE_COUNTRY", geo: "twn" }); // 取消勾選 twn
    expect(s.focusSelection.has("twn")).toBe(false);
    expect(s.focusSelection.has("fra")).toBe(true);
    s = appStateReducer(s, { type: "DESELECT_ALL" });
    expect(s.focusSelection.size).toBe(0);
  });

  it("SET_YEAR / TOGGLE_PLAYING 不影響 focus 名單(播放中選取保留)", () => {
    let s = appStateReducer(init(), { type: "FOCUS_ADD", geo: "twn" });
    s = appStateReducer(s, { type: "SET_YEAR", year: 1999 });
    s = appStateReducer(s, { type: "TOGGLE_PLAYING" });
    expect(s.focusSelection.has("twn")).toBe(true);
  });
});

// 8/4 使用者要求:散布圖縮放改用滑鼠滾輪(見 lib/scatterZoom.ts + BubbleChart.tsx 的
// wheel effect),取代原本靠框選+獨立「放大」模式的做法——FocusMode 不再有 "zoom",
// SET_ZOOM_DOMAIN/EXIT_ZOOM 這兩個 action 本身還在(縮放範圍還是同一份 state),
// 只是觸發來源從「框選」變成「滾輪」,測試改成直接送這兩個 action 驗證 reducer 行為。
describe("U19 縮放範圍(滑鼠滾輪觸發)", () => {
  const init = () => createInitialState(focusCountries);

  it("初始:zoomDomain 為空", () => {
    const s = init();
    expect(s.zoomDomain).toEqual({ x: null, y: null });
  });

  it("SET_ZOOM_DOMAIN 設定 X/Y 縮放範圍", () => {
    const s = appStateReducer(init(), { type: "SET_ZOOM_DOMAIN", x: [30, 60], y: [1000, 20000] });
    expect(s.zoomDomain).toEqual({ x: [30, 60], y: [1000, 20000] });
  });

  it("SET_ZOOM_DOMAIN 允許單一軸為 null(滾輪縮小超過該軸完整範圍時,那一軸自己先還原)", () => {
    let s = appStateReducer(init(), { type: "SET_ZOOM_DOMAIN", x: [30, 60], y: [1000, 20000] });
    s = appStateReducer(s, { type: "SET_ZOOM_DOMAIN", x: null, y: [1000, 20000] });
    expect(s.zoomDomain).toEqual({ x: null, y: [1000, 20000] });
  });

  it("EXIT_ZOOM 清空縮放範圍(雙擊空白處的一次性重置手勢),不影響 focusMode", () => {
    let s = appStateReducer(init(), { type: "SET_FOCUS_MODE", mode: "select" });
    s = appStateReducer(s, { type: "SET_ZOOM_DOMAIN", x: [30, 60], y: [1000, 20000] });
    s = appStateReducer(s, { type: "EXIT_ZOOM" });
    expect(s.zoomDomain).toEqual({ x: null, y: null });
    expect(s.focusMode).toBe("select"); // EXIT_ZOOM 不再需要理會 focusMode(沒有 zoom 模式互斥了)
  });

  it("EXIT_ZOOM 在無縮放範圍時原樣返回(setState 短路)", () => {
    const s = init();
    expect(appStateReducer(s, { type: "EXIT_ZOOM" })).toBe(s);
  });

  it("SET_CHANNELS 換 X 或 Y 時縮放範圍自動還原;只換顏色/大小則保留", () => {
    let s = appStateReducer(init(), { type: "SET_ZOOM_DOMAIN", x: [30, 60], y: [1000, 20000] });
    const afterColor = appStateReducer(s, { type: "SET_CHANNELS", patch: { color: "fertility" } });
    expect(afterColor.zoomDomain).toEqual({ x: [30, 60], y: [1000, 20000] });
    const afterX = appStateReducer(s, { type: "SET_CHANNELS", patch: { x: "population" } });
    expect(afterX.zoomDomain).toEqual({ x: null, y: null });
  });
});
