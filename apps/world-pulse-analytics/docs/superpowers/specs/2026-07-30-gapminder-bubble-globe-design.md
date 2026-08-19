# Gapminder 泡泡圖 + 地球儀 App 設計規格

日期：2026-07-30
交辦人：指導老師（顏佐榕老師）
參考範本：https://www.gapminder.org/tools/#$chart-type=bubbles&url=v2 、 https://globe.gl/

## 背景與目標

老師希望做一個仿 Gapminder Tools 泡泡圖工具的新網頁 app：
X 軸 life expectancy、Y 軸 GDP per capita（income）、泡泡大小先用總人口，共三個指標。
畫面分三欄：左邊國家勾選清單、中間泡泡圖、右邊放 globe.gl 3D 地球儀。

資料來源：`supervisor/data/global/`，主要用 `gapminder_core3.csv`（已含
`*_is_projection` 標記欄與 `all_three` 篩選欄，見同目錄
`gapminder_core3_缺失值說明.md`）。

## 範圍界定

- 這是全新獨立專案，資料夾 `gapminder-bubble-globe-app/`，與其他 `xxx-app`
  專案（如 township-drilldown-app）平行、互不相依。
- 純前端，無需後端／資料庫（資料在建置期預先處理成靜態 JSON）。
- 三個指標先做（life_expectancy、income、population），之後若要加其他指標
  （`indicator_catalog.csv` 裡還有 720 個可選）是後續工作，不在本次範圍。

## 技術棧

沿用 township-drilldown-app 既有慣例：

- React 18 + TypeScript + Vite
- Tailwind CSS v4
- D3（泡泡圖繪製：軸、刻度、圓形、動畫)
- globe.gl（右側 3D 地球儀）
- Vitest（單元測試）+ Playwright（跨面板互動的端對端測試）
- 部署：Vercel（沿用其他 app 的部署模式）

## 資料處理

一次性腳本（scaffold 階段執行一次，非執行期程式）：

1. 讀取 `supervisor/data/global/gapminder_core3.csv`
2. 篩選 `all_three == 1`（三指標同時有值的列，範圍 1950–2050、195 國）
3. 只保留必要欄位：`geo, name, year, income, life_expectancy, population,
   world_4region, income_is_projection, life_expectancy_is_projection,
   population_is_projection, latitude, longitude`
4. 輸出精簡 JSON 到 `src/data/gapminder.json`（約 19,416 列，純前端無壓力）
5. 額外輸出一份 `src/data/countries.json`：195 國的 `geo/name/world_4region`
   清單，供左側勾選清單分組使用

不做內插、不做補值——序列內部本來就沒有破洞（見缺失值說明文件），缺的是
序列兩端之外的年份，這是結構性缺值，如實呈現即可。

## 跨面板共用狀態

App 頂層維護：

| 狀態 | 說明 | 預設值 |
|---|---|---|
| `selectedCountries` | 目前納入圖表的國家集合（Set<geo>） | 195 國全勾 |
| `hoveredCountry` | 目前滑鼠焦點國家（geo \| null） | null |
| `currentYear` | 目前顯示年份 | 1950（時間軸起點，配合播放鍵從頭播放） |
| `isPlaying` | 是否正在播放年份動畫 | false |

三個面板都是這份狀態的訂閱者／更新者，透過 React Context 或頂層 props 傳遞。

## 元件設計

### 1. 左側：`CountryChecklist`

- 依 `world_4region`（asia / europe / africa / americas）分組收合
- 每組可整組勾選／取消
- 搜尋框依國名即時篩選（跨群組）
- 勾選狀態即時反映到 `selectedCountries`
- 預設全勾

### 2. 中間：`BubbleChart`（D3）

- X 軸：`life_expectancy`，線性刻度
- Y 軸：`income`，**對數刻度**（依 `indicators.csv` 建議，資料無 0 或負值可直接取對數）
- 泡泡半徑：`population`，開方（sqrt）尺度
- 顏色：依 `world_4region` 四色分類，與地球儀高亮色一致
- 只渲染 `selectedCountries ∩ currentYear 有資料的國家`
- 推估值視覺區分：`*_is_projection` 為真的泡泡用半透明或虛線外框
- 下方或上方：年份滑桿（1950–2050）+ 播放/暫停按鈕 + 目前年份文字
- Hover 泡泡 → 設定 `hoveredCountry`，顯示 tooltip（國名、三指標數值、是否為推估值）
- 已知現象處理：2020 年起 9 個微型國家（Andorra、Dominica、Monaco 等）
  平均餘命無資料而消失，圖上加一行小提示文字說明，避免被誤判成程式錯誤

### 3. 右側：`WorldGlobe`（globe.gl）

- 渲染世界地球儀，`selectedCountries` 內的國家上色標示（與泡泡圖同色系）
- `hoveredCountry` 對應的國家加額外高亮效果（如放大點/描邊）
- 三面板（清單／泡泡圖／地球儀）任一處 hover 都會同步彼此的高亮，形成雙向連動
- 角色定位為「純視覺化 selected 國家」，不疊加額外指標色階（不做 choropleth）

## 錯誤處理

- `selectedCountries` 為空集合 → 泡泡圖顯示友善空狀態文字，而非空白畫布或報錯
- `hoveredCountry` 在當前年份無資料 → tooltip 顯示「無資料」，不中斷互動
- globe.gl 找不到對應座標的國家實體 → 該國略過渲染，僅開發模式下 console 警告

## 測試計畫

- **Vitest**：
  - 資料篩選腳本：驗證 `all_three` 篩選與 `*_is_projection` 旗標邏輯正確
  - `BubbleChart`：給定已知年份/資料，驗證泡泡座標、半徑、顏色映射正確
  - `CountryChecklist`：分組收合、搜尋篩選、全選/取消邏輯
- **Playwright**：
  - 勾選/取消國家 → 泡泡圖對應國家出現/消失
  - Hover 清單中一國 → 泡泡圖與地球儀同步高亮，反之亦然
  - 點擊播放 → 年份自動推進，泡泡隨年份移動
  - 拖曳年份滑桿 → 圖表即時更新到該年份

## 不在本次範圍

- Choropleth 式地球儀（依指標上色）
- 三個指標以外的其他指標（720 個候選指標）
- 後端/資料庫
- 人口加權或其他進階統計處理
