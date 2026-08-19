# data-vis-coding-v2

這是一個 **Claude Skill**（適用於 [Claude Code](https://claude.com/claude-code) 的 Agent Skill 格式），由本人於暑期實習期間製作。開發過程使用 Claude Code 協助。

一套把「**一份資料（CSV / JSON / GeoJSON）＋ 一個需求**」變成
「**可運作、能互動、數值正確、風格一致**」的互動式資料視覺化應用的完整工作流程 skill。
產出為 React + Tailwind + Chart.js / D3 前端。

## 這個 skill 做什麼

引導走完 **規格釐清 → 資料處理 → 圖表選型 → 元件實作 → 多層次驗證**，並強調三個核心原則：

1. **內容與樣式分離** — 先決定「畫什麼」，再套固定樣式字典決定「長怎樣」，避免 style drift。
2. **執行取代臆測** — 欄位、型別、統計量、圖形對應數值一律靠實際讀檔與執行取得，避免視覺幻覺。
3. **人機協作** — 需求意圖與美學決策保留給人確認，資料處理與實作測試交給自動化。

v2 另可**一鍵 scaffold 專案骨架**（`scripts/scaffold.py`，純前端或全端、內建雙主題），
並在動手前用 **layout picker**（`assets/layout-picker-template.html`）先選版面。

## 資料夾結構

| 路徑 | 內容 |
|---|---|
| `SKILL.md` | skill 主文件（frontmatter + 工作流程） |
| `references/` | 分項參考：圖表選型、版面選項、技術棧、驗證、流程 |
| `scripts/scaffold.py` | 專案骨架產生器 |
| `assets/` | layout picker 樣板、樣式字典 |
| `tests/` | skill 本身的 pytest 測試 |
| `evals/` | 觸發與行為評測 |

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
