# 設計文件：十大死因進散布圖四通道

日期：2026-07-22
分支：`minimap-linked` 續作（本地，**不 push GitHub**）

## 背景與動機

使用者想在關係頁看「死因之間的相關」（例：惡性腫瘤 × 肺炎）。經討論選定
**方案 A**：十大死因直接成為四通道（X／Y／顏色／大小）可選的一等公民變數，
自由組合任兩死因或死因×社經指標；既有框選、播放、迷你地圖塗色、點縣選取
全部自動繼承。（相關矩陣熱圖為後續第二步，本次不做。）

## 資料前提（已驗證）

- `values.json` 已含 10 個死因 key（`death_c06`…`death_c28`），鄉鎮層
  102–108 年、368 鄉鎮**全齊無缺值**（`node` 掃過：每死因×每年份都是 368）。
  → `scatterPoints` 的「任一 key 缺值剔除鄉鎮」邏輯擴充後點集仍是 368，不縮水。
- `meta.deathCauses` 含 11 項：`death`（全死因，與指標重複）＋10 死因；
  死因無 `unit` 欄位，沿用死亡率指標的單位「每10萬人」。

## 設計

### 型別擴充（`lib/data.ts`）

- `export type ScatterKey = IndicatorKey | \`death_c${string}\``（template literal
  pattern，death_c* 全涵蓋、不必逐一列舉）。
- `Point`／`ScatterDomains` 由 `Record<IndicatorKey, number>` 放寬為
  `Record<ScatterKey, number>`（pattern index signature 不與 `township`/`region` 衝突）。
- 新純函式 `scatterVars(meta)`：回傳散布圖可用變數清單
  `{ key, label, unit, group: "ind" | "cause" }[]`＝5 指標（group=ind）＋
  10 死因（group=cause，排除重複的 `death`，unit=死亡率指標單位）。
  Scatter 的下拉選項、軸標題、tooltip、色條/大小圖例標籤全部改查這張表。

### 通道與選單（`lib/scatterChannels.ts`＋`charts/Scatter.tsx`）

- `ScatterChannels` 四通道型別由 `IndicatorKey` 放寬為 `ScatterKey`；
  `ColorKey = "region" | ScatterKey`。
- 下拉用 `<optgroup>` 分兩組：「基本指標」（5 項）／「十大死因」（10 項）；
  顏色通道在最前面保留「區域」。
- `makeColorNormalizer`／`colorTicks` 參數型別同步放寬（`density` 特例照舊，
  死因走線性）。死因當 X/Y＝線性軸、當顏色＝主題連續色階、當大小＝sqrt 比例，
  全部沿用既有程式路徑，不寫新分支。

### 左側死因連動（App.tsx）

- 現況：進關係頁或切左側指標時 X＝當前指標。
- 擴充：若當前指標＝死亡率**且**地圖頁已選某死因（`deathCause !== "death"`），
  X 帶入該死因 key（例：地圖看惡性腫瘤→進關係頁 X=惡性腫瘤）；頁內下拉可再改。

### 不變的部分

框選、清除、切年/切通道保留名單、年份播放、迷你地圖（等高/點縣/懸停/塗色——
塗色的 `townFillMap` 吃 colorKey，型別放寬後死因色階自動生效）、地圖頁死因選單、
村里層（死因本就無村里資料，關係頁只用鄉鎮層，不受影響）。

## 不做的事（YAGNI）

- 相關係數矩陣熱圖（第二步另案）。
- 死因的年齡標準化／老年人口比例混淆因子欄位（資料沒有；生態相關注意事項
  以說明文字方式呈現即可，本次不加文案變更）。
- X=Y 同變數防呆（現在也允許同指標上兩軸，維持現狀）。

## 驗證計畫（沿用五層驗證）

1. **程式層**：tsc 0 錯；vitest 既有 76 項全綠。
2. **單元測試（新增）**：`scatterVars`（5+10、排除重複 death、死因 unit=每10萬人）；
   `scatterPoints` 含死因值（對照 values.json 已知真值）；`scatterDomains` 涵蓋死因
   key 且涵蓋每年 extent；`townFillMap` 死因 key 色階（型別放寬回歸）。
3. **互動層（Playwright 新增情境）**：
   - X 下拉出現「十大死因」optgroup、選惡性腫瘤 → X 軸標題＝惡性腫瘤；
   - Y 選肺炎 → 兩死因散布呈現、點數仍 368；
   - 顏色選糖尿病 → 色條出現、迷你地圖同步變該死因色階；
   - 框選＋切死因通道 → 名單保留；
   - 左側死亡率＋地圖選死因→進關係頁 X=該死因；
   - 既有 verify-scatter／verify-brush-play／verify-minimap-linked 全 PASS。
4. **視覺層**：截圖（死因×死因、死因當顏色）AI 終審。
5. **人工審查**：localhost 實際操作走查。

## 上線策略

- 續用本地分支 `minimap-linked` 開發與 commit，**不 push GitHub**。
- localhost 驗收滿意 → 老師過目 → 再推分支 → 合併 main → Vercel 自動部署。
