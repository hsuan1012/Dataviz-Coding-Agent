#!/usr/bin/env python3
"""Scaffold a data-viz web app.

借鑑自老師 dataviz-webapp skill（2026-07-09）的 scaffold.py，改為：
- 純前端預設（--fullstack 才加 FastAPI+SQLite 後端）
- --charts d3|chartjs|recharts（預設 d3）
- 生成物套「方向 A 雙主題」設計系統（複製本 skill 的 styleDictionary.js）
"""
import argparse
import json
import textwrap
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent  # data-vis-coding-v2/


def w(path: Path, content: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(textwrap.dedent(content).lstrip("\n"), encoding="utf-8")


def copy_style_dictionary(dst: Path):
    """複製本 skill 的方向 A 雙主題字典進生成的專案。"""
    src = SKILL_DIR / "assets" / "styleDictionary.js"
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(src.read_text(encoding="utf-8"), encoding="utf-8")


# styleDictionary.js 的型別宣告：純 .js 模組無宣告會讓 tsc --noEmit 報
# TS7016（7/9 dogfood 實測），scaffold 一併生成。
# default export 逐欄位列型別、不用 Record<string, any>——否則字典漏把 named export
# 放進 default 匯出時 tsc 抓不到、sd.xxx 於 runtime 才爆（8/14 treemap dogfood 實測）。
STYLE_DTS = '''
export const colors: Record<string, string>;
export const accent: Record<string, string>;
export const categoricalPalette: string[];
export const sequentialScale: { from: string; to: string };
export const quantileScale: string[];
export const labelContrast: { labelOnLight: string; labelOnDark: string; darkFrom: number };
export const flowColors: { increase: string; decrease: string; base: string };
export const tooltip: { bg: string; fg: string };
export const typography: {
  fontSerif: string; fontFamily: string; fontMono: string;
  sizes: Record<string, number>; weights: Record<string, number>;
};
export const spacing: Record<string, number>;
export const components: {
  panel: { radius: number };
  button: { radius: number };
  control: { radius: number };
  pill: { radius: number };
  tooltip: { radius: number; padding: string };
  bar: { radius: number };
  swatch: { radius: number };
};
export const shadows: Record<string, string>;
export const themes: { light: Record<string, any>; dark: Record<string, any> };
declare const styleDictionary: {
  colors: typeof colors;
  accent: typeof accent;
  categoricalPalette: typeof categoricalPalette;
  sequentialScale: typeof sequentialScale;
  quantileScale: typeof quantileScale;
  labelContrast: typeof labelContrast;
  flowColors: typeof flowColors;
  tooltip: typeof tooltip;
  typography: typeof typography;
  spacing: typeof spacing;
  components: typeof components;
  shadows: typeof shadows;
  themes: typeof themes;
};
export default styleDictionary;
'''


def chart_deps(charts: str) -> dict:
    return {
        "d3": {"d3": "^7.9.0"},
        "chartjs": {"chart.js": "^4.4.0", "react-chartjs-2": "^5.2.0"},
        "recharts": {"recharts": "^2.12.0"},
    }[charts]


def chart_type_deps(charts: str) -> dict:
    """圖表庫對應的 @types（chart.js/recharts 自帶型別，d3 需另裝；
    地圖類 app 幾乎都會用到 GeoJSON 型別，跟著 d3 一起給）。"""
    return {
        "d3": {"@types/d3": "^7.4.3", "@types/geojson": "^7946.0.14"},
        "chartjs": {},
        "recharts": {},
    }[charts]


def example_chart_src(charts: str, ext: str) -> str:
    if charts == "recharts":
        return '''
        import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
        import { useTokens } from "../lib/useTokens";
        const demo = [{ x: 1, y: 12 }, { x: 2, y: 19 }, { x: 3, y: 9 }, { x: 4, y: 22 }];
        export default function ExampleChart() {
          const t = useTokens();
          return (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={demo}>
                <XAxis dataKey="x" stroke={t.textMuted} />
                <YAxis stroke={t.textMuted} />
                <Tooltip />
                <Line type="monotone" dataKey="y" stroke={t.accent} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          );
        }
        '''
    if charts == "chartjs":
        return '''
        import { Line } from "react-chartjs-2";
        import { Chart, CategoryScale, LinearScale, PointElement, LineElement, Tooltip } from "chart.js";
        import { useTokens } from "../lib/useTokens";
        Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);
        export default function ExampleChart() {
          const t = useTokens();
          const data = { labels: [1, 2, 3, 4], datasets: [{ data: [12, 19, 9, 22], borderColor: t.accent, tension: 0.3 }] };
          return <Line data={data} options={{ scales: { x: { ticks: { color: t.textMuted } }, y: { ticks: { color: t.textMuted } } } }} />;
        }
        '''
    # default: d3
    return '''
    import { useRef, useEffect } from "react";
    import * as d3 from "d3";
    import { useTokens } from "../lib/useTokens";
    const demo = [{ x: 1, y: 12 }, { x: 2, y: 19 }, { x: 3, y: 9 }, { x: 4, y: 22 }];
    export default function ExampleChart() {
      const ref = useRef<SVGSVGElement>(null);
      const t = useTokens();
      useEffect(() => {
        const svg = d3.select(ref.current);
        svg.selectAll("*").remove();
        const W = 480, H = 280, m = { top: 16, right: 16, bottom: 28, left: 36 };
        const x = d3.scaleLinear().domain([1, 4]).range([m.left, W - m.right]);
        const y = d3.scaleLinear().domain([0, 24]).range([H - m.bottom, m.top]);
        svg.attr("viewBox", `0 0 ${W} ${H}`);
        // 座標軸：示範圖沒有軸會像隨機折線，看不出是圖表
        const gx = svg.append("g").attr("transform", `translate(0,${H - m.bottom})`).call(d3.axisBottom(x).ticks(4));
        const gy = svg.append("g").attr("transform", `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5));
        [gx, gy].forEach((g) => {
          g.selectAll("text").attr("fill", t.textMuted);
          g.selectAll("line,path").attr("stroke", t.border);
        });
        const line = d3.line<{ x: number; y: number }>().x((d) => x(d.x)).y((d) => y(d.y));
        svg.append("path").datum(demo).attr("fill", "none")
          .attr("stroke", t.accent).attr("stroke-width", 2).attr("d", line);
      }, [t]);
      // viewBox + width:100% 會等比放大到容器寬——必須限寬，否則示範圖撐滿全頁
      return <svg ref={ref} style={{ width: "100%", maxWidth: 560, display: "block" }} />;
    }
    '''


# 生成的前端套方向 A 雙主題：useTokens 直接 spread 當前主題的 token（themes.light/dark）。
# 真實字典鍵：bg / surface / text / textMuted / accent / accentHover / border ...（無 axis，軸色用 textMuted）。
USE_TOKENS = '''
import { createContext, useContext, useState, type ReactNode } from "react";
import { themes } from "./styleDictionary.js";
// 方向 A 雙主題 token context。t.accent / t.textMuted / t.bg / t.text 皆來自字典當前主題。
const ThemeCtx = createContext<any>(themes.light);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(false);
  const theme = dark ? themes.dark : themes.light;
  return <ThemeCtx.Provider value={{ ...theme, dark, toggle: () => setDark((v) => !v) }}>{children}</ThemeCtx.Provider>;
}
export const useTokens = () => useContext(ThemeCtx);
'''

APP_SRC = '''
import { ThemeProvider, useTokens } from "./lib/useTokens";
import sd from "./lib/styleDictionary.js";
import ExampleChart from "./components/ExampleChart";
// 外殼版面：限寬置中容器＋token 化的標題/按鈕/卡片。
// Tailwind preflight 會重置 h1 樣式，標題要自己給大小權重。
function Inner() {
  const t = useTokens();
  return (
    <div style={{ background: t.bg, color: t.text, minHeight: "100vh", padding: "28px 24px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Data Viz Scaffold</h1>
          <button onClick={t.toggle} style={{ background: t.surface, color: t.text, border: `1px solid ${t.border}`, borderRadius: 9, padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>
            {t.dark ? "淺色" : "深色"}
          </button>
        </div>
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: sd.spacing.borderRadius, padding: sd.spacing.chartPadding }}>
          <ExampleChart />
        </div>
      </div>
    </div>
  );
}
export default function App() {
  return (
    <ThemeProvider>
      <Inner />
    </ThemeProvider>
  );
}
'''

MAIN_SRC = '''
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
'''

INDEX_CSS = '@import "tailwindcss";\n'

INDEX_HTML = '''
<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='16' r='14' fill='%231E293B'/><rect x='10' y='18' width='3' height='5' fill='%2394A3B8'/><rect x='15' y='14' width='3' height='9' fill='%2394A3B8'/><rect x='20' y='10' width='3' height='13' fill='%2394A3B8'/></svg>" />
    <title>{name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
'''

TSCONFIG = '''
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true
  },
  "include": ["src"]
}
'''

GITIGNORE = "node_modules\ndist\n*.db\n__pycache__\n.venv\n"


def package_json(name: str, charts: str, js: bool = False) -> str:
    deps = {"react": "^18.3.1", "react-dom": "^18.3.1", **chart_deps(charts)}
    dev = {
        "@vitejs/plugin-react": "^4.3.0",
        "vite": "^5.4.0",
        "tailwindcss": "^4.0.0",
        "@tailwindcss/vite": "^4.0.0",
    }
    # TS 模式：Vite build 用 esbuild「不做型檢」，漏 @types 也會綠——
    # 7/9 dogfood 實測 build 綠但 tsc --noEmit 爆。補齊 @types 並讓 build 先型檢
    # （老師 dataviz-webapp 的做法：tsc 綠才輪到 vite）。
    if not js:
        dev.update({
            "typescript": "^5.5.0",
            "@types/react": "^18.3.0",
            "@types/react-dom": "^18.3.0",
            "@types/node": "^20.14.0",
            **chart_type_deps(charts),
        })
    build = "vite build" if js else "tsc --noEmit && vite build"
    return json.dumps(
        {
            "name": name,
            "private": True,
            "version": "0.0.0",
            "type": "module",
            "scripts": {"dev": "vite", "build": build, "preview": "vite preview"},
            "dependencies": deps,
            "devDependencies": dev,
        },
        indent=2,
        ensure_ascii=False,
    )


def vite_config(fullstack: bool, port: int) -> str:
    proxy = f'''
      server: {{ proxy: {{ "/api": "http://localhost:{port}" }} }},''' if fullstack else ""
    return textwrap.dedent(f'''
    import {{ defineConfig }} from "vite";
    import react from "@vitejs/plugin-react";
    import tailwindcss from "@tailwindcss/vite";
    export default defineConfig({{
      plugins: [react(), tailwindcss()],{proxy}
    }});
    ''')


def readme(name: str, fullstack: bool, port: int) -> str:
    fe = "npm install && npm run dev"
    be = (
        f"\n## Backend\n```\ncd backend && python -m pip install -r requirements.txt && "
        f"python seed.py && python -m uvicorn app.main:app --port {port}\n```\n"
    ) if fullstack else ""
    return f"# {name}\n\n## Frontend\n```\n{fe}\n```\n{be}"


def scaffold(name, entity, fullstack, charts, js, output_dir, port):
    root = Path(output_dir) / name
    ext = "jsx" if js else "tsx"

    # ----- frontend（純前端時專案根即前端） -----
    copy_style_dictionary(root / "src" / "lib" / "styleDictionary.js")
    if not js:
        w(root / "src" / "lib" / "styleDictionary.d.ts", STYLE_DTS)
    w(root / "src" / "lib" / f"useTokens.{ext}", USE_TOKENS)
    w(root / "src" / "components" / f"ExampleChart.{ext}", example_chart_src(charts, ext))
    w(root / "src" / f"App.{ext}", APP_SRC)
    w(root / "src" / f"main.{ext}", MAIN_SRC)
    w(root / "src" / "index.css", INDEX_CSS)
    w(root / "index.html", INDEX_HTML.format(name=name))
    w(root / "vite.config.ts", vite_config(fullstack, port))
    if not js:
        w(root / "tsconfig.json", TSCONFIG)
    w(root / ".gitignore", GITIGNORE)
    w(root / "package.json", package_json(name, charts, js))
    w(root / "README.md", readme(name, fullstack, port))

    if fullstack:
        scaffold_backend(root, name, entity)

    print(f"Scaffolded {name} ({'fullstack' if fullstack else 'frontend-only'}, charts={charts}) at {root}")


def scaffold_backend(root: Path, name: str, entity: str):
    Entity = entity.capitalize()
    w(root / "backend" / "app" / "__init__.py", "")
    w(root / "backend" / "app" / "main.py", f'''
        from fastapi import FastAPI
        from fastapi.middleware.cors import CORSMiddleware
        from .database import init_db
        from .routers import {entity}s
        app = FastAPI(title="{name}")
        app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
        app.include_router({entity}s.router)
        @app.get("/api/health")
        def health():
            return {{"status": "ok"}}
        init_db()
    ''')
    w(root / "backend" / "app" / "database.py", '''
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker, declarative_base
        engine = create_engine("sqlite:///./data.db", connect_args={"check_same_thread": False})
        SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
        Base = declarative_base()
        def get_db():
            db = SessionLocal()
            try:
                yield db
            finally:
                db.close()
        def init_db():
            Base.metadata.create_all(bind=engine)
    ''')
    w(root / "backend" / "app" / "models.py", f'''
        from sqlalchemy import Column, Integer, String, Float, DateTime
        from .database import Base
        class {Entity}(Base):
            __tablename__ = "{entity}s"
            id = Column(Integer, primary_key=True, index=True)
            name = Column(String, index=True)
            value = Column(Float)
            category = Column(String, index=True)
            timestamp = Column(DateTime, index=True)
    ''')
    w(root / "backend" / "app" / "schemas.py", f'''
        from pydantic import BaseModel
        from datetime import datetime
        class {Entity}Base(BaseModel):
            name: str
            value: float
            category: str
            timestamp: datetime
        class {Entity}Create({Entity}Base):
            pass
        class {Entity}Read({Entity}Base):
            id: int
            class Config:
                from_attributes = True
    ''')
    w(root / "backend" / "app" / "crud.py", f'''
        from sqlalchemy.orm import Session
        from . import models
        def list_{entity}s(db: Session):
            return db.query(models.{Entity}).all()
    ''')
    w(root / "backend" / "app" / "routers" / "__init__.py", "")
    w(root / "backend" / "app" / "routers" / f"{entity}s.py", f'''
        from fastapi import APIRouter, Depends
        from sqlalchemy.orm import Session
        from ..database import get_db
        from .. import crud, schemas
        router = APIRouter(prefix="/api/{entity}s", tags=["{entity}s"])
        @router.get("", response_model=list[schemas.{Entity}Read])
        def list_items(db: Session = Depends(get_db)):
            return crud.list_{entity}s(db)
    ''')
    w(root / "backend" / "seed.py", f'''
        from datetime import datetime, timedelta
        from app.database import SessionLocal, init_db
        from app.models import {Entity}
        init_db()
        db = SessionLocal()
        base = datetime(2024, 1, 1)
        for i in range(30):
            for cat in ["A", "B"]:
                db.add({Entity}(name=f"{{cat}}-{{i}}", value=float(i * (2 if cat == "A" else 3)),
                                category=cat, timestamp=base + timedelta(days=i)))
        db.commit()
        print("seeded")
    ''')
    w(root / "backend" / "requirements.txt",
      "fastapi\nuvicorn[standard]\nsqlalchemy>=2.0\npydantic>=2.0\n")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("name")
    p.add_argument("--entity", default="datapoint")
    p.add_argument("--fullstack", action="store_true")
    p.add_argument("--charts", choices=["d3", "chartjs", "recharts"], default="d3")
    p.add_argument("--js", action="store_true")
    p.add_argument("--output-dir", default=".")
    p.add_argument("--port", type=int, default=8000)
    a = p.parse_args()
    scaffold(a.name, a.entity, a.fullstack, a.charts, a.js, a.output_dir, a.port)
