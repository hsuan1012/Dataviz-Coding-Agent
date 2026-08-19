// 框選連動驗證(合併單頁 Bento 版):框選→主地圖高亮疊加、切年/切通道名單不變、雙擊剔除、
// 清除還原。老師 8/11 回饋移除年份播放▶鈕後,原「播放」段落已刪除,只留框選/選取相關驗證。
// 需先 npm run dev(localhost:5173)。檔名沿用 verify-brush-play 舊名(歷史因素,行為已不含 play)。
import { chromium } from "playwright";
const fail = (m) => { console.error("FAIL: " + m); process.exitCode = 1; };
const ok = (m) => console.log("PASS: " + m);
const OUT = "C:/Users/user/jayla/township-drilldown-app/docs/superpowers/artifacts";

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await p.goto("http://localhost:5173");
await p.waitForFunction(() => document.querySelectorAll("svg path").length >= 20, null, { timeout: 30000 });

// ---- 框選連動(合併單頁:散布圖與主地圖同屏) ----
// 框選 coach mark(7/23):初次造訪(乾淨 context)應顯示
if ((await p.locator("button.brush-hint").count()) === 1) ok("初次造訪顯示框選提示章");
else fail("初次造訪無框選提示章");

const sbox = () => p.locator(".chart-scatter svg[width='100%']").boundingBox();
// .scatter-select-toggle 兩顆按鈕(選取/清除)共用視覺樣式,各自疊專屬 class 精準辨識
// (單靠 :not(.sel-clear) 排除法在多顆鈕時會失效,故用專屬 class 而非排除法)
const selectToggle = p.locator(".scatter-mode-select");
const clearToggle = p.locator("button.sel-clear");
const countOf = async () => Number((await p.locator(".mini-count").textContent())?.match(/\d+/)?.[0] ?? -1);
// 拖曳一個「畫面座標比例」框(viewBox=元素尺寸 1:1,取畫面座標比例換算即可對應 svg 座標)
const dragFrac = async (fx0, fy0, fx1, fy1) => {
  const bx = await sbox();
  if (!bx) { fail("找不到散布圖 svg"); process.exit(1); }
  const pt = (fx, fy) => [bx.x + bx.width * fx, bx.y + bx.height * fy];
  const [ax0, ay0] = pt(fx0, fy0), [ax1, ay1] = pt(fx1, fy1);
  await p.mouse.move(ax0, ay0); await p.mouse.down();
  await p.mouse.move(ax1, ay1, { steps: 8 }); await p.mouse.up();
  await p.waitForTimeout(900);
};
const dragPx = async ([ax0, ay0, ax1, ay1]) => {
  await p.mouse.move(ax0, ay0); await p.mouse.down();
  await p.mouse.move(ax1, ay1, { steps: 8 }); await p.mouse.up();
  await p.waitForTimeout(900);
};
// 兩個固定、互斥的畫面比例框(實測過:各自非空、加總≈中央大框的總數,不會不小心框到「幾乎全部」
// ——這批資料在預設通道下集中在低值區,曾試過依資料 min/max 動態切兩半或框單一泡泡座標,
// 兩者都會因為密集群聚而失準:前者常框到 8~9 成泡泡,後者常因起訖點落在鄰近泡泡上而完全框不到)。
const boxA = [0.25, 0.25, 0.475, 0.7];
const boxB = [0.475, 0.25, 0.7, 0.7];
// 清除模式:框選「目前所有已選泡泡」的實際涵蓋範圍(讀 DOM 真實位置,不猜資料分布)→ 全清
const clearAllSelectedViaDrag = async () => {
  const encl = await p.evaluate(() => {
    const rects = Array.from(document.querySelectorAll("g.dots circle"))
      .filter((c) => Number(c.getAttribute("fill-opacity")) > 0.5)
      .map((c) => c.getBoundingClientRect());
    if (!rects.length) return null;
    const x0 = Math.min(...rects.map((r) => r.x)) - 8, y0 = Math.min(...rects.map((r) => r.y)) - 8;
    const x1 = Math.max(...rects.map((r) => r.x + r.width)) + 8, y1 = Math.max(...rects.map((r) => r.y + r.height)) + 8;
    return [x0, y0, x1, y1];
  });
  if (encl) await dragPx(encl);
};

// ---- 選取/清除模式(7/30 修正為互斥的對稱框選鈕):預設關閉,拖曳/單擊無反應 ----
if ((await selectToggle.getAttribute("aria-pressed")) === "false") ok("選取模式預設關閉");
else fail("選取模式預設應為關閉");
if (await clearToggle.isDisabled()) ok("清除鈕預設停用(無選取)"); else fail("清除鈕預設應停用");

await dragFrac(0.25, 0.25, 0.7, 0.7); // 兩個模式都關閉時拖曳
if (await clearToggle.isDisabled()) ok("兩模式都關閉時拖曳無反應(仍無選取)");
else fail("兩模式都關閉時拖曳竟有作用");

await selectToggle.click();
await p.waitForTimeout(150);
if ((await selectToggle.getAttribute("aria-pressed")) === "true") ok("按「選取」→ 開啟選取模式");
else fail("選取模式未開啟");

// 依序框選兩個互斥的固定範圍(boxA/boxB):驗證選取模式框選＝累加,不是取代
await dragFrac(...boxA);
const nA = await countOf();
if (nA > 0) ok(`選取模式框選 boxA → 鎖定 ${nA} 鄉鎮`); else fail("框選 boxA 後名單為 0");
await dragFrac(...boxB);
let n = await countOf();
if (n > nA) ok(`再框選 boxB → 累加為 ${n}(> ${nA},未取代舊名單)`);
else fail(`框選 boxB 後 ${n} 未大於 ${nA}(疑似取代而非累加)`);
// boxA 與 boxB 的 X 範圍不重疊(0.25-0.475 / 0.475-0.7):只要還有選中的泡泡落在 boxA 的
// X 範圍內,就證明框 boxB 沒有把 boxA 選的取代掉。
{
  const bx = await sbox();
  const boundaryX = bx.x + bx.width * boxA[2];
  const aStillIn = await p.evaluate((bxRight) =>
    Array.from(document.querySelectorAll("g.dots circle"))
      .some((c) => Number(c.getAttribute("fill-opacity")) > 0.5 && c.getBoundingClientRect().x < bxRight), boundaryX);
  if (aStillIn) ok("框選 boxB 後,boxA 範圍內仍有泡泡保留在選取中(確認累加語意)");
  else fail("框選 boxB 後 boxA 的泡泡被取代掉了");
}

// 操作說明:未選教「怎麼框選」,選取後=「已選 N+名單保留/雙擊剔除」與「還原」兩行
const countLine = await p.locator(".mini-count").textContent();
if (countLine?.includes("保留")) ok("選取後說明=名單保留"); else fail("選取後說明異常: " + countLine);
if (countLine?.includes("雙擊")) ok("選取後說明含雙擊剔除提示"); else fail("說明缺雙擊提示: " + countLine);

// coach mark:框選成功後收起
if ((await p.locator("button.brush-hint").count()) === 0) ok("框選成功後提示章收起");
else fail("框選後提示章仍在");

// 主地圖:選中鄉鎮彩色疊加數=已選 N(合併單頁取代迷你地圖)
let hi = await p.locator(".chart-map g.sel-overlay path").count();
if (hi === n) ok(`主地圖高亮疊加數 ${hi} = 已選 N`); else fail(`高亮 ${hi} ≠ 已選 ${n}`);
let dim = await p.evaluate(() =>
  Array.from(document.querySelectorAll("g.dots circle"))
    .filter((c) => Number(c.getAttribute("fill-opacity")) < 0.3).length);
if (dim > 0) ok(`名單外泡泡已調暗(${dim} 顆)`); else fail("無泡泡被調暗");
await p.screenshot({ path: `${OUT}/brush-selected.png` });

// 切年份 → 名單不變(鎖名單非鎖區域)
await p.locator(".year-tab", { hasText: "103" }).click();
await p.waitForTimeout(900);
let n2 = await countOf();
if (n2 === n) ok("切年份 → 名單不變"); else fail(`切年後 ${n2} ≠ ${n}`);

// 切通道 → 名單不變;X 下拉=全頁指標 → 標題同步
await p.locator('select.scatter-ch[data-ch="x"]').selectOption({ label: "醫院醫事人力" });
await p.waitForTimeout(900);
n2 = await countOf();
if (n2 === n) ok("切 X 通道 → 名單不變"); else fail(`切通道後 ${n2} ≠ ${n}`);
const h1 = await p.locator("h1").textContent();
if (h1?.includes("醫院醫事人力")) ok("切 X → 頁標題同步(X=全頁指標)"); else fail("標題未同步: " + h1);
await p.screenshot({ path: `${OUT}/brush-channel-kept.png` });

// ---- 單擊泡泡(選取模式)累加選取,重複點擊不重複加入 ----
await p.evaluate(() => {
  const c = Array.from(document.querySelectorAll("g.dots circle"))
    .find((el) => Number(el.getAttribute("fill-opacity")) < 0.3); // 挑一顆未選中的
  c?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});
await p.waitForTimeout(500);
n2 = await countOf();
if (n2 === n + 1) ok(`單擊未選泡泡(選取模式) → 累加為 ${n2}`); else fail(`單擊累加異常 ${n2} ≠ ${n + 1}`);
n = n2;
await p.evaluate(() => {
  const c = Array.from(document.querySelectorAll("g.dots circle"))
    .find((el) => Number(el.getAttribute("fill-opacity")) > 0.5); // 挑一顆已選中的
  c?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});
await p.waitForTimeout(500);
n2 = await countOf();
if (n2 === n) ok("重複單擊已選泡泡(選取模式) → 不重複加入"); else fail(`重複單擊異常 ${n2} ≠ ${n}`);

// ---- 雙擊剔除(老師 7/24):名單內泡泡 dblclick 移出;未選點無反應。不受選取/清除模式影響 ----
// dblclick 用 dispatchEvent(小元素真滑鼠會點鄰元素教訓);選中=fill-opacity 0.7、未選=0.25
await p.evaluate(() => {
  const c = Array.from(document.querySelectorAll("g.dots circle"))
    .find((el) => Number(el.getAttribute("fill-opacity")) > 0.5);
  c?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
});
await p.waitForTimeout(900);
const nEx = await countOf();
if (nEx === n - 1) ok(`雙擊已選泡泡 → 名單 ${n}→${nEx}`); else fail(`雙擊剔除異常 ${nEx} ≠ ${n - 1}`);
const hiEx = await p.locator(".chart-map g.sel-overlay path").count();
if (hiEx === nEx) ok(`剔除後主地圖高亮同步(${hiEx})`); else fail(`剔除後高亮 ${hiEx} ≠ ${nEx}`);
await p.evaluate(() => {
  const c = Array.from(document.querySelectorAll("g.dots circle"))
    .find((el) => Number(el.getAttribute("fill-opacity")) < 0.3);
  c?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
});
await p.waitForTimeout(600);
const nNoop = await countOf();
if (nNoop === nEx) ok("雙擊未選泡泡 → 名單不變(只做剔除不加回)"); else fail(`未選點誤觸 ${nNoop} ≠ ${nEx}`);
n = nNoop;

// ---- 清除模式(7/30 初版兩輪修正,8/4 再改單擊行為):與選取模式互斥;框選依模式加減;
// 單擊(8/4 改為依模式分流):清除模式單擊已選泡泡=移出,單擊未選泡泡=無反應(不再誤加入)----
await clearToggle.click(); // 開啟清除模式,應自動關閉選取模式(互斥)
await p.waitForTimeout(150);
if ((await clearToggle.getAttribute("aria-pressed")) === "true") ok("按「清除」→ 開啟清除模式");
else fail("清除模式未開啟");
if ((await selectToggle.getAttribute("aria-pressed")) === "false") ok("開啟清除模式 → 選取模式自動關閉(互斥)");
else fail("選取模式未自動關閉");

// 清除模式下單擊一顆未選中的泡泡(8/4 改為)→ 無反應,不會誤加入
await p.evaluate(() => {
  const c = Array.from(document.querySelectorAll("g.dots circle"))
    .find((el) => Number(el.getAttribute("fill-opacity")) < 0.3);
  c?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});
await p.waitForTimeout(500);
n2 = await countOf();
if (n2 === n) ok(`清除模式下單擊未選泡泡 → 無反應,名單仍 ${n2}(8/4:取代原本會誤加入的行為)`);
else fail(`清除模式單擊未選泡泡異常 ${n2} ≠ ${n}`);

// 清除模式下單擊一顆已選中的泡泡(8/4 新行為)→ 移出選取(等同 onExcludeTown)
await p.evaluate(() => {
  const c = Array.from(document.querySelectorAll("g.dots circle"))
    .find((el) => Number(el.getAttribute("fill-opacity")) > 0.5);
  c?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});
await p.waitForTimeout(500);
n2 = await countOf();
if (n2 === n - 1) ok(`清除模式下單擊已選泡泡 → 移出選取,名單 ${n}→${n2}(8/4 新行為)`);
else fail(`清除模式單擊已選泡泡異常 ${n2} ≠ ${n - 1}`);
n = n2;

// 清除模式框選 boxA → 只移出落在 boxA 的已選項目,boxB 範圍內的應仍保留(累減不是一次清空)
await dragFrac(...boxA);
n2 = await countOf();
const bStillIn = await p.evaluate((bxRight) =>
  Array.from(document.querySelectorAll("g.dots circle"))
    .some((c) => Number(c.getAttribute("fill-opacity")) > 0.5 && c.getBoundingClientRect().x >= bxRight),
  (await sbox()).x + (await sbox()).width * boxA[2]);
if (n2 < n) ok(`清除模式框選 boxA → 部分移出,名單 ${n}→${n2}`); else fail(`清除模式框選未如預期移出: ${n2}(原 ${n})`);
if (bStillIn) ok("清除模式框選 boxA 後,boxB 範圍內的已選泡泡仍保留(確認累減而非全清)");
else fail("清除模式框選後 boxB 的已選泡泡也被清掉了(疑似做成全清)");
n = n2;

// 清除模式框選涵蓋「目前所有已選泡泡」的實際範圍 → 名單清空(=null,無 .mini-count),清除模式自動退出
await clearAllSelectedViaDrag();
if ((await p.locator(".mini-count").count()) === 0) ok("清除模式框選涵蓋剩餘全部 → 名單清空");
else fail("框選後名單未清空: " + (await p.locator(".mini-count").textContent()));
if (await clearToggle.isDisabled()) ok("名單清空 → 清除鈕自動停用");
else fail("名單清空後清除鈕未停用");
if ((await clearToggle.getAttribute("aria-pressed")) === "false") ok("名單清空 → 清除模式自動退出");
else fail("清除模式未自動退出");
let dim2 = await p.evaluate(() =>
  Array.from(document.querySelectorAll("g.dots circle"))
    .filter((c) => Number(c.getAttribute("fill-opacity")) < 0.3).length);
if (dim2 === 0) ok("清空後泡泡全還原"); else fail(`仍有 ${dim2} 顆調暗`);
if ((await p.locator(".chart-map g.sel-overlay path").count()) === 0) ok("主地圖高亮清空"); else fail("高亮未清");
const hintIdle = await p.locator(".mini-hint").textContent();
if (hintIdle?.includes("框選")) ok("清空後說明文字=如何框選"); else fail("清空後說明異常: " + hintIdle);
await p.screenshot({ path: `${OUT}/brush-cleared.png` });

// ---- 泡泡不越軸+軸外起拖(7/23) ----
// 1. 所有圓「身」完整落在軸內(viewBox=動態 1:1,從 svg 讀取;M={l:72,r:14,t:14,b:42})
const overflow = await p.evaluate(() => {
  const svg = document.querySelector("g.dots").closest("svg");
  const [, , W, H] = svg.getAttribute("viewBox").split(" ").map(Number);
  const M = { l: 72, r: 14, t: 14, b: 42 };
  return Array.from(document.querySelectorAll("g.dots circle")).filter((c) => {
    const cx = +c.getAttribute("cx"), cy = +c.getAttribute("cy"), r = +c.getAttribute("r");
    return cx - r < M.l - 0.5 || cx + r > W - M.r + 0.5 || cy - r < M.t - 0.5 || cy + r > H - M.b + 0.5;
  }).length;
});
if (overflow === 0) ok("所有泡泡圓身完整落在軸內"); else fail(`${overflow} 顆泡泡越軸`);

// 2. 從軸外(左邊距)起拖也能框選(1:1 ⇒ 0.02×寬≈18px < M.l=72 ⇒ 軸外)
{
  // 前一段清空後選取/清除模式都已自動退出,先重開選取模式才能測拖曳
  await selectToggle.click();
  await p.waitForTimeout(150);
  const box2 = await sbox();
  const px2 = (fx, fy) => [box2.x + box2.width * fx, box2.y + box2.height * fy];
  const [ox0, oy0] = px2(0.02, 0.1), [ox1, oy1] = px2(0.6, 0.85);
  await p.mouse.move(ox0, oy0); await p.mouse.down();
  await p.mouse.move(ox1, oy1, { steps: 8 }); await p.mouse.up();
  await p.waitForTimeout(900);
  const nOut = Number((await p.locator(".mini-count").textContent())?.match(/\d+/)?.[0] ?? 0);
  if (nOut > 0) ok(`從軸外起拖框選成功(${nOut} 鄉鎮)`); else fail("軸外起拖無法框選");
  // 還原,不留狀態:切清除模式,框選涵蓋目前所有已選泡泡的實際範圍清空(清除鈕不再是「按一下即清空」)
  await clearToggle.click();
  await p.waitForTimeout(150);
  await clearAllSelectedViaDrag();
  await p.waitForTimeout(300);
}

// ---- 雙擊剔到空 → 回未選取狀態+回全國(reducer 規則 5) ----
// 點連江縣(inset)取得小而確定的名單;點縣=下鑽+整縣選取(合併單頁 B 案)
{
  await p.evaluate(() => {
    const el = Array.from(document.querySelectorAll(".chart-map path.inset-path"))
      .find((c) => c.__data__?.properties?.COUNTYNAME === "連江縣");
    el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await p.waitForTimeout(1100);
  const nSmall = Number((await p.locator(".mini-count").textContent())?.match(/\d+/)?.[0] ?? 0);
  if (nSmall > 0 && nSmall <= 6) ok(`點連江縣=下鑽+整縣選取(${nSmall} 鄉鎮)`); else fail("小名單異常: " + nSmall);
  const crumb = await p.locator('nav[aria-label="下鑽層級"]').textContent();
  if (crumb?.includes("連江縣")) ok("麵包屑=連江縣(點縣同時下鑽)"); else fail("未下鑽: " + crumb);
  for (let i = 0; i < nSmall + 4 && !(await p.locator("button.sel-clear").isDisabled()); i++) {
    await p.evaluate(() => {
      const c = Array.from(document.querySelectorAll("g.dots circle"))
        .find((el) => Number(el.getAttribute("fill-opacity")) > 0.5);
      c?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    await p.waitForTimeout(450);
  }
  if (await p.locator("button.sel-clear").isDisabled()) ok("逐顆雙擊剔到空 → 回未選取狀態(清除鈕停用)");
  else fail("剔到空未還原,清除鈕仍可點");
  const dimEnd = await p.evaluate(() =>
    Array.from(document.querySelectorAll("g.dots circle"))
      .filter((c) => Number(c.getAttribute("fill-opacity")) < 0.3).length);
  if (dimEnd === 0) ok("剔到空後泡泡全彩色(=null 而非空名單全灰)"); else fail(`剔到空仍 ${dimEnd} 顆灰`);
  const crumbEnd = await p.locator('nav[aria-label="下鑽層級"]').textContent();
  if (crumbEnd?.includes("全國") && !crumbEnd?.includes("連江縣")) ok("剔到空 → 自動回全國(規則5)");
  else fail("剔到空未回全國: " + crumbEnd);
}

if (errors.length) fail("console/page 錯誤: " + errors.join(" | ")); else ok("無 console/page 錯誤");
await b.close();
console.log(process.exitCode ? "== 有項目失敗 ==" : "== 全部通過 ==");
