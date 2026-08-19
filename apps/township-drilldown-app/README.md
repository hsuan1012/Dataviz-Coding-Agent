# 臺灣鄉鎮統計圖集（township-drilldown-app）

**🔗 線上網站：https://township-drilldown-app.vercel.app**

> 開發過程使用 Claude Code 協助。

在 `township-tabs-app-taste`（前一版，凍結不動）之上新增 **縣市 › 鄉鎮 › 村里三層下鑽**：
全國視圖只畫 22 縣市（縣級著色），點臺北市進入 12 區（鄉鎮著色），點北投區進入 42 里
（村里著色，湖田里…）。深淺主題、金馬 inset 框全數保留，切主題時下鑽位置不丟。
縣市/鄉鎮下鑽與返回上層時，地圖以點擊位置為中心播放
zoom in/out 縮放動畫（老師建議；換指標/年份/主題/框選不觸發；`prefers-reduced-motion`
時瞬間切換）。

**合併單頁（Bento Box，老師 7/24 建議＋使用者 wireframe 定版）**：原「分區排名×地圖｜關係」
檢視切換鈕退役，全部內容同屏一頁——左側欄＝**可開合的縣市／鄉鎮區導覽**（老師 8/11 回饋，取代
原五指標選單；搜尋框可中英/台臺變體混搜、Enter 直接下鑽、展開全部/收合全部、依北中南東離島
分區＋縣內北到南地理排序，比照 `gapminder-bubble-globe-app` 側欄樣式）；主區左 1/3＝
**台灣地圖卡貫穿全高**（視覺焦點兼篩選器）、右上＝**關係散布圖卡**（svg viewBox 與量測尺寸
1:1 動態同步，零留白）、右下＝**四通道排名單排**（北／中／南／東·離島各前五；下鑽至鄉鎮層＝
該層前五名＋資訊面板等高並排，縣層級不顯示資訊面板、排名四格改吃滿整列寬度）；整頁 100dvh
flex 鎖定無捲軸，年份列＋語言切換/深色模式鈕收在貼底 footer 列。**矮視窗（高 ≤860px，如高縮放
筆電）自動解鎖整頁直向捲軸**：圖表列改定高 640px 保住散布圖可讀性（不能用連續 min-height
地板——散布圖 svg viewBox＝量測定高、無內在高度，拆掉定高鏈會進「量測→長高→再量測」回饋，
連桌機鎖屏都會破），桌機（>860px）完全不受影響。

**X 軸＝全頁指標**：排名依據、頁面標題皆由散布圖 X 軸導出（`lib/scatterChannels.ts` 的
`xToIndicator`；X 選死因 → 死亡率＋該死因）；地圖塗色與圖例改跟隨**「顏色」通道**（老師 8/11
回饋），選取/hover 外框改**粉紅色**避免跟「中」區域的青綠色衝突（比照
`gapminder-bubble-globe-app` 的歐洲區配色解法）。X=Y 有防呆（Y 選單禁用與 X 同值的選項）。

**語意合一（B 案五條規則）**：狀態 `{view, selected}` 全進純 reducer（`lib/mergedSelect.ts`，TDD）——
①點地圖縣市＝下鑽＋**整縣選取**（散布圖高亮該縣、其餘調暗）；②散布圖框選＝只選取並自動退回
全國（呼叫端算好新名單整包傳入 `applyBrush`，reducer 本身仍是「接收完整名單→退回全國」；
框空＝清除）；③返回全國＝清除選取；④縣層點鄉鎮＝進村里層＋單點高亮；⑤雙擊泡泡＝從框選
名單剔除（編輯選取不動 view，剔到空→清除＋回全國）。
深連結 `#/臺北市` 進來即帶整縣選取。全國層主地圖維持縣級加權聚合面量圖，選取名單以
**疊加層**表現（選中鄉鎮 accent 描邊＋半透明填色疊在縣級面量圖上）。

**關係散布圖＝四通道 crossfilter**：
X 軸／Y 軸／顏色／大小四個下拉皆可自由指派任一變數，分「基本指標／十大死因」兩組（optgroup）——
死因×死因（如惡性腫瘤×肺炎）或死因×社經指標皆可自由組合（進入「關係」頁時 X 先帶入當前左側
指標；左側「死亡率」若已選死因別，X 自動帶入該死因，頁內可再改）。註：死因相關為鄉鎮層級的
生態相關，不等同個人層級關聯；顏色可選「區域」分類色或任一指標的連續色階＋漸層色條；圖上方圖例列
（左=區域色點/色條、右=嵌套同心圓大小圖例，圓底對齊、引線標值，與圖上泡泡同尺度）。圖下方附
白話解說（每顆泡泡=一個鄉鎮＋四通道怎麼讀，跟著下拉即時更新）。**散布圖圖例列右側「選取」「清除」
互斥的框選模式切換鈕**（使用者要求，7/30 改版）：預設兩者皆關閉，拖曳/單擊泡泡無反應（防誤觸）；
按「選取」開啟後拖曳框選＝框內泡泡**併入**目前名單（累加，不取代），按「清除」（自動關掉「選取」）
拖曳框選＝框內泡泡**移出**名單（累減，不是一次全清）——對稱的加減操作。單顆泡泡的單擊手勢跟隨
模式：選取模式單擊＝加入、清除模式單擊已選泡泡＝移出（8/4 修正，原「單擊一律加入」在清除
模式下違反直覺）；雙擊泡泡＝移出名單，不分模式、任何時候都能用。
框選拖曳範圍改虛線邊框＋accent 淡色半透明底（不擋視線、看得出範圍）；已選泡泡加描邊
（accent 色）跟未選中的區分。
框外泡泡**灰階淡化**（保留全體分布脈絡、顏色只留給選中者）、切年份/切通道名單保留（追同一群人，
非重算框內），主地圖同步以疊加層高亮選中鄉鎮；「清除」鈕無選取時停用、名單清空時自動退出清除模式；
全清所有選取可回全國麵包屑（既有捷徑）。**滾輪縮放＋拖曳平移**（老師建議「放大縮小用滑鼠滾輪
控制比較直覺」，8/4 取代 7/31 的放大鏡框選按鈕，工具列回到選取/清除兩顆）：在圖上滾動＝以游標
位置為錨點縮放（上滾放大、下滾縮小），X/Y 兩軸各自獨立縮放與還原、最小縮到全域的 5%，圖上
滾動會擋掉整頁捲動；放大後直接拖曳圖面＝平移可視範圍（游標跟手、超出全域自動夾住，與選取/
清除框選模式互不干擾）；雙擊空白處＝一次還原（退出縮放並清空選取、回初始狀態）。人口密度
symlog 軸的縮放/平移在**刻度轉換空間**計算且縮放中保留 symlog 刻度（8/7；刻度值改 d3.ticks
動態現算、還原後變回固定對數刻度組）——轉換空間值比例＝像素比例，游標下的泡泡縮放時像素級
釘住不跳（值空間算法在對數軸會被邊界 clamp 推走 200px+，「縮放中切線性刻度」與「游標定點」
在對數軸上數學上不可兼得，故 7/31 方案 A 退役）；縮放範圍外的泡泡在軸線邊界乾淨裁掉、
不會跑出軸外。**使用說明彈窗**：圖表下方原本常駐的操作解說文字，改成「使用說明」按鈕（清除
右邊），點下彈出列點說明的小視窗，貼在按鈕列下方、右緣對齊該按鈕，不擋住控制列；再點按鈕
或點視窗外任何空白處皆可收合。全國層滑過縣市可雙向預覽
（地圖與該縣泡泡互相描邊強調）。**年份標籤列**（純點選，老師 8/11 回饋移除原自動輪播▶按鈕，
只留手動點年份）。
**排名長條（使用者要求，7/30 改版）**：全國層四格改對應散布圖 X／Y／顏色／大小四通道
（`X軸（死亡率）`…），各自全國前五名、各自一把尺（四指標範圍互不相關，跨年份固定可比較），
長條依每列所屬**區域**上色；顏色通道＝「區域」（分類、無數值）時該格顯示提示文字而非排名清單。
切年份時長條寬度伸縮、名次以 translateY 平滑上下移動（keyed by 鄉鎮）。下鑽後排名格維持
**同一套四通道格式**（老師 8/11 回饋，取代原單一指標清單）：下鑽縣→該縣鄉鎮 X/Y/顏色/大小
各前五、下鑽鄉鎮→該區村里 X/Y/顏色/大小各前五。

**中英文語言切換**（使用者 8/11 要求，比照 `gapminder-bubble-globe-app` 已上線的機制）：
語言切換鈕與深色模式鈕並排，釘在年份標籤列右下角（與年份膠囊同一水平線），文字＝按下去
會變成的語言，純 `useState` 不持久化（重新整理回中文）。UI 全翻（`lib/i18n.ts` 唯一真相
來源）＋指標/十大死因/區域分類用資料既有 `key` 索引小型英文對照表（`lib/metricI18n.ts`）；
縣市/鄉鎮/村里地名（含地圖上直接畫的文字標籤、麵包屑、tooltip、排名卡、資訊面板、側欄
縣市／鄉鎮導覽）用 `pinyin-pro` 即時音譯成羅馬拼音＋memoize cache（`lib/placeName.ts`；
拼音為自動化最佳近似，非官方羅馬拼音權威來源，如「臺北」轉出「Taibei」而非郵政式
「Taipei」）。語言鈕/深色模式鈕寬度比照「使用說明」等同家族按鈕的 padding，切換時不跳動。

**版型**：老師認可 Taste 版型（「照著這個版型把其他的地圖加上去」），
使用者決策「字體/顏色仍用方案 A」→ **Taste 側欄骨架 × 方案 A tokens**（Noto Serif TC
襯線標題、冷石板中性、青綠強調與青綠數值色階）。原 taste 配色（燒橙/靛藍）保留在
`lib/tasteTokens.ts` 未接線，要比稿時可切回。**方向 A 舊外殼已依使用者要求整個移除**
（8/11；原本切換器早已隱藏、僅供 localStorage 強制切換供回歸測試用，Taste 為唯一外殼後
`lib/designs.ts`／`useTokens.tsx` 也同步簡化，只留深淺主題這一軸）。

## 三層下鑽設計

| 視圖層 | 著色單位 | 資料 | 點擊 |
|---|---|---|---|
| 全國 | 22 縣市 | **原始分子/分母加權聚合**（見下） | 下鑽該縣 |
| 縣內 | 該縣鄉鎮 | 既有鄉鎮值（102–107 年） | 下鑽該區村里 |
| 區內 | 該區村里 | 人口=普查快照、密度=人口/圖資面積、所得=逐年 | 最末層 |

- **縣級著色的誠實聚合**：拒絕未加權平均。密度=Σ人口÷Σ面積、所得=Σ所得總額÷Σ戶數、
  死亡率=Σ死亡數÷Σ人口，ETL 內建抽樣手算驗證（臺北市密度 9731.6 人/km²）。
- **村里層有什麼顯示什麼**：密度/所得可選；死亡率最細至鄉鎮，進村里層自動降級為密度
  ＋提示條，指標選單中禁用。村里人口為普查快照，圖例與提示明確標示。
- 對應不到的村里（普查後行政區裁併整編，約 5–6%）誠實畫「無資料」色。
- 麵包屑「全國 › 臺北市 › 北投區」逐段可點回（依使用者要求移除「← 上一層」鈕，
  返回一律走麵包屑或瀏覽器上一頁）。位置在**標題下方、排名格＋地圖之上**，橫跨內容區
  （`components/MapBreadcrumb.tsx`，含操作提示與降級通知）。
- **資訊面板**（老師 8/11 回饋調整範圍）：下鑽至**鄉鎮層**才在排名欄旁顯示當前選取單位的
  多指標 sparkline 面板——進北投區看北投區（各指標 102–107 sparkline＋當年值）、**點選村里
  （如大屯里）**看該里（密度=快照＋註記、所得=逐年 sparkline、死亡率=誠實標無村里資料）；
  **縣層級不再顯示**（折線圖太占位），改讓排名四格（X/Y/顏色/大小）吃滿整列寬度。村里點選有
  高亮框，換視圖自動清除。純函式 `entityInfo`（data.ts）供測試。
- **年份標籤列**：年度選擇由下拉改為貼底 footer 一排可點標籤（「102 年…107 年」，
  選中者青綠膠囊填底，`components/YearTabs.tsx`），與語言切換、深色模式鈕同列，全頁共用。
  原自動輪播▶按鈕已依老師 8/11 回饋移除，只留手動點選年份。
- **框選連動（linked brushing）**：散布圖 `d3.brush` 放開瞬間以 `townsInRect`
  （`lib/brushSelect.ts`，TDD）鎖定鄉鎮名單存於 App 層；`dots.raise()` 讓 tooltip 與
  框選共存（從空白處起拖＝框選、泡泡上＝hover）。名單↔地圖以 FULLNAME 對齊，
  有單元測試鎖住這個介面。歷史教訓：舊迷你地圖的金馬 inset **fit 排除集合沒跟著搬**，
  烏坵鄉投影越框疊在主圖上（自動測試全綠、最終全分支 AI 審查抓到），與澎湖壓框同類——
  投影三件套（fit/clip/繪製集合）必須一起搬。
- **迷你地圖退役**：合併單頁後選取高亮由主地圖疊加層承接，`charts/MiniMap.tsx` 與
  `lib/countySelect.ts` 退役（檔案保留未掛載）；「點縣累加 toggle」語意由
  「點縣＝下鑽＋整縣選取」取代（取捨：跨縣名單只能框選）。懸停預覽保留於全國層。
- **泡泡圖固定級距**：X/Y 軸與泡泡半徑 domain 改取「所有年份」的 extent
  （`scatterDomains`），切年份時座標系與尺度不變，可直接比較各年位移（有測試把關
  「固定範圍涵蓋每年 extent」）。
- **泡泡圖切年份動畫**：以鄉鎮名為 key 做 D3 data join，切年份時泡泡不整批重畫、
  而是 750ms `easeCubicInOut` 補間平滑移動；新泡泡半徑從 0 長出；尊重
  `prefers-reduced-motion`。驗證確認「同一批 DOM 節點保留＋368 顆位置補間」。
  （半徑編碼密度、年間穩定，故大小變化細微、最大約 0.4px；主要可見效果是位置滑動。）
- **瀏覽器歷史整合**：下鑽位置同步到 URL hash（`#/臺中市/和平區`）——瀏覽器
  上一頁/下一頁可在層級間導覽、網址可直接分享；**重新整理（F5）則回全國首頁**（使用者 8/11
  回饋，改用 Performance Navigation Timing API 的 `navigation.type==="reload"` 分辨「按重整」
  跟「開新分頁貼分享連結／上一頁下一頁」，只有前者清空 hash）（`lib/nav.ts` 的
  `viewToHash`/`hashToView`，round-trip 有測試）。
- **圖例在版面流**：圖例卡曾以 absolute 疊在地圖上、遮住大甲區西北角（使用者抓到）
  → 移到地圖左欄，任何形狀不可能被擋；verify-drilldown 加「圖例/地圖 bbox 零重疊」常駐檢查。
- 各層各指標使用**自己的 quantile breaks**（meta `breaksByLevel`），不混層。

## 資料工程（etl/）

- `build_data.py`：三層 ETL。鄉鎮層沿用 township-atlas 管線（別名對齊、對應率門檻、
  合計列防重複）；縣級用 `weighted_ratio` 聚合；村里人口以 `區域別代碼`=VILLCODE 對應
  （93.7%）、村里所得以（鄉鎮全名, 村里名）對應（95.5%），值直接嵌入各村里
  geojson 的 properties。
- `fix_winding.py`：**mapshaper 輸出是 RFC 7946 環繞方向（外環 CCW），d3 球面渲染會把
  它畫成「全球挖掉這塊」，整張圖糊成單色**——肉眼審抓到（自動測試全綠也沒擋住，
  又一個「可形式化的視覺不變量要寫成檢查」案例）。全環反轉＋常駐驗證，並剔除源檔
  12 筆連江縣無幾何佔位列。
- 圖資產製（一次性，記錄重現步驟）：
  ```
  # 村里界：政府資料開放平台「村(里)界(TWD97經緯度)」1150624 版（內政部國土測繪中心）
  mapshaper VILLAGE_NLSC_1150624.shp encoding=utf8 \
    -each "AREA_KM2=Math.round(this.area/1e4)/100" -simplify keep-shapes 10% \
    -filter-fields VILLCODE,VILLNAME,TOWNCODE,TOWNNAME,COUNTYNAME,AREA_KM2 \
    -split TOWNCODE -o "public/data/villages/" format=geojson precision=0.0001
  # 縣市界：由鄉鎮界 dissolve（邊界對齊），gap-fill 消 2049 個髮絲縫隙洞、
  # 保留嘉義市/臺北市 2 個真實內飛地洞
  mapshaper -i taiwan_townships.geojson snap -dissolve2 COUNTYNAME \
    copy-fields=COUNTYID,COUNTYCODE -clean gap-fill-area=2km2 \
    -o counties.geojson format=geojson precision=0.0001
  # 之後必跑 python etl/fix_winding.py
  ```
- 村里檔依 TOWNCODE 切 368 檔（共 ~7MB、平均 19KB），進入該區才 lazy load＋記憶體快取；
  載入失敗回鄉鎮層＋提示，不白屏。

## 執行

```
npm install
npm run dev      # 開發（http://localhost:5173）
npm run build    # tsc 0 錯 + 產出 dist/
npm run test     # vitest 142 tests（nav reducer/mergedSelect 語意合一/指標降級/三層資料/嵌入值真值/色階通道/框選/滾輪縮放與拖曳平移 domain 數學（含 symlog 轉換空間）/地圖塗色/死因變數/散布圖解說（雙語）/排名四通道/地名羅馬拼音/指標英文對照）
python etl/build_data.py       # 重建三層資料（含縣級加權抽樣驗算）
python etl/fix_winding.py      # 環繞方向修正＋驗證（geojson 重產後必跑）
python -m pytest etl/ -q       # ETL 純函式測試（8 tests，含加權聚合防未加權平均）
# 以下十一支需 dev server（合併頁語意版，共 240 項，2026-08-11 移除方向 A 後全數重跑確認）：
node scripts/verify-drilldown.mjs       # 三層全流程（下鑽/湖田里真值/降級）28 項
node scripts/verify-designs.mjs         # 主題持久化+雙主題截圖 6 項
node scripts/verify-taiwanvotes.mjs     # inset/下鑽/標籤/footer 5 項
node scripts/verify-scatter.mjs         # 四通道 crossfilter+使用說明彈窗（含圖例列位置/對齊、點空白處關閉）28 項
node scripts/verify-scatter-zoom.mjs    # 滾輪縮放+拖曳平移：游標錨點釘住(symlog 轉換空間,≤10px)/clamp 邊界/動態刻度/雙擊還原/平移不影響框選/放大鏡按鈕已移除 32 項
node scripts/verify-brush-play.mjs      # 選取/清除互斥框選連動+單擊/雙擊+提示章 41 項（含泡泡不越軸/軸外起拖/連江縣剔到空）
node scripts/verify-scatter-causes.mjs  # 死因四通道+白話解說/版面對齊 20 項
node scripts/verify-merged.mjs          # 合併頁三件套一致性（點縣→排名標題/散布圖高亮數/地圖疊加數一致、縣市／鄉鎮導覽、縣層無資訊面板/鄉鎮層保留）32 項
node scripts/verify-rwd.mjs             # RWD 三寬度（1500/960/740）堆疊＋高度斷點（1920×800 捲軸/1080 鎖屏）23 項
node scripts/verify-map-zoom.mjs        # 地圖縮放動畫：觸發規則(換指標/年份/主題不觸發)+並發保護+reduced-motion 24 項
node scripts/check-inset-collision.mjs  # inset 框不得與主圖重疊（澎湖壓框回歸檢查）1 項
```

## 目錄（相對 taste 版的新增/變更）

```
township-drilldown-app/
├── public/
│   ├── counties.geojson                  # 新：22 縣市（dissolve+gap-fill+winding 修正）
│   ├── data/villages/{TOWNCODE}.json     # 新：368 檔村里界＋嵌入值（lazy load）
│   └── data/{meta,values}.json           # 改：三層 values、breaksByLevel、levels
├── etl/                                  # 新：build_data.py / fix_winding.py / core.py + pytest
├── src/lib/nav.ts(.test.ts)              # 新：三層導覽 reducer＋指標降級規則
├── src/lib/mergedSelect.ts(.test.ts)     # 新：合併單頁語意合一 reducer（B 案五條規則）
├── src/lib/data.ts                       # 改：三層型別、valueAt、loadVillages 快取
├── src/charts/Choropleth.tsx             # 改：三模式繪製＋麵包屑＋降級提示＋層級圖例
├── src/App.tsx                           # 改：view 狀態、村里 lazy load、自動降級
└── scripts/verify-drilldown.mjs          # 新：三層下鑽 14 項整合驗證
```

其餘（tokens、排名/關係分頁、驗證哲學）同 `township-tabs-app-taste/README.md`。
