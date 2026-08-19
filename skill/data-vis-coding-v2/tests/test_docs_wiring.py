from pathlib import Path

V2 = Path(r"C:\Users\user\jayla\.claude\skills\data-vis-coding-v2")


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
