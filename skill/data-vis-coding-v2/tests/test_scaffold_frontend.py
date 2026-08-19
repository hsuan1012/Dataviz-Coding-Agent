import json, subprocess, sys, os
from pathlib import Path

SKILL = Path(r"C:\Users\user\jayla\.claude\skills\data-vis-coding-v2")
SCRIPT = SKILL / "scripts" / "scaffold.py"


def run(tmp_path, *extra):
    env = {**os.environ, "PYTHONUTF8": "1"}
    subprocess.run(
        [sys.executable, str(SCRIPT), "demoviz", "--entity", "township",
         "--output-dir", str(tmp_path), *extra],
        check=True, env=env,
    )
    return tmp_path / "demoviz"


def test_frontend_tree_exists(tmp_path):
    root = run(tmp_path)
    # useTokens 含 JSX（ThemeProvider），TS 規定須為 .tsx（非 .ts）
    for rel in ["index.html", "package.json", "vite.config.ts", "tsconfig.json",
                ".gitignore", "README.md", "src/main.tsx", "src/App.tsx",
                "src/index.css", "src/lib/styleDictionary.js",
                "src/lib/useTokens.tsx", "src/components/ExampleChart.tsx"]:
        assert (root / rel).exists(), f"missing {rel}"


def test_no_backend_by_default(tmp_path):
    root = run(tmp_path)
    assert not (root / "backend").exists()


def test_style_dictionary_has_dual_theme(tmp_path):
    root = run(tmp_path)
    sd = (root / "src/lib/styleDictionary.js").read_text(encoding="utf-8")
    assert "light" in sd and "dark" in sd


def test_example_chart_reads_from_dictionary_not_hardcoded(tmp_path):
    root = run(tmp_path)
    chart = (root / "src/components/ExampleChart.tsx").read_text(encoding="utf-8")
    assert "styleDictionary" in chart or "useTokens" in chart
    # 不得出現老師白底標準色
    for banned in ["#2a78d6", "#1baf7a", "#eda100"]:
        assert banned not in chart


def test_default_charts_is_d3(tmp_path):
    root = run(tmp_path)
    pkg = (root / "package.json").read_text(encoding="utf-8")
    assert '"d3"' in pkg


def test_types_packages_and_typecheck_build(tmp_path):
    """7/9 dogfood 抓到的缺口：Vite build 綠（esbuild 不型檢）但 tsc --noEmit 爆。
    scaffold 必須補齊 @types 並讓 build 先過型檢（老師 dataviz-webapp 的做法）。"""
    root = run(tmp_path)
    pkg = json.loads((root / "package.json").read_text(encoding="utf-8"))
    for dep in ["@types/react", "@types/react-dom", "@types/node"]:
        assert dep in pkg["devDependencies"], f"missing {dep}"
    assert "@types/d3" in pkg["devDependencies"]      # 預設 d3 要有對應型別
    assert "@types/geojson" in pkg["devDependencies"]  # 地圖類 app 常用
    assert pkg["scripts"]["build"].startswith("tsc"), "build 須先 tsc --noEmit 再 vite build"


def test_style_dictionary_has_dts(tmp_path):
    """styleDictionary.js 無型別宣告會讓 tsc --noEmit 報錯（7/9 dogfood 實測）。"""
    root = run(tmp_path)
    assert (root / "src/lib/styleDictionary.d.ts").exists()


def test_js_mode_skips_types(tmp_path):
    root = run(tmp_path, "--js")
    pkg = json.loads((root / "package.json").read_text(encoding="utf-8"))
    assert "@types/react" not in pkg.get("devDependencies", {})
    assert pkg["scripts"]["build"] == "vite build"
    assert not (root / "src/lib/styleDictionary.d.ts").exists()
