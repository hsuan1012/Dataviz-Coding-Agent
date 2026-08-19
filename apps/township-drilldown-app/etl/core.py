# -*- coding: utf-8 -*-
"""ETL 純函式（可單元測試）。"""
import numpy as np


def township_income(rows):
    """rows: iterable of (township_name, total_income, n_households).
    回 {township: Σtotal / Σhouseholds}（千元/戶）。"""
    agg = {}
    for name, total, n in rows:
        t, h = agg.get(name, (0.0, 0.0))
        agg[name] = (t + float(total), h + float(n))
    return {name: (t / h) for name, (t, h) in agg.items() if h > 0}


def quantile_breaks(values, k=5):
    """回 k-1 個分位切點（升序）。與前端 densityClass 的 >= 分級一致。"""
    arr = np.asarray([v for v in values if v is not None], dtype=float)
    qs = [i / k for i in range(1, k)]
    return [float(np.quantile(arr, q)) for q in qs]


def death_rate(deaths, pop, per=100000):
    """deaths/pop: {township: count}。回每 per 人死亡率；缺人口者略過。"""
    out = {}
    for name, d in deaths.items():
        p = pop.get(name)
        if p and p > 0:
            out[name] = float(d) / float(p) * per
    return out


# --- 三層下鑽新增 ---

def county_of(fullname):
    """鄉鎮 FULLNAME（如 臺北市北投區）→ 縣市名。台灣 22 縣市名皆為 3 字。"""
    return str(fullname)[:3]


def weighted_ratio(rows, per=1):
    """rows: iterable of (group, numerator, denominator)。
    回 {group: Σnum/Σden*per} —— 加權聚合，拒絕未加權平均；Σden<=0 略過。"""
    agg = {}
    for g, num, den in rows:
        n, d = agg.get(g, (0.0, 0.0))
        agg[g] = (n + float(num), d + float(den))
    return {g: n / d * per for g, (n, d) in agg.items() if d > 0}


def village_density(pop, area_km2):
    """村里人口÷面積(km²)；缺人口或面積<=0 回 None。"""
    if pop is None or not area_km2 or area_km2 <= 0:
        return None
    return float(pop) / float(area_km2)
