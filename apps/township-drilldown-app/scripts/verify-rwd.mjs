// RWD 驗證(合併單頁 Bento+側欄):1500=一屏鎖定桌面版、960=堆疊+側欄頂列、740=排名單欄、
// 1920×800/1080=高度斷點(≤860 解鎖整頁捲軸+charts-row 定高;>860 維持一屏鎖定)
import { chromium } from "playwright";
const fail = (m) => { console.error("FAIL: " + m); process.exitCode = 1; };
const ok = (m) => console.log("PASS: " + m);
const OUT = "C:/Users/user/jayla";

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await p.goto("http://localhost:5173");
await p.waitForFunction(() => document.querySelectorAll("svg path").length >= 20, null, { timeout: 30000 });
await p.waitForTimeout(600);

const box = (sel) => p.locator(sel).first().boundingBox();

// ---- 1500:桌面 Bento 一屏鎖定 ----
{
  const aside = await box(".taste-aside"), map = await box(".chart-map"), sc = await box(".chart-scatter");
  if (aside.width < 300 && map.x > aside.x + aside.width - 5) ok("1500:側欄在左");
  else fail(`1500 側欄異常 w=${aside.width}`);
  if (sc.x > map.x + map.width - 40) ok("1500:地圖左、散布圖右並排"); else fail("1500 未並排");
  const m = await p.evaluate(() => ({
    fit: document.documentElement.scrollHeight <= window.innerHeight + 1,
    hOK: document.documentElement.scrollWidth <= window.innerWidth + 1,
    yearIn: document.querySelector(".year-tab").getBoundingClientRect().bottom <= window.innerHeight,
  }));
  if (m.fit) ok("1500:一屏無整頁捲軸"); else fail("1500 出現整頁捲軸");
  if (m.hOK) ok("1500:無橫向捲軸"); else fail("1500 橫向捲軸");
  if (m.yearIn) ok("1500:年份列在畫面內"); else fail("1500 年份列被擠出");
  const boxes = await p.locator(".rank-row .rank-box").all();
  if (boxes.length >= 4) {
    const b0 = await boxes[0].boundingBox(), b3 = await boxes[3].boundingBox();
    if (Math.abs(b0.y - b3.y) < 5) ok("1500:排名四卡單排"); else fail("1500 排名未單排");
  } else fail("1500 排名卡數異常: " + boxes.length);
  await p.screenshot({ path: `${OUT}/rwd-1500-merged.png` });
}

// ---- 1920×800(筆電矮視窗):高度斷點解鎖捲軸、圖表定高不再壓縮 ----
await p.setViewportSize({ width: 1920, height: 800 });
await p.waitForTimeout(700);
{
  const m = await p.evaluate(() => {
    const de = document.documentElement;
    const row = document.querySelector(".charts-row");
    const slot = document.querySelector(".chart-scatter .flex-1");
    return {
      scrollable: de.scrollHeight > de.clientHeight,
      hOK: de.scrollWidth <= de.clientWidth + 1,
      rowH: Math.round(row.getBoundingClientRect().height),
      slotH: Math.round(slot.getBoundingClientRect().height),
    };
  });
  if (m.scrollable) ok("800 高:整頁可直向捲動(高度斷點解鎖)"); else fail("800 高應可捲動");
  if (Math.abs(m.rowH - 640) <= 2) ok(`800 高:圖表列定高 640(實測 ${m.rowH})`); else fail(`800 高圖表列非定高: ${m.rowH}`);
  if (m.slotH >= 300) ok(`800 高:散布圖槽 ≥300px 不再壓成縮圖(實測 ${m.slotH})`); else fail(`800 高散布圖槽過矮: ${m.slotH}`);
  if (m.hOK) ok("800 高:無橫向捲軸"); else fail("800 高橫向捲軸");
  const bottomOK = await p.evaluate(() => {
    window.scrollTo(0, 999999);
    const r = document.querySelector(".year-tab").getBoundingClientRect();
    return r.top >= 0 && r.bottom <= document.documentElement.clientHeight;
  });
  if (bottomOK) ok("800 高:捲到底年份列完整可見"); else fail("800 高捲到底年份列不可見");
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.screenshot({ path: `${OUT}/rwd-1920x800-short.png` });
}

// ---- 1920×1080(桌機):高度斷點不觸發=一屏鎖定原樣 ----
await p.setViewportSize({ width: 1920, height: 1080 });
await p.waitForTimeout(700);
{
  const m = await p.evaluate(() => ({
    fit: document.documentElement.scrollHeight <= window.innerHeight + 1,
    yearIn: document.querySelector(".year-tab").getBoundingClientRect().bottom <= window.innerHeight,
  }));
  if (m.fit) ok("1080 高:一屏鎖定無捲軸(斷點未誤觸發)"); else fail("1080 高出現捲軸=鎖屏被破壞");
  if (m.yearIn) ok("1080 高:年份列在畫面內"); else fail("1080 高年份列被擠出");
}

// ---- 960(半屏 1920):堆疊+側欄收頂列+可直向捲動 ----
await p.setViewportSize({ width: 960, height: 950 });
await p.waitForTimeout(700);
{
  const aside = await box(".taste-aside");
  if (aside.width > 900) ok("960:側欄收成全寬頂列"); else fail(`960 側欄未收頂列 w=${aside.width}`);
  const map = await box(".chart-map"), sc = await box(".chart-scatter");
  if (sc.y > map.y + map.height - 40) ok("960:地圖上、散布圖下(堆疊)"); else fail("960 未堆疊");
  const m = await p.evaluate(() => ({
    scrollable: document.documentElement.scrollHeight > window.innerHeight,
    hOK: document.documentElement.scrollWidth <= window.innerWidth + 1,
  }));
  if (m.scrollable) ok("960:長頁可直向捲動(高度鎖解除)"); else fail("960 應可捲動");
  if (m.hOK) ok("960:無橫向捲軸"); else fail("960 橫向捲軸");
  const boxes = await p.locator(".rank-row .rank-box").all();
  const b0 = await boxes[0].boundingBox(), b1 = await boxes[1].boundingBox(), b2 = await boxes[2].boundingBox();
  if (Math.abs(b0.y - b1.y) < 5 && b2.y > b0.y + 10) ok("960:排名卡 2×2"); else fail("960 排名非 2×2");
  await p.screenshot({ path: `${OUT}/rwd-960-merged.png` });
}

// ---- 740(半屏 1536):排名單欄、頂列縣市導覽可用 ----
await p.setViewportSize({ width: 740, height: 950 });
await p.waitForTimeout(700);
{
  const boxes = await p.locator(".rank-row .rank-box").all();
  const b0 = await boxes[0].boundingBox(), b1 = await boxes[1].boundingBox();
  if (b1.y > b0.y + 10) ok("740:排名卡單欄堆疊"); else fail("740 排名未單欄");
  // 老師 8/11:左側指標鈕退役,改可開合縣市/鄉鎮區導覽——這裡改驗窄版頂列的縣市按鈕仍可下鑽。
  await p.locator('nav[aria-label="縣市／鄉鎮區導覽"] button', { hasText: "新北市" }).click();
  await p.waitForTimeout(600);
  if ((await p.locator('nav[aria-label="下鑽層級"]').textContent())?.includes("新北市")) ok("740:頂列點縣市可下鑽");
  else fail("740 頂列點縣市失效");
  const hOK = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  if (hOK) ok("740:無橫向捲軸"); else fail("740 橫向捲軸");
  await p.screenshot({ path: `${OUT}/rwd-740-merged.png` });
}

// ---- 回 1500:還原 ----
await p.setViewportSize({ width: 1500, height: 950 });
await p.waitForTimeout(700);
{
  const map = await box(".chart-map"), sc = await box(".chart-scatter");
  if (sc.x > map.x + map.width - 40) ok("回 1500:並排還原"); else fail("回 1500 未還原");
}

if (errors.length) fail("console/page 錯誤: " + errors.join(" | ")); else ok("無 console/page 錯誤");
await b.close();
console.log(process.exitCode ? "== 有項目失敗 ==" : "== 全部通過 ==");
