import { useEffect, useMemo, useRef } from "react";
import Globe from "globe.gl";
import { MeshBasicMaterial } from "three";
import { useAppState } from "../state/AppStateContext";
import { useTheme } from "../state/ThemeContext";
import { useLanguage } from "../state/LanguageContext";
import {
  buildGlobePolygonData,
  buildDecorativePolygonData,
  makeGlobeFill,
  strokeColorFor,
  sideColorFor,
  DECORATIVE_COLOR,
  type BoundaryFeature,
  type DecorativeFeature,
  type GlobePolygonDatum,
  type DecorativeDatum,
} from "../lib/globePoints";
import { buildYearIndex, interpolateRecord } from "../lib/interpolateRecords";
import { METRICS, metricLabel, type MetricKey } from "../lib/channels";
import type { CountryMeta, YearRecord } from "../data/types";
import worldBoundariesJson from "../data/worldBoundaries.json";

const BOUNDARY_FEATURES = worldBoundariesJson.features as BoundaryFeature[];
// 裝飾地形(南極洲/格陵蘭等,沒有 Gapminder 統計數字)不受任何互動狀態影響，
// 在模組層級算一次即可、每次渲染拿到同一個陣列 reference，避免被誤判成新資料。
const DECORATIVE_DATA = buildDecorativePolygonData(
  worldBoundariesJson.decorativeFeatures as DecorativeFeature[]
);

type PolygonItem = GlobePolygonDatum | DecorativeDatum;
const isCountry = (d: PolygonItem): d is GlobePolygonDatum => "geo" in d;

// 老師回饋(8/11 二次回饋):海洋一度改白色,但實測後老師認為白色海洋會跟卡片/頁面
// 背景混在一起、辨識度不夠,改回原本的深海軍藍——與陸地洲別色/choropleth 顏色拉開
// 對比,球體邊界才看得清楚。深色模式沿用原本的亮藍(#2F4864)不受影響。
const OCEAN_COLOR_LIGHT = "#0B2545";
const OCEAN_COLOR_DARK = "#2F4864";

// 老師回饋:地球儀初始狀態以台灣為中心。只在掛載時設定一次(transitionMs=0,無動畫)
// ——之後使用者自己拖曳旋轉/縮放地球儀,不會被這個初始值打斷。
const INITIAL_POINT_OF_VIEW = { lat: 23.7, lng: 121.0, altitude: 2.2 };

// 老師回饋:「全不選」狀態(selectedCountries 為空)地球儀改呈現白底黑邊界的中性
// 基礎地圖,而非目前「不勾選就完全不畫國界」的空白海洋——所有國家的邊界照樣畫出來,
// 只是不套用洲別/指標顏色,視覺上像一張還沒上色的空白世界地圖。
const NEUTRAL_CAP_COLOR = "#ffffff";
const NEUTRAL_STROKE_COLOR = "#000000";

// 8/4 使用者回饋:選取國家的邊框強調色(見 globePoints.ts strokeColorFor)在這個
// WebGL 線寬受限的環境下還是不夠明顯——顏色能做的已經做了,線本身粗不起來。改用
// polygonAltitude 把選取中的國家從球面「浮起」一截,靠實體高度差而非線條粗細來標示,
// 不受線寬限制、辨識度更高。polygonAltitude 接受 accessor(見 three-globe.d.ts),
// 屬於 hover/focus 那類「只換材質/幾何參數、不重建 polygonsData」的 reactive prop,
// 搭配既有的 polygonsTransitionDuration(300)會自動有平滑浮起的過場動畫。
const POLYGON_ALTITUDE_BASE = 0.006;
const POLYGON_ALTITUDE_FOCUSED = 0.03;

export function WorldGlobe({ countries, records }: { countries: CountryMeta[]; records: YearRecord[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<ReturnType<ReturnType<typeof Globe>> | null>(null);
  const { state, dispatch } = useAppState();
  const { dark } = useTheme();
  const { lang } = useLanguage();
  // 8/4 使用者二次回饋:「空白處」原本以為是海洋,實際指的是地球儀球體以外的留白區域
  // (容器是方形,球體是圓形,四角會露出容器背景色——這塊區域射線完全沒打中場景裡任何
  // 物件,globe.gl 的 onGlobeClick/onPolygonClick 都不會觸發,前一版邏輯根本接不到)。
  // 改在容器本身(containerRef,globe.gl 的 canvas 掛在它底下)掛原生 click 監聽——
  // 不論點到海洋、裝飾地形、球體外的留白,只要不是「點到國家」都算空白處。用事件
  // 冒泡順序保證正確性:globe.gl 把它的 click 監聽器掛在 canvas 本身,冒泡到容器時
  // onPolygonClick 一定已經同步跑完,justToggledCountryRef 這時已經是最新值。
  // 沒有 onGlobeDblClick,用時間戳記手動判斷雙擊:兩次「非國家」點擊間隔 <350ms
  // 視為一次雙擊。
  const lastBlankClickRef = useRef(0);
  const justToggledCountryRef = useRef(false);
  const registerBlankClick = () => {
    const now = Date.now();
    if (now - lastBlankClickRef.current < 350) {
      lastBlankClickRef.current = 0;
      dispatch({ type: "FOCUS_CLEAR" });
    } else {
      lastBlankClickRef.current = now;
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;
    // globe.gl 的匯出是工廠函式：Globe(config?) 回傳一個「掛載函式」，
    // 呼叫該函式並傳入容器 DOM 才會建立實例——不是 `new Globe(el)`。
    // 老師 8/3 回饋：地球儀改 choropleth 呈現(國家邊界填色)，不需要衛星地形貼圖——
    // 不設 globeImageUrl，改指定 globeMaterial 當海洋底色。用 MeshBasicMaterial(不受光照
    // 影響的實色)而非預設材質——預設材質是 Phong 系，沒貼圖時場景光源不夠會讓球體大半
    // 顯示成黑色(使用者回報的黑色海洋就是這個)。深海軍藍(#0B2545)刻意跟陸地洲別色裡
    // 最接近的亞洲鋼藍(#2A6F97,見 regionColors.ts)拉開亮度差，避免海洋跟陸地混在一起。
    const globeInstance = Globe()(containerRef.current)
      .backgroundColor("#ffffff")
      .globeMaterial(new MeshBasicMaterial({ color: dark ? OCEAN_COLOR_DARK : OCEAN_COLOR_LIGHT }))
      .showAtmosphere(false)
      .polygonGeoJsonGeometry("geometry")
      .polygonSideColor(() => "rgba(15, 23, 42, 0.08)")
      .polygonAltitude(POLYGON_ALTITUDE_BASE)
      // 選了哪些國家改變才需要重建 3D 網格(下面第二個 effect 才會用到 transition)；
      // hover/focus 改走 polygonCapColor/polygonStrokeColor 的 accessor 重新指定，
      // 不碰 polygonsData，避免每次滑鼠移動都整批拆掉重建網格造成閃爍(見下方註解)。
      .polygonsTransitionDuration(300)
      // 裝飾地形沒有 geo,hover/click 對它們無效(no-op,選取 toggle 不生效)。
      // 點到國家時標記 justToggledCountryRef,讓下面掛在容器上的 click 監聽器(冒泡
      // 時一定晚於這裡)知道這次點擊已經處理過,不要又當成「空白處」觸發雙擊清空。
      .onPolygonHover((d: PolygonItem | null) => dispatch({ type: "SET_HOVERED", geo: d && isCountry(d) ? d.geo : null }))
      .onPolygonClick((d: PolygonItem | null) => {
        if (d && isCountry(d)) {
          justToggledCountryRef.current = true;
          dispatch({ type: "FOCUS_TOGGLE", geo: d.geo });
        }
      });
    globeRef.current = globeInstance;
    globeInstance.pointOfView(INITIAL_POINT_OF_VIEW, 0);

    const container = containerRef.current;
    // 掛在容器(canvas 的父層)上,冒泡順序保證晚於 globe.gl 掛在 canvas 本身的 click
    // 監聽器——這裡讀到的 justToggledCountryRef 一定是這次點擊的最新值(見上方
    // onPolygonClick 註解)。justToggledCountryRef 為 true 代表這次點擊已經被當成
    // 「點國家」處理過,重置旗標、不要再當空白處觸發;否則(海洋/裝飾地形/球體外的
    // 留白,三者射線都沒打中對應物件)一律算空白處,交給 registerBlankClick 判斷雙擊。
    const handleContainerClick = () => {
      if (justToggledCountryRef.current) {
        justToggledCountryRef.current = false;
        return;
      }
      registerBlankClick();
    };
    container.addEventListener("click", handleContainerClick);
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      globeRef.current?.width(width).height(height);
    });
    resizeObserver.observe(container);
    // 初始量測：ResizeObserver 的第一次 callback 會非同步觸發，
    // 但同步設定一次可避免首次繪製時短暫使用 globe.gl 預設的 window 尺寸。
    globeInstance.width(container.clientWidth).height(container.clientHeight);

    return () => {
      container.removeEventListener("click", handleContainerClick);
      resizeObserver.disconnect();
      // globe.gl（透過 Kapsule）的頂層實例有公開的 _destructor()：
      // 會停止動畫迴圈、清空各圖層資料，並釋放 three.js 的 renderer/WebGL context。
      // 只清空容器的 innerHTML 並不會釋放這些資源，容器移除後仍會殘留 render loop。
      globeRef.current?._destructor?.();
      container.innerHTML = "";
      globeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 老師回饋:「全不選」時地球儀不該真的畫不出任何國界(見上方 NEUTRAL_CAP_COLOR 註解)
  // ——改用全部國家的 geo 集合餵給 buildGlobePolygonData,靠下面的 accessor effect
  // 決定要不要套用中性白底黑邊界(不動 buildGlobePolygonData 本身的過濾邏輯/既有測試)。
  const allGeos = useMemo(() => new Set(countries.map((c) => c.geo)), [countries]);
  const isNeutral = state.selectedCountries.size === 0;

  // 只在「選了哪些國家」改變時才重算 + 重建 polygonsData——這是唯一該觸發 3D 網格
  // 重建的時機(國家集合真的變了)。useMemo 讓 selectedCountries/countries 沒變時
  // 拿到同一個陣列 reference，下面的 effect 才不會被無關的重渲染誤觸發。
  // 裝飾地形(DECORATIVE_DATA)一律顯示、不受勾選清單影響，排在最前面。
  const polygons = useMemo<PolygonItem[]>(
    () => [
      ...DECORATIVE_DATA,
      ...buildGlobePolygonData(BOUNDARY_FEATURES, countries, isNeutral ? allGeos : state.selectedCountries),
    ],
    [countries, state.selectedCountries, isNeutral, allGeos]
  );
  useEffect(() => {
    globeRef.current?.polygonsData(polygons);
  }, [polygons]);

  // 8/7 老師回饋:choropleth 跟隨散布圖「顏色」通道。指標模式時算出每國「當年值」
  // (吃內插層——播放中顏色跟著小數年份連續變化);region 模式回 null,accessor 走
  // 現行洲別色路徑。
  const yearIndex = useMemo(() => buildYearIndex(records), [records]);
  const colorValueByGeo = useMemo(() => {
    if (state.channels.color === "region") return null;
    const key = state.channels.color as MetricKey;
    const map = new Map<string, number | null>();
    for (const c of countries) {
      const r = interpolateRecord(yearIndex, c.geo, state.currentYear);
      map.set(c.geo, r ? r[key] : null);
    }
    return map;
  }, [state.channels.color, yearIndex, countries, state.currentYear]);

  // hover/focus 只是「同一批已存在的國界」要不要換顏色——這裡故意不呼叫 polygonsData，
  // 只重新指定 polygonCapColor/polygonStrokeColor 這兩個 accessor function。
  // 踩過的坑：一開始把顏色烤進 polygonsData 的每個物件裡，滑鼠移動觸發 hover 就要重建
  // 整批新 reference 的物件餵回 polygonsData，three-globe 的資料綁定認不出「同一個國家」，
  // 整批拆掉重建 3D 網格(比點陣圖層貴很多)，肉眼就是滑鼠一移過地球儀整片閃爍。
  // 分離之後，hover 只更新材質顏色，不動幾何，滑鼠移動不再閃爍。
  // 裝飾地形固定 DECORATIVE_COLOR/預設白邊，不吃 focus 灰化或 hover 強調色。
  // backgroundColor 是 canvas 本身的清底色(卡片邊角球體蓋不到的地方會露出來)，
  // 深色模式回饋:白色清底在深色卡片裡會露出一圈白邊，改成跟卡片同色系的深色。
  useEffect(() => {
    const hasFocus = state.focusSelection.size > 0;
    const fill = makeGlobeFill(state.channels.color, dark);
    // 指標模式 hover 標籤加一行當年值(choropleth 沒有數字可讀,hover 是唯一讀值入口);
    // 缺值國家顯示「—」。
    const colorKey = state.channels.color;
    const valueLine = (geo: string): string => {
      if (colorKey === "region" || !colorValueByGeo) return "";
      const v = colorValueByGeo.get(geo) ?? null;
      const text = v === null ? "—" : METRICS[colorKey as MetricKey].format(v);
      return `<div style="font-size:13px;opacity:.85">${metricLabel(colorKey as MetricKey, lang)}: ${text}</div>`;
    };
    globeRef.current
      ?.backgroundColor(dark ? "#16212e" : "#ffffff")
      .globeMaterial(new MeshBasicMaterial({ color: dark ? OCEAN_COLOR_DARK : OCEAN_COLOR_LIGHT }))
      .polygonCapColor((d: PolygonItem) =>
        isCountry(d)
          ? isNeutral
            ? NEUTRAL_CAP_COLOR
            : fill(d.region, colorValueByGeo?.get(d.geo) ?? null, state.focusSelection.has(d.geo), hasFocus)
          : DECORATIVE_COLOR
      )
      .polygonStrokeColor((d: PolygonItem) =>
        isCountry(d) && isNeutral
          ? NEUTRAL_STROKE_COLOR
          : strokeColorFor(
              isCountry(d) && d.geo === state.hoveredCountry,
              isCountry(d) && state.focusSelection.has(d.geo),
              dark
            )
      )
      .polygonAltitude((d: PolygonItem) =>
        isCountry(d) && state.focusSelection.has(d.geo) ? POLYGON_ALTITUDE_FOCUSED : POLYGON_ALTITUDE_BASE
      )
      .polygonSideColor((d: PolygonItem) =>
        sideColorFor(isCountry(d) && state.focusSelection.has(d.geo), dark)
      )
      // 8/4 語言切換:polygonLabel 跟顏色/描邊同一組——只換 accessor,不動 polygonsData,
      // 語言切換不用重建 3D 網格。中文模式維持雙行(主要語言加粗+次要語言括號補充,
      // U14/老師 8/3 回饋的既有設計);英文模式資料只有一種語言可顯示,改單行。
      .polygonLabel((d: PolygonItem) =>
        isCountry(d)
          ? lang === "zh"
            ? `<div style="text-align:center"><div style="font-size:15px;font-weight:600">${d.nameZh}</div>` +
              `<div style="font-size:15px;opacity:.8">(${d.nameEn})</div>${valueLine(d.geo)}</div>`
            : `<div style="text-align:center"><div style="font-size:15px;font-weight:600">${d.nameEn}</div>${valueLine(d.geo)}</div>`
          : lang === "zh"
            ? `<div style="text-align:center"><div style="font-size:14px;font-weight:600;opacity:.85">${d.nameZh}</div>` +
              `<div style="font-size:13px;opacity:.7">(${d.name})</div></div>`
            : `<div style="text-align:center;font-size:14px;font-weight:600;opacity:.85">${d.name}</div>`
      );
  }, [state.hoveredCountry, state.focusSelection, dark, lang, state.channels.color, colorValueByGeo, isNeutral]);

  return <div ref={containerRef} className="h-full w-full" />;
}
