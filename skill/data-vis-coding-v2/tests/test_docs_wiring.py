from pathlib import Path

# 路徑一律相對於本測試檔所在位置（skill 根目錄 = tests/ 的上一層），不綁死任何機器。
V2 = Path(__file__).resolve().parent.parent


def test_skill_md_mentions_new_assets():
    txt = (V2 / "SKILL.md").read_text(encoding="utf-8")
    assert "scaffold" in txt.lower()
    assert "layout-options.md" in txt
    assert "layout-picker" in txt


def test_workflow_has_layout_picker_step():
    txt = (V2 / "references/workflow.md").read_text(encoding="utf-8")
    assert "layout" in txt.lower() and "picker" in txt.lower()


def test_workflow_has_scaffold_section():
    txt = (V2 / "references/workflow.md").read_text(encoding="utf-8")
    assert "scaffold" in txt.lower()
