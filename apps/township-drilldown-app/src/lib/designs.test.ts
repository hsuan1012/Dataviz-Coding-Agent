import { describe, it, expect } from "vitest";
import { themes } from "./styleDictionary.js";
import { resolveTheme } from "./designs";

describe("designs", () => {
  it("resolveTheme 依 dark 回傳對應主題", () => {
    expect(resolveTheme(false)).toBe(themes.light);
    expect(resolveTheme(true)).toBe(themes.dark);
  });
  it("強調色不進數值色階（深淺皆然）", () => {
    for (const m of ["light", "dark"] as const) {
      const t = themes[m] as any;
      expect(t.densityScale).not.toContain(t.accent);
    }
  });
  it("categorical 五色互異", () => {
    for (const m of ["light", "dark"] as const) {
      const c = (themes[m] as any).categorical;
      expect(new Set(c).size).toBe(5);
    }
  });
});
