import { useEffect, useMemo, useState } from "react";
import { ThemeProvider } from "./lib/useTokens";
import { loadAll, loadVillages, type VillageProps } from "./lib/data";
import { NATION, up, indicatorAvailable, viewToHash, hashToView, sameView, type View } from "./lib/nav";
import type { ShellProps, ShellData } from "./designs/ShellProps";
import { patchChannels, xToIndicator, type ScatterChannels } from "./lib/scatterChannels";
import { applyView, applyBrush, applyExclude, type NavSel } from "./lib/mergedSelect";
import { countyOf } from "./lib/counties";
import TasteShell from "./designs/taste/Shell";
import { LanguageProvider, useLanguage } from "./state/LanguageContext";

function Inner() {
  const { tr } = useLanguage();
  const [data, setData] = useState<ShellData | null>(null);
  const [year, setYear] = useState(107); // 108 已隱藏（見 data.ts HIDDEN_YEARS），預設為最新可見年
  // 合併單頁:下鑽與選取同進退(下鑽=整縣選取,spec 五條規則),單一 state 走 mergedSelect reducer
  const [nav, setNav] = useState<NavSel>({ view: NATION, selected: null });
  const [villages, setVillages] = useState<GeoJSON.FeatureCollection | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedVillage, setSelectedVillage] = useState<VillageProps | null>(null);
  // 關係圖四通道(crossfilter);初始 X=density、Y=death、大小=income、顏色=區域分類
  const [scatter, setScatter] = useState<ScatterChannels>({ x: "density", y: "death", size: "income", color: "region" });
  // X 軸=全頁「當前指標」:地圖塗色/排名依據/標題由 scatter.x 導出(合併單頁 spec)
  const { indicator, deathCause } = xToIndicator(scatter.x);
  const view = nav.view;

  useEffect(() => { loadAll().then(setData); }, []);

  // 選定年份若不在可見年份清單（例如 108 已隱藏），自動夾到最新可見年
  useEffect(() => {
    if (data && data.meta.years.length && !data.meta.years.includes(year)) {
      setYear(Math.max(...data.meta.years));
    }
  }, [data, year]);

  const townIndex = useMemo(() => {
    const m = new Map<string, string>();
    data?.geo.features.forEach((f) => {
      const p = f.properties as any;
      m.set(p.FULLNAME as string, p.TOWNCODE as string);
    });
    return m;
  }, [data]);

  // 縣市 → 該縣全部鄉鎮 FULLNAME(applyView 整縣選取用;與 countyOf 同源)
  const countyTownsMap = useMemo(() => {
    const m = new Map<string, string[]>();
    data?.geo.features.forEach((f) => {
      const c = countyOf(f);
      const full = (f.properties as any).FULLNAME as string;
      const arr = m.get(c);
      if (arr) arr.push(full);
      else m.set(c, [full]);
    });
    return m;
  }, [data]);
  const townsOfCounty = useMemo(() => (c: string) => countyTownsMap.get(c) ?? [], [countyTownsMap]);

  // 下鑽位置 ↔ URL hash：瀏覽器上一頁/下一頁、分享網址皆保留位置,深連結 #/臺北市
  // 進來即帶整縣選取(applyView 統一入口)。
  // 使用者 8/11 回饋:「重新整理」應該回到全國首頁,不要保留下鑽位置——但分享網址(貼連結
  // 進來)、上一頁/下一頁仍要保留(這兩者是既有規格,見 verify-drilldown.mjs 的深連結/
  // 瀏覽器上一頁測試)。用 Performance Navigation Timing API 的 navigation.type 分辨這次
  // 頁面載入是不是「按了重整鈕」(reload 是瀏覽器原生分類,跟一般 navigate/貼網址/
  // back_forward 不同,可靠區分「重整」跟「開新分頁貼連結」)。
  useEffect(() => {
    if (!data) return;
    const isReload = performance.getEntriesByType("navigation")
      .some((entry) => (entry as PerformanceNavigationTiming).type === "reload");
    if (isReload && location.hash) {
      history.replaceState(null, "", location.pathname + location.search);
    }
    const applyHash = () =>
      setNav((cur) => {
        const target = hashToView(location.hash, townIndex);
        return sameView(target, cur.view) ? cur : applyView(cur, target, townsOfCounty);
      });
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [data, townIndex, townsOfCounty]);

  // 村里層 X 無資料（死亡率/死因）→ X 自動降級為人口密度並提示（X=全頁指標,降級一體適用）
  useEffect(() => {
    if (data && !indicatorAvailable(data.meta, indicator, view)) {
      setScatter((s) => patchChannels(s, { x: "density" }));
      setNotice(tr.deathRateVillageFallbackNotice);
    }
  }, [data, indicator, view, tr]);

  // 村里圖資 lazy load；失敗回鄉鎮層並提示（不白屏）
  useEffect(() => {
    if (view.level !== "town" || !view.towncode) { setVillages(null); return; }
    let cancelled = false;
    setVillages(null);
    loadVillages(view.towncode)
      .then((fc) => { if (!cancelled) setVillages(fc); })
      .catch((e) => {
        if (!cancelled) {
          console.error(e);
          setNotice(`${tr.villageLoadFailedPrefix}${view.towncode}${tr.villageLoadFailedSuffix}`);
          setNav((cur) => applyView(cur, up(cur.view), townsOfCounty));
        }
      });
    return () => { cancelled = true; };
  }, [view, townsOfCounty, tr]);

  // 換視圖清掉村里選取（含 hashchange 觸發的視圖變化）
  useEffect(() => { setSelectedVillage(null); }, [view]);

  // hash 同步(建歷史紀錄供瀏覽器上一頁;回全國清 hash 也留一筆)
  const syncHash = (v: View) => {
    const h = viewToHash(v);
    if (location.hash !== h) {
      if (h) location.hash = h;
      else history.pushState(null, "", location.pathname + location.search);
    }
  };
  // 地圖點擊/麵包屑統一入口:視圖目標 → reducer(選取跟著層級走) → hash
  const onView = (target: View) => {
    const next = applyView(nav, target, townsOfCounty);
    setNav(next);
    setNotice(null);
    syncHash(next.view);
  };
  // 散布圖框選/清除:只選取不下鑽,一律退回全國層(最後動作贏)
  const onSelect = (list: string[] | null) => {
    const next = applyBrush(nav, list);
    setNav(next);
    syncHash(next.view);
  };
  // 雙擊剔除:編輯名單不動 view;剔到空回全國
  const onExcludeTown = (township: string) => {
    const next = applyExclude(nav, township);
    if (next === nav) return;
    setNav(next);
    syncHash(next.view);
  };

  const shellProps: ShellProps = {
    data, indicator, deathCause, year, view, villages, notice, selectedVillage, scatter,
    selected: nav.selected, onSelect, onExcludeTown,
    onDeathCause: (k) => setScatter((s) => patchChannels(s, { x: k as ScatterChannels["x"] })),
    onIndicator: (k) => setScatter((s) => patchChannels(s, { x: k })),
    onScatterChannel: (patch: Partial<ScatterChannels>) => setScatter((s) => patchChannels(s, patch)),
    onYear: setYear, onView,
    onDismissNotice: () => setNotice(null),
    onSelectVillage: setSelectedVillage,
  };
  return <TasteShell {...shellProps} />;
}

export default function App() {
  return <LanguageProvider><ThemeProvider><Inner /></ThemeProvider></LanguageProvider>;
}
