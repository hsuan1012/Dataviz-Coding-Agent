# -*- coding: utf-8 -*-
"""styleDictionary 匯出完整性回歸測試（第二十四次迭代，8/14 treemap dogfood 教訓）。

字典的 named export 若漏列進 default 匯出，`sd.xxx` 會在 runtime 才爆
undefined；寬鬆的 `Record<string, any>` d.ts 又讓 tsc 放行。此處鎖住兩道防線：
① assets/styleDictionary.js 的每個 named export 都要出現在 default bundle；
② scaffold 生成的 d.ts 逐欄位列型別、不得用 Record<string, any> 當 default。
"""
import re
import sys
from pathlib import Path

V2 = Path(r"C:\Users\user\jayla\.claude\skills\data-vis-coding-v2")

sys.path.insert(0, str(V2 / "scripts"))
from scaffold import STYLE_DTS  # noqa: E402


def named_exports(js: str) -> set[str]:
    return set(re.findall(r"^export const (\w+)", js, flags=re.M))


def default_bundle_keys(js: str) -> set[str]:
    m = re.search(r"const styleDictionary = \{(.*?)\}", js, flags=re.S)
    assert m, "找不到 default bundle"
    return {k.strip() for k in re.sub(r"//[^\n]*", "", m.group(1)).replace("\n", "").split(",") if k.strip()}


def test_all_named_exports_in_default_bundle():
    js = (V2 / "assets" / "styleDictionary.js").read_text(encoding="utf-8")
    missing = named_exports(js) - default_bundle_keys(js)
    assert not missing, f"named export 漏列進 default 匯出: {missing}"


def test_dts_declares_every_named_export():
    js = (V2 / "assets" / "styleDictionary.js").read_text(encoding="utf-8")
    dts_names = named_exports(STYLE_DTS)
    missing = named_exports(js) - dts_names
    assert not missing, f"STYLE_DTS 缺 named export 宣告: {missing}"


def test_dts_default_not_loose_record():
    assert "declare const styleDictionary: Record<string, any>" not in STYLE_DTS
    # default 逐欄位列型別，每個 named export 都要出現在 default 型別裡
    m = re.search(r"declare const styleDictionary: \{(.*?)\};", STYLE_DTS, flags=re.S)
    assert m, "STYLE_DTS 的 default 宣告要用逐欄位物件型別"
    for name in named_exports(STYLE_DTS):
        assert f"{name}: typeof {name};" in m.group(1), f"default 型別缺 {name}"
