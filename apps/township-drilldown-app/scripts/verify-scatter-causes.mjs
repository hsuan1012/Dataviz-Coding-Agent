// 十大死因進散布圖四通道驗證(合併單頁版):optgroup/死因×死因/死因當顏色/名單保留/
// 左側死亡率鈕+X下拉死因帶入全頁。需先 npm run dev(localhost:5173)。
import { chromium } from "playwright";
const fail = (m) => { console.error("FAIL: " + m); process.exitCode = 1; };
const ok = (m) => console.log("PASS: " + m);
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";
// 截圖輸出到 repo 內的 docs/superpowers/artifacts(已 gitignore),路徑相對於本腳本位置、不綁機器。
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "docs", "superpowers", "artifacts");
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await p.goto("http://localhost:5173");
await p.waitForFunction(() => document.querySelectorAll("svg path").length >= 20, null, { timeout: 30000 });
await p.waitForTimeout(800); // 合併單頁:散布圖同屏,無需切頁

const axisTexts = () => p.evaluate(() =>
  Array.from(document.querySelectorAll("svg g.axes text")).map((t) => t.textContent));
const dotN = () => p.locator("svg g.dots circle").count();

// 1) optgroup 分組存在(四通道都有)
for (const ch of ["x", "y", "color", "size"]) {
  const n = await p.locator(`select.scatter-ch[data-ch="${ch}"] optgroup[label="十大死因"] option`).count();
  if (n === 10) ok(`通道 ${ch}:十大死因 optgroup=10 項`); else fail(`通道 ${ch} 死因項=${n}`);
}

// 2) 死因×死因:X=惡性腫瘤、Y=肺炎;X=全頁指標(標題/排名/村里降級)→ 標題同步
// 老師 8/11 回饋:地圖圖例改跟「顏色」通道走,不再跟 X——地圖圖例同步的斷言移到下一段(改顏色時驗)。
await p.locator('select.scatter-ch[data-ch="x"]').selectOption({ label: "惡性腫瘤" });
await p.locator('select.scatter-ch[data-ch="y"]').selectOption({ label: "肺炎" });
await p.waitForTimeout(900);
const ax = await axisTexts();
if (ax.some((t) => t?.includes("惡性腫瘤"))) ok("X 軸標題=惡性腫瘤"); else fail("X 軸標題未變: " + ax.join("/"));
if (ax.some((t) => t?.includes("肺炎"))) ok("Y 軸標題=肺炎"); else fail("Y 軸標題未變");
if ((await dotN()) === 368) ok("死因×死因點數=368(無缺值剔除)"); else fail(`點數=${await dotN()}`);
if ((await p.locator("h1").textContent())?.includes("惡性腫瘤")) ok("X=死因 → 頁標題同步(X=全頁指標)");
else fail("頁標題未同步死因");
await p.screenshot({ path: `${OUT}/causes-scatter-pair.png` });

// 3) 顏色=糖尿病 → 色條出現+泡泡連續色階+地圖圖例同步(老師 8/11:地圖改跟顏色通道走)
await p.locator('select.scatter-ch[data-ch="color"]').selectOption({ label: "糖尿病" });
await p.waitForTimeout(900);
if ((await p.locator("svg.colorbar").count()) === 1) ok("顏色=糖尿病 → 色條出現"); else fail("無色條");
const fills = await p.evaluate(() =>
  new Set(Array.from(document.querySelectorAll("svg g.dots circle")).map((c) => c.getAttribute("fill"))).size);
if (fills > 20) ok(`泡泡連續色階生效(${fills} 種填色)`); else fail(`填色種類過少 ${fills}`);
const mapText = await p.locator(".map-legend").textContent();
if (mapText?.includes("糖尿病")) ok("顏色=糖尿病 → 地圖圖例同步跟著走"); else fail("地圖圖例未跟顏色通道: " + mapText);
await p.screenshot({ path: `${OUT}/causes-color-channel.png` });

// 4) 框選+切死因通道 → 名單保留
// 7/30:框選改為需先按「選取」開啟模式(不再一律可拖曳)
await p.locator(".scatter-mode-select").click();
await p.waitForTimeout(150);
const box = await p.locator(".chart-scatter svg[width='100%']").boundingBox();
await p.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
await p.mouse.down();
await p.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, { steps: 8 });
await p.mouse.up();
await p.waitForTimeout(900);
const n1 = Number((await p.locator(".mini-count").textContent())?.match(/\d+/)?.[0] ?? -1);
if (n1 > 0) ok(`框選鎖定 ${n1} 鄉鎮`); else fail("框選失敗");
await p.locator('select.scatter-ch[data-ch="y"]').selectOption({ label: "心臟疾病" });
await p.waitForTimeout(900);
const n2 = Number((await p.locator(".mini-count").textContent())?.match(/\d+/)?.[0] ?? -1);
if (n2 === n1) ok("切死因通道 → 名單保留"); else fail(`名單 ${n2} ≠ ${n1}`);
// 清除模式框選涵蓋目前所有已選泡泡的實際範圍 → 清空(清除鈕改為互斥框選模式,不再是按一下即清空)
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
  await p.waitForTimeout(400);
}

// 5) X 下拉選死亡率(老師 8/11:左側指標鈕已退役,改用 X 下拉);X 下拉再細選死因
await p.locator('select.scatter-ch[data-ch="x"]').selectOption({ label: "死亡率" });
await p.waitForTimeout(700);
const ax2 = await axisTexts();
if (ax2.some((t) => t?.includes("死亡率"))) ok("X 下拉選死亡率 → X=死亡率");
else fail("X 未同步死亡率: " + ax2.join("/"));
await p.locator('select.scatter-ch[data-ch="x"]').selectOption({ label: "惡性腫瘤" });
await p.waitForTimeout(700);
if ((await p.locator("h1").textContent())?.includes("惡性腫瘤")) ok("X 下拉細選死因 → 全頁跟著");
else fail("死因細選未生效");
await p.screenshot({ path: `${OUT}/causes-nav-sync.png` });

// 6) 白話解說文字(7/23):存在、講「每顆泡泡=一個鄉鎮」、跟著通道更新(此時 X=惡性腫瘤)
const cap = await p.locator("p.scatter-caption").textContent();
if (cap?.includes("每顆泡泡代表一個鄉鎮")) ok("解說文字存在且講「每顆泡泡=一個鄉鎮」");
else fail("解說文字缺失或開頭錯: " + cap);
if (cap?.includes("越靠右代表「惡性腫瘤」")) ok("解說跟著通道更新(X=惡性腫瘤)");
else fail("解說未跟通道: " + cap);

// 解說與操作說明同字級(v7 版面:兩段同塊堆疊)
const textPair = await p.evaluate(() => {
  const cap = document.querySelector("p.scatter-caption");
  const hint = document.querySelector(".mini-hint");
  if (!cap || !hint) return null;
  return { fsCap: getComputedStyle(cap).fontSize, fsHint: getComputedStyle(hint).fontSize };
});
if (textPair && textPair.fsCap === textPair.fsHint) ok(`兩段說明字級一致(${textPair.fsCap})`);
else fail(`字級不一致: ${textPair?.fsCap} vs ${textPair?.fsHint}`);

// 圖內容靠左貼齊(xMin;viewBox=1:1 動態下仍設 xMin 防禦)
const par = await p.evaluate(() => document.querySelector('.chart-scatter svg[width="100%"]')?.getAttribute("preserveAspectRatio"));
if (par === "xMinYMid meet") ok("散布圖內容靠左貼齊(preserveAspectRatio=xMin)");
else fail("preserveAspectRatio 異常: " + par);

if (errors.length) fail("console/page 錯誤: " + errors.join(" | ")); else ok("無 console/page 錯誤");
await b.close();
console.log(process.exitCode ? "== 有項目失敗 ==" : "== 全部通過 ==");
