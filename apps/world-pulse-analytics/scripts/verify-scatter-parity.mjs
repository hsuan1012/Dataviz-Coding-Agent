// 散布圖功能對齊 verify 腳本:實跑七情境(Playwright + 真 Chromium),見
// .superpowers/sdd/2026-07-31-scatter-feature-parity/task-10-brief.md。
// 自行 spawn dev server → 開瀏覽器跑七情境 → 印 PASS/FAIL → exit code 反映結果。
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";

const results = [];
function check(name, ok, detail = "") {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

// Windows 下 shell:true 起的 npm 是 cmd.exe 包一層,dev.kill("SIGTERM") 只會殺掉
// cmd.exe 本身,底下真正在監聽連接埠的 vite/node 常常變成孤兒程序繼續佔用連接埠
// (這個環境裡就撞見過殘留的舊 dev server)。用 taskkill /T /F 連同子程序樹一起收掉。
// 一定要用 spawnSync(同步、等它跑完)——先前用 async spawn 時,taskkill 還沒真正
// 執行完,緊接著的 process.exit() 就把整個 node 行程(含尚未跑完的 taskkill 子程序)
// 一起砍掉,導致 dev server 變孤兒繼續佔用連接埠(實測撞見兩次殘留)。
function killProcessTree(child) {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
}

// vite 的終端輸出帶 ANSI 顏色碼,且顏色碼常常插在網址中間(例如
// "http://localhost:\x1b[1m5175\x1b[22m/"),直接用純文字 regex 配對會抓不到,
// 要先去除 ANSI 控制碼再比對。
function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

let dev;
let browser;
let exitCode = 1;

try {
  dev = spawn("npm", ["run", "dev"], { shell: true, stdio: "pipe" });
  dev.on("error", (err) => console.error("dev server 啟動失敗:", err));

  const url = await new Promise((resolveUrl, reject) => {
    const timer = setTimeout(() => reject(new Error("dev server 30s 未就緒")), 30000);
    let buffered = "";
    const onData = (buf) => {
      buffered += stripAnsi(String(buf));
      const m = buffered.match(/Local:\s+(http:\/\/localhost:\d+\/)/);
      if (m) {
        clearTimeout(timer);
        dev.stdout.off("data", onData);
        resolveUrl(m[1]);
      }
    };
    dev.stdout.on("data", onData);
    dev.stderr.on("data", (buf) => console.error(String(buf)));
  });

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1536, height: 781 } });
  await page.goto(url);
  await page.waitForSelector(".bubble-dot");

  // 1+2. 換通道與 X=Y 防呆
  const xSelect = page.locator("select").nth(0);
  const ySelect = page.locator("select").nth(1);
  await xSelect.selectOption({ label: "兒童死亡率" });
  const xAxisLabel = await page.locator("svg text").filter({ hasText: "兒童死亡率" }).count();
  check("換通道:X 軸標籤跟著切", xAxisLabel > 0);
  const disabledInY = await ySelect.locator("option[disabled]").allTextContents();
  check("X=Y 防呆:Y 下拉 disable 目前 X", disabledInY.some((t) => t.includes("兒童死亡率")));
  await xSelect.selectOption({ label: "平均餘命" }); // 還原

  // 3. 框選累加
  // U19:放大鏡鈕加入選取左邊後,`.scatter-select-toggle` 不再唯一對應選取鈕(現在三顆鈕共用
  // 這個 class 拿視覺樣式)——改用專屬 class `.scatter-mode-select` 精準辨識(比照鄉鎮版
  // Scatter.tsx 373 行同一則教訓:純 :not() 排除法在三顆鈕時會失效)。
  await page.locator(".scatter-mode-select").click();
  const svg = page.locator("svg[aria-label='Gapminder 泡泡圖']");
  const box = await svg.boundingBox();
  // 8/7:起拖點不能寫死——8/3 預設軸對調(X=人均所得)+U7 泡泡半徑放大後,原本的 (0.4,0.4)
  // 如今剛好壓在泡泡上;泡泡層在框選 overlay 之上(單擊 toggle 用),pointerdown 被泡泡
  // 吃掉,框選永遠不會開始(「選中 0 顆」的真因,app 本身正常)。改用 elementFromPoint
  // 掃候選點,挑第一個沒壓到泡泡(circle)的空白處起拖,對日後資料/預設軸再變動都免疫。
  const candidates = [[0.8, 0.15], [0.85, 0.25], [0.7, 0.12], [0.4, 0.4]];
  let brushStart = candidates[0];
  for (const [fx, fy] of candidates) {
    const tag = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y)?.tagName?.toLowerCase() ?? "",
      [box.x + box.width * fx, box.y + box.height * fy]
    );
    if (tag !== "circle") { brushStart = [fx, fy]; break; }
  }
  await page.mouse.move(box.x + box.width * brushStart[0], box.y + box.height * brushStart[1]);
  await page.mouse.down();
  // 終點拉到左下(0.45,0.6):框選矩形涵蓋 1950 年主要泡泡群(中低所得×中段餘命),
  // 確保「選中>0」與「未選灰化>0」兩個斷言都有東西可驗。
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.6, { steps: 8 });
  await page.mouse.up();
  // U8-1 改版後選中泡泡描邊色改成 var(--accent)(CSS 變數,無法直接用 stroke 屬性值選取),
  // 改抓專門加的 data-selected="true" 測試鉤子。
  const strokes = await page.locator("[data-selected='true']").count();
  check("框選累加:選中泡泡描邊", strokes > 0, `${strokes} 顆`);
  // 8/7:灰化 fill 早已從寫死的 #CBD5E1 改成 var(--color-border)(8/3 深色模式改版,
  // 顏色全面走 CSS 變數)——比對字面 hex 永遠 0 顆,改比對變數字串(React 原樣寫進屬性)。
  const dimmed = await page.locator(".bubble-dot[fill='var(--color-border)']").count();
  check("框選累加:未選灰化", dimmed > 0, `${dimmed} 顆`);
  // 老師 8/3 回饋移除常駐 caption 後(內容與使用說明彈窗重複),「已選 N 國」文字
  // 唯一來源是彈窗內的 .mini-count(彈窗即使關閉 display:none,DOM 仍在,
  // textContent 定位器不看可見性,不用真的點開按鈕)。
  const capText = await page.locator(".mini-count").textContent().catch(() => null);
  check("caption 顯示已選數量", /已選 \d+ 國/.test(capText ?? ""), capText ?? "");

  // 4. 單擊剔除(8/4 使用者回饋:從雙擊改單擊 toggle 移除)
  const nBefore = Number((capText ?? "").match(/已選 (\d+) 國/)?.[1] ?? 0);
  await page.locator("[data-selected='true']").first().click({ force: true });
  await page.waitForTimeout(300);
  const capAfter = await page.locator(".mini-count").textContent();
  const nAfter = Number(capAfter.match(/已選 (\d+) 國/)?.[1] ?? 0);
  check("單擊剔除:數量減 1", nAfter === nBefore - 1, `${nBefore} → ${nAfter}`);
  // 8/7:退出選取模式(再點一次 toggle 回 null)——名單(focusSelection)不受影響,
  // 但情境 8b 的拖曳平移 overlay 只在 focusMode===null 時渲染(與框選 overlay 互斥),
  // 不關掉的話 canPan 永遠 false,游標停在 crosshair、平移完全不動(先前 3 個 FAIL 的真因)。
  await page.locator(".scatter-mode-select").click();

  // 5. 色條
  const colorSelect = page.locator("select").nth(2);
  await colorSelect.selectOption({ label: "總生育率" });
  check("顏色連續:色條出現", (await page.locator(".color-bar").count()) > 0);
  await colorSelect.selectOption({ label: "區域(洲別)" });
  check("顏色=區域:色條消失", (await page.locator(".color-bar").count()) === 0);

  // 6. 播放中選取保留(且年份真的有前進,不是卡住)
  const yearBefore = Number(await page.locator(".year-display").textContent());
  await page.locator(".year-play").click();
  await page.waitForTimeout(1500);
  const stillSelectedText = await page.locator(".mini-count").textContent();
  const stillSelected = /已選 \d+ 國/.test(stillSelectedText ?? "") ? 1 : 0;
  const yearAfter = Number(await page.locator(".year-display").textContent());
  check("播放中選取保留", stillSelected > 0);
  check("播放中年份前進", yearAfter > yearBefore, `${yearBefore} → ${yearAfter}`);
  await page.locator(".year-play").click().catch(() => {});

  // 7. 矮視窗降級回歸(8/7 改寫:原斷言「無頁面捲軸」自 8/3 矮視窗斷點後過期——
  // 781px < 860px 觸發 @media (max-height:860px),整頁「應該」能捲動、charts-row 定高
  // 640px,這是老師 8/3 回饋的設計行為,不是 bug。改驗降級真的有生效。)
  const chartsRowHeight = await page.evaluate(
    () => getComputedStyle(document.querySelector(".charts-row")).height
  );
  check("1536×781 矮視窗降級:charts-row 定高 640px", chartsRowHeight === "640px", chartsRowHeight);

  // 8. U19 滑鼠滾輪縮放(8/4 使用者要求,取代原本的放大鏡框選按鈕——比照
  // township-drilldown-app Scatter.tsx 同一天做的同一個改動):游標移到圖表上方
  // 滾動滾輪→X 軸第一個刻度值變化(範圍縮小,起點右移=數值變大)→雙擊空白處還原
  // →刻度復原回縮放前的值。
  const parseNum = (s) => Number(String(s ?? "").replace(/[^0-9.\-]/g, ""));
  // 8/7:先把年份定在固定值再進縮放情境——情境 6 播放 1500ms 後暫停的年份是「非決定性
  // 的小數年」(rAF 版暫停在 1954.37 之類),泡泡位置每次跑都不同,8a-2 的邊線斷言會
  // 間歇性誤中(偶爾有國家恰好落在邊線公差內)。年份輸入框 commit 會 STOP+SET_YEAR 整數。
  const yearInput = page.locator("input[type='number']");
  await yearInput.fill("2000");
  await yearInput.press("Enter");
  await page.waitForTimeout(200);
  const xTickBefore = await page.locator(".x-tick-label").first().textContent();
  // 游標停在繪圖區內一點(沿用情境 3 已驗證過落在繪圖區內的座標比例),往上滾動
  // (負 deltaY)= 放大;單次滾輪只縮放一格(factor=1.2),連續滾 6 次確保變化夠明顯。
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, -200);
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(200);
  const xTickAfterZoom = await page.locator(".x-tick-label").first().textContent();
  check(
    "滾輪放大:X 軸第一個刻度值變大(domain 縮小、範圍起點右移)",
    parseNum(xTickAfterZoom) > parseNum(xTickBefore),
    `${xTickBefore} → ${xTickAfterZoom}`
  );
  // 8a-2. 縮放範圍外的泡泡不得「釘」在繪圖區邊框上(8/7 使用者抓到:clamp(true) 在縮放中
  // 會把範圍外國家的中心全釘在邊界,裁切區只裁掉外半邊→邊框疊一排半圓)。縮放中 clamp
  // 必須關閉,範圍外泡泡整顆外插出繪圖區、由 clipPath 裁掉——斷言:沒有任何泡泡中心
  // 恰好落在裁切區邊線上(±0.5px)。
  const pinnedAtEdge = await page.evaluate(() => {
    const svgEl = document.querySelector("svg[aria-label='Gapminder 泡泡圖']");
    const clip = svgEl.querySelector("#bubble-plot-clip rect");
    const x0 = +clip.getAttribute("x"), y0 = +clip.getAttribute("y");
    const x1 = x0 + +clip.getAttribute("width"), y1 = y0 + +clip.getAttribute("height");
    // 8/7 公差 0.5→0.01:clamp 造成的釘邊是「精確等於」range 端點(同一個浮點值),
    // 0.01 一樣抓得到;0.5 會把「真實值恰好落在邊線附近」的正常國家誤判成釘邊
    // (實測固定年份下仍可能有 1-2 國自然貼邊,是資料巧合不是 clamp 回歸)。
    return [...svgEl.querySelectorAll(".bubble-dot")].filter((c) => {
      const x = +c.getAttribute("cx"), y = +c.getAttribute("cy");
      return Math.abs(x - x0) < 0.01 || Math.abs(x - x1) < 0.01 || Math.abs(y - y0) < 0.01 || Math.abs(y - y1) < 0.01;
    }).length;
  });
  check("縮放中無泡泡釘在繪圖區邊框(clamp 已關,範圍外整顆裁掉)", pinnedAtEdge === 0, `${pinnedAtEdge} 顆`);
  // 8b. 縮放後拖曳平移(8/4 使用者實測後追加需求:「放大後的散布圖可以上下左右用滑鼠移動」,
  // 移植自 township-drilldown-app 同一天做的同一個追加功能,見 panDomain/scatterZoom.ts)。
  // 先重新滾輪放大(上一步已雙擊還原),拖曳空白處應該讓刻度範圍平移(寬度大致不變),
  // 且平移中游標樣式要從 grab 變 grabbing。
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, -200);
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(200);
  const parseTicks = async () =>
    (await page.locator(".x-tick-label").allTextContents()).map(parseNum).filter((n) => !Number.isNaN(n));
  const zoomedTicks1 = await parseTicks();
  const width1 = Math.max(...zoomedTicks1) - Math.min(...zoomedTicks1);
  const cursorGrab = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    return el ? getComputedStyle(el).cursor : null;
  }, { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 });
  check("縮放後游標樣式=grab(提示可拖曳平移)", cursorGrab === "grab", cursorGrab ?? "");
  const panX0 = box.x + box.width * 0.7, panY0 = box.y + box.height * 0.5;
  const panX1 = box.x + box.width * 0.3, panY1 = box.y + box.height * 0.5;
  await page.mouse.move(panX0, panY0);
  await page.mouse.down();
  const cursorGrabbing = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    return el ? getComputedStyle(el).cursor : null;
  }, { x: panX0, y: panY0 });
  check("拖曳中游標樣式=grabbing", cursorGrabbing === "grabbing", cursorGrabbing ?? "");
  await page.mouse.move(panX1, panY1, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const zoomedTicks2 = await parseTicks();
  const width2 = Math.max(...zoomedTicks2) - Math.min(...zoomedTicks2);
  // 8/7 對數空間縮放:X=人均所得是 log 軸,平移=對數空間等距移動 → 值域「等比」移動,
  // 值空間寬度會跟著乘上平移倍率,不再是「寬度不變」;改比對「對數空間寬度」(max/min 的
  // 比值)大致不變。畫出來的 tick 極值只是 domain 的近似(最外側 tick 有沒有畫出來會抖),
  // 容差放 0.35。
  const logW1 = Math.log(Math.max(...zoomedTicks1) / Math.min(...zoomedTicks1));
  const logW2 = Math.log(Math.max(...zoomedTicks2) / Math.min(...zoomedTicks2));
  check(
    "拖曳平移:範圍改變(不是縮放,對數空間寬度大致不變)",
    Math.min(...zoomedTicks2) !== Math.min(...zoomedTicks1) &&
      Math.abs(logW1 - logW2) < Math.max(0.1, logW1 * 0.35),
    `[${zoomedTicks1[0]}..] logW${logW1.toFixed(2)} → [${zoomedTicks2[0]}..] logW${logW2.toFixed(2)}(值寬 ${width1}→${width2})`
  );
  // 雙擊還原一次收尾,不留縮放/平移狀態給後面的情境
  await svg.dblclick({ position: { x: box.width * 0.06, y: box.height * 0.06 } });
  await page.waitForTimeout(200);
  const xTickAfterPanReset = await page.locator(".x-tick-label").first().textContent();
  check("雙擊空白處還原:平移後仍能一次還原回縮放前", xTickAfterPanReset === xTickBefore, `${xTickAfterPanReset}`);

  // 9. U23 使用說明按鈕(移植鄉鎮版):點下彈窗出現(含「選取」操作說明)→再點一次彈窗消失。
  const helpHint = page.locator("text=/按「選取」開啟後/");
  await page.locator(".scatter-help-toggle").click();
  check("使用說明:點下彈窗出現", await helpHint.isVisible());
  // 9b. 彈窗文字不得溢出面板(8/7 使用者抓到:某條 li 曾因 nowrap 撐出 540px 面板)。
  // 用 scrollWidth 抓內容實際寬——nowrap 溢出時 getBoundingClientRect 可能被裁,scrollWidth 才是真相。
  const helpOverflow = await page.evaluate(() => {
    const panels = [...document.querySelectorAll("body > div")].filter((d) => d.querySelector("ul"));
    const panel = panels.find((d) => getComputedStyle(d).position === "fixed" && getComputedStyle(d).display !== "none");
    if (!panel) return ["panel-not-found"];
    const pb = panel.getBoundingClientRect();
    return [...panel.querySelectorAll("li, p")]
      .map((el) => ({ t: (el.textContent ?? "").slice(0, 10), over: Math.max(0, el.getBoundingClientRect().x + el.scrollWidth - (pb.x + pb.width)) }))
      .filter((o) => o.over > 1)
      .map((o) => `${o.t}…+${Math.round(o.over)}px`);
  });
  check("使用說明:所有列點文字皆在面板內(無 nowrap 溢出)", helpOverflow.length === 0, helpOverflow.join("、"));
  await page.locator(".scatter-help-toggle").click();
  check("使用說明:再點一次彈窗消失", !(await helpHint.isVisible()));

  exitCode = results.every(Boolean) ? 0 : 1;
} catch (err) {
  console.error("verify 腳本執行中出錯:", err);
  exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (dev) killProcessTree(dev);
}

process.exit(exitCode);
