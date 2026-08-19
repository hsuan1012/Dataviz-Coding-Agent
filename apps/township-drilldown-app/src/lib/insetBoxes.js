// inset 框位置（svg viewBox 800×900）。獨立成 .js 讓 node 檢查腳本
// （scripts/check-inset-collision.mjs）與 Choropleth 共用同一份真實來源——
// 框的位置必須通過「與主圖投影內容不相撞」的數據檢查，不靠肉眼。
export const INSET_BOXES = [
  { x: 16, y: 560, w: 170, h: 120 },  // 金門縣
  { x: 16, y: 704, w: 170, h: 120 },  // 連江縣
];
