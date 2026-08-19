from core import township_income, quantile_breaks, death_rate

def test_township_income_aggregates_sum_over_sum():
    rows = [("A區", 1000, 10), ("A區", 2000, 10), ("B區", 500, 5)]
    out = township_income(rows)
    assert out["A區"] == (1000 + 2000) / (10 + 10)  # 150.0
    assert out["B區"] == 100.0

def test_quantile_breaks_returns_k_minus_1_cutpoints():
    breaks = quantile_breaks([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], k=5)
    assert len(breaks) == 4
    assert breaks == sorted(breaks)

def test_death_rate_per_100k():
    out = death_rate({"A區": 50}, {"A區": 100000})
    assert out["A區"] == 50.0

def test_death_rate_skips_missing_pop():
    out = death_rate({"A區": 5, "B區": 1}, {"A區": 100000})
    assert "B區" not in out


# --- 三層下鑽新增 ---
from core import county_of, weighted_ratio, village_density

def test_county_of_takes_first_three_chars():
    assert county_of("臺北市北投區") == "臺北市"
    assert county_of("金門縣烏坵鄉") == "金門縣"

def test_weighted_ratio_sums_numerators_and_denominators():
    rows = [("臺北市", 100, 10), ("臺北市", 300, 10), ("新北市", 50, 25)]
    out = weighted_ratio(rows)
    assert out["臺北市"] == 400 / 20  # 加權，非 (10+30)/2 的未加權平均
    assert out["新北市"] == 2.0

def test_weighted_ratio_per_scale_and_zero_denominator():
    out = weighted_ratio([("A", 5, 100000), ("B", 1, 0)], per=100000)
    assert out["A"] == 5.0
    assert "B" not in out

def test_village_density_divides_pop_by_area():
    assert village_density(1656, 2.0) == 828.0
    assert village_density(None, 2.0) is None
    assert village_density(100, 0) is None
