// 三層下鑽整合驗證：全國(縣市)→臺北市(鄉鎮)→北投區(村里)
// 涵蓋：縣級著色數、下鑽點擊、村里 lazy load、湖田里 hover、
// 死亡率降級提示、麵包屑返回、年度連動（村里所得）
// 使用者 8/11 要求:方向 A 舊外殼(切換器早已隱藏)整個移除，本腳本改測 Taste(唯一外殼、
// 合併單頁、無分頁切換)，原本靠切分頁/tab 才能重現的前置動作已改成 Taste 對應操作。
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const OUT = "../docs/superpowers/artifacts";
mkdirSync(OUT, { recursive: true });
const fail = (m) => { console.error("FAIL: " + m); process.exitCode = 1; };
const ok = (m) => console.log("PASS: " + m);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:5173");
const pathCount = () => page.evaluate(() => document.querySelectorAll(".chart-map svg path:not([clip-path])").length);
const crumbText = () => page.evaluate(() =>
  (document.querySelector('nav[aria-label="下鑽層級"]')?.textContent || "").trim());
await page.waitForFunction(() => document.querySelectorAll(".chart-map svg path").length >= 20, null, { timeout: 30000 });

// 老師 8/11 回饋:地圖塗色改跟隨散布圖「顏色」通道,預設值="區域"。這支腳本後面多處
// 假設地圖 tooltip 顯示密度連續值(如臺北市 9818.2)，Taste 合併單頁散布圖控制列常駐可見，
// 不需切分頁，直接把顏色通道下拉改回「人口密度」即可。
await page.locator('select.scatter-ch[data-ch="color"]').selectOption({ label: "人口密度" });
await page.waitForTimeout(200);

// --- 0. 年份標籤列（圖表下方，取代年度下拉）：6 個標籤、預設 107 選中、點 106 生效 ---
// （108 年已於 8f16976 應老師要求暫時隱藏，UI 只呈現 102–107；底層資料不動）
const yearTabCount = await page.locator(".year-tab").count();
const selDefault = await page.locator('.year-tab[aria-selected="true"]').textContent();
await page.locator(".year-tab", { hasText: "106 年" }).click();
await page.waitForTimeout(200);
const sel106 = await page.locator('.year-tab[aria-selected="true"]').textContent();
if (yearTabCount === 6 && selDefault.includes("107") && sel106.includes("106"))
  ok(`年份標籤列 ${yearTabCount} 個（102–107），預設 107、點選 106 生效`);
else fail(`年份標籤列異常 count=${yearTabCount} 預設=${selDefault} 點後=${sel106}`);
await page.locator(".year-tab", { hasText: "107 年" }).click(); // 復原
await page.waitForTimeout(150);

// --- 0b. 排名格：X/Y/顏色/大小四通道格＋切年份長條伸縮/名次平滑移動（節點以 township 為 key 不重建）---
// 7/30:四格從「同一指標分北中南東離島」改成「X/Y/顏色/大小四通道各自全國前五」
const nBoxes = await page.locator(".rank-box").count();
const rankRows = () => page.evaluate(() =>
  Array.from(document.querySelectorAll(".rank-box")).reduce((a, b) => a + b.querySelectorAll(":scope > div > div").length, 0));
if (nBoxes === 4) ok("排名四格（X/Y/顏色/大小四通道）");
else fail(`排名格數異常 ${nBoxes}`);
const titles = await page.evaluate(() =>
  Array.from(document.querySelectorAll(".rank-box > div:first-child")).map((d) => d.textContent));
if (titles[0]?.includes("X 軸") && titles[1]?.includes("Y 軸") && titles[2]?.includes("顏色") && titles[3]?.includes("大小"))
  ok(`排名格標題依序＝X/Y/顏色/大小(${titles.join("、")})`);
else fail("排名格標題順序異常: " + titles.join("、"));
// 切 X 下拉 → 排名格標題同步，見 verify-designs.mjs（X 下拉常駐可見，該腳本已覆蓋）。
// 標記北部第一格的排名列，記錄各列的 transform（名次位置）與長條寬度
await page.waitForTimeout(650);
const snap = () => page.evaluate(() => {
  const box = document.querySelector(".rank-box");
  const rows = Array.from(box.querySelectorAll(":scope > div > div"));
  rows.forEach((r, i) => r.setAttribute("data-rk", "r" + i));
  return rows.map((r) => ({ name: r.querySelector("span:nth-child(2)")?.textContent,
    y: r.style.transform, w: r.querySelector(':scope > div:nth-child(2) > span')?.style.width }));
});
const before = await snap();
await page.locator(".year-tab", { hasText: "102 年" }).click();
await page.waitForTimeout(120);
const persisted = await page.evaluate(() =>
  Array.from(document.querySelectorAll(".rank-box")).slice(0, 1)
    .reduce((a, b) => a + b.querySelectorAll("[data-rk]").length, 0));
if (persisted >= 3) ok(`切年份排名列不重建（${persisted} 列原節點保留＝平滑重排/伸縮，非整批重畫）`);
else fail(`排名列被重建 persisted=${persisted}`);
await page.waitForTimeout(750);
const after = await page.evaluate(() => {
  const box = document.querySelector(".rank-box");
  return Array.from(box.querySelectorAll(":scope > div > div")).map((r) => ({
    name: r.querySelector("span:nth-child(2)")?.textContent, w: r.querySelector(':scope > div:nth-child(2) > span')?.style.width }));
});
const widthsChanged = before.some((b) => { const a = after.find((x) => x.name === b.name); return a && a.w !== b.w; });
if (widthsChanged) ok("切年份長條寬度有伸縮變化");
else fail("長條寬度未變化");
await page.locator(".year-tab", { hasText: "107 年" }).click(); // 復原
await page.waitForTimeout(750);

// --- 1. 全國層：著色單位 = 縣市（本島 20 縣市 + 2 inset）---
const nNation = await page.locator(".chart-map svg path:not(.inset-path)").count();
const nInset = await page.locator(".inset-path").count();
if (nNation >= 20 && nNation < 30 && nInset === 2) ok(`全國層 ${nNation} 個本島縣市多邊形 + ${nInset} inset 縣`);
else fail(`全國層數量異常 main=${nNation} inset=${nInset}`);

// 縣級 tooltip 數值（臺北市 107 密度應為 9818.2，ETL 加權驗算值；108 已隱藏、預設年改為 107）
// tooltip 可能含 span 子元素（村里層人口），改抓「無 div 子元素」且格式匹配的 div
const tipOf = async () => page.evaluate(() =>
  Array.from(document.querySelectorAll("div"))
    .map((d) => (d.querySelector("div") === null ? d.textContent || "" : ""))
    .find((s) => /｜(無資料|[\d.]+\s)/.test(s)) || "");
let taipeiTip = "";
for (let i = 0; i < nNation; i++) {
  await page.locator(".chart-map svg path:not(.inset-path)").nth(i).dispatchEvent("mousemove");
  await page.waitForTimeout(120);
  const s = await tipOf();
  if (s.includes("臺北市")) { taipeiTip = s.trim(); break; }
}
if (taipeiTip.includes("9818.2")) ok("縣級加權密度正確顯示: " + taipeiTip);
else fail("臺北市縣級 tooltip 異常: " + taipeiTip);

// --- 2. 下鑽臺北市 → 鄉鎮層 ---
await page.evaluate(() => {
  const paths = Array.from(document.querySelectorAll(".chart-map svg path:not(.inset-path)"));
  for (const p of paths) {
    p.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
  }
});
// 用 tooltip 找不可靠；直接以 d3 綁定資料點擊：找 COUNTYNAME=臺北市 的 path
const clickFeature = (matchKey, matchVal) => page.evaluate(([k, v]) => {
  const paths = Array.from(document.querySelectorAll(".chart-map svg path"));
  for (const p of paths) {
    const d = p.__data__;
    if (d?.properties?.[k] === v) { p.dispatchEvent(new MouseEvent("click", { bubbles: true })); return true; }
  }
  return false;
}, [matchKey, matchVal]);
if (await clickFeature("COUNTYNAME", "臺北市")) ok("點擊臺北市");
else fail("找不到臺北市多邊形");
await page.waitForFunction(() => (document.querySelector('nav[aria-label="下鑽層級"]')?.textContent || "").includes("臺北市"), null, { timeout: 10000 });
const crumb1 = await crumbText();
const nTowns = await page.locator(".chart-map svg path").count();
if (crumb1.includes("臺北市") && nTowns === 12) ok(`臺北市鄉鎮層 12 區（crumb=${crumb1}）`);
else fail(`鄉鎮層異常 crumb=${crumb1} paths=${nTowns}`);

// 使用者 8/11 回饋:縣層級不再顯示資訊面板(折線圖太占位)，RegionRank 四格吃滿整列寬度
// （同一斷言也見 verify-merged.mjs，此處在完整三層下鑽流程中再驗一次）
if ((await page.locator(".info-panel").count()) === 0) ok("縣層無資訊面板（已移除）");
else fail("縣層仍出現資訊面板");

// --- 3. 下鑽北投區 → 村里層（lazy load 42 里）---
if (await clickFeature("FULLNAME", "臺北市北投區")) ok("點擊北投區");
else fail("找不到北投區多邊形");
await page.waitForFunction(() => document.querySelectorAll(".chart-map svg path").length >= 40, null, { timeout: 15000 });
const nVills = await page.locator(".chart-map svg path").count();
const crumb2 = await crumbText();
if (nVills === 42 && crumb2.includes("北投區")) ok(`北投區村里層 ${nVills} 里（crumb=${crumb2}）`);
else fail(`村里層異常 paths=${nVills} crumb=${crumb2}`);

// 湖田里 hover：density 58.5、人口 983（ETL 嵌入值）
await page.evaluate(() => {
  const p = Array.from(document.querySelectorAll(".chart-map svg path")).find((x) => x.__data__?.properties?.VILLNAME === "湖田里");
  p?.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
});
await page.waitForTimeout(300);
const hutianTip = (await tipOf()).trim();
if (hutianTip.includes("湖田里") && hutianTip.includes("58.5") && hutianTip.includes("983")) ok("湖田里 tooltip 數值正確: " + hutianTip);
else fail("湖田里 tooltip 異常: " + hutianTip);

// 快照標示
if (await page.getByText("普查快照").count()) ok("村里人口普查快照標示可見");
else fail("無普查快照標示");

// 圖例不得與地圖重疊（7/14 大甲區被圖例卡遮住 → 圖例改進版面流；此為回歸檢查）
const legendOverlap = await page.evaluate(() => {
  const L = document.querySelector(".map-legend")?.getBoundingClientRect();
  const S = document.querySelector("svg")?.getBoundingClientRect();
  if (!L || !S) return "missing";
  return !(L.right <= S.left || S.right <= L.left || L.bottom <= S.top || S.bottom <= L.top);
});
if (legendOverlap === false) ok("圖例與地圖 bbox 零重疊");
else fail("圖例與地圖重疊: " + legendOverlap);
await page.screenshot({ path: `${OUT}/drill-beitou-villages.png` });

// --- 3b. 資訊面板：縣→臺北市三指標、鄉鎮→北投區、點大屯里→村里三指標（死亡率誠實無資料）---
const panelText = () => page.evaluate(() =>
  (document.querySelector(".info-panel")?.textContent || "").replace(/\s+/g, " "));
let pt = await panelText();
if (pt.includes("北投區") && pt.includes("人口密度") && pt.includes("平均所得") && pt.includes("死亡率"))
  ok("村里層（未選里）資訊面板=北投區三指標");
else fail("北投區面板異常: " + pt.slice(0, 80));

await clickFeature("VILLNAME", "大屯里");
await page.waitForTimeout(300);
pt = await panelText();
if (pt.includes("大屯里") && pt.includes("普查快照") && pt.includes("無村里資料"))
  ok("點大屯里 → 面板=大屯里（密度快照＋所得＋死亡率誠實無資料）");
else fail("大屯里面板異常: " + pt.slice(0, 120));
const sparkCount = await page.locator(".info-panel svg polyline").count();
if (sparkCount >= 1) ok(`面板趨勢線 ${sparkCount} 條（大屯里所得逐年）`);
else fail("面板無趨勢線");
await page.screenshot({ path: `${OUT}/drill-infopanel-datun.png` });

// --- 4. 村里所得逐年資料嵌入正確（資料直接嵌在 feature properties，與目前選的指標無關）---
const inc = await page.evaluate(() => {
  const p = Array.from(document.querySelectorAll(".chart-map svg path")).find((x) => x.__data__?.properties?.VILLNAME === "湖田里");
  const props = p?.__data__?.properties;
  return { y108: props?.income?.["108"], y105: props?.income?.["105"] };
});
if (inc.y108 === 857.5 && inc.y105 === 1063.7) ok(`村里所得逐年資料嵌入正確（108=${inc.y108}、105=${inc.y105}）`);
else fail(`村里所得資料異常 ${JSON.stringify(inc)}`);

// --- 5. 死亡率降級：於鄉鎮層將 X 軸切死亡率再下鑽村里 → 自動降級為密度＋提示 ---
await page.locator('nav[aria-label="下鑽層級"] button').filter({ hasText: "臺北市" }).click();  // 麵包屑回鄉鎮層
await page.waitForFunction(() => document.querySelectorAll(".chart-map svg path").length === 12, null, { timeout: 10000 });
await page.locator('select.scatter-ch[data-ch="x"]').selectOption({ label: "死亡率" });
await page.waitForTimeout(200);
await clickFeature("FULLNAME", "臺北市北投區");
await page.waitForFunction(() => document.querySelectorAll(".chart-map svg path").length >= 40, null, { timeout: 15000 });
const noticeText = await page.evaluate(() => document.querySelector('[role="status"]')?.textContent || "");
if (noticeText.includes("死亡率") && noticeText.includes("人口密度")) ok("死亡率下鑽自動降級為密度＋提示: " + noticeText.replace("×", "").trim());
else fail(`降級異常 notice=${noticeText}`);
await page.screenshot({ path: `${OUT}/drill-death-downgrade.png` });

// --- 7. 麵包屑「全國」一鍵返回 ---
await page.locator('nav[aria-label="下鑽層級"] button').filter({ hasText: "全國" }).click();
await page.waitForFunction(() => {
  const n = document.querySelectorAll(".chart-map svg path").length;
  return n >= 20 && n < 60;
}, null, { timeout: 10000 });
ok("麵包屑返回全國成功");

// --- 8. 瀏覽器歷史整合：上一頁/下一頁保留下鑽位置;重新整理回全國(老師 8/11 回饋) ---
await clickFeature("COUNTYNAME", "臺北市");
await page.waitForFunction(() => document.querySelectorAll(".chart-map svg path").length === 12, null, { timeout: 10000 });
await clickFeature("FULLNAME", "臺北市北投區");
await page.waitForFunction(() => document.querySelectorAll(".chart-map svg path").length >= 40, null, { timeout: 15000 });
if (page.url().includes(encodeURIComponent("北投區"))) ok("URL hash 反映村里層: " + decodeURIComponent(page.url().split("#")[1] ?? ""));
else fail("URL 無下鑽 hash: " + page.url());

await page.goBack();
await page.waitForFunction(() => document.querySelectorAll(".chart-map svg path").length === 12, null, { timeout: 10000 });
ok("瀏覽器上一頁 → 回鄉鎮層（臺北市 12 區）");
await page.goBack();
await page.waitForFunction(() => { const n = document.querySelectorAll(".chart-map svg path").length; return n >= 20 && n < 60; }, null, { timeout: 10000 });
ok("瀏覽器再上一頁 → 回全國");
await page.goForward();
await page.waitForFunction(() => document.querySelectorAll(".chart-map svg path").length === 12, null, { timeout: 10000 });
ok("瀏覽器下一頁 → 回臺北市");

// 使用者 8/11 回饋:重新整理應該回全國首頁,不再保留下鑽位置(跟上一頁/下一頁/分享網址
// 深連結不同——那三者仍要保留,見上面與下面的斷言)。用 Performance Navigation Timing API
// 的 navigation.type==="reload" 分辨,見 App.tsx 該段註解。
await page.reload();
await page.waitForFunction(() => { const n = document.querySelectorAll(".chart-map svg path").length; return n >= 20 && n < 60; }, null, { timeout: 15000 });
const crumbReload = await crumbText();
const hashReload = page.url().split("#")[1] ?? "";
if (crumbReload === "全國" && !hashReload) ok("重新整理回全國首頁（hash 已清空）");
else fail(`重新整理未回全國 crumb=${crumbReload} hash=${hashReload}`);

// 分享網址深連結仍要保留位置(跟「按重整鈕」不同的載入路徑,不受上面的改動影響)
await page.goto(page.url().split("#")[0] + "#/" + encodeURIComponent("臺北市"));
await page.waitForFunction(() => document.querySelectorAll(".chart-map svg path").length === 12, null, { timeout: 15000 });
const crumbDeepLink = await crumbText();
if (crumbDeepLink.includes("臺北市")) ok("分享網址深連結仍保留下鑽位置（" + crumbDeepLink + "）");
else fail("深連結遺失位置 crumb=" + crumbDeepLink);
await page.locator('nav[aria-label="下鑽層級"] button').filter({ hasText: "全國" }).click();
await page.waitForFunction(() => { const n = document.querySelectorAll(".chart-map svg path").length; return n >= 20 && n < 60; }, null, { timeout: 10000 });

// --- 9. 金門 inset 點擊下鑽（縣級 inset 也可下鑽）---
await page.evaluate(() => {
  const p = Array.from(document.querySelectorAll(".chart-map svg path.inset-path")).find((x) => x.__data__?.properties?.COUNTYNAME === "金門縣");
  p?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});
await page.waitForFunction(() => (document.querySelector('nav[aria-label="下鑽層級"]')?.textContent || "").includes("金門縣"), null, { timeout: 10000 });
const crumbKm = await crumbText();
if (crumbKm.includes("金門縣")) ok("金門 inset 點擊下鑽成功: " + crumbKm);
else fail("金門 inset 下鑽失敗 crumb=" + crumbKm);

await browser.close();
console.log(process.exitCode ? "== 有項目失敗 ==" : "== 全部通過 ==");
