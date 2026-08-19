// Taste 主畫面煙霧測試（設計切換器已依使用者要求隱藏、僅保留 Taste；原跨設計一致性檢查退役）。
// 檢查：排名四格（X/Y/顏色/大小四通道）、年份標籤、localStorage 預設、地圖 hover tooltip、深淺主題截圖。
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:5173";
const OUT = "../docs/superpowers/artifacts";
mkdirSync(OUT, { recursive: true });
const fail = (msg) => { console.error("FAIL: " + msg); process.exitCode = 1; };
const ok = (msg) => console.log("PASS: " + msg);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => document.querySelectorAll("svg path").length >= 20, null, { timeout: 30000 });

// 1. 預設為 Taste（側欄存在、無設計切換器）
const isTaste = await page.$(".taste-aside");
const hasSwitch = await page.getByRole("button", { name: "方向 A" }).count();
if (isTaste && hasSwitch === 0) ok("預設 Taste，且設計切換器已隱藏（無「方向 A」按鈕）");
else fail(`預設或切換器異常 taste=${!!isTaste} 方向A鈕=${hasSwitch}`);

// 2. 排名四格（X/Y/顏色/大小四通道，7/30 改版）
const nBoxes = await page.locator(".rank-box").count();
if (nBoxes === 4) ok("排名四格（X/Y/顏色/大小四通道）");
else fail(`排名格數異常 ${nBoxes}`);
// 切 X 下拉 → 第一格標題跟著換成新指標名稱
await page.locator('select.scatter-ch[data-ch="x"]').selectOption({ label: "平均所得" });
await page.waitForTimeout(700);
const titleXAfter = await page.locator(".rank-box").first().locator(":scope > div:first-child").textContent();
if (titleXAfter?.includes("平均所得")) ok(`切 X 下拉 → 排名格標題同步(${titleXAfter})`);
else fail("排名格標題未隨 X 下拉同步: " + titleXAfter);
await page.locator('select.scatter-ch[data-ch="x"]').selectOption({ label: "人口密度" }); // 復原
await page.waitForTimeout(700);

// 3. 年份標籤點選生效
await page.locator(".year-tab", { hasText: "105 年" }).click();
await page.waitForTimeout(200);
const y = await page.evaluate(() => (document.querySelector('.year-tab[aria-selected="true"]')?.textContent || "").replace(/\D/g, ""));
if (y === "105") ok("年份標籤點選生效（105）");
else fail("年份標籤異常: " + y);
// 108 年因 HIDDEN_YEARS 已從年份標籤列隱藏(src/lib/data.ts),改點另一個可見年份(107)延續原意:
// 換到 hover 檢查前再切一次年份,確保 tooltip 檢查不是巧合命中同一年資料。
await page.locator(".year-tab", { hasText: "107 年" }).click();
await page.waitForTimeout(150);

// 4. 地圖 hover tooltip(老師 8/11:顏色通道預設="區域",tooltip 顯示區域字樣而非連續數值,
// 正規表示式補上北/中/南/東/離島)
await page.locator("svg path").nth(10).dispatchEvent("mousemove");
await page.waitForTimeout(300);
const tip = await page.evaluate(() =>
  Array.from(document.querySelectorAll("div")).map((d) => (d.children.length === 0 ? d.textContent || "" : ""))
    .find((s) => /｜(無資料|[\d.]+\s|北|中|南|東|離島)/.test(s)) || "");
if (tip) ok("地圖 hover tooltip: " + tip.trim().slice(0, 40));
else fail("hover 無 tooltip");

// 5. 深淺主題截圖
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/taste-light.png` });
await page.getByRole("button", { name: "深色模式" }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/taste-dark.png` });
ok("深/淺主題截圖完成");

await browser.close();
console.log(process.exitCode ? "== 有項目失敗 ==" : "== 全部通過 ==");
