# 散布圖雙擊剔除框選點（老師 7/24 需求）

日期：2026-07-24
狀態：已與使用者確認設計（雙擊語意採「只做剔除」，老師原話）

## 需求來源

老師 7/24 回饋：「在 scatter plot 上，拖曳之後選擇出來的點，如果用滑鼠雙擊，
可以將其排除在選擇之外。」

## 行為規格

- 有框選名單（`selected` 非 null）時，雙擊名單內的泡泡 → 該鄉鎮移出名單。
- 剔到剩 0 顆 → 名單設回 `null`（=未選取狀態、全點恢復彩色；與「框空=清除」一致）。
- 雙擊「未被選取」的點、或沒有名單時雙擊 → 無反應（設計決策：不做 toggle 加回，
  貼老師原話、語意單純；剔錯了重新框選即可）。
- 迷你地圖高亮、「已選 N 鄉鎮」計數、灰階淡化、狀態式說明全部自動跟隨
  （同一份 `selected` 名單，無另外接線）。
- 右側狀態式說明「已選」狀態加一句雙擊剔除提示（可發現性）。

## 實作

- 純函式 `excludeFromSelection(selected: string[] | null, township: string): string[] | null`
  放 `src/lib/brushSelect.ts`（與 townsInRect 同家族），TDD：
  - `null` → `null`（無名單無事）
  - 不在名單 → **原物件**返回（參照相等，不觸發重繪）
  - 在名單 → 移除該鄉鎮
  - 移除後為空 → `null`
- `Scatter.tsx` 泡泡 selection 與 mousemove/mouseleave 同處加 `.on("dblclick", …)`，
  呼叫 `select(excludeFromSelection(selected, p.township))`。
- 衝突分析：泡泡在 brush overlay 之上（`dots.raise()`），雙擊泡泡不觸發框選；
  泡泡無單擊 handler，dblclick 前的兩次 click 無副作用。

## 驗證

- vitest：excludeFromSelection 4 案例（先紅後綠）。
- Playwright（verify-brush-play）：框選後 dblclick 名單內泡泡 → 已選 N-1；
  逐顆剔到空 → 回未選取狀態。dblclick 用 `dispatchEvent`（小 path 真滑鼠會點鄰元素教訓）。
- 掃 verify-brush-play 既有文案斷言是否被新 hint 文字打破（7/21 過期斷言教訓）。
