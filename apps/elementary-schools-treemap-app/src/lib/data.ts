import raw114 from "../data/schools_114.json";
import yearsMeta from "../data/years.json";

// ---- 型別 ----
// en＝ETL 產出的英文名（縣市官方名/鄉鎮官方拼音/學校機器轉寫，見 etl/build_hierarchy.py）
export interface SchoolNode {
  id: string;
  name: string;
  en?: string;
  students: number;
  teachers: number;
}
export interface GroupNode {
  name: string;
  en?: string;
  children: (GroupNode | SchoolNode)[];
}
export type TreeNode = GroupNode | SchoolNode;

// 依語言取顯示名（path/key 一律用中文名當穩定識別，顯示層才翻譯）
export function displayName(n: { name: string; en?: string }, lang: string): string {
  return lang === "en" && n.en ? n.en : n.name;
}

export type Measure = "students" | "teachers";
export const MEASURE_LABEL: Record<Measure, string> = {
  students: "學生人數",
  teachers: "專任教師人數",
};

export interface Dataset {
  year: number;
  source: string;
  totals: { students: number; teachers: number; schools: number };
  unplacedSchools: number;
  tree: GroupNode;
}

// ---- 年份（103–114，比照世界發展數據分析平台的時間軸呈現）----
export const YEARS: number[] = yearsMeta.years;
export const YEAR_MIN = YEARS[0];
export const YEAR_MAX = YEARS[YEARS.length - 1];

// 103–108 檔無鄉鎮欄，回填不到的學校（109 前廢校）掛在此偽鄉鎮下（見 etl/build_hierarchy.py）
export const UNPLACED = "（鄉鎮未載明）";

// 初始年（114）靜態載入避免首屏閃爍；其餘年份動態 import 懶載入（Vite 自動分包）
export const dataset = raw114 as Dataset;

const cache = new Map<number, Dataset>([[114, dataset]]);
export async function loadYear(year: number): Promise<Dataset> {
  const hit = cache.get(year);
  if (hit) return hit;
  const mod = await import(`../data/schools_${year}.json`);
  const ds = mod.default as unknown as Dataset;
  cache.set(year, ds);
  return ds;
}

export function isLeaf(n: TreeNode): n is SchoolNode {
  return !("children" in n);
}

// ---- 導覽 ----
// path = [] 全國、["新北市"] 縣市視圖、["新北市","永和區"] 鄉鎮視圖
export function nodeAtPath(tree: GroupNode, path: string[]): GroupNode {
  let node: GroupNode = tree;
  for (const name of path) {
    const next = node.children.find((c): c is GroupNode => !isLeaf(c) && c.name === name);
    if (!next) throw new Error(`路徑不存在: ${path.join("/")}`);
    node = next;
  }
  return node;
}

// 切年時舊路徑可能不存在（如 103 年無「桃園市」）→ 退到最深仍有效的前綴
export function validPathPrefix(tree: GroupNode, path: string[]): string[] {
  const out: string[] = [];
  let node: GroupNode = tree;
  for (const name of path) {
    const next = node.children.find((c): c is GroupNode => !isLeaf(c) && c.name === name);
    if (!next) break;
    out.push(name);
    node = next;
  }
  return out;
}

// ---- 聚合 ----
export interface Aggregate {
  students: number;
  teachers: number;
  schools: number;
}
export function aggregate(node: TreeNode): Aggregate {
  if (isLeaf(node)) return { students: node.students, teachers: node.teachers, schools: 1 };
  const acc = { students: 0, teachers: 0, schools: 0 };
  for (const c of node.children) {
    const a = aggregate(c);
    acc.students += a.students;
    acc.teachers += a.teachers;
    acc.schools += a.schools;
  }
  return acc;
}

// 量值為 0（treemap 面積為 0 而隱形）的學校名單——排除是視圖層決策，動態依量值計算
export interface ZeroSchool {
  county: string;
  township: string;
  name: string;
  countyEn?: string;
  townshipEn?: string;
  en?: string;
  students: number;
  teachers: number;
}
export function zeroSchools(
  node: GroupNode,
  measure: Measure,
  county = "",
  township = "",
  countyEn = "",
  townshipEn = "",
): ZeroSchool[] {
  const out: ZeroSchool[] = [];
  for (const c of node.children) {
    if (isLeaf(c)) {
      if (c[measure] === 0)
        out.push({
          county, township, countyEn, townshipEn,
          name: c.name, en: c.en, students: c.students, teachers: c.teachers,
        });
    } else if (county === "") {
      out.push(...zeroSchools(c, measure, c.name, "", c.en ?? "", ""));
    } else {
      out.push(...zeroSchools(c, measure, county, c.name, countyEn, c.en ?? ""));
    }
  }
  return out;
}

// ---- 縣市地理順序（比照臺灣鄉鎮統計圖集側欄）----
// 北/中/南/東/離島五分區、區內依縣多邊形幾何中心緯度由北到南；
// 由該 app 的 counties.geojson＋meta.regions 離線重算（2026-08-14）。
export const COUNTY_GEO_ORDER: string[] = [
  "基隆市", "臺北市", "新北市", "桃園市", "新竹市", "新竹縣", // 北
  "苗栗縣", "臺中市", "彰化縣", "南投縣", "雲林縣", // 中
  "嘉義市", "嘉義縣", "臺南市", "高雄市", "屏東縣", // 南
  "宜蘭縣", "花蓮縣", "臺東縣", // 東
  "連江縣", "金門縣", "澎湖縣", // 離島
];
export const COUNTY_REGION: Record<string, string> = {
  基隆市: "北", 臺北市: "北", 新北市: "北", 桃園市: "北", 新竹市: "北", 新竹縣: "北",
  苗栗縣: "中", 臺中市: "中", 彰化縣: "中", 南投縣: "中", 雲林縣: "中",
  嘉義市: "南", 嘉義縣: "南", 臺南市: "南", 高雄市: "南", 屏東縣: "南",
  宜蘭縣: "東", 花蓮縣: "東", 臺東縣: "東",
  連江縣: "離島", 金門縣: "離島", 澎湖縣: "離島",
};

// 103 年桃園縣視同桃園市的位置
function normTaoyuan(name: string): string {
  return name === "桃園縣" ? "桃園市" : name;
}
export function countyGeoRank(name: string): number {
  const i = COUNTY_GEO_ORDER.indexOf(normTaoyuan(name));
  return i < 0 ? COUNTY_GEO_ORDER.length : i;
}
export function countyRegionOf(name: string): string {
  return COUNTY_REGION[normTaoyuan(name)] ?? "";
}

// ---- 縣市 → 固定色 index ----
// 跨年 union、以縣市代碼定序（ETL 產出）：桃園縣/桃園市同代碼 03 → 跨年同色
export const countyIndex = new Map<string, number>(
  Object.entries(yearsMeta.countyColorIndex as Record<string, number>),
);

// ---- 格式化 ----
export const fmtInt = (n: number) => n.toLocaleString("zh-TW");
export function fmtRatio(students: number, teachers: number): string {
  if (teachers === 0) return "—";
  return (students / teachers).toFixed(1);
}

// ---- 生師比色階（老師 8/17 回饋③：treemap 顏色深淺對應生師比，越小越淺）----
export function ratioOf(a: { students: number; teachers: number }): number | null {
  if (a.teachers === 0) return null; // 無專任教師：比值無定義（視圖層以最深端呈現）
  return a.students / a.teachers;
}

// 色階定義域＝當年全體學校生師比的 p10–p90（線性夾擠，抗小校離群值；
// 鄉鎮/縣市聚合層級的比值必然落在學校極值之間，同一把尺跨層級可比）
export function ratioDomain(tree: GroupNode): [number, number] {
  const ratios: number[] = [];
  for (const county of tree.children) {
    if (isLeaf(county)) continue;
    for (const tw of county.children) {
      if (isLeaf(tw)) continue;
      for (const s of tw.children) {
        if (!isLeaf(s) || s.students === 0) continue;
        const r = ratioOf(s);
        if (r !== null) ratios.push(r);
      }
    }
  }
  if (!ratios.length) return [0, 1];
  ratios.sort((a, b) => a - b);
  const q = (p: number) => ratios[Math.min(ratios.length - 1, Math.floor(p * ratios.length))];
  return [q(0.1), q(0.9)];
}

// ---- 搜尋（比照世界平台：支援臺/台異體字；年份改用獨立輸入框，見 Sidebar）----
export function normalizeTW(s: string): string {
  return s.replace(/台/g, "臺");
}

export interface SearchResult {
  type: "county" | "township" | "school";
  label: string; // 顯示文字（含縣市/鄉鎮脈絡）
  labelEn?: string; // 英文模式顯示文字
  name: string;
  nameEn?: string; // 實體自身英文名（趨勢面板顯示用）
  path?: string[]; // 導覽目標
  highlightKey?: string; // treemap 高亮 key（與 Treemap display key 同構）
  county?: string;
  township?: string;
  id?: string;
}

export function searchEntities(tree: GroupNode, query: string, limit = 20): SearchResult[] {
  const q = normalizeTW(query.trim());
  if (!q) return [];
  const qLower = q.toLowerCase();
  // 中文比對含臺/台異體；英文比對英文名（不分大小寫）
  const hit = (n: { name: string; en?: string }) =>
    normalizeTW(n.name).includes(q) || (n.en ?? "").toLowerCase().includes(qLower);
  const out: SearchResult[] = [];
  for (const county of tree.children) {
    if (isLeaf(county)) continue;
    if (hit(county)) {
      out.push({
        type: "county", label: county.name, labelEn: county.en, name: county.name, nameEn: county.en,
        path: [county.name], highlightKey: county.name, county: county.name,
      });
    }
    for (const tw of county.children) {
      if (isLeaf(tw)) continue;
      if (hit(tw)) {
        out.push({
          type: "township", label: `${county.name}・${tw.name}`,
          labelEn: `${county.en} · ${tw.en}`, name: tw.name, nameEn: tw.en,
          path: [county.name, tw.name], highlightKey: `${county.name}/${tw.name}`,
          county: county.name, township: tw.name,
        });
      }
      for (const s of tw.children) {
        if (!isLeaf(s)) continue;
        if (hit(s)) {
          out.push({
            type: "school", label: `${county.name}・${tw.name}・${s.name}`,
            labelEn: `${county.en} · ${tw.en} · ${s.en}`, name: s.name, nameEn: s.en,
            path: [county.name, tw.name], highlightKey: `s:${s.id}`,
            county: county.name, township: tw.name, id: s.id,
          });
        }
        if (out.length >= limit) return out.slice(0, limit);
      }
    }
  }
  return out.slice(0, limit);
}

// ---- 歷年趨勢（側欄 sparkline；懶載入 12 年後就地聚合）----
// nation＝全國（老師 8/17 回饋①：趨勢圖跟隨當前選取單位，停在全國就顯示全國趨勢）
export interface TrendEntity {
  type: "nation" | "county" | "township" | "school";
  county: string; // 中文名（識別用；nation 為空字串）
  township?: string;
  id?: string;
  name: string;
  en?: string; // 顯示用英文名（displayName() 可直接吃）
}

// 桃園縣/桃園市跨年視為同一縣市（同縣市代碼 → 同色序 index）
function sameCounty(a: string, b: string): boolean {
  return a === b || (countyIndex.has(a) && countyIndex.get(a) === countyIndex.get(b));
}

export async function entityTrend(
  e: TrendEntity,
  measure: Measure,
): Promise<{ year: number; value: number | null }[]> {
  const out: { year: number; value: number | null }[] = [];
  for (const y of YEARS) {
    const ds = await loadYear(y);
    let value: number | null = null;
    if (e.type === "nation") {
      value = aggregate(ds.tree)[measure];
    } else if (e.type === "school") {
      outer: for (const c of ds.tree.children) {
        if (isLeaf(c)) continue;
        for (const tw of c.children) {
          if (isLeaf(tw)) continue;
          for (const s of tw.children) {
            if (isLeaf(s) && s.id === e.id) {
              value = s[measure];
              break outer;
            }
          }
        }
      }
    } else {
      const county = ds.tree.children.find(
        (c): c is GroupNode => !isLeaf(c) && sameCounty(c.name, e.county),
      );
      if (county) {
        if (e.type === "county") {
          value = aggregate(county)[measure];
        } else {
          const tw = county.children.find(
            (c): c is GroupNode => !isLeaf(c) && c.name === e.township,
          );
          if (tw) value = aggregate(tw)[measure];
        }
      }
    }
    out.push({ year: y, value });
  }
  return out;
}
