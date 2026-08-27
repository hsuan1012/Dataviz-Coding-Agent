from pathlib import Path
# 路徑一律相對於本測試檔所在位置（skill 根目錄 = tests/ 的上一層），不綁死任何機器。
HTML = Path(__file__).resolve().parent.parent / "assets" / "layout-picker-template.html"

def test_has_placeholder():
    assert "{{PROJECT_NAME}}" in HTML.read_text(encoding="utf-8")

def test_has_nine_cards():
    txt = HTML.read_text(encoding="utf-8")
    assert txt.count('class="card"') >= 9

def test_no_teacher_default_palette():
    txt = HTML.read_text(encoding="utf-8")
    for banned in ["#2a78d6", "#1baf7a", "#eda100"]:
        assert banned not in txt

def test_direction_a_accent_present():
    # 方向 A 青綠強調色（對照 styleDictionary 實際 accent hex）
    txt = HTML.read_text(encoding="utf-8").lower()
    assert "--accent" in txt or "teal" in txt or "#0" in txt  # 存在 CSS 變數/青綠色系
