# -*- coding: utf-8 -*-
"""103–114 學年度國民小學校別資料 → 逐年「縣市/鄉鎮/學校」三層階層 JSON。

來源：教育部統計處「國民小學校別資料」
https://stats.moe.gov.tw/files/detail/{yy}/{yy}_basec.csv
（本地副本 ../國民小學校別資料/，UTF-8 BOM）

已知的跨年差異（scan 實測，2026-08-14）：
- 103–108 檔**沒有「鄉鎮市區」欄**：以 109–114 的學校代碼→鄉鎮對照回填
  （以最接近的 109 年優先）；回填不到的（109 前廢校）放入該縣市下的
  「（鄉鎮未載明）」偽鄉鎮——保持縣市與全國總數與原始檔一致，不默默剔除。
- 「學年度」欄 110 年才出現：一律以檔名為準。
- 103 年桃園尚未升格：縣市名稱=桃園縣（縣市代碼同為 03）——名稱保留歷史原貌，
  色彩以縣市代碼對齊（桃園縣/桃園市同色）。
- 109 年檔數值欄帶尾隨空白：全欄位 strip＋to_numeric。

輸出：
- src/data/schools_{year}.json：{year, source, totals, unplacedSchools, tree}
- src/data/years.json：{years, countyColorIndex, perYearTotals}
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
OUT_DIR = ROOT / "src" / "data"

# ---- 英文名（8/14 使用者要求英文模式全英文）----
# 縣市＝官方英文名；鄉鎮＝漢語拼音＋官方例外（淡水 Tamsui、鹿港 Lukang、綠島 Lyudao）；
# 學校＝前綴/後綴翻譯＋核心名漢語拼音（非官方名，README 揭露為機器轉寫）。
COUNTY_EN = {
    "新北市": "New Taipei City", "臺北市": "Taipei City", "桃園市": "Taoyuan City",
    "桃園縣": "Taoyuan County", "臺中市": "Taichung City", "臺南市": "Tainan City",
    "高雄市": "Kaohsiung City", "基隆市": "Keelung City", "新竹市": "Hsinchu City",
    "新竹縣": "Hsinchu County", "苗栗縣": "Miaoli County", "彰化縣": "Changhua County",
    "南投縣": "Nantou County", "雲林縣": "Yunlin County", "嘉義市": "Chiayi City",
    "嘉義縣": "Chiayi County", "屏東縣": "Pingtung County", "宜蘭縣": "Yilan County",
    "花蓮縣": "Hualien County", "臺東縣": "Taitung County", "澎湖縣": "Penghu County",
    "金門縣": "Kinmen County", "連江縣": "Lienchiang County",
}
TOWNSHIP_SUFFIX_EN = {"區": "District", "鎮": "Township", "鄉": "Township", "市": "City"}
TOWNSHIP_EN_EXCEPTIONS = {
    "淡水區": "Tamsui District", "鹿港鎮": "Lukang Township", "綠島鄉": "Lyudao Township",
}
SCHOOL_PREFIX_EN = {"市立": "Municipal", "縣立": "County", "國立": "National", "私立": "Private"}


def _pinyin(text: str) -> str:
    """漢語拼音（首字大寫、無聲調、ü→yu 對齊官方拼寫）。"""
    from pypinyin import lazy_pinyin

    syllables = lazy_pinyin(text)
    word = "".join(syllables)
    return word[:1].upper() + word[1:].replace("ü", "yu").replace("v", "yu")


def township_en(name: str) -> str:
    if name == UNPLACED:
        return "(township unrecorded)"
    if name in TOWNSHIP_EN_EXCEPTIONS:
        return TOWNSHIP_EN_EXCEPTIONS[name]
    if name[-1] in TOWNSHIP_SUFFIX_EN:
        return f"{_pinyin(name[:-1])} {TOWNSHIP_SUFFIX_EN[name[-1]]}"
    return _pinyin(name)


# 學校後綴：長 pattern 優先比對
SCHOOL_SUFFIX_EN = [
    ("高中附設國小部", "Senior High Affiliated Elementary School"),
    ("高級中學附設國小部", "Senior High Affiliated Elementary School"),
    ("實驗教育學校國小部", "Experimental School Elementary Division"),
    ("實驗國(中)小", "Experimental Elementary & Junior High School"),
    ("實驗國民小學", "Experimental Elementary School"),
    ("實驗國小", "Experimental Elementary School"),
    ("國(中)小", "Elementary & Junior High School"),
    ("國民小學", "Elementary School"),
    ("國小部", "Elementary Division"),
    ("國小", "Elementary School"),
    ("小學", "Elementary School"),
]


def school_en(name: str) -> str:
    prefix_en = ""
    core = name
    for zh, en in SCHOOL_PREFIX_EN.items():
        if core.startswith(zh):
            prefix_en = en
            core = core[len(zh):]
            break
    suffix_en = "Elementary School"
    for zh, en in SCHOOL_SUFFIX_EN:
        if core.endswith(zh):
            suffix_en = en
            core = core[: -len(zh)]
            break
    parts = [p for p in [prefix_en, _pinyin(core) if core else "", suffix_en] if p]
    return " ".join(parts)

YEARS = list(range(103, 115))
TOWNSHIP_YEARS = list(range(109, 115))  # 有鄉鎮市區欄的年份
UNPLACED = "（鄉鎮未載明）"

STUDENT_COLS = [f"{g}年級{s}學生數" for g in range(1, 7) for s in ("男", "女")]
TEACHER_COLS = ["男專任教師", "女專任教師"]


def load(year: int) -> pd.DataFrame:
    df = pd.read_csv(RAW_DIR / f"{year}_basec.csv", dtype=str)
    df = df.apply(lambda s: s.str.strip())  # 109 檔數值/文字欄帶尾隨空白
    required = ["縣市代碼", "縣市名稱", "學校代碼", "學校名稱", *STUDENT_COLS, *TEACHER_COLS]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"{year}: 缺少必要欄位 {missing}")
    for c in STUDENT_COLS + TEACHER_COLS:
        converted = pd.to_numeric(df[c], errors="coerce")
        if converted.isnull().any():
            raise ValueError(f"{year}: 欄位 {c} 有無法解析為數字的值")
        df[c] = converted.astype(int)
    if df["學校代碼"].duplicated().any():
        raise ValueError(f"{year}: 學校代碼重複")
    df["students"] = df[STUDENT_COLS].sum(axis=1)
    df["teachers"] = df[TEACHER_COLS].sum(axis=1)
    if (df["students"] < 0).any() or (df["teachers"] < 0).any():
        raise ValueError(f"{year}: 出現負值")
    return df


def township_mapping() -> dict[str, str]:
    """學校代碼→鄉鎮市區。逆序疊代讓最接近舊年的 109 覆蓋後面年份。"""
    mapping: dict[str, str] = {}
    for y in sorted(TOWNSHIP_YEARS, reverse=True):
        df = load(y)
        mapping.update(zip(df["學校代碼"], df["鄉鎮市區"]))
    return mapping


def with_township(df: pd.DataFrame, year: int, mapping: dict[str, str]) -> pd.DataFrame:
    if "鄉鎮市區" in df.columns:
        return df
    df = df.copy()
    df["鄉鎮市區"] = df["學校代碼"].map(mapping).fillna(UNPLACED)
    return df


def build_tree(df: pd.DataFrame) -> dict:
    # 縣市依代碼排序（教育部排序），但以「縣市名稱」分組——臺中/臺南/高雄因縣市合併
    # 各有兩個代碼（06/19、11/21、12/50），同名必須併為一個節點；排序鍵取最小代碼。
    # 「（鄉鎮未載明）」固定排在該縣市最後。
    order = df.groupby("縣市名稱")["縣市代碼"].min().sort_values().index
    counties = []
    for county in order:
        cdf = df[df["縣市名稱"] == county]
        townships = []
        names = [n for n in cdf["鄉鎮市區"].unique() if n != UNPLACED]
        if (cdf["鄉鎮市區"] == UNPLACED).any():
            names.append(UNPLACED)
        for township in names:
            tdf = cdf[cdf["鄉鎮市區"] == township]
            schools = [
                {
                    "id": r["學校代碼"],
                    "name": r["學校名稱"],
                    "en": school_en(r["學校名稱"]),
                    "students": int(r["students"]),
                    "teachers": int(r["teachers"]),
                }
                for r in tdf.to_dict("records")
            ]
            townships.append({"name": township, "en": township_en(township), "children": schools})
        counties.append({"name": county, "en": COUNTY_EN.get(county, _pinyin(county)), "children": townships})
    return {"name": "全國", "children": counties}


def build(year: int, mapping: dict[str, str]) -> dict:
    df = with_township(load(year), year, mapping)
    return {
        "year": year,
        "source": f"教育部統計處「國民小學校別資料」{year} 學年度（{year}_basec.csv）",
        "totals": {
            "students": int(df["students"].sum()),
            "teachers": int(df["teachers"].sum()),
            "schools": int(len(df)),
        },
        "unplacedSchools": int((df["鄉鎮市區"] == UNPLACED).sum()),
        "tree": build_tree(df),
    }


def county_color_index() -> dict[str, int]:
    """跨年縣市 union，以縣市代碼排序定色序 index；同代碼同色（桃園縣/桃園市=03）。"""
    code_by_name: dict[str, str] = {}
    for y in YEARS:
        df = load(y)
        for name, code in zip(df["縣市名稱"], df["縣市代碼"]):
            code_by_name[name] = min(code, code_by_name.get(name, code))
    codes = sorted(set(code_by_name.values()))
    return {name: codes.index(code) for name, code in code_by_name.items()}


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    mapping = township_mapping()
    per_year_totals = {}
    for y in YEARS:
        data = build(y, mapping)
        per_year_totals[str(y)] = data["totals"]
        out = OUT_DIR / f"schools_{y}.json"
        out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        t = data["totals"]
        print(f"OK {out.name}: {t['schools']} schools, {t['students']} students, unplaced={data['unplacedSchools']}")
    meta = {
        "years": YEARS,
        "countyColorIndex": county_color_index(),
        "perYearTotals": per_year_totals,
    }
    (OUT_DIR / "years.json").write_text(
        json.dumps(meta, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    print(f"OK years.json: {len(YEARS)} years, {len(meta['countyColorIndex'])} county names")


if __name__ == "__main__":
    main()
