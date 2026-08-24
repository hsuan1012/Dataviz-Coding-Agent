# Guardrailed Vibe Coding for Interactive Data Visualization

本專案透過建構專屬 Claude Skill，提出將「資料與需求」轉化為「互動式視覺化應用」之標準化工作流程。本報告詳述該框架的設計邏輯，並展示四項實作部署成果。

- **中央研究院統計科學研究所 2026 年暑期實習成果彙整**
- **指導教授：** 顏佐榕 老師
- **研究實作：** 陳歆璇

## 實作成果展示

**Skill 原始碼**：[`skill/data-vis-coding-v2/`](skill/data-vis-coding-v2/)

<table>
  <thead>
    <tr><th>臺灣鄉鎮統計圖集</th><th>世界發展數據分析平台</th></tr>
  </thead>
  <tbody>
    <tr><td><img width="2846" height="1271" alt="臺灣鄉鎮統計圖集" src="https://github.com/user-attachments/assets/f074bf3f-7719-48cb-b17a-0bbcb6aebbdb" /></td><td><img width="2855" height="1247" alt="世界發展數據分析平台" src="https://github.com/user-attachments/assets/351a53f6-aa40-4b12-887a-bc2936621829" /></td></tr>
    <tr><td align="center"><a href="https://township-drilldown-app.vercel.app/">https://township-drilldown-app.vercel.app/</a></td><td align="center"><a href="https://world-pulse-analytics.vercel.app/">https://world-pulse-analytics.vercel.app/</a></td></tr>
  </tbody>
  <tbody>
    <tr><th>臺灣國民小學校別矩形樹狀圖</th><th>臺灣月均溫地圖</th></tr>
  </tbody>
  <tbody>
    <tr><td><img width="2879" height="1254" alt="臺灣國民小學校別矩形樹狀圖" src="https://github.com/user-attachments/assets/9997e8d9-aaaa-4657-b720-da8142e88235" /></td><td><img width="2879" height="1278" alt="臺灣月均溫地圖" src="https://github.com/user-attachments/assets/416c36c3-d5af-466b-b18e-3fcd18de7ca0" /></td></tr>
    <tr><td align="center"><a href="https://elementary-schools-treemap-app.vercel.app/">https://elementary-schools-treemap-app.vercel.app/</a></td><td align="center"><a href="https://temperature-grid-app.vercel.app/">https://temperature-grid-app.vercel.app/</a></td></tr>
  </tbody>
</table>

## 研究動機

儘管大型語言模型已具備自動生成資料視覺化程式碼之能力，然過度仰賴「單次提示（One-shot prompt）」之 Vibe Coding 模式，實務上仍面臨下列三項核心挑戰：

- **隱蔽之數值與語意錯誤：** 諸如資料錯置、視覺幻覺或統計偏誤等問題，於視覺呈現上缺乏顯著特徵，且常規之型別檢查與單元測試亦難以有效攔截。
- **視覺驗證之侷限性：** 地圖投影失真、圖例裁切或空間座標溢出等視覺排版瑕疵，往往能規避既有之自動化測試。因此，如何精準界定「人在迴圈（Human-in-the-Loop）」之最佳介入節點，以兼顧異常偵測精確度與開發效率，為一關鍵課題。
- **單次提示導致經驗無法累積：** 若每次視覺化開發皆仰賴從零開始之提示工程，將缺乏狀態保存與知識傳承機制，導致開發經驗與除錯教訓難以固化為可複用之資產。

## 研究目標

- **確保可驗證之準確性：** 強制模型透過實際讀取與執行檔案，以精確取得欄位、型別、統計量及圖形映射數值，避免仰賴 AI 基於訓練資料之先驗臆測（Prior guessing）。
- **最佳化人機協作：** 將需求意圖釐清與美學決策保留予人類進行審查，而繁複之資料處理與實作驗證則交由系統自動化執行。
- **實現方法複利：** 將單次實作中所遭遇之異常狀態與解法通則化，並持續回寫至 Skill 框架中，使開發經驗得以跨專案累積，避免重複之錯誤探索。

## 研究方法

本研究提出結合「五層驗證」與「五階段流程」之系統化框架，用於引導 AI Agent 建構互動式資料視覺化應用，確保跨專案產出品質之一致性與穩定性。該框架已具體實作為 Claude Skill（存放於 `skill/data-vis-coding-v2/`）。

### 1. 品質管控（五層驗證）

| 驗證層級 | 檢驗標的與執行內容 |
| :--- | :--- |
| **單元測試（vitest）** | 涵蓋資料運算邏輯、狀態管理（Reducer）及尺度映射（Scale conversion）。 |
| **ETL 測試（pytest）** | 驗證資料聚合運算與空間投影修正之正確性。 |
| **端對端腳本（Playwright）** | 針對渲染後之像素進行精確量測，排除非實證之視覺預設。 |
| **數值抽查驗證** | 以獨立算式或人工精算數值，並與圖表渲染結果進行交叉比對。 |
| **人工審查** | 系統部署前之最終視覺與互動體驗查核。 |

> **機制說明**：前四個層級隸屬全自動化檢驗流程，作為每次版本發布之防線；第五層級則精準界定「人在迴圈（Human-in-the-Loop）」之必要介入節點。

### 2. 產品建構（五階段流程）

**標準化開發：** 規格釐清 ➔ 資料處理 ➔ 圖表選型 ➔ 元件實作 ➔ 多層次驗證

## 技術
*   **前端架構：** React 18、TypeScript (Vite)、Tailwind CSS
*   **視覺化引擎：** D3 v7（四專案共用）、three.js／globe.gl（世界發展數據分析平台之 3D 地球儀專屬）
*   **資料工程（ETL）：** Python (pandas/pytest)、Node.js
*   **自動化測試：** vitest、Playwright
*   **版控與部署：** GitHub、Vercel

## 人機協作機制（Human-in-the-Loop）

*   **空間與佈局約束：** 導入線框圖（Wireframes）作為視覺參考，精確引導 AI 代理進行版面配置與空間規劃。
*   **視覺盲區驗證：** 透過人工檢視，彌補自動化測試框架難以捕捉之邊界渲染異常與視覺瑕疵。
*   **互動邏輯測試：** 藉由人工探索式操作，發掘並定位複雜狀態下之互動體驗與狀態流轉缺陷。
*   **介面品質管控：** 針對排版錯位與渲染失真進行最終人工校正，確保視覺呈現之精確度。
*   **系統架構審查：** 評估 AI 生成解法之合理性與擴充性，主動阻絕無效或具潛在技術債風險之程式架構。

## 結論

- **工作流程軟體化與基準驗證：** 藉由 Skill 框架賦予工作流程可執行性，將其視為軟體產品持續迭代。各項視覺化新專案均奠基於已驗證之開發基準，避免重複性之初始構建。
- **驅動測試之流程優化與經驗複利：** 因工作流程已具備軟體化特性，為其建構測試機制。每次針對流程之修正皆轉化為可複用之驗證腳本，實現跨專案之品質累積，消弭經驗重置之開發耗損。
- **人機協作之混合決策機制：** 鑑於版面配置無法完全仰賴自動化生成，本研究落實人機協作機制。其中，底層數值之正確性交由自動化系統嚴格校驗，而視覺易讀性與美學判斷則保留予人類裁定。

## 儲存庫結構

```text
Dataviz-Coding-Agent/
├── apps/                               # 獨立資料視覺化應用程式目錄
│   ├── township-drilldown-app/         # 臺灣鄉鎮統計圖集
│   ├── world-pulse-analytics/          # 世界發展數據分析平台
│   ├── elementary-schools-treemap-app/ # 臺灣國民小學校別矩形樹狀圖
│   └── temperature-grid-app/           # 臺灣月均溫地圖
└── skill/                              # 核心框架與領域知識
    └── data-vis-coding-v2/             # 建置上述四項應用程式之核心 Claude Skill
```
