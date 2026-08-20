# Dataviz Coding Agent

本專案透過建構專屬 Claude Skill，提出將「資料與需求」轉化為「互動式視覺化應用」之標準化工作流程。本報告詳述該框架的設計邏輯，並展示四項實作部署成果。

- **中央研究院統計科學研究所 2026 年暑期實習成果彙整**
- **指導教授：** 顏佐榕 老師
- **研究實作：** 陳歆璇

## 實作成果展示

🤖 **Skill 原始碼**：[`skill/data-vis-coding-v2/`](skill/data-vis-coding-v2/)

| **臺灣鄉鎮統計圖集** | **世界發展數據分析平台** |
| :---: | :---: |
| <img width="2846" height="1271" alt="臺灣鄉鎮統計圖集" src="https://github.com/user-attachments/assets/f074bf3f-7719-48cb-b17a-0bbcb6aebbdb" /> | <img width="2855" height="1247" alt="世界發展數據分析平台" src="https://github.com/user-attachments/assets/2208d079-e179-429e-8fa8-5f9cf08e2b02" /> |
| https://township-drilldown-app.vercel.app/ | https://world-pulse-analytics.vercel.app/ |

| **臺灣國民小學校別圖集** | **臺灣月均溫網格圖集** |
| :---: | :---: |
| <img width="2879" height="1254" alt="臺灣國民小學校別圖集" src="https://github.com/user-attachments/assets/43f0c980-a8da-4216-9bb6-9993f101ad2a" /> | <img width="2879" height="1278" alt="臺灣月均溫網格圖集" src="https://github.com/user-attachments/assets/2478f05a-f6d6-453e-bc1d-f076990c2cf2" /> |
| https://elementary-schools-treemap-app.vercel.app/ | https://temperature-grid-app.vercel.app/ |

## 研究動機

儘管大型語言模型已具備自動生成資料視覺化程式碼之能力，然過度仰賴「單次提示（One-shot prompt）」之 Vibe Coding 模式，實務上仍面臨下列三項核心挑戰：

- **隱蔽之數值與語意錯誤：** 諸如資料錯置、視覺幻覺或統計偏誤等問題，於視覺呈現上缺乏顯著特徵，且常規之型別檢查與單元測試亦難以有效攔截。
- **視覺驗證之侷限性：** 地圖投影失真、圖例裁切或空間座標溢出等視覺排版瑕疵，往往能規避既有之自動化測試。因此，如何精準界定「人在迴圈（Human-in-the-Loop）」之最佳介入節點，以兼顧異常偵測精確度與開發效率，為一關鍵課題。
- **單次提示導致經驗無法累積：** 若每次視覺化開發皆仰賴從零開始之提示工程，將缺乏狀態保存與知識傳承機制，導致開發經驗與除錯教訓難以固化為可複用之資產。

## 研究目標

- **確保可驗證之準確性：** 強制模型透過實際讀取與執行檔案，以精確取得欄位、型別、統計量及圖形映射數值，避免仰賴 AI 基於訓練資料之先驗臆測（Prior guessing）。
- **最佳化人機協作：** 將需求意圖釐清與美學決策保留予人類進行審查，而繁複之資料處理與實作驗證則交由系統自動化執行。
- **實現方法複利：** 將單次實作中所遭遇之異常狀態與解法通則化，並持續回寫至 Skill 框架中，使開發經驗得以跨專案累積，避免重複之錯誤探索。

## 研究方案

我們提出一套五層、五階段的框架，用於以 AI 代理人建構互動式資料視覺化，讓我們得以在不同專案間持續維持產出品質。我們將此框架實作為一個 Claude Skill，即本 repo 的 [`skill/data-vis-coding-v2/`](skill/data-vis-coding-v2/)。

### 品質管控（Quality Control）— 五層驗證

| 驗證層 | 內容 |
|---|---|
| 單元測試（vitest） | 資料運算、reducer、尺度換算 |
| ETL 測試（pytest） | 聚合運算、投影修正 |
| 端對端腳本（Playwright） | 實際量測渲染後的像素，而非憑空假設 |
| 數值抽查 | 手算數值對照圖表實際顯示結果 |
| 人工審查 | 每次發布前的最終視覺查核 |

第 1–4 層全自動化，把關每次發布；第 5 層則是人保留在迴圈中之處。

### 產品建構（Product Building）— 五階段工作流程

**規格釐清 → 資料處理 → 圖表選型 → 元件實作 → 多層次驗證**

每個功能走固定管線：brainstorming（需求與方案定案）→ spec（規格書存檔）→ plan（實作計畫）→ 測試驅動開發（TDD）→ 上述五層驗證 → 使用者驗收 → 合併部署。發現 bug 時不直接提供解法，而是提供截圖與重現步驟，由 AI 依 systematic-debugging 找出根因後修復，再把教訓通則化回寫至 skill。核心原則是**內容與樣式分離**——先決定「畫什麼」，再套固定樣式字典決定「長怎樣」，避免每個專案的視覺語言各自漂移。v2 另可一鍵 scaffold 專案骨架（純前端或全端、內建雙主題），並在動手前用 layout picker 先選版面。

**技術棧**：React 18＋TypeScript（Vite）、Tailwind CSS、D3 v7（四專案共用地圖投影／級距／補間／框選）、three.js＋globe.gl（地球儀專屬）、Python（pandas／pytest）或 Node.js 做 ETL、vitest＋Playwright 做前端驗證、GitHub＋Vercel 做版控與部署。

| AI／工具 | 角色 |
|---|---|
| Claude Code（Anthropic） | 唯一的編程 AI：需求釐清、規格與計畫撰寫、程式與測試實作、除錯、程式審查、部署、文件 |
| `data-vis-coding-v2`（自建 skill） | 疊加於 Claude Code 之上的視覺化領域知識與工作流程 |
| superpowers 系列 skill（社群） | 開發紀律：brainstorming／TDD／systematic-debugging／verification-before-completion |
| Google Gemini | 版面設計討論與線框圖草案，未參與程式撰寫 |
| ChatGPT | 開發環境疑難排解，未參與程式撰寫 |

## 人機協作（Human-in-the-Loop）

- **空間限制**：Figma 線框圖引導 AI 進行版面配置
- **視覺驗證**：抓出自動測試漏掉的問題
- **人工測試**：找出互動缺陷
- **UI 品質管控**：修正版面與渲染問題
- **架構審查**：避免無效的 AI 解法

## 討論（Discussion）

- **因為 Skill 讓工作流程可被執行，我們把它當作軟體來經營**：每個新的視覺化專案，都是從已驗證的基準出發，而非從空白開始。
- **因為工作流程被當作軟體來經營，我們為它撰寫測試**：每一次對工作流程的修正，都會變成一項可重複使用的檢查，讓品質得以跨專案累積，而不是每次歸零重來。
- **因為版面配置並非完全由自動化決定，我們透過人機協作機制在紙上定案**：版面中的每一個數值都會被自動檢查，而版面讀起來是否真的順眼，則交由人眼判斷。

**與 AI 溝通之限制：**

1. 視覺需求難以用文字精確傳達，實務上依賴截圖標註與線框圖比稿。
2. AI 傾向接受使用者說法而非堅持技術判斷，需求提出者須主動要求 AI 提出反對意見與取捨。
3. 人的角色無法省略，但位置明確：極值情境的直覺、美感與語意判斷、對「畫面不對勁」的敏感度；人不寫程式碼，但站在驗收與異常偵測的位置。

## Repo 結構

```
apps/
  township-drilldown-app/          臺灣鄉鎮統計圖集
  world-pulse-analytics/            世界發展數據分析平台
  elementary-schools-treemap-app/   臺灣國民小學校別圖集
  temperature-grid-app/             臺灣月均溫網格圖集
skill/
  data-vis-coding-v2/                建置以上四個 app 所依循的 Claude Skill
docs/
  screenshots/                       本頁使用的代表性截圖
```

每個 `apps/*/README.md` 保留該專案完整的功能清單、資料處理決策與開發指令；本頁只整理跨專案共通的研究敘事。各 app 皆可獨立 `npm install && npm run dev` 執行（ETL 輸出資料已隨 repo 附上，多數專案不需重跑 ETL 即可看到完整畫面）。

---

## 資料來源與致謝

- 臺灣鄉鎮統計圖集：政府開放資料（鄉鎮多指標統計、十大死因、村里人口所得）
- 世界發展數據分析平台：Gapminder 公開資料集（人均所得、平均餘命、人口）
- 國小校別圖集：教育部統計處「國民小學校別資料」（[data.gov.tw dataset 6240](https://data.gov.tw/dataset/6240)）
- 月均溫網格圖集：國家科學及技術委員會 TCCIP 計畫 TReAD 2km 網格資料

> **月均溫網格圖集資料授權說明**：本 repo 收錄的是 ETL 處理後的彙整輸出（去重、依縣市與月份聚合），並非 TCCIP 原始逐日網格檔；該資料原始授權條款是否允許以此形式公開散布，尚待向資料提供單位進一步確認。

感謝指導老師顏佐榕老師（中央研究院統計科學研究所）全程指導與逐項回饋；部分視覺化設計方法（調色盤生成邏輯、全端 scaffold 對照組）承蒙老師提供範例參考。

## AI 協助揭露

本 repo 內四個應用程式與 skill 皆由作者與 AI 協作完成：程式碼、測試與本文件由 Claude（Anthropic）依作者與指導教授的規格及回饋產生，作者負責需求釐清、設計決策、驗證與人工審查。
