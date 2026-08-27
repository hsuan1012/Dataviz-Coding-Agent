from pathlib import Path

# 路徑一律相對於本測試檔所在位置（skill 根目錄 = tests/ 的上一層），不綁死任何機器。
DOC = Path(__file__).resolve().parent.parent / "references" / "layout-options.md"


def test_has_nine_layouts():
    txt = DOC.read_text(encoding="utf-8")
    for key in list("ABCDEFGHI"):
        assert f"| {key} " in txt or f"| {key} |" in txt, f"layout {key} missing"


def test_has_four_principles():
    txt = DOC.read_text(encoding="utf-8")
    for kw in ["hover", "漸進揭露", "捲動", "顏色留給資料"]:
        assert kw in txt, f"principle keyword {kw} missing"


def test_has_attribution():
    assert "dataviz-webapp" in DOC.read_text(encoding="utf-8")
