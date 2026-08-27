import subprocess, sys, os
from pathlib import Path

# 路徑一律相對於本測試檔所在位置（skill 根目錄 = tests/ 的上一層），不綁死任何機器。
SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "scaffold.py"


def run_fs(tmp_path):
    env = {**os.environ, "PYTHONUTF8": "1"}
    subprocess.run([sys.executable, str(SCRIPT), "fsapp", "--entity", "township",
                    "--fullstack", "--output-dir", str(tmp_path)], check=True, env=env)
    return tmp_path / "fsapp"


def test_backend_tree(tmp_path):
    root = run_fs(tmp_path)
    for rel in ["backend/app/main.py", "backend/app/database.py", "backend/app/models.py",
                "backend/app/schemas.py", "backend/app/crud.py",
                "backend/app/routers/townships.py", "backend/seed.py",
                "backend/requirements.txt"]:
        assert (root / rel).exists(), f"missing {rel}"


def test_health_route_present(tmp_path):
    root = run_fs(tmp_path)
    main = (root / "backend/app/main.py").read_text(encoding="utf-8")
    assert "/api/health" in main


def test_requirements_has_fastapi(tmp_path):
    root = run_fs(tmp_path)
    req = (root / "backend/requirements.txt").read_text(encoding="utf-8")
    for pkg in ["fastapi", "uvicorn", "sqlalchemy", "pydantic"]:
        assert pkg in req.lower()


def test_vite_proxy_present_when_fullstack(tmp_path):
    root = run_fs(tmp_path)
    vc = (root / "vite.config.ts").read_text(encoding="utf-8")
    assert "/api" in vc and "proxy" in vc
