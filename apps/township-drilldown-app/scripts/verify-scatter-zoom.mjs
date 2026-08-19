// 散布圖滾輪縮放驗證(8/4,取代原本的放大鏡框選按鈕):以游標位置為錨點縮放 X/Y 軸範圍、
// 人口密度(symlog)軸縮放中保留 symlog 刻度+d3.ticks 動態刻度值(8/7 對數空間縮放,
// 取代 7/31「縮放中切線性」方案 A——切線性與游標定點在對數軸上不可兼得)、縮小到全域自動還原、
// 放大有 5% 下限、雙擊空白處還原、選取/清除模式下滾輪縮放仍可用且不影響框選結果。
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

const selectToggle = p.locator(".scatter-mode-select");
const clearToggle = p.locator("button.sel-clear");
const sbox = () => p.locator(".chart-scatter svg[width='100%']").boundingBox();
// 在圖表座標系(fx,fy 為 0~1 的相對位置)上滾動滾輪;deltaY<0=放大、>0=縮小(見 Scatter.tsx)
const wheelAt = async (fx, fy, deltaY, times = 1) => {
  const bx = await sbox();
  await p.mouse.move(bx.x + bx.width * fx, bx.y + bx.height * fy);
  for (let i = 0; i < times; i++) await p.mouse.wheel(0, deltaY);
  await p.waitForTimeout(300);
};
const clickBlank = async () => {
  const bx = await sbox();
  await p.mouse.click(bx.x + bx.width * 0.98, bx.y + bx.height * 0.95);
  await p.waitForTimeout(400);
};
const xTickTexts = () => p.evaluate(() =>
  Array.from(document.querySelectorAll("g.axes > g")[0].querySelectorAll(".tick text")).map((t) => t.textContent));
const xTickNums = async () => (await xTickTexts()).map((s) => Number(s.replace(/,/g, ""))).filter((n) => !Number.isNaN(n));
const xAxisMax = async () => Math.max(...(await xTickNums()));
const xAxisMin = async () => Math.min(...(await xTickNums()));
// Y 軸版本(鏡射上面 X 軸的三支):Scatter.tsx 依序 axes.append("g")兩次——先 X(translate(0,H-M.b))
// 後 Y(translate(M.l,0)),中間穿插的 axes.append("text")軸標題不是 <g> 不會混進 "g.axes > g"
// 這個 selector,所以順序固定是 [0]=X、[1]=Y(8/4 review 補,經 live probe 對照 Y 軸實際刻度確認索引)。
const yTickTexts = () => p.evaluate(() =>
  Array.from(document.querySelectorAll("g.axes > g")[1].querySelectorAll(".tick text")).map((t) => t.textContent));
const yTickNums = async () => (await yTickTexts()).map((s) => Number(s.replace(/,/g, ""))).filter((n) => !Number.isNaN(n));
const yAxisMax = async () => Math.max(...(await yTickNums()));
const yAxisMin = async () => Math.min(...(await yTickNums()));
// 精確版:xAxisMin/Max 是用「畫出來的 ticks」的極值當近似值,d3 的 ticks() 在挑「好看的整數」
// 間距時,domain 邊界卡在哪個位置會讓最外側那格 tick 出現或消失(8/4 live-run 撞到:同一段拖曳
// 距離,量出來的寬度有時候整整差了快 15%,純粹是最外側 tick 有沒有畫出來的差異,不是真的平移
// 出錯)。這支改成直接用 <path class="domain">(軸線,端點固定就是 x.range()/y.range(),不受
// 縮放影響)配合任兩個已知 tick 的「像素位置↔資料值」反推線性映射,在 range 兩端點內插出精確
// 的目前 domain 邊界,不受「這格 tick 到底有沒有被畫出來」影響。只用在需要嚴格比較寬度是否
// 不變的斷言;其餘只需要「有沒有變」或「有沒有貼齊邊界內」這種粗略比較的斷言,原本的
// xAxisMin/Max/yAxisMin/Max 已經夠穩定,不用全面替換。
const axisDomain = (idx) => p.evaluate((i) => {
  const g = document.querySelectorAll("g.axes > g")[i];
  const isX = i === 0;
  const d = g.querySelector("path.domain").getAttribute("d");
  const nums = d.match(/-?[\d.]+/g).map(Number);
  const rangeP0 = isX ? nums[0] : nums[1]; // X: "M{x0},..." / Y: "M-6,{y0}..."
  const rangeP1 = nums[3]; // 兩種格式第 4 個數字都是另一端點(X 的 H{x1}、Y 的 V{y1})
  const ticks = Array.from(g.querySelectorAll(".tick")).map((t) => {
    const m = t.getAttribute("transform").match(/translate\(([-\d.]+),([-\d.]+)\)/);
    const px = isX ? parseFloat(m[1]) : parseFloat(m[2]);
    const v = parseFloat(t.querySelector("text").textContent.replace(/,/g, ""));
    return { px, v };
  }).filter((t) => !Number.isNaN(t.v));
  const t0 = ticks[0], t1 = ticks[ticks.length - 1];
  const slope = (t1.v - t0.v) / (t1.px - t0.px);
  const valueAt = (px) => t0.v + slope * (px - t0.px);
  return [valueAt(rangeP0), valueAt(rangeP1)].sort((a, b) => a - b);
}, idx);
const resetZoom = async () => {
  await p.evaluate(() => {
    const svg = document.querySelector("g.dots").closest("svg");
    svg.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  });
  await p.waitForTimeout(400);
};

if (await p.locator(".scatter-zoom-toggle").count() === 0) ok("「放大」按鈕已移除");
else fail("「放大」按鈕仍存在,應已被滾輪縮放取代");

// ==== 第一段:X=人口密度(symlog),縮放中保留 symlog 刻度+動態刻度值(8/7 對數空間縮放) ====
if ((await xTickTexts()).includes("40,000")) ok("預設人口密度軸=手調固定刻度(含 40,000)");
else fail("預設人口密度軸刻度異常: " + (await xTickTexts()));

await wheelAt(0.3, 0.5, -300, 10); // 游標偏左、往上滾(放大)十次,確保縮放幅度夠大
const densityTicksZoomed = await xTickTexts();
if (!densityTicksZoomed.includes("40,000")) ok(`滾輪放大後人口密度軸改 d3.ticks 動態刻度(${densityTicksZoomed.join("、")})`);
else fail("滾輪放大後仍是固定刻度組,縮放刻度未生效: " + densityTicksZoomed.join("、"));

// ---- 錨點釘住(8/7 對數空間縮放的核心行為):游標下的泡泡在連續縮放後仍留在游標附近。
// 值空間版在 symlog 軸實測會漂 200px+(被 clamp 推走),轉換空間版應在數 px 內
// (容忍 10px:泡泡位置有 750ms 補間,量測時機與次像素渲染的微小殘差)。----
await resetZoom();
await p.waitForTimeout(900); // 還原也走 750ms 補間——等泡泡完全靜止再抓基準位置,否則基準抓在飛行中途,量出來的不是真漂移
{
  const bx = await sbox();
  const target = await p.evaluate(([cx, cy]) => {
    const circles = [...document.querySelector("g.dots").querySelectorAll("circle")];
    let best = -1, bestD = 1e9;
    circles.forEach((c, i) => {
      const b = c.getBoundingClientRect();
      const d = Math.hypot(b.x + b.width / 2 - cx, b.y + b.height / 2 - cy);
      if (d < bestD) { bestD = d; best = i; }
    });
    const b = circles[best].getBoundingClientRect();
    return { idx: best, x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }, [bx.x + bx.width * 0.5, bx.y + bx.height * 0.5]);
  await p.mouse.move(target.x, target.y);
  for (let i = 0; i < 5; i++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(900); } // 每格等補間(750ms)結束
  const drift = await p.evaluate(([idx, mx, my]) => {
    const c = [...document.querySelector("g.dots").querySelectorAll("circle")][idx];
    const b = c.getBoundingClientRect();
    return Math.hypot(b.x + b.width / 2 - mx, b.y + b.height / 2 - my);
  }, [target.idx, target.x, target.y]);
  if (drift <= 10) ok(`symlog 軸滾輪縮放錨點釘住:游標下的泡泡 5 格縮放後僅偏移 ${drift.toFixed(1)}px(≤10px)`);
  else fail(`symlog 軸滾輪縮放錨點漂移過大: ${drift.toFixed(1)}px(游標下的內容跳走了)`);
}

// ---- 泡泡不跑出 X/Y 軸:縮放後軸外的泡泡要被裁掉,不能疊到軸線外(裁切區沿用 7/31 機制) ----
const clipInfo = await p.evaluate(() => {
  const dots = document.querySelector("g.dots");
  const svg = dots.closest("svg");
  const clipAttr = dots.getAttribute("clip-path");
  const idMatch = clipAttr?.match(/#([\w-]+)/);
  const clipRect = idMatch ? svg.querySelector(`#${idMatch[1]} rect`) : null;
  return { hasClip: !!clipAttr, rectExists: !!clipRect, w: clipRect ? +clipRect.getAttribute("width") : null, h: clipRect ? +clipRect.getAttribute("height") : null };
});
if (clipInfo.hasClip && clipInfo.rectExists && clipInfo.w > 0 && clipInfo.h > 0)
  ok(`g.dots 有裁切區限制在軸線範圍內(${clipInfo.w}×${clipInfo.h})`);
else fail("g.dots 缺少有效裁切區,縮放時軸外泡泡會跑出範圍: " + JSON.stringify(clipInfo));

// 雙擊空白處還原
await resetZoom();
if ((await xTickTexts()).includes("40,000")) ok("雙擊空白處 → 滾輪縮放還原(刻度變回固定值)");
else fail("雙擊空白處未還原: " + (await xTickTexts()).join("、"));

// ==== 第二段:縮小 clamp 回全域、放大 clamp 5% 下限 ====
await p.locator('select.scatter-ch[data-ch="x"]').selectOption({ label: "平均所得" });
await p.waitForTimeout(700);
const fullMax = await xAxisMax();
const fullMin = await xAxisMin();

// ---- 錨點測試:縮放中心=游標位置,不是永遠縮放到 domain 正中央(核心行為,8/4 review 補) ----
// 同一個全域起始狀態,分別在偏左(fx=0.25)、偏右(fx=0.75)游標位置放大同樣格數;
// 若真的以游標為錨點,偏左游標放大後的範圍應整體偏低、偏右游標放大後的範圍應整體偏高。
await wheelAt(0.25, 0.5, -300, 5);
const leftAnchorMax = await xAxisMax();
const leftAnchorMin = await xAxisMin();
await resetZoom();
if ((await xAxisMax()) !== fullMax) fail("錨點測試前置:雙擊還原未生效,無法比較兩側結果");

await wheelAt(0.75, 0.5, -300, 5);
const rightAnchorMax = await xAxisMax();
const rightAnchorMin = await xAxisMin();
await resetZoom();

if (leftAnchorMax < rightAnchorMax && leftAnchorMin < rightAnchorMin)
  ok(`滾輪縮放以游標為錨點:偏左游標放大→範圍偏低(${leftAnchorMin}~${leftAnchorMax}),偏右游標放大→範圍偏高(${rightAnchorMin}~${rightAnchorMax})`);
else fail(`滾輪縮放未依游標位置錨定,兩側結果未如預期分化: 偏左=${leftAnchorMin}~${leftAnchorMax}、偏右=${rightAnchorMin}~${rightAnchorMax}`);

await wheelAt(0.5, 0.5, -300, 8); // 中心點連續放大八次
const zoomedMax = await xAxisMax();
if (zoomedMax < fullMax) ok(`滾輪放大正常:${fullMax}→${zoomedMax}`);
else fail(`滾輪放大異常: ${zoomedMax} 未小於 ${fullMax}`);

await wheelAt(0.5, 0.5, -300, 30); // 大量再放大,確認會收斂到 5% 下限(而非 0/negative,也不是隨便一個比例)
const overZoomedMax = await xAxisMax();
const overZoomedMin = await xAxisMin();
const fullWidth = fullMax - fullMin;
const floorFrac = (overZoomedMax - overZoomedMin) / fullWidth;
if (floorFrac > 0.03 && floorFrac < 0.08)
  ok(`連續大量放大後收斂到全域寬度的 ${(floorFrac * 100).toFixed(1)}%,符合 5% 下限(容許 3%~8%):${overZoomedMin}~${overZoomedMax}(全域 ${fullMin}~${fullMax})`);
else fail(`連續大量放大後寬度佔全域比例異常(應收斂在 5% 下限附近,容許 3%~8%,實際 ${(floorFrac * 100).toFixed(1)}%): ${overZoomedMin}~${overZoomedMax}(全域 ${fullMin}~${fullMax})`);

await wheelAt(0.5, 0.5, 300, 40); // 大量往下滾(縮小),應該會 clamp 回全域而不是無限放大範圍
await p.waitForTimeout(300);
if ((await xAxisMax()) === fullMax) ok(`連續大量縮小 → clamp 回全域範圍(${fullMax})`);
else fail(`連續大量縮小後未回到全域範圍: ${await xAxisMax()} ≠ ${fullMax}`);

// ==== 第三段:選取/清除模式下滾輪縮放仍可用,且不影響框選結果 ====
await selectToggle.click();
await p.waitForTimeout(150);
const dragFrac = async (fx0, fy0, fx1, fy1) => {
  const bx = await sbox();
  const pt = (fx, fy) => [bx.x + bx.width * fx, bx.y + bx.height * fy];
  const [ax0, ay0] = pt(fx0, fy0), [ax1, ay1] = pt(fx1, fy1);
  await p.mouse.move(ax0, ay0); await p.mouse.down();
  await p.mouse.move(ax1, ay1, { steps: 8 }); await p.mouse.up();
  await p.waitForTimeout(400);
};
await dragFrac(0.05, 0.05, 0.35, 0.5);
const n = Number((await p.locator(".mini-count").textContent())?.match(/\d+/)?.[0] ?? -1);
if (n > 0) ok(`選取模式框選鎖定 ${n} 鄉鎮`); else fail("選取框選失敗");

await wheelAt(0.5, 0.5, -300, 3);
const n2 = Number((await p.locator(".mini-count").textContent())?.match(/\d+/)?.[0] ?? -1);
if (n2 === n) ok(`選取模式下滾輪縮放不影響已選名單(仍 ${n2})`); else fail(`滾輪縮放意外改動了名單: ${n2} ≠ ${n}`);
if ((await selectToggle.getAttribute("aria-pressed")) === "true") ok("滾輪縮放後選取模式仍維持開啟");
else fail("滾輪縮放不應影響選取模式開關狀態");

await clickBlank();
if ((await selectToggle.getAttribute("aria-pressed")) === "false") ok("點空白處 → 退出選取模式(名單不變)");
else fail("選取模式點空白處未退出");

// 清除模式下滾輪縮放同樣不影響名單(名單非空時清除鈕才可點)
await clearToggle.click();
await p.waitForTimeout(150);
if ((await clearToggle.getAttribute("aria-pressed")) === "true") ok("清除模式開啟");
else fail("清除模式未開啟");
await wheelAt(0.5, 0.5, -300, 3);
const n3 = Number((await p.locator(".mini-count").textContent())?.match(/\d+/)?.[0] ?? -1);
if (n3 === n) ok(`清除模式下滾輪縮放不影響名單(仍 ${n3})`); else fail(`滾輪縮放意外改動了名單: ${n3} ≠ ${n}`);

// ==== 第四段:縮放後可拖曳平移 ====
await p.locator('select.scatter-ch[data-ch="x"]').selectOption({ label: "平均所得" });
await p.waitForTimeout(700);
if ((await selectToggle.getAttribute("aria-pressed")) === "true") await selectToggle.click();
if ((await clearToggle.getAttribute("aria-pressed")) === "true") await clearToggle.click();
await p.waitForTimeout(200);
// 前面第三段選取/清除模式測試中,X 通道一直維持「平均所得」不變,重選同一個選項不會觸發
// Scatter.tsx 內 [xKey,yKey] 變動才清空縮放的 effect;加上第三段本身也做過幾次滾輪縮放,
// 進到第四段時軸其實還是「已縮放」狀態,不是真的未縮放。這裡明確雙擊還原一次,確保「未縮放時
// 拖曳無反應」這條斷言測的真的是未縮放起始狀態(8/4 live-run 時發現,不還原會導致此斷言必敗)。
await resetZoom();
// 這時 zoomX/zoomY 都是 null(全域),讀出來的刻度就是 Y 軸的全域範圍,供下面 clamp 測試比對。
const fullYMax = await yAxisMax();
const fullYMin = await yAxisMin();
const fullYWidth = fullYMax - fullYMin;

const dragPan = async (fx0, fy0, fx1, fy1) => {
  const bx = await sbox();
  const pt = (fx, fy) => [bx.x + bx.width * fx, bx.y + bx.height * fy];
  const [ax0, ay0] = pt(fx0, fy0), [ax1, ay1] = pt(fx1, fy1);
  await p.mouse.move(ax0, ay0); await p.mouse.down();
  await p.mouse.move(ax1, ay1, { steps: 10 }); await p.mouse.up();
  await p.waitForTimeout(400);
};

// 未縮放時拖曳空白處完全無反應(比照縮放前既有行為)。8/4 review 補:改成真正的斜向拖曳
// (同時有水平+垂直位移),確保 X、Y 兩軸都測到「未縮放時無反應」,不是只測 X。
const preZoomMax = await xAxisMax();
const preZoomYMax = await yAxisMax();
await dragPan(0.85, 0.9, 0.3, 0.4);
if ((await xAxisMax()) === preZoomMax) ok("未縮放時斜向拖曳空白處對 X 軸無反應");
else fail(`未縮放時拖曳不該有反應,但 X 範圍變了: ${preZoomMax} → ${await xAxisMax()}`);
if ((await yAxisMax()) === preZoomYMax) ok("未縮放時斜向拖曳空白處對 Y 軸無反應");
else fail(`未縮放時拖曳不該有反應,但 Y 範圍變了: ${preZoomYMax} → ${await yAxisMax()}`);

// 縮放後拖曳可平移(軸範圍應該改變,且不是「縮放範圍變寬/變窄」而是整段平移——寬度不變)。
// 8/4 review 補:中心點滾輪縮放(wheelAt(0.5,0.5,...))本來就會同時 setZoomX/setZoomY(見
// Scatter.tsx 滾輪 handler,每一格都對 X、Y 用同一個 factor 一起算),所以這裡兩軸都已經是
// 縮放狀態;改用真正的斜向拖曳(同時有水平+垂直位移),藉此讓 Y 軸也真的被拖曳到,而不是
// 像先前版本只測水平拖曳、Y 軸的 setZoomY 完全沒被斷言覆蓋到。寬度比較改用 axisDomain()
// 精確內插(理由見上方 axisDomain 定義處的註解:單一次拖曳量出來的寬度若用畫出來的 tick
// 極值比較,容易因邊界剛好卡在「這格 tick 要不要畫出來」而誤差到 10~15%)。
await wheelAt(0.5, 0.5, -300, 6);
const [zoomedMin1, zoomedMax1] = await axisDomain(0);
const [yZoomedMin1, yZoomedMax1] = await axisDomain(1);
await dragPan(0.75, 0.8, 0.4, 0.5); // 斜向拖曳(左上方向),起點在圖表右下角空白處(避開泡泡)
const [zoomedMin2, zoomedMax2] = await axisDomain(0);
const [yZoomedMin2, yZoomedMax2] = await axisDomain(1);
const width1 = zoomedMax1 - zoomedMin1, width2 = zoomedMax2 - zoomedMin2;
const yWidth1 = yZoomedMax1 - yZoomedMin1, yWidth2 = yZoomedMax2 - yZoomedMin2;
if (Math.abs(zoomedMax2 - zoomedMax1) > 1 || Math.abs(zoomedMin2 - zoomedMin1) > 1)
  ok(`斜向拖曳後 X 範圍改變(平移生效):[${zoomedMin1.toFixed(0)},${zoomedMax1.toFixed(0)}] → [${zoomedMin2.toFixed(0)},${zoomedMax2.toFixed(0)}]`);
else fail("斜向拖曳後 X 範圍完全沒變,平移未生效");
if (Math.abs(width1 - width2) < Math.max(1, width1 * 0.05)) ok(`X 平移前後寬度大致不變(${width1.toFixed(1)} ≈ ${width2.toFixed(1)},只是平移不是縮放)`);
else fail(`X 平移不應改變範圍寬度: ${width1.toFixed(1)} → ${width2.toFixed(1)}`);
if (Math.abs(yZoomedMax2 - yZoomedMax1) > 1 || Math.abs(yZoomedMin2 - yZoomedMin1) > 1)
  ok(`斜向拖曳後 Y 範圍也改變(平移生效,證明 setZoomY 真的有被觸發):[${yZoomedMin1.toFixed(0)},${yZoomedMax1.toFixed(0)}] → [${yZoomedMin2.toFixed(0)},${yZoomedMax2.toFixed(0)}]`);
else fail("斜向拖曳後 Y 範圍完全沒變,Y 軸平移未生效(setZoomY 可能沒被觸發)");
if (Math.abs(yWidth1 - yWidth2) < Math.max(1, yWidth1 * 0.05)) ok(`Y 平移前後寬度大致不變(${yWidth1.toFixed(1)} ≈ ${yWidth2.toFixed(1)},只是平移不是縮放)`);
else fail(`Y 平移不應改變範圍寬度: ${yWidth1.toFixed(1)} → ${yWidth2.toFixed(1)}`);

// 連續大量往同一方向斜向拖曳平移,X、Y 應該分別 clamp 在各自的全域邊界。不假設拖曳方向對應
// X/Y 範圍變大還是變小的哪一側(理由同上面的平移方向斷言:實測發現不同軸、不同方向組合會
// clamp 到不同側,寫死方向的斷言曾經在 X 軸上判斷錯邊界,見前次修正紀錄),只檢查:
// 1) 兩軸都不超出各自全域邊界 2) 兩軸都確實貼齊到其中一側邊界(而非無限平移)3) 寬度都不變。
for (let i = 0; i < 8; i++) await dragPan(0.9, 0.9, 0.1, 0.1); // 連續往同一斜向大量拖曳,把 X、Y 範圍都推向各自全域邊界
// 寬度比較一樣改用 axisDomain() 精確內插(理由同上一段:clamp 到邊界後畫出來的 tick 集合往往
// 剛好落在一個「特別好看」的整數上,跟 width1 那組 tick 不是同一組整數級距,直接拿兩者的
// tick 極值相減比較寬度會有系統性誤差,不是真的寬度跑掉)。全域邊界(fullMin/fullMax/
// fullYMin/fullYMax)本身是在未縮放的乾淨起始狀態量的,兩種讀法在那個狀態下數值一致,沿用即可。
const [clampedMin, clampedMax] = await axisDomain(0);
const clampTol = Math.max(1, fullWidth * 0.02);
if (clampedMin >= fullMin - clampTol && clampedMax <= fullMax + clampTol)
  ok(`X 拖曳平移未超出全域邊界:[${clampedMin.toFixed(0)},${clampedMax.toFixed(0)}] 落在全域 [${fullMin},${fullMax}] 內`);
else fail(`X 拖曳平移超出了全域邊界: [${clampedMin.toFixed(0)},${clampedMax.toFixed(0)}] 全域 [${fullMin},${fullMax}]`);
if (clampedMin <= fullMin + clampTol || clampedMax >= fullMax - clampTol)
  ok(`連續同方向拖曳平移 → X 確實貼齊到全域邊界的其中一側(clamp 生效,非無限平移):[${clampedMin.toFixed(0)},${clampedMax.toFixed(0)}]`);
else fail(`連續同方向拖曳平移 X 未貼齊任一邊界,clamp 可能未生效: [${clampedMin.toFixed(0)},${clampedMax.toFixed(0)}] 全域 [${fullMin},${fullMax}]`);
const clampedWidth = clampedMax - clampedMin;
if (Math.abs(clampedWidth - width1) < Math.max(1, width1 * 0.05))
  ok(`X clamp 邊界時寬度仍大致不變(${clampedWidth.toFixed(1)} ≈ ${width1.toFixed(1)})`);
else fail(`X clamp 邊界時寬度異常改變: ${clampedWidth.toFixed(1)} ≠ ${width1.toFixed(1)}`);

const [clampedYMin, clampedYMax] = await axisDomain(1);
const clampYTol = Math.max(1, fullYWidth * 0.02);
if (clampedYMin >= fullYMin - clampYTol && clampedYMax <= fullYMax + clampYTol)
  ok(`Y 拖曳平移未超出全域邊界:[${clampedYMin.toFixed(0)},${clampedYMax.toFixed(0)}] 落在全域 [${fullYMin},${fullYMax}] 內`);
else fail(`Y 拖曳平移超出了全域邊界: [${clampedYMin.toFixed(0)},${clampedYMax.toFixed(0)}] 全域 [${fullYMin},${fullYMax}]`);
if (clampedYMin <= fullYMin + clampYTol || clampedYMax >= fullYMax - clampYTol)
  ok(`連續同方向拖曳平移 → Y 確實貼齊到全域邊界的其中一側(clamp 生效,非無限平移):[${clampedYMin.toFixed(0)},${clampedYMax.toFixed(0)}]`);
else fail(`連續同方向拖曳平移 Y 未貼齊任一邊界,clamp 可能未生效: [${clampedYMin.toFixed(0)},${clampedYMax.toFixed(0)}] 全域 [${fullYMin},${fullYMax}]`);
const clampedYWidth = clampedYMax - clampedYMin;
if (Math.abs(clampedYWidth - yWidth1) < Math.max(1, yWidth1 * 0.05))
  ok(`Y clamp 邊界時寬度仍大致不變(${clampedYWidth.toFixed(1)} ≈ ${yWidth1.toFixed(1)})`);
else fail(`Y clamp 邊界時寬度異常改變: ${clampedYWidth.toFixed(1)} ≠ ${yWidth1.toFixed(1)}`);

await resetZoom();

// 選取模式開啟時,拖曳空白處是方框選取,不是平移(X、Y 兩軸縮放範圍都不該被影響)
await wheelAt(0.5, 0.5, -300, 6); // 先縮放,確認「有縮放狀態下」選取模式仍是框選而非平移
await selectToggle.click();
await p.waitForTimeout(150);
const beforeSelectDragMax = await xAxisMax();
const beforeSelectDragYMax = await yAxisMax();
await dragFrac(0.05, 0.05, 0.35, 0.5); // 本來就是斜向拖曳(水平+垂直都有位移)
const selN = Number((await p.locator(".mini-count").textContent())?.match(/\d+/)?.[0] ?? -1);
if (selN > 0) ok(`選取模式下拖曳空白處仍是框選(鎖定 ${selN} 鄉鎮),不是平移`); else fail("選取模式下拖曳應該框選,但沒有鎖定任何鄉鎮");
if ((await xAxisMax()) === beforeSelectDragMax) ok("選取模式下拖曳框選不影響 X 軸縮放範圍"); else fail("選取模式下拖曳意外改動了 X 軸縮放範圍");
if ((await yAxisMax()) === beforeSelectDragYMax) ok("選取模式下拖曳框選不影響 Y 軸縮放範圍"); else fail("選取模式下拖曳意外改動了 Y 軸縮放範圍");
await selectToggle.click();
await p.waitForTimeout(150);

if (errors.length) fail("console/page 錯誤: " + errors.join(" | ")); else ok("無 console/page 錯誤");
await b.close();
console.log(process.exitCode ? "== 有項目失敗 ==" : "== 全部通過 ==");
