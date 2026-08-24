// 中英雙語字典（架構比照世界發展數據分析平台 lib/i18n.ts）。
// 注意：資料層名稱（縣市/鄉鎮/學校名）為教育部原始資料的中文名稱，英文模式維持原名不翻譯。
import type { Measure } from "./data";

export type Language = "zh" | "en";

export interface Dict {
  title: string;
  subtitle: (year: number, measureLabel: string) => string;
  measure: Record<Measure, string>;
  kpiSchools: string;
  nationwide: string;
  hintDrill: string;
  hintBack: string;
  ratioLegend: string; // 生師比色階說明（老師 8/17 回饋③）
  darkMode: string;
  lightMode: string;
  langToggleLabel: string; // 按下去會變成的語言
  searchPlaceholder: string;
  searchAria: string;
  yearLabel: string;
  yearRangeHint: string;
  noResults: string;
  typeCounty: string;
  typeTownship: string;
  typeSchool: string;
  trendTitle: (name: string, measureLabel: string) => string;
  trendLoading: string;
  playAria: string;
  pauseAria: string;
  syAxisAria: string;
  sySuffix: string;
  ttStudents: string;
  ttTeachers: string;
  ttRatio: string;
  ttSchools: string;
  zeroNote: (count: number, measureLabel: string) => string;
  zeroShowList: string;
  zeroHideList: string;
  zeroItem: (students: string, teachers: string) => string;
  backfillNote: (unplaced: number) => string;
  sourceLine: (year: number) => string;
  navAria: string;
  sidebarAria: string;
  treemapAria: (place: string, measureLabel: string) => string;
}

export const translations: Record<Language, Dict> = {
  zh: {
    title: "臺灣國民小學校別矩形樹狀圖",
    subtitle: (y, m) => `${y} 學年度・縣市 › 鄉鎮市區 › 學校三層下鑽，面積＝${m}`,
    measure: { students: "學生人數", teachers: "專任教師人數" },
    kpiSchools: "學校數",
    nationwide: "全國",
    hintDrill: "點擊區塊下鑽，",
    hintBack: "點擊空白處返回上層",
    ratioLegend: "色淺＝生師比低、色深＝生師比高",
    darkMode: "深色模式",
    lightMode: "淺色模式",
    langToggleLabel: "English",
    searchPlaceholder: "搜尋學校/鄉鎮/縣市…",
    searchAria: "搜尋",
    yearLabel: "年份",
    yearRangeHint: "103–114",
    noResults: "無符合結果",
    typeCounty: "縣市",
    typeTownship: "鄉鎮",
    typeSchool: "學校",
    trendTitle: (name, m) => `${name}・${m} 103–114 學年趨勢`,
    trendLoading: "載入 12 年趨勢…",
    playAria: "播放",
    pauseAria: "暫停",
    syAxisAria: "學年度",
    sySuffix: "學年度",
    ttStudents: "學生人數",
    ttTeachers: "專任教師人數",
    ttRatio: "生師比",
    ttSchools: "學校數",
    zeroNote: (n, m) => `本視圖另有 ${n} 校因${m}為 0 未入圖（面積為零）`,
    zeroShowList: "展開名單",
    zeroHideList: "收合名單",
    zeroItem: (s, te) => `（學生 ${s}、專任教師 ${te}）`,
    backfillNote: (u) =>
      `註：103–108 學年檔案未提供「鄉鎮市區」欄位，鄉鎮分層依 109 學年後之學校代碼回填（以現制行政區呈現）` +
      (u > 0 ? `；另有 ${u} 校（109 學年前已裁併）無從回填，列於各縣市「（鄉鎮未載明）」` : "") + "。",
    sourceLine: (y) => `資料來源：教育部統計處「國民小學校別資料」${y} 學年度（${y}_basec.csv）。`,
    navAria: "階層導覽",
    sidebarAria: "搜尋與排名清單",
    treemapAria: (p, m) => `${p}國民小學${m} treemap`,
  },
  en: {
    title: "Taiwan Elementary Schools Atlas",
    subtitle: (y, m) => `SY ${y} · County › Township › School drill-down · Area = ${m.toLowerCase()}`,
    measure: { students: "Students", teachers: "Full-time Teachers" },
    kpiSchools: "Schools",
    nationwide: "Nationwide",
    hintDrill: "Click a block to drill down; ",
    hintBack: "click empty space to go back up",
    ratioLegend: "Lighter = lower student–teacher ratio",
    darkMode: "Dark Mode",
    lightMode: "Light Mode",
    langToggleLabel: "中文",
    searchPlaceholder: "Search school / township / county…",
    searchAria: "Search",
    yearLabel: "Year",
    yearRangeHint: "SY 103–114",
    noResults: "No results",
    typeCounty: "County",
    typeTownship: "Township",
    typeSchool: "School",
    trendTitle: (name, m) => `${name} · ${m}, SY 103–114`,
    trendLoading: "Loading 12-year trend…",
    playAria: "Play",
    pauseAria: "Pause",
    syAxisAria: "School year",
    sySuffix: "SY",
    ttStudents: "Students",
    ttTeachers: "Full-time teachers",
    ttRatio: "Student–teacher ratio",
    ttSchools: "Schools",
    zeroNote: (n, m) => `${n} schools with zero ${m.toLowerCase()} are omitted (zero area).`,
    zeroShowList: "Show list",
    zeroHideList: "Hide list",
    zeroItem: (s, te) => ` (students ${s}, teachers ${te})`,
    backfillNote: (u) =>
      "Note: SY 103–108 files lack the township column; townships are back-filled from SY 109+ school codes (current administrative divisions)" +
      (u > 0 ? `; ${u} schools closed before SY 109 could not be placed and are listed under “(township unrecorded)”` : "") + ".",
    sourceLine: (y) => `Data source: MOE Statistics, “Elementary School Data by School”, SY ${y} (${y}_basec.csv).`,
    navAria: "Hierarchy navigation",
    sidebarAria: "Search and ranking list",
    treemapAria: (p, m) => `Elementary school ${m.toLowerCase()} treemap — ${p}`,
  },
};
