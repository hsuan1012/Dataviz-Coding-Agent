import { describe, it, expect } from "vitest";
import { romanizePlaceName } from "./placeName";

describe("romanizePlaceName", () => {
  it("zh 模式原樣回傳", () => {
    expect(romanizePlaceName("板橋區", "zh")).toBe("板橋區");
  });
  it("區 → District", () => {
    expect(romanizePlaceName("板橋區", "en")).toBe("Banqiao District");
  });
  it("縣 → County", () => {
    expect(romanizePlaceName("金門縣", "en")).toBe("Jinmen County");
  });
  it("市（縣級市）→ City", () => {
    expect(romanizePlaceName("臺北市", "en")).toBe("Taibei City");
  });
  it("鄉 → Township", () => {
    expect(romanizePlaceName("烏坵鄉", "en")).toBe("Wuqiu Township");
  });
  it("里 → Village", () => {
    expect(romanizePlaceName("民生里", "en")).toBe("Minsheng Village");
  });
  it("村 → Village", () => {
    expect(romanizePlaceName("三民村", "en")).toBe("Sanmin Village");
  });
  it("抓不到已知字尾時整串轉拼音、不加字尾", () => {
    expect(romanizePlaceName("台灣", "en")).toBe("Taiwan");
  });
  it("同名稱重複呼叫回傳一致結果(cache 正確性)", () => {
    const a = romanizePlaceName("板橋區", "en");
    const b = romanizePlaceName("板橋區", "en");
    expect(a).toBe(b);
  });
});
