# -*- coding: utf-8 -*-
"""多年 ETL 對帳測試。

114 基準值＝2026-08-14 pandas 獨立實跑；103–108 回填不到鄉鎮的校數
＝同日 scan 實測鎖定（109 年前廢校）。逐年不變量（葉和=原始檔逐列和）
以「測試內獨立用 pandas 重算」對帳，不信任 build_tree 自己的加總。
"""
import pytest

from build_hierarchy import (
    UNPLACED,
    YEARS,
    build,
    county_color_index,
    load,
    school_en,
    township_en,
    township_mapping,
    with_township,
)

BASE_114 = {"students": 1_165_258, "teachers": 99_724, "schools": 2_663}
BASE_ZERO_STUDENT_114 = 12
# 103–108 檔無鄉鎮欄，依 109+ 學校代碼回填後仍無從回填的校數（scan 鎖定）
EXPECTED_UNPLACED = {103: 31, 104: 20, 105: 12, 106: 5, 107: 2, 108: 0,
                     109: 0, 110: 0, 111: 0, 112: 0, 113: 0, 114: 0}


@pytest.fixture(scope="module")
def mapping():
    return township_mapping()


@pytest.fixture(scope="module")
def datasets(mapping):
    return {y: build(y, mapping) for y in YEARS}


def leaves(node):
    if "children" not in node:
        yield node
    else:
        for c in node["children"]:
            yield from leaves(c)


def test_114_totals_match_baseline(datasets):
    assert datasets[114]["totals"] == BASE_114


def test_114_zero_student_schools_kept(datasets):
    zero = [s for s in leaves(datasets[114]["tree"]) if s["students"] == 0]
    assert len(zero) == BASE_ZERO_STUDENT_114


def test_114_spot_check_largest_school(datasets):
    tree = datasets[114]["tree"]
    ntc = next(c for c in tree["children"] if c["name"] == "新北市")
    yh = next(t for t in ntc["children"] if t["name"] == "永和區")
    xl = next(s for s in yh["children"] if s["name"] == "市立秀朗國小")
    assert xl["students"] == 3024


@pytest.mark.parametrize("year", YEARS)
def test_tree_sums_equal_raw(year, datasets):
    """逐年：樹葉和/校數 == 原始檔 pandas 獨立加總（不經 build_tree）。"""
    df = load(year)
    ls = list(leaves(datasets[year]["tree"]))
    assert len(ls) == len(df)
    assert sum(s["students"] for s in ls) == int(df["students"].sum())
    assert sum(s["teachers"] for s in ls) == int(df["teachers"].sum())
    assert datasets[year]["totals"]["schools"] == len(df)


@pytest.mark.parametrize("year", YEARS)
def test_county_count_and_structure(year, datasets):
    tree = datasets[year]["tree"]
    assert len(tree["children"]) == 22  # 103 年桃園縣取代桃園市，仍 22 縣市
    for county in tree["children"]:
        assert county["en"], county["name"]  # 每層皆有英文名
        for township in county["children"]:
            assert township["en"], f"{county['name']}{township['name']}"
            assert township["children"], f"{county['name']}{township['name']}"
            for school in township["children"]:
                assert "children" not in school
                assert set(school) == {"id", "name", "en", "students", "teachers"}
                assert school["en"]


def test_english_names_spot_checks():
    assert township_en("板橋區") == "Banqiao District"
    assert township_en("淡水區") == "Tamsui District"  # 官方例外，非 Danshui
    assert township_en("鹿港鎮") == "Lukang Township"
    assert township_en("綠島鄉") == "Lyudao Township"  # ü→yu 官方拼寫
    assert township_en(UNPLACED) == "(township unrecorded)"
    assert school_en("市立秀朗國小") == "Municipal Xiulang Elementary School"
    assert school_en("私立淡江高中附設國小部") == "Private Danjiang Senior High Affiliated Elementary School"
    assert school_en("縣立豐山實驗國(中)小") == "County Fengshan Experimental Elementary & Junior High School"


def test_county_en_official(datasets):
    tree = datasets[114]["tree"]
    en = {c["name"]: c["en"] for c in tree["children"]}
    assert en["新北市"] == "New Taipei City"
    assert en["高雄市"] == "Kaohsiung City"  # 官方名，非拼音 Gaoxiong
    assert en["基隆市"] == "Keelung City"
    tree103 = datasets[103]["tree"]
    en103 = {c["name"]: c["en"] for c in tree103["children"]}
    assert en103["桃園縣"] == "Taoyuan County"


@pytest.mark.parametrize("year", YEARS)
def test_unplaced_counts_locked(year, datasets):
    data = datasets[year]
    assert data["unplacedSchools"] == EXPECTED_UNPLACED[year]
    got = sum(1 for c in data["tree"]["children"] for t in c["children"]
              if t["name"] == UNPLACED for _ in t["children"])
    assert got == EXPECTED_UNPLACED[year]


@pytest.mark.parametrize("year", YEARS)
def test_school_ids_unique(year, datasets):
    ids = [s["id"] for s in leaves(datasets[year]["tree"])]
    assert len(ids) == len(set(ids))


def test_103_taoyuan_is_county(datasets):
    names = [c["name"] for c in datasets[103]["tree"]["children"]]
    assert "桃園縣" in names and "桃園市" not in names
    names114 = [c["name"] for c in datasets[114]["tree"]["children"]]
    assert "桃園市" in names114 and "桃園縣" not in names114


def test_county_color_index_taoyuan_same_color():
    idx = county_color_index()
    assert idx["桃園縣"] == idx["桃園市"]  # 同縣市代碼 03，跨年同色
    assert len(set(idx.values())) == 22  # 22 個代碼各一個色序


def test_backfill_township_spot_check(mapping):
    """103 年私立淡江高中附設國小部（011301）應回填為淡水區（來自 109+ 對照）。"""
    df = with_township(load(103), 103, mapping)
    row = df[df["學校代碼"] == "011301"].iloc[0]
    assert row["鄉鎮市區"] == "淡水區"
