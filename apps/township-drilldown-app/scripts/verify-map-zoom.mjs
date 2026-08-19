// 地圖層級切換 zoom in/out 動畫驗證(老師建議)：
// 換指標/年份/主題/框選不觸發、下鑽=zoom in、麵包屑返回=zoom out、reduced-motion 瞬間切換、
// 快速連續點擊(並發保護)不留殘留分身。需先 npm run dev(localhost:5173)。
import { chromium } from "playwright";
const fail = (m) => { console.error("FAIL: " + m); process.exitCode = 1; };
const ok = (m) => console.log("PASS: " + m);

const ghostCount = (p) => p.evaluate(() => document.querySelectorAll('img[data-zoom-ghost]').length);
const clickCounty = (p, name) => p.evaluate((n) => {
  const el = Array.from(document.querySelectorAll(".chart-map svg path"))
    .find((c) => c.__data__?.properties?.COUNTYNAME === n);
  el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  return !!el;
}, name);
// 縣層下鑽鄉鎮：查 FULLNAME(如「臺北市大安區」)——沿用 clickCounty 的找路徑+dispatchEvent 手法
const clickTown = (p, fullname) => p.evaluate((n) => {
  const el = Array.from(document.querySelectorAll(".chart-map svg path"))
    .find((c) => c.__data__?.properties?.FULLNAME === n);
  el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  return !!el;
}, fullname);
// 用 waitForFunction 輪詢分身數到達期望值，比固定 waitForTimeout 後單點快照更穩健
// （時序抖動時不會因為快照時間點沒抓準而誤判）
const waitForGhostCount = (p, n, timeout = 1500) =>
  p.waitForFunction((want) => document.querySelectorAll('img[data-zoom-ghost]').length === want, n, { timeout })
    .then(() => true).catch(() => false);

const b = await chromium.launch();
const errors = [];
// 主流程包 try/finally：任何一步 .click()/斷言中途丟例外(選擇器對不上、timeout…)，
// 都要先印出對應 FAIL 再確保瀏覽器關掉，不留殭屍 Chromium 行程。
try {
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await p.goto("http://localhost:5173");
  await p.waitForFunction(() => document.querySelectorAll("svg path").length >= 20, null, { timeout: 30000 });
  await p.waitForTimeout(300);

  // ---- 1. 換指標不觸發縮放動畫（本功能最容易犯錯之處，明確回歸檢查）----
  // 老師 8/11:左側指標鈕退役,改用 X 軸下拉切指標(效果等價:只換指標、不換下鑽層級)。
  await p.locator('select.scatter-ch[data-ch="x"]').selectOption({ label: "平均所得" });
  await p.waitForTimeout(200);
  if ((await ghostCount(p)) === 0) ok("換指標：無縮放分身(不觸發動畫)");
  else fail("換指標卻出現縮放分身");
  await p.locator('select.scatter-ch[data-ch="x"]').selectOption({ label: "人口密度" });
  await p.waitForTimeout(200);

  // ---- 2. 換年份不觸發 ----
  await p.locator(".year-tab", { hasText: "102 年" }).click();
  await p.waitForTimeout(200);
  if ((await ghostCount(p)) === 0) ok("換年份：無縮放分身");
  else fail("換年份卻出現縮放分身");
  await p.locator(".year-tab", { hasText: "107 年" }).click();
  await p.waitForTimeout(200);

  // ---- 3. 換深色模式不觸發 ----
  await p.locator(".year-like", { hasText: "深色模式" }).click();
  await p.waitForTimeout(200);
  if ((await ghostCount(p)) === 0) ok("換主題：無縮放分身");
  else fail("換主題卻出現縮放分身");
  await p.locator(".year-like", { hasText: "淺色模式" }).click();
  await p.waitForTimeout(200);

  // ---- 4. 點縣市下鑽＝zoom in：動畫期間分身存在，850ms 後消失，地圖內容立即正確 ----
  if (await clickCounty(p, "臺北市")) ok("點擊臺北市"); else fail("找不到臺北市多邊形");
  if (await waitForGhostCount(p, 1)) ok("下鑽瞬間：分身存在 1 個(zoom in 動畫進行中)");
  else fail("下鑽瞬間分身數異常: " + (await ghostCount(p)));
  const midPaths = await p.evaluate(() => document.querySelectorAll(".chart-map svg:not([data-zoom-ghost]) path").length);
  if (midPaths === 12) ok("下鑽瞬間：地圖內容已是新層(12 區)，不受分身影響");
  else fail("下鑽瞬間地圖內容異常 paths=" + midPaths);
  if (await waitForGhostCount(p, 0, 1500)) ok("850ms 後：分身已移除");
  else fail("分身未清除");
  const crumb1 = await p.locator('nav[aria-label="下鑽層級"]').textContent();
  if (crumb1?.includes("臺北市")) ok("麵包屑已下鑽至臺北市"); else fail("麵包屑異常: " + crumb1);

  // ---- 4b. 縣→鎮下鑽(county→town，final review 抓到的 Critical bug 現場)：
  // 進入鎮層會觸發 App.tsx 非同步載入村里 GeoJSON，先 setVillages(null) 再 setVillages(fc)，
  // 各自都會讓 Choropleth 的 effect 再多跑一輪(view 不變、direction=null)。修好前，那些
  // 無關的重跑會把「還在播放中」的分身連同其 timer 一起清掉，造成分身在 ~60-120ms 就消失、
  // 比 850ms 全動畫壽命短很多，播出一段白閃。用 400ms 的存活檢查點來抓這個提前消失
  // （比起舊版 80ms 出現+850ms 消失兩點式檢查，中段這一點才是真正會抓到回歸的檢查）----
  if (await clickTown(p, "臺北市大安區")) ok("點擊臺北市大安區(縣→鎮下鑽)"); else fail("找不到臺北市大安區多邊形");
  if (await waitForGhostCount(p, 1)) ok("縣→鎮下鑽：分身已出現");
  else fail("縣→鎮下鑽：分身未出現");
  await p.waitForTimeout(400);
  if ((await ghostCount(p)) === 1) ok("縣→鎮下鑽 400ms：分身仍存活(未被村里 lazy-load 重繪誤清)");
  else fail("縣→鎮下鑽 400ms：分身提前消失(白閃 regression)，數量=" + (await ghostCount(p)));
  const crumbTown = await p.locator('nav[aria-label="下鑽層級"]').textContent();
  if (crumbTown?.includes("大安")) ok("麵包屑已下鑽至大安區"); else fail("麵包屑異常: " + crumbTown);
  if (await waitForGhostCount(p, 0, 1500)) ok("縣→鎮下鑽：分身最終仍正常移除(未變成永久殘留)");
  else fail("縣→鎮下鑽：分身未在時限內移除");

  // ---- 4c. 鎮→縣返回(麵包屑點臺北市)：對稱檢查——離開鎮層 App.tsx 也會 setVillages(null)，
  // 同樣的無關重繪風險，方向相反(zoom out)但問題本質相同 ----
  await p.locator('nav[aria-label="下鑽層級"] button').filter({ hasText: "臺北市" }).click();
  if (await waitForGhostCount(p, 1)) ok("鎮→縣返回：分身已出現");
  else fail("鎮→縣返回：分身未出現");
  await p.waitForTimeout(400);
  if ((await ghostCount(p)) === 1) ok("鎮→縣返回 400ms：分身仍存活(未提前消失)");
  else fail("鎮→縣返回 400ms：分身提前消失(白閃 regression)，數量=" + (await ghostCount(p)));
  if (await waitForGhostCount(p, 0, 1500)) ok("鎮→縣返回：分身最終仍正常移除");
  else fail("鎮→縣返回：分身未在時限內移除");

  // ---- 5. 點麵包屑回全國＝zoom out ----
  await p.locator('nav[aria-label="下鑽層級"] button').filter({ hasText: "全國" }).click();
  if (await waitForGhostCount(p, 1)) ok("回全國瞬間：分身存在 1 個(zoom out 動畫進行中)");
  else fail("回全國瞬間分身數異常: " + (await ghostCount(p)));
  // 與 zoom-in 的 midPaths 對稱檢查：動畫進行中，底層地圖內容應已是全國層(本島 20-30 縣市 + 2 inset)，
  // 不是還停在臺北市(這正是用 <img> 分身、不是 cloneNode 插 <svg> 的意義——分身蓋在上面，底層可以先切好)。
  const midNationMain = await p.evaluate(() => document.querySelectorAll(".chart-map svg:not([data-zoom-ghost]) path:not(.inset-path)").length);
  const midNationInset = await p.evaluate(() => document.querySelectorAll(".chart-map svg:not([data-zoom-ghost]) .inset-path").length);
  if (midNationMain >= 20 && midNationMain < 30 && midNationInset === 2)
    ok(`回全國瞬間：地圖內容已是全國層(${midNationMain} 縣市+${midNationInset} inset)，不受分身影響`);
  else fail(`回全國瞬間地圖內容異常 main=${midNationMain} inset=${midNationInset}`);
  if (await waitForGhostCount(p, 0, 1500)) ok("回全國 850ms 後：分身已移除");
  else fail("回全國分身未清除");

  // ---- 6. 快速連續點擊(並發保護)：不留下多個殘留分身 ----
  await clickCounty(p, "臺北市");
  await p.waitForTimeout(80);
  await p.locator('nav[aria-label="下鑽層級"] button').filter({ hasText: "全國" }).click();
  await p.waitForTimeout(80);
  await clickCounty(p, "高雄市");
  await p.waitForTimeout(80);
  const rapidGhosts = await ghostCount(p);
  if (rapidGhosts <= 1) ok(`快速連續操作：分身數 ${rapidGhosts}（不堆疊，最後動作贏）`);
  else fail("快速連續操作留下多個分身: " + rapidGhosts);
  await p.waitForTimeout(850);
  if ((await ghostCount(p)) === 0) ok("快速操作結束 850ms 後：分身已全數清除");
  else fail("快速操作後仍有殘留分身");

  // ---- 7. reduced-motion：瞬間切換，完全無分身 ----
  const p2 = await b.newPage({ viewport: { width: 1500, height: 950 }, reducedMotion: "reduce" });
  p2.on("pageerror", (e) => errors.push(String(e)));
  p2.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); }); // 與 p 同款監聽，避免 reduced-motion 專屬的 React console error 被放過
  await p2.goto("http://localhost:5173");
  await p2.waitForFunction(() => document.querySelectorAll("svg path").length >= 20, null, { timeout: 30000 });
  await clickCounty(p2, "臺南市");
  await p2.waitForTimeout(200);
  if ((await ghostCount(p2)) === 0) ok("reduced-motion：下鑽不建立分身");
  else fail("reduced-motion 仍建立了分身");
  const crumb2 = await p2.locator('nav[aria-label="下鑽層級"]').textContent();
  if (crumb2?.includes("臺南市")) ok("reduced-motion：下鑽仍正確瞬間切換至臺南市");
  else fail("reduced-motion 下鑽失敗: " + crumb2);
  await p2.close();

  if (errors.length) fail("console/page 錯誤: " + errors.join(" | ")); else ok("無 console/page 錯誤");
} catch (e) {
  fail("腳本執行中發生例外(可能是選擇器/時序對不上): " + (e?.message ?? e));
} finally {
  await b.close();
}
console.log(process.exitCode ? "== 有項目失敗 ==" : "== 全部通過 ==");
