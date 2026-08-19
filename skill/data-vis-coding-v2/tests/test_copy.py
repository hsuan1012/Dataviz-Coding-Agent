from pathlib import Path

V2 = Path(r"C:\Users\user\jayla\.claude\skills\data-vis-coding-v2")
ORIG = Path(r"C:\Users\user\jayla\.claude\skills\data-vis-coding")


def test_copy_has_all_original_files():
    for rel in ["SKILL.md", "references/workflow.md", "references/tech-stack.md",
                "references/chart-selection.md", "references/verification.md",
                "assets/styleDictionary.js"]:
        assert (V2 / rel).exists(), f"missing {rel}"


def test_v2_name_changed():
    head = (V2 / "SKILL.md").read_text(encoding="utf-8")[:400]
    assert "name: data-vis-coding-v2" in head


def test_original_untouched():
    head = (ORIG / "SKILL.md").read_text(encoding="utf-8")[:400]
    assert "name: data-vis-coding\n" in head or "name: data-vis-coding\r\n" in head
