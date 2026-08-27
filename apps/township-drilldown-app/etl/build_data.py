# -*- coding: utf-8 -*-
"""ETL v3：原始 CSV → 三層（縣市/鄉鎮/村里）靜態 JSON。

- 縣市層：原始分子/分母加權聚合（密度=Σ人口/Σ面積、所得=Σ所得/Σ戶、死亡率=Σ死亡/Σ人口）。
- 鄉鎮層：沿用 township-atlas-app 管線。
- 村里層：人口=108年2月快照（M020）、密度=人口/圖資面積、所得=101–111 逐里；
  數值直接嵌入 public/data/villages/{TOWNCODE}.json 的 feature properties。
"""
import os, io, json, glob, zipfile
import pandas as pd
from core import township_income, quantile_breaks, death_rate, county_of, weighted_ratio, village_density

BASE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(BASE)
# 原始資料不進 repo（老師提供的 taiwan_township_datasets 資料夾與死因對照表）。
# 執行前用環境變數指定位置；未設定時退回 repo 內的 data/raw/（需自行放入）。
RAW = os.path.join(APP, "data", "raw")
SRC = os.environ.get("TOWNSHIP_SRC_DIR", os.path.join(RAW, "taiwan_township_datasets"))
GEOJSON = os.path.join(APP, "public", "taiwan_townships.geojson")
VILLDIR = os.path.join(APP, "public", "data", "villages")
OUT = os.path.join(APP, "public", "data")
YEARS = list(range(102, 109))  # 102..108
VILLAGE_POP_LABEL = "108年2月"

NAME_ALIASES = {
    "桃園縣中壢市": "桃園市中壢區", "桃園縣八德市": "桃園市八德區",
    "桃園縣大溪鎮": "桃園市大溪區", "桃園縣楊梅市": "桃園市楊梅區",
    "桃園縣蘆竹鄉": "桃園市蘆竹區", "桃園縣大園鄉": "桃園市大園區",
    "桃園縣龜山鄉": "桃園市龜山區", "桃園縣龍潭鄉": "桃園市龍潭區",
    "桃園縣平鎮市": "桃園市平鎮區", "桃園縣新屋鄉": "桃園市新屋區",
    "桃園縣觀音鄉": "桃園市觀音區", "桃園縣復興鄉": "桃園市復興區",
    "桃園縣桃園市": "桃園市桃園區",
    "彰化縣員林鎮": "彰化縣員林市", "苗栗縣頭份鎮": "苗栗縣頭份市",
}


def die(msg):
    raise SystemExit(f"[ETL FAIL] {msg}")


def _decode_csv(raw, inner, **kw):
    for enc in ("utf-8-sig", "utf-8", "big5", "cp950"):
        try:
            return pd.read_csv(io.BytesIO(raw), encoding=enc, **kw)
        except Exception:
            continue
    die(f"無法解碼 {inner}")


def read_csv_from_zip(zip_path, inner, **kw):
    with zipfile.ZipFile(zip_path) as z:
        raw = z.read(inner)
    return _decode_csv(raw, inner, **kw)


def read_csv_from_nested_zip(outer_zip, inner_zip, inner_csv, **kw):
    """medicine.zip 為 zip-in-zip：外層取內層 zip bytes，再從內層取 CSV。"""
    with zipfile.ZipFile(outer_zip) as z:
        inner_bytes = z.read(inner_zip)
    with zipfile.ZipFile(io.BytesIO(inner_bytes)) as iz:
        raw = iz.read(inner_csv)
    return _decode_csv(raw, inner_csv, **kw)


def clean_name(s):
    s = str(s).replace("﻿", "").strip().replace("　", "").strip()
    return NAME_ALIASES.get(s, s)


def clean_columns(df):
    df.columns = [str(c).replace("﻿", "").strip() for c in df.columns]
    return df


def check_rate(indicator, year, matched_n, total, threshold=0.98):
    rate = matched_n / total
    if rate < threshold:
        die(f"{indicator} {year} 對應率 {rate:.1%} < {threshold:.0%}")
    return rate


def main():
    os.makedirs(OUT, exist_ok=True)
    geo = json.load(open(GEOJSON, encoding="utf-8"))
    geo_names = {f["properties"]["FULLNAME"] for f in geo["features"]}
    if len(geo_names) < 360:
        die(f"geojson 鄉鎮數異常 {len(geo_names)}")
    county_names = {county_of(n) for n in geo_names}
    if len(county_names) != 22:
        die(f"縣市數異常 {len(county_names)}")

    # 十大死因 → 官方「41 大類」cause 碼（death_causes.zip dead*.csv；與 app 總死亡率同源）。
    # 對照經全國總數＋138分類 ICD-10 交叉驗證，9/10 完全吻合、總數吻合（見 build 尾段 sanity）。
    # 順序＝典型排名。全死因＝既有 death（不另存）。
    DEATH_CAUSES = [("06", "惡性腫瘤"), ("16", "心臟疾病"), ("17", "腦血管疾病"), ("21", "肺炎"),
                    ("09", "糖尿病"), ("38", "事故傷害"), ("23", "慢性下呼吸道疾病"),
                    ("15", "高血壓性疾病"), ("32", "腎炎腎病症候群及腎病變"), ("28", "慢性肝病及肝硬化")]
    dc_keys = [f"death_c{c}" for c, _ in DEATH_CAUSES]

    # values[indicator][level][year][name]；村里值嵌入 geojson，不進 values.json
    values = {k: {"county": {}, "town": {}} for k in
              ("density", "income", "death", "clinic", "hospital", *dc_keys)}
    pop_by_year = {}
    match_report = {}

    # --- 密度（鄉鎮＋縣市，同一來源 CSV：people_total / area）---
    pdz = os.path.join(SRC, "population_density.zip")
    with zipfile.ZipFile(pdz) as z:
        dens_files = {int(n.split("N010")[0].split("opendata")[1]): n
                      for n in z.namelist() if n.endswith(".csv")}
    for y in YEARS:
        if y not in dens_files:
            die(f"密度缺 {y} 年")
        df = read_csv_from_zip(pdz, dens_files[y], skiprows=[1])
        df = clean_columns(df)
        for c in ("population_density", "people_total", "area"):
            df[c] = pd.to_numeric(df[c], errors="coerce")
        town_d, pop, ratio_rows = {}, {}, []
        for _, r in df.iterrows():
            raw = r.get("site_id", "")
            if pd.isna(raw):
                continue
            name = clean_name(raw)
            if not name or name == "nan" or name not in geo_names:
                continue
            if not pd.isna(r["population_density"]):
                town_d[name] = float(r["population_density"])
            if not pd.isna(r["people_total"]):
                pop[name] = int(r["people_total"])
            if not pd.isna(r["people_total"]) and not pd.isna(r["area"]):
                ratio_rows.append((county_of(name), r["people_total"], r["area"]))
        check_rate("density", y, len(town_d), len(geo_names))
        values["density"]["town"][str(y)] = town_d
        values["density"]["county"][str(y)] = weighted_ratio(ratio_rows)
        pop_by_year[str(y)] = pop
        if len(values["density"]["county"][str(y)]) != 22:
            die(f"density 縣級 {y} 年僅 {len(values['density']['county'][str(y)])} 縣")

    # --- 所得（鄉鎮=合計列；縣市=合計列加權；村里=逐里列）---
    inz = os.path.join(SRC, "income_tax.zip")
    with zipfile.ZipFile(inz) as z:
        inc_files = {int(os.path.basename(n).split("_")[0]): n
                     for n in z.namelist() if n.endswith(".csv") and "_165-9" in n}
    village_income = {}  # {year: {(鄉鎮全名, 村里名): 平均所得}}
    for y in YEARS:
        if y not in inc_files:
            die(f"所得缺 {y} 年")
        df = read_csv_from_zip(inz, inc_files[y])
        df = clean_columns(df)
        df["鄉鎮市區"] = df["鄉鎮市區"].map(clean_name)
        total_rows = df[df["村里"] == "合計"]
        town_rows = [(r["鄉鎮市區"], r["綜合所得總額"], r["納稅單位(戶)"])
                     for _, r in total_rows.iterrows()]
        inc = {k: v for k, v in township_income(town_rows).items() if k in geo_names}
        check_rate("income", y, len(inc), len(geo_names))
        values["income"]["town"][str(y)] = inc
        values["income"]["county"][str(y)] = weighted_ratio(
            [(county_of(t), tot, n) for t, tot, n in town_rows if t in geo_names])
        # 村里列：排除官方彙總列（合計）與未分類列（其他）
        vrows = df[~df["村里"].isin(["合計", "其他"])]
        vi = {}
        for _, r in vrows.iterrows():
            t, v = r["鄉鎮市區"], clean_name(r["村里"])
            n, tot = r["納稅單位(戶)"], r["綜合所得總額"]
            try:
                n, tot = float(n), float(tot)
            except (TypeError, ValueError):
                continue
            if t in geo_names and v and n > 0:
                vi[(t, v)] = tot / n
        village_income[str(y)] = vi

    # --- 死亡率（鄉鎮＋縣市）---
    CODEBOOK = os.environ.get("DEATH_CODEBOOK_XLSX", os.path.join(RAW, "對照表.xlsx"))
    cdf = pd.read_excel(CODEBOOK, sheet_name="county")
    code_col, name_col = cdf.columns[-2], cdf.columns[-1]
    code2name = {}
    for _, r in cdf.iterrows():
        code = str(r[code_col]).strip()
        if code and code != "nan":
            code2name[code.split(".")[0].zfill(4)] = clean_name(r[name_col])

    dcz = os.path.join(SRC, "death_causes.zip")
    with zipfile.ZipFile(dcz) as z:
        dead_files = {int(os.path.basename(n).split("dead")[1].split(".csv")[0]): n
                      for n in z.namelist() if n.endswith(".csv") and "dead" in os.path.basename(n)}
    for y in YEARS:
        if y not in dead_files:
            die(f"死因缺 {y} 年")
        df = read_csv_from_zip(dcz, dead_files[y])
        df = clean_columns(df)
        deaths = {nm: 0 for nm in pop_by_year[str(y)]}                         # 全死因
        cdeaths = {c: {nm: 0 for nm in pop_by_year[str(y)]} for c, _ in DEATH_CAUSES}  # 各死因
        for _, r in df.iterrows():
            nm = code2name.get(str(r["county"]).strip().zfill(4))
            if nm in deaths or (nm and nm in geo_names):
                n = int(r["N"])
                deaths[nm] = deaths.get(nm, 0) + n
                code = str(r["cause"]).strip().zfill(2)
                if code in cdeaths:
                    cdeaths[code][nm] = cdeaths[code].get(nm, 0) + n
        rate = {k: v for k, v in death_rate(deaths, pop_by_year[str(y)]).items() if k in geo_names}
        check_rate("death", y, len(rate), len(geo_names))
        values["death"]["town"][str(y)] = rate
        values["death"]["county"][str(y)] = weighted_ratio(
            [(county_of(nm), d, pop_by_year[str(y)][nm])
             for nm, d in deaths.items() if nm in pop_by_year[str(y)]], per=100000)
        # 各十大死因：同分母（人口）、同縣市加權法
        for c, _ in DEATH_CAUSES:
            crate = {k: v for k, v in death_rate(cdeaths[c], pop_by_year[str(y)]).items() if k in geo_names}
            values[f"death_c{c}"]["town"][str(y)] = crate
            values[f"death_c{c}"]["county"][str(y)] = weighted_ratio(
                [(county_of(nm), d, pop_by_year[str(y)][nm])
                 for nm, d in cdeaths[c].items() if nm in pop_by_year[str(y)]], per=100000)

    # --- 醫療（診所/醫院 每萬人醫事人力，鄉鎮＋縣市）---
    # 分子＝各鄉鎮醫事人員總計，分母＝同年人口（pop_by_year），×10000。
    # 無機構鄉鎮＝0（非缺值）→ 對所有鄉鎮補 0 再算，覆蓋率以人口為準。
    medz = os.path.join(SRC, "medicine.zip")
    # 鄉鎮市區碼 → 全名（取「103 年以後適用」欄，clean_name 統一新制；碼跨年穩定）
    spec = read_csv_from_nested_zip(medz, "medicine/診所人力統計/107年診所人力統計.zip", "欄位說明.csv")
    spec = clean_columns(spec)
    code2town = {}
    for _, r in spec.iterrows():
        code = str(r[spec.columns[0]]).strip()
        nm = clean_name(r[spec.columns[-1]])
        if code and code != "nan" and nm in geo_names:
            code2town[code] = nm
    if len(code2town) < 360:
        die(f"醫療鄉鎮碼對照僅 {len(code2town)} 筆")

    for key, folder, prefix in (("clinic", "診所", "clinic_personnel"),
                                ("hospital", "醫院", "hos_personnel")):
        for y in YEARS:
            inner_zip = f"medicine/{folder}人力統計/{y}年{folder}人力統計.zip"
            df = read_csv_from_nested_zip(medz, inner_zip, f"{prefix}_{y}.csv")
            df = clean_columns(df)
            code_c = df.columns[0]  # 鄉鎮市區碼
            df["醫事人員總計"] = pd.to_numeric(df["醫事人員總計"], errors="coerce")
            med_town = {nm: 0.0 for nm in geo_names}
            n_matched = 0
            for _, r in df.iterrows():
                nm = code2town.get(str(r[code_c]).strip())
                if nm is None:
                    continue
                n_matched += 1
                if not pd.isna(r["醫事人員總計"]):
                    med_town[nm] += float(r["醫事人員總計"])
            # csv 鄉鎮碼須高比例對應到 geo（抓改制年碼制不符）
            if n_matched / len(df) < 0.95:
                die(f"{key} {y} 鄉鎮碼對應率 {n_matched / len(df):.1%} < 95%")
            pop = pop_by_year[str(y)]
            town_rows = [(nm, med_town[nm], pop[nm]) for nm in geo_names if pop.get(nm, 0) > 0]
            check_rate(key, y, len(town_rows), len(geo_names))
            values[key]["town"][str(y)] = weighted_ratio(town_rows, per=10000)
            values[key]["county"][str(y)] = weighted_ratio(
                [(county_of(nm), m, p) for nm, m, p in town_rows], per=10000)

    # --- 村里：人口快照 + 密度 + 所得，嵌入各 TOWNCODE geojson ---
    popz = os.path.join(SRC, "population.zip")
    vp = read_csv_from_zip(popz, "population/opendata10802M020.csv")
    vp = clean_columns(vp)
    vpop = {}  # VILLCODE -> 總計
    for _, r in vp.iterrows():
        code = str(r["區域別代碼"]).strip()
        try:
            vpop[code] = int(r["總計"])
        except (TypeError, ValueError):
            continue

    vfiles = sorted(glob.glob(os.path.join(VILLDIR, "*.json")))
    if len(vfiles) < 360:
        die(f"村里檔數異常 {len(vfiles)}")
    n_vill = n_pop_hit = 0
    inc_hit = {str(y): 0 for y in YEARS}
    all_vdens, all_vinc = [], []
    for fp in vfiles:
        g = json.load(open(fp, encoding="utf-8"))
        for f in g["features"]:
            p = f["properties"]
            n_vill += 1
            full_town = clean_name(str(p.get("COUNTYNAME", "")) + str(p.get("TOWNNAME", "")))
            pop = vpop.get(str(p.get("VILLCODE", "")))
            dens = village_density(pop, p.get("AREA_KM2"))
            p["pop"] = pop
            p["density"] = None if dens is None else round(dens, 1)
            if pop is not None:
                n_pop_hit += 1
            if dens is not None:
                all_vdens.append(dens)
            inc_by_year = {}
            vname = clean_name(p.get("VILLNAME", ""))
            for y in YEARS:
                v = village_income[str(y)].get((full_town, vname))
                if v is not None:
                    inc_by_year[str(y)] = round(v, 1)
                    inc_hit[str(y)] += 1
                    all_vinc.append(v)
            p["income"] = inc_by_year
        json.dump(g, open(fp, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

    pop_rate = n_pop_hit / n_vill
    inc_rate = inc_hit[str(YEARS[-1])] / n_vill
    match_report["village"] = {"n": n_vill, "pop_rate": round(pop_rate, 4),
                               "income_rate_latest": round(inc_rate, 4),
                               "income_hits": inc_hit}
    # 村里界為 115 年版、人口為 108 年快照，期間有村里裁併整編 → 允許低於鄉鎮層的 98%
    if pop_rate < 0.90:
        die(f"村里人口對應率 {pop_rate:.1%} < 90%")
    if inc_rate < 0.85:
        die(f"村里所得對應率 {inc_rate:.1%} < 85%")

    def vals_of(ind, level):
        return [v for yr in values[ind][level].values() for v in yr.values()]

    REGION_OF = {
        "臺北市": "北", "新北市": "北", "基隆市": "北", "桃園市": "北", "新竹市": "北", "新竹縣": "北",
        "苗栗縣": "中", "臺中市": "中", "彰化縣": "中", "南投縣": "中", "雲林縣": "中",
        "嘉義市": "南", "嘉義縣": "南", "臺南市": "南", "高雄市": "南", "屏東縣": "南",
        "宜蘭縣": "東", "花蓮縣": "東", "臺東縣": "東",
        "澎湖縣": "離島", "金門縣": "離島", "連江縣": "離島",
    }
    regions = {name: next((v for k, v in REGION_OF.items() if name.startswith(k)), "其他")
               for name in sorted(geo_names)}

    meta = {
        "years": YEARS,
        "villagePopLabel": VILLAGE_POP_LABEL,
        "indicators": [
            {"key": "density", "label": "人口密度", "unit": "人/km²",
             "levels": ["county", "town", "village"],
             "breaks": quantile_breaks(vals_of("density", "town")),
             "breaksByLevel": {
                 "county": quantile_breaks(vals_of("density", "county")),
                 "town": quantile_breaks(vals_of("density", "town")),
                 "village": quantile_breaks(all_vdens)}},
            {"key": "income", "label": "平均所得", "unit": "千元/戶",
             "levels": ["county", "town", "village"],
             "breaks": quantile_breaks(vals_of("income", "town")),
             "breaksByLevel": {
                 "county": quantile_breaks(vals_of("income", "county")),
                 "town": quantile_breaks(vals_of("income", "town")),
                 "village": quantile_breaks(all_vinc)}},
            {"key": "death", "label": "死亡率", "unit": "每10萬人",
             "levels": ["county", "town"],
             "breaks": quantile_breaks(vals_of("death", "town")),
             "breaksByLevel": {
                 "county": quantile_breaks(vals_of("death", "county")),
                 "town": quantile_breaks(vals_of("death", "town"))}},
            {"key": "clinic", "label": "診所醫事人力", "unit": "人/萬人",
             "levels": ["county", "town"],
             "breaks": quantile_breaks(vals_of("clinic", "town")),
             "breaksByLevel": {
                 "county": quantile_breaks(vals_of("clinic", "county")),
                 "town": quantile_breaks(vals_of("clinic", "town"))}},
            {"key": "hospital", "label": "醫院醫事人力", "unit": "人/萬人",
             "levels": ["county", "town"],
             "note": "數值歸戶於醫院所在鄉鎮，非服務範圍；醫院跨區服務，宜參看縣市層",
             "breaks": quantile_breaks(vals_of("hospital", "town")),
             "breaksByLevel": {
                 "county": quantile_breaks(vals_of("hospital", "county")),
                 "town": quantile_breaks(vals_of("hospital", "town"))}},
        ],
        # 「死亡率」指標的死因別選單：全死因（＝death 指標本身）＋十大死因，各自色階級距。
        "deathCauses": [
            {"key": "death", "label": "全死因",
             "breaks": quantile_breaks(vals_of("death", "town")),
             "breaksByLevel": {"county": quantile_breaks(vals_of("death", "county")),
                               "town": quantile_breaks(vals_of("death", "town"))}},
            *[{"key": f"death_c{c}", "label": lbl,
               "breaks": quantile_breaks(vals_of(f"death_c{c}", "town")),
               "breaksByLevel": {"county": quantile_breaks(vals_of(f"death_c{c}", "county")),
                                 "town": quantile_breaks(vals_of(f"death_c{c}", "town"))}}
              for c, lbl in DEATH_CAUSES],
        ],
        "regions": regions,
    }
    json.dump(meta, open(os.path.join(OUT, "meta.json"), "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))
    json.dump(values, open(os.path.join(OUT, "values.json"), "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))

    # 抽樣加權驗算：縣級值必須等於手算 Σ分子/Σ分母（不同程式路徑）
    y = "108"
    df108 = read_csv_from_zip(pdz, dens_files[108], skiprows=[1])
    df108 = clean_columns(df108)
    for c in ("people_total", "area"):
        df108[c] = pd.to_numeric(df108[c], errors="coerce")
    df108["name"] = df108["site_id"].map(clean_name)
    sub = df108[df108["name"].astype(str).str.startswith("臺北市") & df108["name"].isin(geo_names)]
    manual = sub["people_total"].sum() / sub["area"].sum()
    got = values["density"]["county"][y]["臺北市"]
    if abs(manual - got) > 1e-6 * manual:
        die(f"縣級密度驗算不符：手算 {manual} vs ETL {got}")

    # 死因別 sanity：每死因每年鄉鎮數齊全；且惡性腫瘤為十大死因之首（鄉鎮平均率）
    for c, _ in DEATH_CAUSES:
        for yy in YEARS:
            gn = len(values[f"death_c{c}"]["town"][str(yy)])
            if gn != len(geo_names):
                die(f"死因 {c} {yy} 年鄉鎮數 {gn} != {len(geo_names)}")

    def _mean_rate(key, yy="106"):
        vs = list(values[key]["town"][yy].values())
        return sum(vs) / len(vs) if vs else 0
    ranked = sorted(DEATH_CAUSES, key=lambda cl: -_mean_rate(f"death_c{cl[0]}"))
    if ranked[0][1] != "惡性腫瘤":
        die(f"死因排名異常：106 鄉鎮平均率首位應為惡性腫瘤，實為 {ranked[0][1]}")
    print("死因別 106 鄉鎮平均率前三:", [l for _, l in ranked[:3]])

    print("ETL v3 OK")
    print(json.dumps(match_report, ensure_ascii=False))
    print("county density 108 臺北市 =", round(got, 1), "(驗算通過)")


if __name__ == "__main__":
    main()
