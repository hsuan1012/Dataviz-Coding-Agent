# -*- coding: utf-8 -*-
"""把 mapshaper 輸出的 RFC 7946 環繞方向（外環 CCW）反轉成 d3 球面渲染慣例（外環 CW）。

d3.geoPath 以球面幾何解讀 polygon：外環 CCW 會被視為「全球挖掉這塊」，
整張畫布糊成單色（7/14 全國縣市層/村里層肉眼審抓到的 bug）。
全環反轉即可（外環 CCW→CW、洞 CW→CCW，拓撲關係不變）。
"""
import glob, json, os, sys

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def ring_area(ring):
    """Shoelace（經緯度平面近似）：正=CW、負=CCW。"""
    s = 0.0
    for i in range(len(ring) - 1):
        (x1, y1), (x2, y2) = ring[i], ring[i + 1]
        s += (x2 - x1) * (y2 + y1)
    return s


def rewind_geom(geom):
    """外環一律轉成 CW（洞相反）。回傳是否有修改。"""
    changed = False
    polys = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
    for poly in polys:
        for j, ring in enumerate(poly):
            a = ring_area(ring)
            want_cw = (j == 0)  # 外環 CW、洞 CCW
            if (a > 0) != want_cw:
                ring.reverse()
                changed = True
    return changed


def fix_file(path):
    fc = json.load(open(path, encoding="utf-8"))
    # 原始村里 shapefile 有少數無名稱、無幾何的佔位列（連江縣 12 筆）→ 剔除
    before = len(fc["features"])
    fc["features"] = [f for f in fc["features"] if f["geometry"] is not None]
    dropped = before - len(fc["features"])
    n = sum(rewind_geom(f["geometry"]) for f in fc["features"])
    if n or dropped:
        json.dump(fc, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    if dropped:
        print(f"  dropped {dropped} null-geometry features: {os.path.basename(path)}")
    return n


def main():
    targets = [os.path.join(APP, "public", "counties.geojson")]
    targets += sorted(glob.glob(os.path.join(APP, "public", "data", "villages", "*.json")))
    total_files = fixed = 0
    for p in targets:
        total_files += 1
        if fix_file(p):
            fixed += 1
    print(f"winding fixed: {fixed}/{total_files} files")
    # 驗證：全部檔案外環皆 CW
    for p in targets:
        fc = json.load(open(p, encoding="utf-8"))
        for f in fc["features"]:
            geom = f["geometry"]
            polys = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
            for poly in polys:
                if ring_area(poly[0]) <= 0:
                    sys.exit(f"[FAIL] 外環仍為 CCW: {p} {f['properties']}")
    print("verify: all exterior rings CW")


if __name__ == "__main__":
    main()
