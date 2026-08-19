import subprocess, sys, os
from pathlib import Path

SCRIPT = Path(r"C:\Users\user\jayla\.claude\skills\data-vis-coding-v2\scripts\scaffold.py")


def gen(tmp_path, charts):
    env = {**os.environ, "PYTHONUTF8": "1"}
    subprocess.run([sys.executable, str(SCRIPT), f"c{charts}", "--charts", charts,
                    "--output-dir", str(tmp_path)], check=True, env=env)
    return tmp_path / f"c{charts}"


def test_recharts_variant(tmp_path):
    root = gen(tmp_path, "recharts")
    chart = (root / "src/components/ExampleChart.tsx").read_text(encoding="utf-8")
    assert "recharts" in chart
    assert '"recharts"' in (root / "package.json").read_text(encoding="utf-8")


def test_chartjs_variant(tmp_path):
    root = gen(tmp_path, "chartjs")
    chart = (root / "src/components/ExampleChart.tsx").read_text(encoding="utf-8")
    assert "react-chartjs-2" in chart
    assert '"chart.js"' in (root / "package.json").read_text(encoding="utf-8")


def test_all_variants_use_tokens_not_hardcoded(tmp_path):
    for charts in ["d3", "chartjs", "recharts"]:
        root = gen(tmp_path, charts)
        chart = (root / "src/components/ExampleChart.tsx").read_text(encoding="utf-8")
        assert "useTokens" in chart
        for banned in ["#2a78d6", "#1baf7a", "#eda100"]:
            assert banned not in chart


def test_d3_demo_has_axes_and_size_cap(tmp_path):
    """7/13 實測：d3 示範圖只畫線無座標軸、svg width=100% 配 viewBox 等比放大撐滿全頁。
    示範圖是使用者第一眼印象、也是後續開發模板，須有軸且限寬。"""
    root = gen(tmp_path, "d3")
    chart = (root / "src/components/ExampleChart.tsx").read_text(encoding="utf-8")
    assert "axisBottom" in chart and "axisLeft" in chart, "示範圖須有 x/y 座標軸"
    assert "maxWidth" in chart, "svg 須限寬，否則 viewBox+width:100% 撐滿全頁"


def test_app_shell_has_layout_container(tmp_path):
    """App 外殼須有限寬置中容器與 token 化的標題/按鈕，別讓內容貼齊全頁寬。"""
    root = gen(tmp_path, "d3")
    app = (root / "src/App.tsx").read_text(encoding="utf-8")
    assert "maxWidth" in app
    assert "t.surface" in app and "t.border" in app
