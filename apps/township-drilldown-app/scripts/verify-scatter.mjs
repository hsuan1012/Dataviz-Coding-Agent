// 關係圖 crossfilter 驗證：四通道下拉、X 進頁同步頁籤、色條/區域圖例切換、
// 全組合掃描不 crash、keyed join 補間動畫保留
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
await p.waitForFunction(() => document.querySelectorAll(".chart-map svg path").length >= 20, null, { timeout: 30000 });
await p.waitForTimeout(500); // 合併單頁:散布圖同屏,無需切頁

const axisLabels = () => p.evaluate(() => Array.from(document.querySelectorAll("svg g.axes text")).map((t) => t.textContent).slice(-2));
const setCh = async (ch, label) => { await p.locator(`select.scatter-ch[data-ch="${ch}"]`).selectOption({ label }); await p.waitForTimeout(350); };

// 1) 四個通道下拉都在
const nSel = await p.locator("select.scatter-ch").count();
if (nSel === 4) ok("四通道下拉(X/Y/大小/顏色)都在"); else fail(`下拉數 ${nSel} ≠ 4`);

// 2) 進頁 X=當前頁籤指標(預設人口密度)
let ax = await axisLabels();
if (ax[0].includes("人口密度")) ok("X 初始=頁籤指標(人口密度)"); else fail("X 初始異常: " + ax[0]);

// 3) X 下拉自由切換(不再鎖頁籤)
await setCh("x", "醫院醫事人力");
ax = await axisLabels();
if (ax[0].includes("醫院")) ok("X 下拉切醫院醫事人力 → 軸標題跟著變"); else fail("X 未變: " + ax[0]);

// 4) Y 下拉
await setCh("y", "平均所得");
ax = await axisLabels();
if (ax[1].includes("平均所得")) ok("Y 下拉 → Y 軸=平均所得"); else fail("Y 未變: " + ax[1]);

// 5) 顏色=指標 → 色條出現、泡泡呈連續色;切回區域 → 圖例還原
await setCh("color", "人口密度");
if ((await p.locator("svg.colorbar").count()) === 1) ok("顏色=人口密度 → 色條出現"); else fail("色條未出現");
// 等補間結束(750ms)再取樣,測穩定後的填色而非過場值
await p.waitForTimeout(900);
const fills = await p.evaluate(() =>
  new Set(Array.from(document.querySelectorAll("svg g.dots circle")).map((c) => c.getAttribute("fill"))).size);
if (fills > 20) ok(`連續色階生效(${fills} 種填色 > 分類 5 色)`); else fail(`填色種類過少 ${fills}`);
await p.screenshot({ path: `${OUT}/scatter-crossfilter-colorbar.png` });
await setCh("color", "區域");
if ((await p.locator("svg.colorbar").count()) === 0) ok("顏色=區域 → 色條移除、圖例還原"); else fail("色條未移除");

// 5b) 大小圖例(老師 7/20 建議;7/23 使用者改指定位置=圖下方與區域圖例同列):
//     2–3 顆遞增空心圓、單位跟著大小通道換;圖例列左緣對齊 Y 軸線
const chOrder = await p.evaluate(() =>
  Array.from(document.querySelectorAll("select.scatter-ch")).map((s) => s.getAttribute("data-ch")));
if (chOrder.join(",") === "x,y,color,size") ok("下拉順序=X/Y/顏色/大小(大小在最後)");
else fail("下拉順序異常: " + chOrder.join(","));
const sizeLegend = async () => p.evaluate(() => {
  const svg = document.querySelector("svg.size-legend");
  if (!svg) return null;
  const rs = Array.from(svg.querySelectorAll("circle")).map((c) => +c.getAttribute("r"));
  const label = svg.parentElement?.textContent ?? "";
  // 圖例是否在圖下方的圖例列(與區域圖例/色條同列;7/23 使用者指定)
  const row = svg.closest("div.legend-row");
  const inLegendRow = !!row;
  // 圖例列左緣是否對齊 Y 軸線(viewBox=1:1 動態 ⇒ 從 svg 讀 W/H;M.l=56)
  const chartSvg = document.querySelector('.chart-scatter svg[width="100%"]');
  const chart = chartSvg?.getBoundingClientRect();
  const [, , vbW, vbH] = chartSvg?.getAttribute("viewBox")?.split(" ").map(Number) ?? [0, 0, 1, 1];
  const rowBox = row?.getBoundingClientRect();
  const axisL = chart ? chart.left + 56 * Math.min(chart.width / vbW, chart.height / vbH) : null;
  const alignDiff = rowBox && axisL !== null ? Math.abs(rowBox.left - axisL) : null;
  // 圖例列在圖「上方」(7/23 使用者指定)
  const aboveChart = rowBox && chart ? rowBox.bottom <= chart.top + 2 : null;
  return { rs, label, inLegendRow, alignDiff, aboveChart };
});
let sl = await sizeLegend();
if (sl && sl.rs.length >= 2 && sl.rs.length <= 3) ok(`大小圖例存在(${sl.rs.length} 顆參考圓)`);
else fail("大小圖例缺或圓數異常: " + JSON.stringify(sl));
if (sl && sl.inLegendRow) ok("大小圖例在圖例列(與區域圖例同列)");
else fail("大小圖例不在圖例列");
if (sl && sl.alignDiff !== null && sl.alignDiff <= 24) ok(`圖例列左緣對齊 Y 軸線(差 ${sl.alignDiff.toFixed(1)}px)`);
else fail("圖例列未對齊 Y 軸: " + JSON.stringify(sl?.alignDiff));
if (sl && sl.aboveChart) ok("圖例列位於圖上方(控制列與圖之間)");
else fail("圖例列不在圖上方");
if (sl && sl.rs.every((v, i) => i === 0 || v > sl.rs[i - 1])) ok(`圖例圓遞增(${sl.rs.map((v) => v.toFixed(1)).join("→")}px)`);
else fail("圖例圓未遞增: " + sl?.rs);
if (sl && sl.label.includes("千元/戶")) ok("圖例單位=目前大小通道(平均所得 千元/戶)");
else fail("圖例單位異常: " + sl?.label);
await setCh("size", "死亡率");
sl = await sizeLegend();
if (sl && sl.label.includes("每10萬人")) ok("切大小通道 → 圖例單位同步(每10萬人)");
else fail("切大小後圖例未同步: " + sl?.label);
// 5b-2) 大小=人口密度(最大參考圓貼半徑上限)→ 引線標籤不得被 SVG 上緣裁掉(7/20 使用者截圖抓到)
await setCh("size", "人口密度");
const clipped = await p.evaluate(() => {
  const svg = document.querySelector("svg.size-legend");
  if (!svg) return "no svg";
  const texts = Array.from(svg.querySelectorAll("text"));
  const bad = texts.filter((t) => +t.getAttribute("y") - 10 < 0).map((t) => t.textContent);
  return bad.length ? bad.join(",") : null;
});
if (!clipped) ok("大小=密度:圖例標籤皆在 SVG 內(無裁切)");
else fail("圖例標籤被裁: " + clipped);
await setCh("size", "平均所得");

// 5c) 泡泡大小(老師 7/20 建議的放大視覺,Bento 1:1 座標系上限 16px 顯示≈等值):最大泡泡貼上限
await p.waitForTimeout(900); // 等大小回切的補間結束再量,避免取到過場半徑
const maxR = await p.evaluate(() =>
  Math.max(...Array.from(document.querySelectorAll("svg g.dots circle")).map((c) => +c.getAttribute("r"))));
if (maxR > 12) ok(`最大泡泡 r=${maxR.toFixed(1)}px(上限 16,1:1 顯示;domain nice 後實值略低於上限)`); else fail(`最大泡泡過小 r=${maxR}`);

// 6) X 下拉切指標 → 軸同步(老師 8/11:左側指標鈕已退役,改由 X 下拉承擔這個角色)
await p.locator('select.scatter-ch[data-ch="x"]').selectOption({ label: "死亡率" });
await p.waitForTimeout(500);
ax = await axisLabels();
if (ax[0].includes("死亡率")) ok("X 下拉切指標 → 軸同步為死亡率"); else fail("X 未同步: " + ax[0]);

// 7) 全組合掃描:四通道逐一切過全部選項,結尾泡泡數=368、無錯誤
const indLabels = await p.evaluate(() =>
  Array.from(document.querySelectorAll('select.scatter-ch[data-ch="x"] option')).map((o) => o.textContent));
for (const ch of ["x", "y", "size"]) for (const lb of indLabels) await setCh(ch, lb);
for (const lb of ["區域", ...indLabels]) await setCh("color", lb);
const nDots = await p.locator("svg g.dots circle").count();
if (nDots === 368) ok(`通道掃描後泡泡數仍 ${nDots}(368 鄉鎮)`); else fail(`泡泡數異常 ${nDots}`);
await p.screenshot({ path: `${OUT}/scatter-crossfilter-sweep-end.png` });

// 8) keyed join 補間動畫保留:107 → 102 節點不重建、全體移動
await setCh("x", "人口密度"); await setCh("y", "死亡率"); await setCh("size", "平均所得"); await setCh("color", "區域");
const before = await p.evaluate(() => {
  const circles = Array.from(document.querySelectorAll("svg g.dots circle"));
  circles.forEach((c, i) => c.setAttribute("data-tag", "y" + i));
  const map = {};
  circles.forEach((c) => { map[c.__data__.township] = { cx: +c.getAttribute("cx"), cy: +c.getAttribute("cy") }; });
  return { tagged: circles.length, map };
});
await p.locator(".year-tab", { hasText: "102 年" }).click();
await p.waitForTimeout(120);
const persisted = await p.evaluate(() =>
  Array.from(document.querySelectorAll("svg g.dots circle")).filter((c) => c.getAttribute("data-tag")).length);
if (persisted === before.tagged) ok(`切年份節點不重建(${persisted}/${before.tagged}=keyed join 補間)`);
else fail(`節點被重建 persisted=${persisted}/${before.tagged}`);
await p.waitForTimeout(1000);
const moved = await p.evaluate((before) => {
  let n = 0;
  for (const c of document.querySelectorAll("svg g.dots circle")) {
    const b0 = before.map[c.__data__.township];
    if (b0 && Math.hypot(+c.getAttribute("cx") - b0.cx, +c.getAttribute("cy") - b0.cy) > 1) n++;
  }
  return n;
}, before);
if (moved > 200) ok(`全體位置補間:${moved} 泡泡移動`); else fail(`移動泡泡過少 ${moved}`);

// 8b) 使用說明彈窗(使用者要求,7/31):按鈕在「清除」右邊、預設收合;點下彈出、
// 內容含白話解說+四點操作列表+目前選取狀態;彈窗須完整落在卡片範圍內(不跑出左右邊界)。
const helpToggle = p.locator(".scatter-help-toggle");
if ((await helpToggle.count()) === 1) ok("使用說明按鈕存在(清除右邊)"); else fail("找不到使用說明按鈕");
if ((await helpToggle.getAttribute("aria-pressed")) === "false") ok("使用說明預設收合");
else fail("使用說明預設應為收合");
await helpToggle.click();
await p.waitForTimeout(200);
const helpText = await p.evaluate(() =>
  document.querySelector(".scatter-caption").closest("div[style*='position: fixed']").textContent);
if (helpText?.includes("每顆泡泡代表一個鄉鎮") && helpText?.includes("滾輪") && helpText?.includes("選取") && helpText?.includes("清除"))
  ok("使用說明內容含白話解說+四項操作說明");
else fail("使用說明內容缺漏: " + helpText);
const bulletStyle = await p.evaluate(() => getComputedStyle(document.querySelector(".scatter-caption + ul li")).listStyleType);
if (bulletStyle === "disc") ok("使用說明用列點顯示(list-style: disc)"); else fail("列點樣式異常: " + bulletStyle);
// 8/3 改 portal 到 document.body(見 Scatter.tsx):不再受卡片 overflow-hidden 限制,
// 只需確認落在瀏覽器視窗內(不會跑出螢幕外),不用再侷限在 .chart-scatter 卡片範圍。
const bounds = await p.evaluate(() => {
  const rect = (el) => el.getBoundingClientRect();
  const box = document.querySelector(".scatter-caption").closest("div[style*='position: fixed']");
  const b = rect(box);
  return { insideLeft: b.x >= -1, insideRight: b.right <= window.innerWidth + 1 };
});
if (bounds.insideLeft && bounds.insideRight) ok("使用說明彈窗完整落在瀏覽器視窗內(不跑出螢幕外)");
else fail("使用說明彈窗跑出視窗邊界: " + JSON.stringify(bounds));
// 8/7 使用者要求(比照 gapminder):點「彈窗以外任何空白處」都要關閉——包含散布圖空白處。
// 散布圖空白處掛著 d3.brush overlay,它的 mousedown 會 stopImmediatePropagation,冒泡階段的
// document 監聽收不到;關閉監聽須掛捕獲階段才能比 brush 先收到(此斷言即防這個回歸)。
const helpVisible = () => p.evaluate(() => {
  const el = document.querySelector(".scatter-help-popup");
  return !!el && getComputedStyle(el).display !== "none";
});
{
  const bx = await p.locator(".chart-scatter svg[width='100%']").boundingBox();
  // 點擊座標選圖表左下(0.3,0.8):彈窗浮在散布圖「右上方」(540px 寬、按鈕列正下方),
  // 座標太靠右上會打中彈窗本身(打中彈窗不關是設計行為)——除錯時就是這樣誤判成「不會關」。
  await p.mouse.click(bx.x + bx.width * 0.3, bx.y + bx.height * 0.8); // 散布圖空白處(彈窗範圍外)
  await p.waitForTimeout(250);
  if (!(await helpVisible())) ok("點散布圖空白處 → 使用說明彈窗關閉(pointerdown 捕獲層,brush overlay 擋不掉)");
  else { fail("點散布圖空白處未關閉使用說明彈窗(pointerdown 被 brush overlay 吃掉)"); await helpToggle.click(); await p.waitForTimeout(150); }
}
await p.waitForTimeout(100);

if (errors.length) fail("console/page 錯誤: " + errors.join(" | "));
else ok("全程無 console/page error");
await b.close();
console.log(process.exitCode ? "== 有項目失敗 ==" : "== 全部通過 ==");
