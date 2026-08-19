// 滾輪縮放/拖曳平移共用的邊界 clamp:把 [newLo,newHi] 這段範圍平移(不改變寬度)貼回
// [fullLo,fullHi] 之內,超出哪一側就往回推多少。
function clampToFull(newLo: number, newHi: number, fullLo: number, fullHi: number): [number, number] {
  if (newLo < fullLo) { newHi += fullLo - newLo; newLo = fullLo; }
  if (newHi > fullHi) { newLo -= newHi - fullHi; newHi = fullHi; }
  return [newLo, newHi];
}

// 滾輪縮放的 domain 數學(純函式,不碰 DOM/React state):以 anchor(游標對應的資料值)
// 為錨點縮放 [current] 這段 domain,factor>1=放大(變窄)、factor<1=縮小(變寬)。
// 縮小超過 full 的寬度直接回 null(=交給呼叫端還原成全範圍)。
// 放大 clamp 在 full 寬度的 minFrac(預設 5%),避免縮到看不到任何資料點。
// 注意:此函式假設「值比例=像素比例」,只對線性軸成立。symlog/log 軸要用下方
// zoomDomainInSpace 在刻度轉換空間呼叫本函式,錨點才會真的釘在游標像素位置。
export function zoomDomain(
  current: [number, number],
  full: [number, number],
  anchor: number,
  factor: number,
  minFrac = 0.05,
): [number, number] | null {
  const [lo, hi] = current;
  const [fullLo, fullHi] = full;
  const width = hi - lo;
  const fullWidth = fullHi - fullLo;
  let newWidth = width / factor;
  const minWidth = fullWidth * minFrac;
  if (newWidth < minWidth) newWidth = minWidth;
  if (newWidth >= fullWidth) return null;
  // t=錨點在目前 domain 裡的比例位置;縮放後用同一個 t 反推新邊界,螢幕座標上的錨點位置不變
  // (range 不變、t 不變 ⇒ 映射到同一個像素)。寬度 0(degenerate)時無比例可言,退回置中。
  const t = width === 0 ? 0.5 : (anchor - lo) / width;
  const newLo = anchor - t * newWidth;
  const newHi = newLo + newWidth;
  return clampToFull(newLo, newHi, fullLo, fullHi);
}

// 拖曳平移的 domain 數學(純函式):把 current 平移 delta(資料值位移量),超出 full 邊界時
// clamp 貼齊邊界(寬度不變)。呼叫端(Scatter.tsx 的拖曳 handler)只在該軸已經是縮放狀態
// (current 不是完整 full 範圍)時才會呼叫,故不需要「平移回全範圍變 null」這種情境。
export function panDomain(
  current: [number, number],
  full: [number, number],
  delta: number,
): [number, number] {
  const [lo, hi] = current;
  const [fullLo, fullHi] = full;
  return clampToFull(lo + delta, hi + delta, fullLo, fullHi);
}

// ==== 轉換空間版本(8/7,使用者定案取代方案 A)====
// symlog/log 軸的縮放/平移改在「刻度轉換空間」做:先把 domain/anchor 過 fwd 轉換、
// 跑同一套值空間數學、再用 inv 轉回資料值。轉換空間裡「值比例=像素比例」(這正是
// 該刻度把資料映射到像素的方式),所以錨點會像素級釘在游標下;值空間版在寬 log 軸
// 上第一格會因 clamp 把錨點推走半個繪圖區(gapminder 人均所得軸實測)。
// 縮放中的軸保留原刻度型態(symlog 留 symlog),不再切線性——「切線性」與「游標定點」
// 在寬對數軸上數學上不可兼得(釘住錨點需要 domain 延伸出全域範圍,必被 clamp 推走)。

// d3.scaleSymlog(constant C) 的正/反轉換(d3-scale symlog 定義):
export const symlogFwd = (C: number) => (x: number) => Math.sign(x) * Math.log1p(Math.abs(x) / C);
export const symlogInv = (C: number) => (u: number) => Math.sign(u) * C * Math.expm1(Math.abs(u));

export function zoomDomainInSpace(
  current: [number, number],
  full: [number, number],
  anchor: number,
  factor: number,
  fwd: (x: number) => number,
  inv: (u: number) => number,
  minFrac = 0.05,
): [number, number] | null {
  const d = zoomDomain(
    [fwd(current[0]), fwd(current[1])],
    [fwd(full[0]), fwd(full[1])],
    fwd(anchor),
    factor,
    minFrac,
  );
  return d === null ? null : [inv(d[0]), inv(d[1])];
}

// delta 以「轉換空間單位」傳入(呼叫端用轉換空間寬度/像素寬度換算),寬度在轉換空間不變。
export function panDomainInSpace(
  current: [number, number],
  full: [number, number],
  delta: number,
  fwd: (x: number) => number,
  inv: (u: number) => number,
): [number, number] {
  const d = panDomain(
    [fwd(current[0]), fwd(current[1])],
    [fwd(full[0]), fwd(full[1])],
    delta,
  );
  return [inv(d[0]), inv(d[1])];
}
