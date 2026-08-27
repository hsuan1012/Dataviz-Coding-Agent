# -*- coding: utf-8 -*-
"""TCCIP TReAD 月均溫網格 ETL。

輸入:supervisor 下的 TReAD_月平均溫_全台_<year>.csv(長格式:縣市名,LON,LAT,Month,value)。
輸出(public/data/):
  grids.json       — 去重後的網格座標(lon/lat 兩個等長陣列,索引即 grid id)+ cell 尺寸估計
  temps_<year>.json — 每年 12 個月 × nGrids 的月均溫矩陣(與 grids.json 索引對齊)
  meta.json        — 年份清單、全域溫度範圍、去重統計

去重規則:縣市邊界網格會跨縣市重複(同座標、12 個月值完全一致,已驗證),
保留第一次出現的縣市版本;若發現同座標不同值則直接報錯(資料假設破裂,不能靜默吞掉)。
"""
import argparse
import csv
import json
import os
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
# 原始 TCCIP 月均溫 CSV 不進 repo(授權資料)。執行前用環境變數 TCCIP_SOURCE_DIR 指定資料夾;
# 未設定時退回 repo 內的 data/raw/月均溫網格資料_TCCIP/(需自行放入)。
SOURCE_DIR = os.environ.get(
    "TCCIP_SOURCE_DIR",
    os.path.normpath(os.path.join(HERE, "..", "data", "raw", "月均溫網格資料_TCCIP")))
OUT_DIR = os.path.normpath(os.path.join(HERE, "..", "public", "data"))

ALL_YEARS = list(range(1980, 2025))


def read_year(year, source_dir=SOURCE_DIR):
    """讀一年的 CSV → {(lon_str, lat_str): {county, values[12]}},去重並驗證一致性。"""
    path = os.path.join(source_dir, f"TReAD_月平均溫_全台_{year}.csv")
    grids = {}
    dropped = 0
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        header = next(reader)
        if header != ["縣市名", "LON", "LAT", "Month", "value"]:
            raise ValueError(f"{year}: 非預期的欄位 {header}")
        for county, lon, lat, month, value in reader:
            key = (lon, lat)
            m = int(month)
            v = float(value)
            entry = grids.get(key)
            if entry is None:
                grids[key] = {"county": county, "values": [None] * 12}
                grids[key]["values"][m - 1] = v
            elif entry["county"] == county:
                entry["values"][m - 1] = v
            else:
                # 跨縣市重複網格:值必須與既有版本一致
                existing = entry["values"][m - 1]
                if existing is not None and existing != v:
                    raise ValueError(
                        f"{year}: 網格 {key} 在 {entry['county']} 與 {county} 值不一致 "
                        f"(month {m}: {existing} vs {v})")
                dropped += 1
    for key, entry in grids.items():
        if any(v is None for v in entry["values"]):
            raise ValueError(f"{year}: 網格 {key} 月份不完整")
    return grids, dropped


def estimate_cell(lons, lats):
    """估計網格 cell 尺寸(度),用最近鄰距離的中位數。

    TReAD 是 TWD97 投影下的規則 1km 網格,相對經緯線有微小旋轉,
    任何「沿經度/緯度軸分桶取步距」的做法都會隔格取樣量到 2 倍
    (2026-08-18 實測兩個方向都中招)。改為:空間雜湊找每格最近鄰,
    取中位數距離(公尺)換算回 dlat 與該緯度下的 dlon。
    """
    import math
    mean_lat = sum(lats) / len(lats)
    kx = 111320.0 * math.cos(math.radians(mean_lat))  # 每度經度公尺
    ky = 111320.0                                     # 每度緯度公尺
    cell = 0.02
    buckets = defaultdict(list)
    for i, (lon, lat) in enumerate(zip(lons, lats)):
        buckets[(int(lon / cell), int(lat / cell))].append(i)
    nn = []
    for i in range(0, len(lons), max(1, len(lons) // 1500)):
        bx, by = int(lons[i] / cell), int(lats[i] / cell)
        best = float("inf")
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for j in buckets.get((bx + dx, by + dy), ()):
                    if j == i:
                        continue
                    d = math.hypot((lons[j] - lons[i]) * kx, (lats[j] - lats[i]) * ky)
                    if d < best:
                        best = d
        if best < float("inf"):
            nn.append(best)
    nn.sort()
    spacing_m = nn[len(nn) // 2]
    return round(spacing_m / kx, 5), round(spacing_m / ky, 5)


def build(years, source_dir=SOURCE_DIR, out_dir=OUT_DIR):
    os.makedirs(out_dir, exist_ok=True)
    ref_keys = None
    order = None
    county_idx = None
    tmin, tmax = float("inf"), float("-inf")
    total_dropped = 0
    # 歷年趨勢(側欄 sparkline 用):全島+各縣市 × 12 月 × 每年均溫,前端免抓 45 檔
    trend_island = [[] for _ in range(12)]        # [month][year_i]
    trend_county = {}                             # {縣市: [month][year_i]}
    for year in years:
        grids, dropped = read_year(year, source_dir)
        total_dropped += dropped
        if ref_keys is None:
            ref_keys = set(grids)
            order = sorted(grids)  # 固定順序:座標字串排序,索引即 grid id
            lons = [float(k[0]) for k in order]
            lats = [float(k[1]) for k in order]
            counties = [grids[k]["county"] for k in order]
            county_idx = {}
            for i, c in enumerate(counties):
                county_idx.setdefault(c, []).append(i)
            trend_county = {c: [[] for _ in range(12)] for c in county_idx}
            dlon, dlat = estimate_cell(lons, lats)
            with open(os.path.join(out_dir, "grids.json"), "w", encoding="utf-8") as f:
                json.dump({
                    "n": len(order),
                    "cell": [dlon, dlat],
                    "lon": lons, "lat": lats, "county": counties,
                }, f, ensure_ascii=False)
        elif set(grids) != ref_keys:
            raise ValueError(f"{year}: 網格集合與首年不一致")
        months = [[grids[k]["values"][m] for k in order] for m in range(12)]
        for m in range(12):
            vals = months[m]
            trend_island[m].append(round(sum(vals) / len(vals), 2))
            for c, idx in county_idx.items():
                trend_county[c][m].append(round(sum(vals[i] for i in idx) / len(idx), 2))
        flat = [v for row in months for v in row]
        ymin, ymax = min(flat), max(flat)
        tmin, tmax = min(tmin, ymin), max(tmax, ymax)
        with open(os.path.join(out_dir, f"temps_{year}.json"), "w", encoding="utf-8") as f:
            json.dump({"year": year, "min": ymin, "max": ymax, "months": months}, f)
        print(f"{year}: grids={len(order)} dropped_dup_rows={dropped} range=[{ymin}, {ymax}]")
    with open(os.path.join(out_dir, "trends.json"), "w", encoding="utf-8") as f:
        json.dump({"years": years, "island": trend_island, "county": trend_county},
                  f, ensure_ascii=False)
    with open(os.path.join(out_dir, "meta.json"), "w", encoding="utf-8") as f:
        json.dump({
            "years": years, "nGrids": len(order),
            "tmin": tmin, "tmax": tmax,
            "duplicateGridCountyDropped": total_dropped // len(years) // 12,
        }, f)
    print(f"meta: years={years[0]}..{years[-1]} global range=[{tmin}, {tmax}]")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--years", default="1980",
                    help="逗號分隔或 all(預設 1980,效果確認後再跑 all)")
    args = ap.parse_args()
    years = ALL_YEARS if args.years == "all" else [int(y) for y in args.years.split(",")]
    build(years)
