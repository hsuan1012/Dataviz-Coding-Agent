# -*- coding: utf-8 -*-
"""ETL 資料層驗證:去重正確性、對齊、數值抽查(手算對照原始 CSV)。"""
import csv
import json
import os

import pytest

from build_data import SOURCE_DIR, OUT_DIR, read_year

GRIDS_PATH = os.path.join(OUT_DIR, "grids.json")
TEMPS_1980 = os.path.join(OUT_DIR, "temps_1980.json")
META_PATH = os.path.join(OUT_DIR, "meta.json")


@pytest.fixture(scope="module")
def grids():
    with open(GRIDS_PATH, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def temps():
    with open(TEMPS_1980, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def raw_1980():
    """原始 CSV 全列(不經 ETL),作為抽查對照的獨立來源。"""
    path = os.path.join(SOURCE_DIR, "TReAD_月平均溫_全台_1980.csv")
    rows = []
    with open(path, encoding="utf-8-sig", newline="") as f:
        r = csv.reader(f)
        next(r)
        rows.extend(r)
    return rows


def grid_index(grids, lon, lat):
    for i, (x, y) in enumerate(zip(grids["lon"], grids["lat"])):
        if abs(x - lon) < 1e-9 and abs(y - lat) < 1e-9:
            return i
    raise AssertionError(f"grid ({lon},{lat}) not found")


def test_dedupe_unique_count(grids):
    # 1980 原始檔 10,076 個網格×縣市組合,去重後應為 8,975 個唯一座標
    assert grids["n"] == 8975
    assert len(grids["lon"]) == 8975
    assert len(grids["lat"]) == 8975
    assert len(set(zip(grids["lon"], grids["lat"]))) == 8975


def test_dedupe_dropped_rows_match_raw(raw_1980, grids):
    unique_pairs = {(r[1], r[2]) for r in raw_1980}
    combos = {(r[1], r[2], r[0]) for r in raw_1980}
    assert len(unique_pairs) == grids["n"]
    # 被去掉的 = 組合數 - 唯一座標數
    with open(META_PATH, encoding="utf-8") as f:
        meta = json.load(f)
    assert meta["duplicateGridCountyDropped"] == len(combos) - len(unique_pairs)


def test_duplicate_values_consistent():
    # ETL 對「同座標不同值」會 raise;能正常讀完 = 一致性成立
    grids_map, dropped = read_year(1980)
    assert len(grids_map) == 8975
    assert dropped > 0


def test_months_shape_and_alignment(grids, temps):
    assert temps["year"] == 1980
    assert len(temps["months"]) == 12
    for m in temps["months"]:
        assert len(m) == grids["n"]
        assert all(isinstance(v, (int, float)) for v in m)


def test_value_spot_checks(grids, temps):
    # 手算對照:原始 CSV 開頭與結尾的已知值
    i = grid_index(grids, 120.61191, 23.83454)   # 南投縣第一格
    assert temps["months"][0][i] == 15.369
    assert temps["months"][1][i] == 15.656
    j = grid_index(grids, 121.05536, 23.32937)   # 高雄市最末格(山區)
    assert temps["months"][10][j] == 7.977
    assert temps["months"][11][j] == 2.91


def test_random_rows_against_raw(raw_1980, grids, temps):
    # 從原始 CSV 均勻抽 200 列,逐一核對 ETL 輸出
    step = max(1, len(raw_1980) // 200)
    for row in raw_1980[::step]:
        _, lon, lat, month, value = row
        i = grid_index(grids, float(lon), float(lat))
        assert temps["months"][int(month) - 1][i] == float(value)


def test_temperature_range_sane(temps):
    assert -30 < temps["min"] < temps["max"] < 45
    assert temps["min"] == pytest.approx(-1.482)
    assert temps["max"] == pytest.approx(31.594)


def test_cell_size_about_2km(grids):
    # 最近鄰實測網格間距 ~2.07km(8,975 格 × ~4.3km² ≈ 本島面積,吻合);
    # 不是 TReAD 文件常見的 1km —— 以實測為準,勿假設
    dlon, dlat = grids["cell"]
    assert 0.018 < dlon < 0.023
    assert 0.016 < dlat < 0.021


def test_county_field_covers_all(grids):
    assert len(grids["county"]) == grids["n"]
    assert "南投縣" in set(grids["county"])


def test_trends_shape_and_spot_check(grids, temps):
    with open(os.path.join(OUT_DIR, "trends.json"), encoding="utf-8") as f:
        trends = json.load(f)
    n_years = len(trends["years"])
    assert trends["years"][0] == 1980
    assert len(trends["island"]) == 12
    assert all(len(row) == n_years for row in trends["island"])
    assert set(trends["county"]) == set(grids["county"])
    # 抽查:1980 年 1 月全島均溫(對照 temps_1980 手算)
    jan = temps["months"][0]
    expect = round(sum(jan) / len(jan), 2)
    assert trends["island"][0][0] == expect
    # 縣市抽查:南投縣 1980 年 1 月
    idx = [i for i, c in enumerate(grids["county"]) if c == "南投縣"]
    expect_c = round(sum(jan[i] for i in idx) / len(idx), 2)
    assert trends["county"]["南投縣"][0][0] == expect_c
