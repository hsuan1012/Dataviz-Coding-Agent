# 臺灣月均溫地圖

**正式站**:[temperature-grid-app.vercel.app](https://temperature-grid-app.vercel.app) (Vercel 自動部署,main 分支推送即更新)

TCCIP TReAD 月平均溫 2km 網格資料(1980–2024,45 年)的互動視覺化。
版面(家族外殼):左=縣市競速長條側欄(搜尋/年份選擇/點縣市聚焦)、中=動態 heatmap 地圖
(左上角年份/月份浮水印,播放時同步跳動)、右=ridgeline plot(各月網格月均溫分布,
點縣市時切為該縣),底部=年份播放軸+月份多選列(單擊切換選取,再點一次取消;
選取月份於 ridgeline 保留原色、其餘淡出,全未選則不淡出)。
方向 A 雙主題(預設淺色)+中英雙語;溫度色階以老師 color-matrix 的 LCH 方法生成
(scripts/gen_temp_scale.mjs,逐點色域檢查),全期(1980–2024)固定 domain 跨年可比。
以 data-vis-coding-v2 skill 建置。

## 專案結構

```
etl/          Python ETL(去重+輸出前端資料+trends 預計算)與 pytest
src/          React + TypeScript + D3 前端(元件/樣式字典/i18n/單元測試)
public/data/  ETL 輸出:grids.json、temps_1980..2024.json、trends.json、meta.json、縣市界
skill/        data-vis-coding-v2 — 本專案建置所依循的 Claude Skill(工作流程+樣式規範+驗證)
scripts/      LCH 溫度色階生成器(gen_temp_scale.mjs,逐點 sRGB 色域檢查)
docs/         開發過程驗證截圖
```

## 執行

```bash
# 1) ETL:讀 supervisor 下的原始 CSV,去重後輸出 public/data/(45 檔+grids+meta)
py etl/build_data.py --years all

# 2) 前端
npm install
npm run dev        # http://localhost:5173
```

## 資料處理重點

- **去重**:縣市邊界網格跨縣市重複(1980:10,076 組合 → 8,975 唯一網格,去除 1,101 筆)。
  重複網格 12 個月數值經驗證完全一致才丟棄;若不一致 ETL 直接報錯,不靜默處理。
- **網格解析度**:最近鄰實測 ~2.07km(非文件常見的 1km;8,975 格 × ~4.3km² ≈ 本島面積,吻合)。
  TReAD 網格相對經緯線有微小旋轉,任何沿軸分桶量步距的方法都會隔格取樣量到 2 倍——用最近鄰距離法。
- **含澎湖縣網格**(127 格):老師口頭範圍為本島,先保留並於 footer 註明。
- 色階:方向 A `densityScale`(單一色相、色盲安全),全年固定 domain,逐月動畫可比。

## 驗證

- `py -m pytest etl/` — 資料層 9 項:去重數、跨縣市一致性、200 列隨機對照原始 CSV、已知值抽查
- `npm test` — vitest 15 項:KDE(積分=1/峰位/雙峰保留)、最近鄰查詢、色階端點與單調性、縣市統計
- `npm run build` — tsc --noEmit + vite build
- Playwright 實測:月份切換/播放前進/hover tooltip(數值對照原始 CSV 命中)/深色模式,截圖見 docs/screenshots/

## 下一階段

- 評估 temps JSON 量化壓縮(45 檔×~0.8MB)
- 鄉鎮層下鑽(2km 網格×鄉鎮界空間 join 可行)與澎湖網格去留,待指示

## AI 協助揭露

本專案由 Claude Code 依 data-vis-coding-v2 skill 流程建置,人工負責需求釐清、版面拍板與視覺審查。
