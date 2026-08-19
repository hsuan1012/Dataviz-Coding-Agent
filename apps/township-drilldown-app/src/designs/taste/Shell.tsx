import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import * as d3 from "d3";
import { useTokens } from "../../lib/useTokens";
import { useLanguage } from "../../state/LanguageContext";
import { metricLabel } from "../../lib/metricI18n";
import { romanizePlaceName } from "../../lib/placeName";
import sd from "../../lib/styleDictionary.js";
const S = sd.typography.sizes, C = sd.components; // type scale/元件層 tokens:一律具名
import { entityInfo, scatterVars, REGIONS } from "../../lib/data";
import { drillToCounty, drillToTown } from "../../lib/nav";
import YearTabs from "../../components/YearTabs";
import MapBreadcrumb from "../../components/MapBreadcrumb";
import MapLegend from "../../components/MapLegend";
import SourceFooter from "../../components/SourceFooter";
import Choropleth from "../../charts/Choropleth";
import RegionRank from "../../charts/RegionRank";
import InfoPanel from "../../charts/InfoPanel";
import Scatter, { ScatterControls } from "../../charts/Scatter";
import type { ShellProps } from "../ShellProps";

// Taste 外殼・合併單頁（老師 7/24 建議③＋使用者 wireframe）：
// 三欄＝散布圖 45%｜台灣地圖 30%｜排名欄 25%，控制列在頂、年份列貼底共用。
// 檢視切換/死因膠囊列退役——X 軸下拉＝全頁「當前指標」（地圖塗色/排名/標題跟著走）；
// 語意合一：點地圖＝下鑽＋整縣選取、框選＝只選取不下鑽（reducer 見 lib/mergedSelect.ts）。
// 老師 8/11 回饋:左側指標選單鈕退役,原位置改可開合的縣市/鄉鎮區導覽(見下方 CountyNav)。
export default function TasteShell({ data, indicator, deathCause, year, view, villages, notice, selectedVillage, scatter, selected, onSelect, onExcludeTown, onScatterChannel, onYear, onView, onDismissNotice, onSelectVillage }: ShellProps) {
  const t = useTokens();
  const { lang, tr, toggle: toggleLang } = useLanguage();
  // 地圖懸停縣市 → 散布圖該縣泡泡描邊(7/22 雙向互動,合併後由外殼牽線)
  const [hoverCounty, setHoverCounty] = useState<string | null>(null);
  const yrs = data?.meta.years ?? [];
  const yrRange = yrs.length ? `${yrs[0]}–${yrs[yrs.length - 1]}` : "102–107"; // 依可見年份（108 已隱藏）
  const title = data ? metricLabel(scatter.x, scatterVars(data.meta).find((v) => v.key === scatter.x)?.label ?? "", lang) : "";

  // 縣→鄉鎮清單(從鄉鎮界回推,FULLNAME=縣名+區名)。
  const townsByCounty = useMemo(() => {
    const m = new Map<string, { full: string; name: string; towncode: string }[]>();
    data?.geo.features.forEach((f) => {
      const p = f.properties as any;
      const county = p.COUNTYNAME as string;
      const item = { full: p.FULLNAME as string, name: p.TOWNNAME as string, towncode: p.TOWNCODE as string };
      const arr = m.get(county);
      if (arr) arr.push(item); else m.set(county, [item]);
    });
    return m;
  }, [data]);
  // 使用者回饋:縣市順序改成北/中/南/東/離島分區,比原本沿用 counties.geojson 的散亂順序
  // 好找。meta.regions 以鄉鎮 FULLNAME 為鍵(見 lib/data.ts),縣的區域=該縣任一鄉鎮的區域
  // (同縣鄉鎮區域一律相同,取第一筆即可)。
  const countyRegion = useMemo(() => {
    const m = new Map<string, string>();
    townsByCounty.forEach((towns, county) => {
      const r = data?.meta.regions[towns[0]?.full ?? ""];
      if (r) m.set(county, r);
    });
    return m;
  }, [townsByCounty, data]);
  // 使用者回饋②:分區內還要再依地理位置由北到南排(如「北」分區基隆市最北要排最前)。
  // 用 d3.geoCentroid 算每個縣多邊形的實際地理中心緯度,由高到低排(緯度越高越北)——
  // 用真實幾何算,不是手刻一份縣市清單去猜(對照澎湖/金門/連江這類離島型的縣容易猜錯)。
  const countyLat = useMemo(() => {
    const m = new Map<string, number>();
    data?.counties.features.forEach((f) => {
      const county = (f.properties as any).COUNTYNAME as string;
      const [, lat] = d3.geoCentroid(f as any);
      m.set(county, lat);
    });
    return m;
  }, [data]);
  const countyList = useMemo(() => {
    const list = data?.counties.features.map((f) => (f.properties as any).COUNTYNAME as string) ?? [];
    return [...list].sort((a, b) => {
      const ra = REGIONS.indexOf(countyRegion.get(a) as any);
      const rb = REGIONS.indexOf(countyRegion.get(b) as any);
      if (ra !== rb) return (ra < 0 ? REGIONS.length : ra) - (rb < 0 ? REGIONS.length : rb);
      return (countyLat.get(b) ?? 0) - (countyLat.get(a) ?? 0); // 緯度高(北)在前
    });
  }, [data, countyRegion, countyLat]);
  // 老師 8/11 回饋:初始狀態＝縣市選項(全部收合);地圖點擊/麵包屑下鑽時同步展開對應的縣,
  // 回全國層時收合回縣市清單。使用者回饋:改支援同時展開多縣(Set,原本只能單縣),
  // 才能做「展開全部/收合全部」;手動點箭頭=獨立 toggle 該縣,不影響其他已展開的縣;
  // 地圖下鑽/麵包屑改變位置時=取代整組展開狀態、只留目前所在縣(焦點跟隨,原行為不變)。
  const [expandedCounties, setExpandedCounties] = useState<Set<string>>(new Set());
  useEffect(() => {
    setExpandedCounties(view.level === "nation" ? new Set() : new Set([view.county!]));
  }, [view.level, view.county]);
  const toggleCounty = (county: string) => {
    setExpandedCounties((prev) => {
      const next = new Set(prev);
      if (next.has(county)) next.delete(county); else next.add(county);
      return next;
    });
  };
  // 使用者 8/11 回饋:樣式比照 gapminder-bubble-globe-app 的國家勾選清單(搜尋框+洲別
  // 展開列右側計數徽章)——縣市導覽也加搜尋(比對縣市名或該縣任一鄉鎮名),搜尋中的縣市
  // 一律強制展開(不受手動收合狀態影響),搜完清空恢復原本收合狀態。
  const [navQuery, setNavQuery] = useState("");
  // 使用者回饋:「台」「臺」異體字要都能搜到——地名資料一律用正式的「臺」字
  // (臺南市/臺北市/臺東縣…),但使用者常打通用的「台」字,兩者需正規化成同一個字再比對。
  // 使用者回饋②:中英文都要能搜到,且不看目前介面語言是中文還是英文——比照
  // gapminder-bubble-globe-app 的 filterBySearch(同時比對原名與顯示名,見該專案
  // lib/selection.ts)。這裡固定用 romanizePlaceName(name,"en") 算英文拼音,不能傳目前的
  // lang:lang==="zh" 時 romanizePlaceName 會原樣回傳中文(見 lib/placeName.ts),等於英文
  // 查詢在中文介面下永遠比對不到——要在任何介面語言下都同時比對中文與英文兩種形式。
  // 英文比對不分大小寫(使用者可能習慣小寫輸入,拼音字首大寫是程式產生的,不該逼使用者跟著打)。
  const zh2tw = (s: string) => s.replace(/臺/g, "台");
  const matchesQuery = (name: string) => {
    const q = navQuery.trim();
    if (!q) return true;
    const romanized = romanizePlaceName(name, "en");
    return zh2tw(name).includes(zh2tw(q))
      || romanized.toLowerCase().includes(q.toLowerCase());
  };
  // 使用者回饋③:輸入鄉鎮/縣市名按 Enter 應該直接下鑽過去,不用打完整名稱(如「板橋」
  // 不必打「板橋區」)也不用再手動點。策略:先找「完全相等」(如剛好打了完整名稱,
  // 或兩個以上鄉鎮同名時用完整名稱消歧義);找不到就退而找「唯一一個子字串符合」的鄉鎮
  // (matchesQuery 同一套子字串比對邏輯——就是清單畫面上實際篩出來的那些);若篩出多筆
  // 或完全沒篩到就不動作,避免打一半字就跳去不是使用者要的地方。鄉鎮優先於縣市(較specific)。
  const exactMatch = (name: string, q: string) =>
    zh2tw(name) === zh2tw(q) || romanizePlaceName(name, "en").toLowerCase() === q.toLowerCase();
  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const q = navQuery.trim();
    if (!q) return;
    const allTowns = countyList.flatMap((county) =>
      (townsByCounty.get(county) ?? []).map((tw) => ({ county, ...tw })));

    const exactTown = allTowns.find((tw) => exactMatch(tw.name, q));
    if (exactTown) { onView(drillToTown({ level: "county", county: exactTown.county, town: null, towncode: null }, exactTown.full, exactTown.towncode)); return; }
    const exactCounty = countyList.find((c) => exactMatch(c, q));
    if (exactCounty) { onView(drillToCounty(exactCounty)); return; }

    const fuzzyTowns = allTowns.filter((tw) => matchesQuery(tw.name));
    if (fuzzyTowns.length === 1) {
      const tw = fuzzyTowns[0];
      onView(drillToTown({ level: "county", county: tw.county, town: null, towncode: null }, tw.full, tw.towncode));
      return;
    }
    if (fuzzyTowns.length > 1) return; // 多筆符合,不消歧義、不亂跳
    const fuzzyCounties = countyList.filter((c) => matchesQuery(c));
    if (fuzzyCounties.length === 1) onView(drillToCounty(fuzzyCounties[0]));
  };
  const filteredCounties = useMemo(() => {
    if (!navQuery.trim()) return countyList;
    return countyList.filter((c) => matchesQuery(c) || (townsByCounty.get(c) ?? []).some((tw) => matchesQuery(tw.name)));
  }, [countyList, navQuery, townsByCounty]);
  // 高度鏈:預設維持 100dvh 鎖屏(老師驗收版);矮視窗(≤860px 高)由 index.css 高度斷點
  // 解鎖成「auto 高+charts-row 定高」→整頁捲軸(7/28)。不能用連續 min-height 地板:
  // 散布圖 viewBox=量測定高、無內在高度,拆掉定高鏈會進「量測→長高→再量測」回饋,連桌機都失鎖。
  // 使用者回饋:深色模式下左側縣市/鄉鎮導覽的捲軸要跟 gapminder-bubble-globe-app 一樣——
  // 該專案不是靠 color-scheme(瀏覽器原生深色捲軸較粗且無法自訂粗細/圓角),而是用
  // .app-scroll 這個共用 class 自訂 -webkit-scrollbar(細滾軸+圓角+隨主題 token 換色)，
  // 這裡直接沿用同一個 class，並補上它需要的 --border/--text-muted CSS 變數。
  return (
    <div className="taste-root flex flex-row w-full overflow-hidden" style={{ background: t.bg, color: t.text, height: "100dvh", fontFamily: sd.typography.fontFamily, ["--accent" as any]: t.accent, ["--border" as any]: t.border, ["--text-muted" as any]: t.textMuted }}>
      {/* 左側導覽列(wireframe v8 回歸):品牌+五指標鈕(=設定 X 軸捷徑,選中態跟 scatter.x 導出)+深色模式 */}
      {/* 7/28 使用者:選單欄縮窄 232→190 */}
      <aside className="taste-aside shrink-0 h-full flex flex-col" style={{ width: 190, borderRight: `1px solid ${t.border}`, padding: "22px 12px", gap: 12, boxSizing: "border-box", background: t.surface }}>
        {/* v14(使用者):主標題置中+漸層字,棄襯線改粗黑體=活潑現代(emoji 依要求移除) */}
        <div className="flex flex-col items-center text-center" style={{ marginBottom: 10 }}>
          <div style={{ fontSize: S.brand, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.3,
            backgroundImage: `linear-gradient(90deg, ${t.accent}, color-mix(in srgb, ${t.accent} 40%, #6ee7b7))`,
            WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
            {tr.brandTitleLine1}<br />{tr.brandTitleLine2}
          </div>
        </div>
        <div className="shrink-0" style={{ paddingBottom: 6 }}>
          {/* 樣式比照 gapminder-bubble-globe-app 的 .app-input:同一組 hover/focus-visible
              互動態(taste-select 已有這組樣式,見 index.css),背景跟側欄同白(t.surface,
              不是頁面底色 t.bg)、字級用跟按鈕同一階的 S.control(13px),padding 4px 8px
              對齊 gapminder 那邊的 px-2 py-1。 */}
          <input
            type="text"
            className="taste-select"
            placeholder={tr.countyNavSearchPlaceholder}
            value={navQuery}
            onChange={(e) => setNavQuery(e.target.value)}
            onKeyDown={onSearchKeyDown}
            style={{
              boxSizing: "border-box", width: "100%", borderRadius: 9,
              border: `1px solid ${t.border}`, fontSize: S.control, padding: "4px 8px",
              color: t.text, background: t.surface, fontFamily: sd.typography.fontFamily,
              marginBottom: 6,
            }}
          />
          {/* 使用者回饋:比照 gapminder 的「全選/全不選」——這裡沒有多選概念,改成同位置的
              「展開全部/收合全部」,一樣是搜尋框正下方一排快速動作鈕。 */}
          <div className="flex gap-2">
            <button type="button" className="taste-nav" onClick={() => setExpandedCounties(new Set(countyList))}
              style={{ borderRadius: 8, border: `1px solid ${t.border}`, fontSize: 12.5,
                color: t.text, background: t.surface, padding: "4px 8px", cursor: "pointer",
                fontFamily: sd.typography.fontFamily }}>
              {tr.expandAllButton}
            </button>
            <button type="button" className="taste-nav" onClick={() => setExpandedCounties(new Set())}
              style={{ borderRadius: 8, border: `1px solid ${t.border}`, fontSize: 12.5,
                color: t.text, background: t.surface, padding: "4px 8px", cursor: "pointer",
                fontFamily: sd.typography.fontFamily }}>
              {tr.collapseAllButton}
            </button>
          </div>
        </div>
        <nav className="county-nav app-scroll" style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minHeight: 0, overflowY: "auto" }}
          aria-label={tr.countyNavAriaLabel}>
          {filteredCounties.map((county) => {
            const isOpen = navQuery.trim() ? true : expandedCounties.has(county);
            const isActiveCounty = view.county === county;
            const towns = townsByCounty.get(county) ?? [];
            return (
              <div key={county}>
                <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <button type="button" onClick={() => toggleCounty(county)}
                    aria-expanded={isOpen}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 2px",
                      color: t.textMuted, fontSize: S.footnote, flexShrink: 0, lineHeight: 1 }}>
                    {isOpen ? "▼" : "▶"}
                  </button>
                  <button type="button" className="taste-nav" title={county}
                    aria-current={isActiveCounty ? "page" : undefined}
                    onClick={() => onView(drillToCounty(county))}
                    style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6,
                      textAlign: "left", overflow: "hidden",
                      background: isActiveCounty ? "color-mix(in srgb, var(--accent) 16%, transparent)" : "transparent",
                      border: "none", padding: "6px 8px", cursor: "pointer", borderRadius: 12,
                      color: isActiveCounty ? t.accent : t.text, fontFamily: sd.typography.fontFamily,
                      fontSize: S.control, fontWeight: isActiveCounty ? 700 : 500 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{romanizePlaceName(county, lang)}</span>
                    <span style={{ marginLeft: "auto", flexShrink: 0, fontSize: 11, fontWeight: 500,
                      color: t.accent, background: t.accentSoft, borderRadius: 999, padding: "1px 7px" }}>
                      {towns.length}
                    </span>
                  </button>
                </div>
                {isOpen && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 1, marginLeft: 22 }}>
                    {towns.map((tw) => {
                      const isActiveTown = view.town === tw.full;
                      return (
                        <button key={tw.full} type="button" title={tw.name} className="taste-nav"
                          aria-current={isActiveTown ? "page" : undefined}
                          onClick={() => onView(drillToTown({ level: "county", county, town: null, towncode: null }, tw.full, tw.towncode))}
                          style={{ textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            background: isActiveTown ? "color-mix(in srgb, var(--accent) 16%, transparent)" : "transparent",
                            border: "none", padding: "4px 8px", cursor: "pointer", borderRadius: 10,
                            color: isActiveTown ? t.accent : t.textMuted, fontFamily: sd.typography.fontFamily,
                            fontSize: S.control, fontWeight: isActiveTown ? 700 : 500 }}>
                          {romanizePlaceName(tw.name, lang)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        {/* v14:底部置中,註記安靜待底(語言切換/深色模式鈕已依使用者 8/11 要求移到主內容標題旁) */}
        <div className="flex flex-col items-center text-center" style={{ marginTop: "auto" }}>
          <p style={{ fontSize: 10, color: t.textMuted, opacity: 0.8, margin: 0, fontVariantNumeric: "tabular-nums" }}>{tr.yearRangeFooterPrefix}{yrRange}{tr.yearRangeFooterSuffix}</p>
        </div>
      </aside>
      {/* 右側主容器:整頁高度鎖定(wireframe v7):header/年份列/footer 天然高、
          圖表區 flex-1 吃剩餘;overflow-hidden 強制無整頁捲軸(≤1100 寬與 ≤860 高斷點解鎖) */}
      <main className="merged-main flex flex-col flex-1 min-w-0 h-full" style={{
        overflow: "hidden", padding: "14px 26px 12px", boxSizing: "border-box" }}>
        <header className="shrink-0" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 18, paddingBottom: 10, borderBottom: `1px solid ${t.border}`, marginBottom: 12 }}>
          <h1 style={{ margin: 0, fontFamily: sd.typography.fontSerif, fontSize: S.title, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.15 }}>
            {title}
          </h1>
          {/* 控制列=全頁唯一控制:X 軸即「當前指標」,地圖與排名跟著走 */}
          {data && <div style={{ marginLeft: "auto" }}>
            <ScatterControls meta={data.meta} channels={scatter} onChannel={onScatterChannel} />
          </div>}
        </header>
        {!data ? <p style={{ color: t.textMuted }}>{tr.loadingData}</p> : (
          <>
            {/* Bento 佈局(使用者 wireframe v4):左=地圖卡貫穿全高(視覺第一焦點/資料篩選器)、
                右上=散布圖卡、右下=排名 2×2 卡。三大區塊卡片化(surface 底+圓角+shadow)。 */}
            {/* 圖表區=flex-1 吃 main 剩餘高度(零魔術數字):overflow-hidden+子項 min-h-0
                =內容再多也不得把底部年份列擠出畫面(grid item 預設 min-height:auto 會撐破) */}
            <div className="charts-row grid grid-cols-12 gap-6 items-stretch flex-1 min-h-0 overflow-hidden">
              <div className="chart-map col-span-4 min-w-0 min-h-0 flex flex-col gap-2 rounded-2xl shadow-sm"
                style={{ background: t.surface, border: `1px solid ${t.border}`, padding: 16 }}>
                <MapBreadcrumb view={view} meta={data.meta} villagesLoading={view.level === "town" && !villages}
                  notice={notice} onView={onView} onDismissNotice={onDismissNotice} />
                <div className="flex-1 min-h-0">
                  <Choropleth geo={data.geo} counties={data.counties} values={data.values} meta={data.meta}
                    colorChannel={scatter.color} year={year}
                    view={view} villages={villages} selectedVillage={selectedVillage}
                    onView={onView} onSelectVillage={onSelectVillage} legend={false} fluid
                    selectedTowns={selected} onHoverCounty={setHoverCounty} />
                </div>
                <MapLegend meta={data.meta} colorChannel={scatter.color} view={view} />
              </div>
              <div className="col-span-8 min-w-0 flex flex-col gap-6 min-h-0 h-full overflow-hidden">
                <div className="chart-scatter rounded-2xl shadow-sm flex flex-col flex-1 min-h-0"
                  style={{ background: t.surface, border: `1px solid ${t.border}`, padding: 16 }}>
                  {/* 卡內圖表滿寬滿高(wireframe v7):操作說明改移進 Scatter 自己的圖例列
                      「使用說明」彈窗按鈕(使用者要求,7/31,見 Scatter.tsx),此處不再另外渲染。 */}
                  <div className="flex-1 min-h-0 w-full">
                    <Scatter values={data.values} meta={data.meta} year={year}
                      channels={scatter} geo={data.geo} selected={selected}
                      onSelect={onSelect} onExcludeTown={onExcludeTown} hoverCounty={hoverCounty}
                      showCaption={false} />
                  </div>
                </div>
                {/* 右下:排名單排(compact,shrink-0 保自身高不被壓縮)。
                    使用者 8/11 回饋:縣層級自身總覽的折線圖面板太占位,已移除,讓 RegionRank
                    四格(X/Y/顏色/大小)吃滿整列寬度;鄉鎮層級(含未選里的鄉鎮自身總覽、
                    點選村里)則保留資訊面板(使用者確認)。 */}
                {(() => {
                  const info = entityInfo(data.meta, data.values, view, selectedVillage, year);
                  const showInfo = !!(info && view.level === "town");
                  return (
                    <div className="rank-row grid grid-cols-12 gap-4 items-stretch shrink-0">
                      <div className={showInfo ? "col-span-4 min-w-0 h-full" : "col-span-12 min-w-0"}>
                        <RegionRank values={data.values} meta={data.meta} indicator={indicator} deathCause={deathCause}
                          year={year} view={view} villages={villages} channels={scatter} compact />
                      </div>
                      {showInfo && <div className="info-slot col-span-8 min-w-0 h-full"><InfoPanel info={info!} year={year} /></div>}
                    </div>
                  );
                })()}
              </div>
            </div>
            {/* 使用者 8/11 要求:語言切換/深色模式鈕改放年份列右下角,跟年份標籤同一水平線。
                relative+absolute:讓 YearTabs 維持原本置中不受旁邊按鈕組寬度影響,
                按鈕組單獨釘在容器右下角(YearTabs 內部是 column,下面那排才是年份標籤本身,
                釘在 bottom 剛好對齊那一排,不是對齊上面的「選擇年度」小標籤)。 */}
            <div className="shrink-0" style={{ position: "relative" }}>
              <YearTabs years={data.meta.years} year={year} onYear={onYear} />
              {/* 使用者要求:寬度跟「使用說明」鈕一致——拿掉舊版寫死的 minWidth:106(那是為了防
                  切換時視覺跳動而人工加寬的),改用跟「使用說明」/「選取」/「清除」完全同一組
                  padding(4px 14px),讓寬度自然由文字內容決定,同一個按鈕家族視覺一致。 */}
              <div style={{ position: "absolute", right: 0, bottom: 2, display: "flex", gap: 8 }}>
                <button className="year-like" onClick={toggleLang} style={{ background: t.surface, color: t.text, border: `1px solid ${t.border}`, borderRadius: C.pill.radius, padding: "4px 14px", cursor: "pointer", fontSize: S.control, fontFamily: sd.typography.fontFamily, transition: "all 150ms ease-in-out" }}>
                  {lang === "zh" ? tr.langToggleToEn : tr.langToggleToZh}
                </button>
                <button className="year-like" onClick={t.toggle} style={{ background: t.surface, color: t.text, border: `1px solid ${t.border}`, borderRadius: C.pill.radius, padding: "4px 14px", cursor: "pointer", fontSize: S.control, fontFamily: sd.typography.fontFamily, transition: "all 150ms ease-in-out" }}>
                  {t.dark ? tr.lightModeButton : tr.darkModeButton}
                </button>
              </div>
            </div>
          </>
        )}
        {/* 頁尾列:資料來源(深色模式鈕/年份註記回歸左側欄) */}
        <div className="shrink-0"><SourceFooter /></div>
      </main>
    </div>
  );
}
