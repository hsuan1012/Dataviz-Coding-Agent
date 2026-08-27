from pathlib import Path
import pytest

# 路徑一律相對於本測試檔所在位置（skill 根目錄 = tests/ 的上一層），不綁死任何機器。
V2 = Path(__file__).resolve().parent.parent
ORIG = Path(__file__).resolve().parent.parent.parent / "data-vis-coding"


def test_copy_has_all_original_files():
    for rel in ["SKILL.md", "references/workflow.md", "references/tech-stack.md",
                "references/chart-selection.md", "references/verification.md",
                "assets/styleDictionary.js"]:
        assert (V2 / rel).exists(), f"missing {rel}"


def test_v2_name_changed():
    head = (V2 / "SKILL.md").read_text(encoding="utf-8")[:400]
    assert "name: data-vis-coding-v2" in head


def test_original_untouched():
    if not ORIG.exists():
        pytest.skip("v1 對照組不在此環境（只在開發機並存），跳過")
    head = (ORIG / "SKILL.md").read_text(encoding="utf-8")[:400]
    assert "name: data-vis-coding\n" in head or "name: data-vis-coding\r\n" in head
