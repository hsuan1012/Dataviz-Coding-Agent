import { describe, it, expect } from "vitest";
import { formatCountryDisplayName } from "./countryDisplayName";

describe("formatCountryDisplayName", () => {
  it("有效 iso2 時只回傳中文名稱（不含英文、不含括號）", () => {
    expect(formatCountryDisplayName("Taiwan", "TW")).toBe("台灣");
    expect(formatCountryDisplayName("Japan", "JP")).toBe("日本");
  });

  it("iso2 為空字串時退回英文原名，不顯示空字串或 undefined", () => {
    expect(formatCountryDisplayName("Some Territory", "")).toBe("Some Territory");
  });

  it("iso2 無法被 Intl.DisplayNames 解析時退回英文原名", () => {
    // 使用 "XX"：ISO 3166 使用者自訂保留碼、CLDR 無對應譯名，
    // Intl.DisplayNames 會原樣回傳輸入值。
    // （原規格用 "ZZ" 測試，但 "ZZ" 是 CLDR 明確定義的「未知區域」保留碼，
    // 會被解析成有意義的字串「未知區域」而非原樣回傳，因此換一個真正
    // 無法被解析、會原樣回傳的代碼來驗證同一個 fallback 行為。）
    expect(formatCountryDisplayName("Unknown Place", "XX")).toBe("Unknown Place");
  });

  // 8/4 語言切換:lang="en" 一律回傳原始英文名,不查中文——即使 iso2 有效也一樣。
  it("lang='en' 時直接回傳英文原名,不查中文(即使 iso2 有效)", () => {
    expect(formatCountryDisplayName("Taiwan", "TW", "en")).toBe("Taiwan");
    expect(formatCountryDisplayName("Japan", "JP", "en")).toBe("Japan");
  });

  it("lang 省略時預設 'zh',維持既有行為", () => {
    expect(formatCountryDisplayName("Taiwan", "TW")).toBe(formatCountryDisplayName("Taiwan", "TW", "zh"));
  });
});
