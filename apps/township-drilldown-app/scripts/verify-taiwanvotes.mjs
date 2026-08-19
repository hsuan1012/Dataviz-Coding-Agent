// taiwanvotes 參考項驗證（三層下鑽版語意）：inset、下鑽、標籤、footer
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const OUT = "../docs/superpowers/artifacts";
mkdirSync(OUT, { recursive: true });
const fail = (m) => { console.error("FAIL: " + m); process.exitCode = 1; };
const ok = (m) => console.log("PASS: " + m);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:5173");
// 全國層 = 22 縣市（本島 20 + inset 2）
await page.waitForFunction(() => document.querySelectorAll(".chart-map svg path").length >= 20, null, { timeout: 30000 });

// 1. footer
if (await page.getByText("資料來源：").count()) ok("footer 可見");
else fail("無 footer");

// 2. inset 存在＋hover 金門 tooltip（縣級著色）
const insetCount = await page.locator(".chart-map .inset-path").count();
if (insetCount > 0) ok(`inset 路徑 ${insetCount} 條`);
else fail("無 inset 路徑");
await page.locator(".chart-map .inset-path").first().dispatchEvent("mousemove");
await page.waitForTimeout(300);
const tip = await page.evaluate(() =>
  Array.from(document.querySelectorAll("div"))
    .map((d) => (d.children.length === 0 ? d.textContent || "" : ""))
    // 老師 8/11:顏色通道預設="區域",tooltip 顯示區域字樣而非連續數值,正規表示式補上北/中/南/東/離島
    .find((s) => /｜(無資料|[\d.]+\s|北|中|南|東|離島)/.test(s)) || "");
if (tip.includes("金門縣")) ok("inset hover tooltip: " + tip.trim());
else fail("inset hover 無金門 tooltip，讀到: " + tip);

// 3. 點縣市下鑽 → 麵包屑＋鄉鎮標籤
const crumbText = () => page.evaluate(() =>
  (document.querySelector('nav[aria-label="下鑽層級"]')?.textContent || "").trim());
// 凹形縣多邊形的 bbox 中心可能落在鄰縣上，Playwright click 會被攔截 → 直接對 d3 綁定資料派發 click
await page.evaluate(() => {
  const p = Array.from(document.querySelectorAll(".chart-map svg path:not(.inset-path)")).find((x) => x.__data__?.properties?.COUNTYNAME === "彰化縣");
  p?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});
await page.waitForFunction(() => (document.querySelector('nav[aria-label="下鑽層級"]')?.textContent || "").includes("彰化縣"), null, { timeout: 10000 });
const crumbA = await crumbText();
const labelCount = await page.evaluate(() => document.querySelectorAll(".chart-map svg text").length);
if (crumbA.startsWith("全國") && labelCount >= 3) ok(`下鑽成功（${crumbA}），鄉鎮標籤 ${labelCount} 個`);
else fail(`縣內視圖異常 crumb=${crumbA} labels=${labelCount}`);

// 4. 縣內截圖（深/淺）
await page.screenshot({ path: `${OUT}/tv-ref-county-light.png` });
await page.getByRole("button", { name: "深色模式" }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/tv-ref-county-dark.png` });
await page.getByRole("button", { name: "淺色模式" }).click();
await page.waitForTimeout(300);

// 5. 麵包屑「全國」返回 → 全國截圖
await page.locator('nav[aria-label="下鑽層級"] button').filter({ hasText: "全國" }).click();
await page.waitForFunction(() => document.querySelectorAll(".chart-map svg path").length >= 20 && document.querySelectorAll(".chart-map svg path").length < 60, null, { timeout: 10000 });
ok("返回全國成功");
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/tv-ref-national-light.png` });

await browser.close();
console.log(process.exitCode ? "== 有項目失敗 ==" : "== 全部通過 ==");
