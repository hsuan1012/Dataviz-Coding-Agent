# data-vis-coding-v2

本專案為一款資料視覺化專用之 Claude Skill，透過整合標準化工作流程，能將原始資料（CSV/JSON/GeoJSON）與使用者需求，自動轉化為具備高互動性、數值精確且風格一致之前端應用程式（預設採用 React、Tailwind CSS 及 Chart.js/D3 等技術）。

## 這個 skill 做什麼

引導走完 **規格釐清 → 資料處理 → 圖表選型 → 元件實作 → 多層次驗證**，並強調三個核心原則：

1. **內容與樣式分離** — 先決定「畫什麼」，再套固定樣式字典決定「長怎樣」，避免 style drift。
2. **執行取代臆測** — 欄位、型別、統計量、圖形對應數值一律靠實際讀檔與執行取得，避免視覺幻覺。
3. **人機協作** — 需求意圖與美學決策保留給人確認，資料處理與實作測試交給自動化。

v2 另可**一鍵 scaffold 專案骨架**（`scripts/scaffold.py`，純前端或全端、內建雙主題），
並在動手前用 **layout picker**（`assets/layout-picker-template.html`）先選版面。

## 檔案結構

data-vis-coding-v2/
├── assets/             # 靜態資源庫：版面配置樣板（Layout Picker）與視覺樣式字典
├── evals/              # 評估模組：代理觸發機制與行為邊界之評測腳本
├── references/         # 領域知識庫：涵蓋圖表選型、版面配置、技術規範、驗證機制與標準流程
├── scripts/            # 自動化開發腳本
│   └── scaffold.py     # 專案骨架與基礎環境生成器
├── tests/              # 測試套件：針對本 Skill 核心邏輯之 pytest 單元測試
└── SKILL.md            # Skill 核心定義檔：包含詮釋資料（Frontmatter）與標準化工作流程

## 怎麼使用

**方式 A — 放進 Claude Code 的 skills 目錄：**
把整個資料夾放到 `.claude/skills/data-vis-coding-v2/`（專案層）或使用者層的 skills 目錄，
Claude Code 會自動載入。

**方式 B — 打包成 `.skill` 檔安裝：**
把資料夾壓成 zip、副檔名改為 `.skill`，即可分享安裝。

安裝後，當你要「把一份資料做成可互動的視覺化 / dashboard / 地圖」時就會觸發。

## 測試

```bash
python -m pytest -q
```
