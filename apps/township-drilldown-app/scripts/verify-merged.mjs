// 合併單頁三件套一致性驗證(老師 7/24 建議③+B 案語意合一):
// 點縣=下鑽+整縣選取(地圖/排名/散布圖同步)、框選=退回全國、深連結帶選取、X=全頁指標。
// 需先 npm run dev(localhost:5173)。
import { chromium } from "playwright";
const fail = (m) => { console.error("FAIL: " + m); process.exitCode = 1; };
const ok = (m) => console.log("PASS: " + m);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await p.goto("http://localhost:5173");
await p.waitForFunction(() => document.querySelectorAll("svg path").length >= 20, null, { timeout: 30000 });
await p.waitForTimeout(500);

// ---- 版面三大件同屏 ----
for (const [sel, name] of [[".taste-aside", "左側導覽欄"], [".chart-map", "地圖卡"], [".chart-scatter", "散布圖卡"], [".rank-row", "排名列"]]) {
  if ((await p.locator(sel).count()) >= 1) ok(`${name}存在`); else fail(`缺 ${name}(${sel})`);
}
const oneScreen = await p.evaluate(() => ({
  fit: document.documentElement.scrollHeight <= window.innerHeight + 1,
  yearIn: document.querySelector(".year-tab").getBoundingClientRect().bottom <= window.innerHeight,
}));
if (oneScreen.fit) ok("一屏無整頁捲軸"); else fail("出現整頁捲軸");
if (oneScreen.yearIn) ok("年份列在畫面內"); else fail("年份列被擠出");

// ---- 點縣=下鑽+整縣選取(規則1):地圖/排名/散布圖/URL 四方同步 ----
await p.evaluate(() => {
  const el = Array.from(document.querySelectorAll(".chart-map svg path"))
    .find((c) => c.__data__?.properties?.COUNTYNAME === "臺北市");
  el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});
await p.waitForTimeout(1100);
const crumb = await p.locator('nav[aria-label="下鑽層級"]').textContent();
if (crumb?.includes("臺北市")) ok("點臺北市 → 麵包屑下鑽"); else fail("麵包屑未下鑽: " + crumb);
const hash = await p.evaluate(() => decodeURIComponent(location.hash));
if (hash === "#/臺北市") ok("URL hash=#/臺北市"); else fail("hash 異常: " + hash);
// 老師 8/11 回饋:縣內排名卡改比照全國層呈現四通道(X/Y/顏色/大小)各自前五,不再是單一
// 「該縣前五名」大格,格子標題也不再重複縣名(縣名脈絡已在麵包屑)。
const rankBoxCount = await p.locator(".rank-box").count();
if (rankBoxCount === 4) ok("縣內排名卡=四通道(X/Y/顏色/大小)"); else fail(`縣內排名卡應為 4 格,實際 ${rankBoxCount}`);
const rankTitle = await p.locator(".rank-box").first().textContent();
if (rankTitle?.includes("X 軸")) ok("縣內排名卡第一格=X 軸"); else fail("排名卡第一格異常: " + rankTitle);
const cnt = await p.locator(".mini-count").textContent();
if (cnt?.includes("12")) ok("散布圖=整縣選取(已選 12 鄉鎮)"); else fail("選取數異常: " + cnt);
const dim = await p.evaluate(() =>
  Array.from(document.querySelectorAll("g.dots circle"))
    .filter((c) => Number(c.getAttribute("fill-opacity")) < 0.3).length);
if (dim === 368 - 12) ok(`名單外 ${dim} 顆泡泡調暗`); else fail(`調暗數 ${dim} ≠ 356`);
// 使用者 8/11 回饋:縣層級不再顯示資訊面板(折線圖太占位),RegionRank 四格改吃滿整列寬度
if ((await p.locator(".info-panel").count()) === 0) ok("縣級無資訊面板(已移除)"); else fail("縣級資訊面板未移除");
const rankColClass = await p.evaluate(() => document.querySelector(".rank-row > div")?.className || "");
if (rankColClass.includes("col-span-12")) ok("縣級 RegionRank 欄位=col-span-12(吃滿整列寬度)");
else fail("縣級 RegionRank 欄位異常: " + rankColClass);

// 使用者 8/11 追加澄清:鄉鎮層級的資訊面板要保留(只有縣層級移除)
await p.evaluate(() => {
  const el = Array.from(document.querySelectorAll(".chart-map svg path"))
    .find((c) => c.__data__?.properties?.FULLNAME === "臺北市北投區");
  el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});
await p.waitForTimeout(1100);
const crumbTown = await p.locator('nav[aria-label="下鑽層級"]').textContent();
if (crumbTown?.includes("北投區")) ok("點北投區 → 麵包屑下鑽至鄉鎮層"); else fail("鄉鎮層下鑽失敗: " + crumbTown);
if ((await p.locator(".info-panel").count()) === 1) ok("鄉鎮層資訊面板保留(北投區)"); else fail("鄉鎮層資訊面板未出現");
// 退回縣層(臺北市),讓後續框選/退回全國等測試維持原本的前置狀態(整縣選取 12 鄉鎮)
await p.locator('nav[aria-label="下鑽層級"] button').filter({ hasText: "臺北市" }).click();
await p.waitForTimeout(1100);

// ---- 框選=只選取不下鑽(規則2):已下鑽時自動退回全國 ----
// 7/30:框選改為需先按「選取」開啟模式(不再一律可拖曳)
await p.locator(".scatter-mode-select").click();
await p.waitForTimeout(150);
const sbox = await p.locator(".chart-scatter svg[width='100%']").boundingBox();
await p.mouse.move(sbox.x + sbox.width * 0.3, sbox.y + sbox.height * 0.3);
await p.mouse.down();
await p.mouse.move(sbox.x + sbox.width * 0.75, sbox.y + sbox.height * 0.7, { steps: 8 });
await p.mouse.up();
await p.waitForTimeout(1000);
const crumb2 = await p.locator('nav[aria-label="下鑽層級"]').textContent();
if (crumb2?.includes("全國") && !crumb2.includes("臺北市")) ok("已下鑽時框選 → 自動退回全國(最後動作贏)");
else fail("框選未退回全國: " + crumb2);
const hash2 = await p.evaluate(() => location.hash);
if (hash2 === "" || hash2 === "#") ok("退回全國 → hash 清空"); else fail("hash 未清: " + hash2);
const n = Number((await p.locator(".mini-count").textContent())?.match(/\d+/)?.[0] ?? 0);
if (n > 0) ok(`框選名單 ${n} 鄉鎮生效`); else fail("框選無名單");
const hi = await p.locator(".chart-map g.sel-overlay path").count();
if (hi === n) ok("全國地圖高亮=名單數"); else fail(`高亮 ${hi} ≠ ${n}`);

// ---- 回全國=清除(規則3):清除模式框選涵蓋目前所有已選泡泡的實際範圍 → 清空 ----
// 7/30:清除鈕改為互斥的框選模式切換鈕(不再是按一下就立即清空),需實際框選才能清除
await p.locator("button.sel-clear").click();
await p.waitForTimeout(150);
const encl = await p.evaluate(() => {
  const rects = Array.from(document.querySelectorAll("g.dots circle"))
    .filter((c) => Number(c.getAttribute("fill-opacity")) > 0.5)
    .map((c) => c.getBoundingClientRect());
  if (!rects.length) return null;
  const x0 = Math.min(...rects.map((r) => r.x)) - 8, y0 = Math.min(...rects.map((r) => r.y)) - 8;
  const x1 = Math.max(...rects.map((r) => r.x + r.width)) + 8, y1 = Math.max(...rects.map((r) => r.y + r.height)) + 8;
  return [x0, y0, x1, y1];
});
if (encl) {
  const [ex0, ey0, ex1, ey1] = encl;
  await p.mouse.move(ex0, ey0); await p.mouse.down();
  await p.mouse.move(ex1, ey1, { steps: 8 }); await p.mouse.up();
  await p.waitForTimeout(700);
}
if ((await p.locator(".chart-map g.sel-overlay path").count()) === 0) ok("清除 → 地圖高亮清空");
else fail("清除後高亮仍在");

// ---- 老師 8/11:左側指標鈕退役,原位置改可開合的縣市/鄉鎮區導覽 ----
// 先回全國層(前面的縣內操作結束時已清除選取但仍在臺北市內),縣市導覽初始狀態應全部收合。
await p.goto("http://localhost:5173");
await p.waitForFunction(() => document.querySelectorAll("svg path").length >= 20, null, { timeout: 30000 });
await p.waitForTimeout(500);
const countyNav = p.locator('nav[aria-label="縣市／鄉鎮區導覽"]');
if ((await countyNav.count()) === 1) ok("左側縣市／鄉鎮區導覽存在"); else fail("找不到縣市導覽 nav");
if ((await countyNav.locator('button[title="板橋區"]').count()) === 0) ok("初始狀態縣市清單全部收合(看不到任何鄉鎮按鈕)");
else fail("初始狀態不應展開任何縣的鄉鎮清單");
await countyNav.locator("button", { hasText: "新北市" }).click();
await p.waitForTimeout(900);
if ((await p.locator('nav[aria-label="下鑽層級"]').textContent())?.includes("新北市")) ok("點側欄縣市名 → 地圖下鑽同步");
else fail("點側欄縣市名未同步下鑽");
if ((await countyNav.locator('button[title="板橋區"]').count()) === 1) ok("下鑽後側欄自動展開對應縣的鄉鎮清單");
else fail("下鑽後側欄未自動展開");
await countyNav.locator('button[title="板橋區"]').click();
await p.waitForTimeout(900);
if ((await p.locator('nav[aria-label="下鑽層級"]').textContent())?.includes("板橋")) ok("點側欄鄉鎮名 → 地圖下鑽至該區");
else fail("點側欄鄉鎮名未下鑽至該區");
await p.locator('button:has-text("全國")').click();
await p.waitForTimeout(500);
if ((await countyNav.locator('button[title="板橋區"]').count()) === 0) ok("回全國層 → 側欄收合回縣市清單");
else fail("回全國層側欄未收合");

// ---- X 下拉選死因 → 全頁跟著(death_c* 蘊含死亡率+死因) ----
const causeVal = await p.evaluate(() => {
  const sel = document.querySelector('select.scatter-ch[data-ch="x"]');
  const opt = Array.from(sel.options).find((o) => o.label.includes("惡性腫瘤"));
  return opt?.value ?? null;
});
if (causeVal) {
  await p.locator('select.scatter-ch[data-ch="x"]').selectOption(causeVal);
  await p.waitForTimeout(900);
  if ((await p.locator("h1").textContent())?.includes("惡性腫瘤")) ok("X=惡性腫瘤 → 標題同步"); else fail("死因標題未同步");
  // 老師 8/11 回饋:地圖圖例改跟「顏色」通道走,不再跟 X——這裡改把顏色也切成同一個死因,
  // 驗證地圖圖例/legend 是跟著顏色通道同步,而非(舊版)跟著 X。
  await p.locator('select.scatter-ch[data-ch="color"]').selectOption(causeVal);
  await p.waitForTimeout(900);
  const mapTxt = await p.locator(".chart-map").textContent();
  if (mapTxt?.includes("惡性腫瘤")) ok("顏色=死因 → 地圖圖例同步"); else fail("死因地圖圖例未同步");
} else fail("X 下拉找不到惡性腫瘤選項");

// ---- 深連結:重新載入 #/臺北市 → 直接帶下鑽+整縣選取 ----
await p.goto("http://localhost:5173/#/%E8%87%BA%E5%8C%97%E5%B8%82");
// 深連結直接進縣層:地圖只有 12 個鄉鎮 path,等散布圖泡泡到齊即可
await p.waitForFunction(() => document.querySelectorAll("g.dots circle").length >= 300, null, { timeout: 30000 });
await p.waitForTimeout(1000);
const crumb3 = await p.locator('nav[aria-label="下鑽層級"]').textContent();
if (crumb3?.includes("臺北市")) ok("深連結 → 下鑽臺北市"); else fail("深連結未下鑽: " + crumb3);
const cnt3 = await p.locator(".mini-count").textContent();
if (cnt3?.includes("12")) ok("深連結 → 帶整縣選取(12)"); else fail("深連結選取異常: " + cnt3);

if (errors.length) fail("console/page 錯誤: " + errors.join(" | ")); else ok("無 console/page 錯誤");
await b.close();
console.log(process.exitCode ? "== 有項目失敗 ==" : "== 全部通過 ==");
