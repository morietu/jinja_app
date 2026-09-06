# Production Smoke Re-check / Release Readiness 再判定

## 1. Metadata

| 項目 | 値 |
|---|---|
| Date | 2026-09-05 |
| Base / Head SHA | `69e5ee1ba55925799efea35c851decc3d2f4b09e`（`origin/develop` tip） |
| Branch | `audit/production-smoke-recheck`（最新 develop から作成） |
| Local build ID | `3Jz3W3ipfh0prxzcXBtX_` |
| 前回 Smoke QA | #2702（base `350a641`） |
| Scope Audit | #2704 |
| 本監査の性質 | **audit-only**。production code / test / token / backend / API / mobile は一切変更していない |

---

## 2. Merge Confirmation（履歴ではなく実コードで確認）

| PR | 内容 | merge commit | 実コード確認 |
|---|---|---|---|
| #2704 | P1 Dark UI Remediation Scope Audit | `ba53b11` | `docs/audit/p1-dark-ui-remediation-scope.md` が develop に存在 |
| #2706 | PSQ-001 Concierge Hero | `78b6c68` | `ConciergeTopRecommendationHero.tsx:137` が `bg-[var(--kt-color-surface-default)]` |
| #2707 | PSQ-002 Shrine Detail Prompt | `30ed5fc` | `ShrineDeepDivePrompt.tsx` L140 `--kt-color-text-primary` / L147 `--kt-color-background-base` |
| #2708 | PSQ-003 Consultation History | `c4b5c86` | `ConsultationHistoryListView.tsx` の `stone`/`bg-white` 残存 **0件** |
| #2709 | PSQ-009 Explore Layout | `89aab5f` | `ExploreLayout.tsx` L50/L51 が `--kt-color-text-muted` / `--kt-color-text-primary` |

**5件すべて merge 済み。**

### 前回 QA（`30ed5fc`）以降の develop 変化

`apps/web` で変更されたのは 15 ファイル。P1 fix 3件（Hero / History / Explore）に加え、`CompassClient.tsx`＋`types.ts`（#2715 / #2716）、`OriginSelector.tsx`（#2715）、`searchEvents.ts`、e2e spec。
**`pnpm-lock.yaml` / `package.json` / `tokens.css` はいずれも無変更。**

---

## 3. 環境

| 項目 | 内容 |
|---|---|
| 実行環境 | `next build` → `next start`（production bundle / production CSS）、`<html class="dark">` は `layout.tsx` が無条件適用 |
| Backend | local stub（Django 相当）。`/api/shrines/{id}/data` は production 実レスポンスを verbatim 投入 |
| Browser | Chromium 1194 / Playwright 1.58.2 |
| Viewports | 375 / 390 / 430 / 1280 |
| 計測方法 | class 文字列の assert ではなく、**実描画ピクセルを対象要素の直近から採取（6×6 patch 最頻色）**し、computed `color`（`lab()`/`oklab()` は sRGB 変換）との WCAG 2.1 相対輝度比を算出。スクロール位置を変えて below-the-fold も走査 |
| 制約 | production / preview への直接 HTTP は本セッションの egress policy で不可（前回 QA と同一）。したがって **production 実レンダリングではなく local production build 上の計測**である |

---

## 4. Build / Validation

| Check | Result |
|---|---|
| production build (`next build`) | **成功**（EXIT=0） |
| typecheck | **0 errors** |
| lint | **0 errors** |
| full web tests | **166 files / 1298 tests passed** |
| contract tests | **166 files / 1298 tests passed** |
| OpenAPI lint | `No results with a severity of 'error' found!` |
| `git diff --check` | **PASS** |

---

## 5. P1 Re-check（統合後の再発有無）

| ID | Area | Previous Problem | Current Result |
|---|---|---|---|
| PSQ-001 | Concierge Recommendation Hero | 神社名 1.34:1 ほか判読不能 | **PASS** |
| PSQ-002 | Shrine Detail 質問 UI | button 1.13:1 / input 1.21:1 | **PASS** |
| PSQ-003 | Consultation History（一覧） | 最終メッセージ 1.07:1 ほか | **PASS** |
| PSQ-009 | Explore Layout（共有部） | `<h1>` 1.15:1 ほか | **PASS** |

### PSQ-001 実測（4 viewport すべて同値）

| 要素 | Before(#2702) | Now |
|---|---|---|
| 神社名「富岡八幡宮」(20px) | 1.34:1 | **15.68:1** |
| Conclusion 本文（R-1 対象） | 反実仮想 1.26:1 | **16.26:1** |
| Ranking Reason「相談との一致が強い」 | 1.83:1 | **9.36:1** |
| Explanation-only Fact「応神天皇」 | 1.61:1 | **9.03:1** |
| 「参考情報」pill | — | **6.74:1** |
| Next Action 本文 | 2.56:1 | **6.74:1** |

長文パス（27文字の神社名 ＋ 156文字の Conclusion 本文）も 4 viewport で overflow / clipping / Hero からのはみ出し **0**。
`/concierge/full` も同一 client のため同結果（low contrast は既知 P2 のヘッダ CTA のみ）。

Hero 内に render される trust label は `ConciergeSectionsRenderer:1181` 側が担っており、既に token 化済み（実測 9.03:1）。Hero の `trustLabels` prop は呼び出し側から渡されないため L151 の branch は **到達不能**（既知 P3、本監査では未修正）。

### PSQ-002 / PSQ-003 / PSQ-009 実測

- Shrine Detail: 入力文字・placeholder・送信 button ともスイープの low-contrast に出現せず（送信 button は 7.70:1）。低コントラストは既知 P2 のヘッダ CTA と経路 CTA（2.47:1）のみ。
- `/mypage/history`（一覧）: **normal list / empty / error** の 3 state を実測。低コントラストはヘッダ CTA（2.47:1）と empty state の CTA（2.47:1）のみ = 既知 P2。**`tokens.css` は無変更で、新規 error token は存在しない**（`--kt-color-status-error` は `:root` と `.dark` の 2 定義のみ）。error state は `--kt-color-border-default` + `--kt-color-background-subtle` の合成で表現されており、D-3 `COMPOSITION_ONLY` を維持。
- `/shrines`: 低コントラストはヘッダ CTA のみ。
- `/map` の **共有 ExploreLayout 部分**（EXPLORE / 神社をたどる / EXPERIENCE / NEARBY / タブ）も同様に PASS。**PSQ-009 の修正は両 route で有効**。

**4件とも統合後に再発なし。**

---

## 6. Viewport QA

| Route | 375 | 390 | 430 | 1280 |
|---|---|---|---|---|
| `/concierge`（結果） | PASS | PASS | PASS | PASS |
| `/concierge/full` | PASS | PASS | PASS | PASS |
| Shrine Detail `/shrines/49` | PASS | PASS | PASS | PASS |
| `/mypage/history`（一覧） | PASS | PASS | PASS | PASS |
| `/shrines` | PASS | PASS | PASS | PASS |
| **`/map`** | **FAIL** | **FAIL** | **FAIL** | **FAIL** |
| **`/mypage/history/[tid]`** | **FAIL** | **FAIL** | **FAIL** | **FAIL** |

全 route・全 viewport で共通して確認できた項目:

- horizontal overflow: **0件**
- clipping / layout collapse: **0件**
- text wrapping: 長文でも折返しのみ、破綻なし
- 空見出し: **0件**
- `undefined` / `null` / `[object Object]`: **0件**
- internal need slug（`money` / `career` / `protection` 等）の露出: **0件**
- internal source key（`shrine_official` / `reason_facts` / `matched_need_tags` 等）の露出: **0件**

---

## 7. `/map` Regression 確認

| 項目 | 結果 |
|---|---|
| Map visible | **N/A — 地図コンポーネントが存在しない** |
| Map dimensions | N/A |
| Map container collapse | N/A |
| Overlay regression | なし（overlay 自体が無い） |
| Map interaction を妨げる layer | なし |
| Horizontal overflow | **なし**（4 viewport） |
| Clipping | なし |

### 事実

`/map` は `MapPageClient` → `ExploreLayout` ＋ `NearbyShrineCardListClient`（カード一覧）で構成されており、
**地図ライブラリ・iframe・canvas をいずれも使用していない**（`grep` で `google.*maps` / `mapbox` / `leaflet` / `maplibre` / `<iframe>` はヒット 0。Google Maps は外部リンク生成のみ）。

したがって「map が利用不能」という regression は**構造的に発生しえない**。一方で、地図が無いこと自体は既存仕様であり本監査の対象外。

補足（観察）: `MapPageClient` の描画分岐は `selected ? "search" : "nearby"` であり、`ViewModeTabs` が操作する `viewMode` state は描画に影響しない。`/shrines` も同様に `viewMode` を `ExploreLayout` へ渡すのみ。したがって **「一覧 / 地図」トグルは両 route で視覚的には動作するが表示内容を変えない**。これは本 P1 群とは無関係の既存挙動であり、New Finding NF-4 として記録する。

---

## 8. Runtime Error Audit

| 分類 | 結果 |
|---|---|
| 5xx | **0件** |
| Hydration error | **0件** |
| React runtime error / uncaught exception / pageerror | **0件**（全 route・全 viewport） |
| Unhandled promise rejection | 0件 |
| Route load failure | 0件 |
| Console error | Shrine Detail のみ 2件 |

### Console error の内訳（expected warning と regression の分離）

Shrine Detail で `404 /api/shrine-interactions/` と `404 /api/visits/` が発生する。
これは **本監査の local stub backend が当該 endpoint を実装していないことに起因する QA 環境固有の事象**であり、production の欠陥ではない（前回 #2702 でも同一の切り分けを記録済み）。

**actual regression に該当する runtime error は 0件。**

---

## 9. Evidence Boundary 再確認

| Surface | 結果 | 実測した表示 |
|---|---|---|
| Concierge Recommendation | **PASS** | 「相談との一致が強い」（Ranking Reason）→「参考情報」pill →「応神天皇」（Explanation-only Fact）→「参拝前にできること」（Action）の順で、**deity が Ranking 理由として提示されていない** |
| Shrine Detail | **PASS** | 「選ばれた理由」「推薦理由」「ranking contribution」の見出しに Explanation-only fact が入る事象は検出されず |
| Consultation History Detail | **PASS** | 「参考情報: 応神天皇」と明示 prefix 付きで分離 |
| Compass | **PASS** | 「参考情報: 今回の方向・距離の条件に合う候補です」＝ Filter Context として分離 |

- `matched_need_tags` / ranking 由来の `goriyaku` / `history_theme` が Explanation-only と混同される表示: **検出されず**
- raw internal need tag / slug のユーザー露出: **0件**（全 route）
- internal source key の露出: **0件**

**Evidence contract の regression なし。**

---

## 10. Compass Ranking Truth 再確認

| 確認項目 | 結果 |
|---|---|
| 九星気学 / 年盤 / 月盤 を score contribution として表示していないか | **PASS** |
| Western astrology を寄与しているように表示していないか | **PASS**（astrology 表現の検出 0件） |
| `history_theme` の役割と表示契約が一致しているか | **PASS** |

実測した表示:

- 「年盤・月盤 共通」バッジ ＋「年盤と月盤の両方で重なる、今月の参考方位です。日盤は使用していません。**（参考情報です）**」
  → Direction eligibility の gate として、明示的に *参考情報* 側に置かれている。
- カード内の match reason は `reason` / `reason_facts` 由来のみで、方位・九星への言及なし。
- `history_theme` は `resolveCompassSupplementaryFactText.ts` により、**実際に rank を押し上げた場合のみ**（backend の `resolve_history_theme_candidate_boost() > 0`）`explanationOnlyFactText` slot へ入り、
  「〜という文脈（KAMI MUSUBIの解釈）」と **Derived Meaning であることを明示**して表示される。official Fact としては提示していない。
- purpose が match しなかった候補には「今回の方向・距離の条件に合う候補です」＝ Filter Context を明示し、**存在しない purpose match を捏造していない**。

ロジックは一切変更していない。

---

## 11. Known P2 / P3 再分類

| Issue | 前回 Severity | 今回実測 | Release impact | 判定 |
|---|---|---|---|---|
| **PSQ-004** Global Primary Action token 対比 | P2 | rest **2.47:1** / hover **1.94:1**（`#fff` on `#00bc7d` / `#00d492`）。全 route のヘッダ CTA・主要 CTA に共通 | 判読は可能で journey を止めない。全 CTA が同一状態で一貫 | **P2 据え置き** |
| **D-1 accent label** | P2 | Hero: eyebrow **3.31:1** / Runtime Match ラベル **3.43:1** / Next Action ラベル **3.42:1** | AA 未満だが判読可能。`ShrineCardCompact:105` と同色・同役割で整合 | **P2 据え置き** |
| **missing `.dark` overrides（11件）** | P3 | `tokens.css` 無変更のため現存 | 本監査対象 route では未使用 | **P3 据え置き** |
| **dead Hero `trustLabels` branch** | P3 | `ConciergeSectionsRenderer` が prop を渡さず到達不能 | ユーザー影響なし | **P3 据え置き** |
| **PSQ-005 OriginSelector**（light 固定） | P2 | #2715 で amber error card は撤去されたが、`bg-white` / `text-stone-*` は現存 | Compass の出発地点選択は成立する | **P2 据え置き** |

**既知 P2 / P3 で P1 へ悪化したものは 0件。**

---

## 12. New Findings

### NF-1（**P1**）Consultation History Detail が未移行

| 項目 | 内容 |
|---|---|
| Route | `/mypage/history/[tid]` |
| Owner | `apps/web/src/components/views/ConsultationHistoryDetailView.tsx` |
| 到達経路 | `/mypage/history` 一覧のスレッドカードをタップ（通常 journey） |
| Viewport | 375 / 390 / 430 / 1280 すべてで再現 |

実測（実描画ピクセル）:

| 要素 | 実測 | 必要 |
|---|---|---|
| **CTA「神社の詳細を見る」**(12px, `text-emerald-800`) | **1.08:1** | 4.5 |
| ご利益「開運」「勝運」(14px, `text-stone-700`) | **1.26:1** | 4.5 |
| **ページ見出し「仕事の流れを整えたい」**(20px) | **1.33:1** | 4.5 |
| 住所 / 「参考情報:」(12–14px, `text-stone-500`) | **1.70:1** | 4.5 |

low-contrast 要素は 12件。スクリーンショットでも CTA と見出しが背景とほぼ同化していることを確認。

**severity 判断**: 本タスクの P1 定義「text / CTA が実質判読不能」に該当。CTA が判別不能かつ主要見出しが読めない。

**位置づけ**: これは 4件の P1 修正の *regression ではない*。#2704 で D-2 の Option B 領域（`/mypage/history/[tid]`）として記録され、Mother Ship の `SCREEN_READABLE_SCOPE` 決定により PSQ-003 の修正範囲から**意図的に除外**された箇所である。#2702 時点では `BLOCKED_BY_ENVIRONMENT` で未計測だったため severity 未分類のままだった。本監査で初めて実測し、P1 相当と判明した。

---

### NF-2（**P1**）`/map` のページ見出しと検索入力が未移行

| 項目 | 内容 |
|---|---|
| Route | `/map` |
| Owner | `apps/web/src/app/map/page.tsx`（見出し） / `apps/web/src/components/PlaceSuggestBox.tsx`（入力） |
| 到達経路 | Home「地図でも確認する」→ `/map`（通常 journey） |
| Viewport | 375 / 390 / 430 / 1280 すべてで再現 |

実測:

| 要素 | 実測 | 必要 |
|---|---|---|
| **ページ `<h1>`「近くの神社」**(20px, `text-stone-900`) | **1.15:1** | 4.5 |
| **検索入力の入力文字**(14px, `text-stone-900`) | **1.78:1** | 4.5 |
| 説明文「今いる場所から、静かにたどれます。」(12px, `text-stone-500`) | 4.19:1 | 4.5 |

**severity 判断**: ページタイトルが読めず（1.15:1 — PSQ-009 の元の値と同水準）、かつ**ユーザーが入力した文字が読めない**（PSQ-002 が P1 とされた欠陥と同一クラス）。

**位置づけ**: `/map/page.tsx` 自身のヘッダは PSQ-009 のスコープ外として PR #2709 に明記済み。`PlaceSuggestBox` は #2704 の調査対象外だった。共有 `ExploreLayout` 部分は **PASS** しており、PSQ-009 の修正自体に regression はない。

---

### NF-3（P2）`/map` の近隣カード一覧が light 固定

`NearbyShrineCardListClient.tsx` が `bg-white/70` / `bg-white/80` / `bg-stone-50` / `text-stone-900` / `text-stone-500` / `text-slate-400` 等を使用し、Dark UI 上で意図しない明色カードになる。

実測: 住所 **2.32:1**、セクションラベル「近くの神社」 **4.19:1**。神社名・ボタンは暗色 on 明色で判読可能。

journey は成立するため **P2**。

---

### NF-4（P3）「一覧 / 地図」トグルが表示を変えない

`/map` の描画分岐は `selected ? "search" : "nearby"` で、`ViewModeTabs` が操作する `viewMode` state は描画に影響しない。`/shrines` も `viewMode` を `ExploreLayout` へ渡すのみ。
トグルは視覚的に切り替わるが表示内容は不変。既存挙動であり本 P1 群とは無関係。**P3**。

---

## 13. Severity Table

| Severity | 件数 | ID |
|---|---|---|
| **P0** | **0** | — |
| **P1** | **2** | NF-1（`/mypage/history/[tid]`）、NF-2（`/map` 見出し・入力） |
| P2 | 6 | PSQ-004、D-1 accent、PSQ-005、NF-3、（既知）Shrine Detail secondary CTA、Concierge 補助条件パネル |
| P3 | 3 | missing `.dark` overrides（11件）、dead Hero `trustLabels` branch、NF-4 |

---

## 14. Blind Spots（明示）

1. **production 実レンダリングは未検証。** 本セッションの egress policy により production / preview へ直接 HTTP 接続できないため、計測はすべて **local production build**（同一 SHA・同一 CSS bundle）上のもの。#2702 以来の制約を引き継いでいる。
2. **Backend は local stub。** recommendation payload は repo の wire contract に沿って構成した合成データであり、production の実 ranking 出力そのものは検証していない。Evidence Boundary / Compass Ranking Truth の判定は **表示契約レベル**である。
3. **Compass の新規変更（#2715 / #2716）の網羅的再監査は行っていない。** 本監査は Compass Ranking Truth の再確認に限定した。eligibility zero semantics の挙動網羅は対象外。
4. `/mypage/history/[tid]` の「final message state」は stub が返す 2 メッセージで確認したもので、production の実履歴データ形状は未検証。
5. `/map` の位置情報は Playwright の固定座標を付与しており、実端末の geolocation 失敗系 UI は未検証。
6. NF-1 / NF-2 の severity は本タスクの定義（「text / CTA が実質判読不能」）に照らした判断である。両者とも journey の**完走自体は可能**であり、「読めない」ことによる実質的な利用困難を P1 と解釈している。この解釈が Mother Ship の意図と異なる場合、判定は READY_WITH_KNOWN_P2 に変わりうる。

---

## 15. Release Readiness

# BLOCKED

**理由**: 新規 P1 が 2件（NF-1 / NF-2）。いずれも通常 journey 上で到達する production route において、主要見出し（1.15–1.33:1）・主要 CTA（1.08:1）・ユーザー入力文字（1.78:1）が判読不能。

**重要な区別**: これらは **merge 済み 4件の P1 修正の regression ではない**。PSQ-001 / 002 / 003 / 009 は 4 viewport すべてで PASS しており、統合後の再発は 0件。build / tests / typecheck / lint / contract / OpenAPI もすべて green。Evidence contract と Compass Ranking Truth にも regression はない。

2件の P1 は、Mother Ship の D-2 `SCREEN_READABLE_SCOPE` 決定によって**意図的に修正範囲外とされた隣接サーフェス**であり、#2702 当時は環境制約で未計測だったため severity が付いていなかったものである。今回初めて実測可能になり、P1 相当と判明した。

本監査では修正を行わず、Mother Ship へ差し戻す。

---

## 16. Scope Guard

| 項目 | 結果 |
|---|---|
| Production code changed | **NO** |
| Test code changed | **NO** |
| Design token changed | **NO** |
| Backend / API / DB changed | **NO** |
| Mobile changed | **NO** |
| Ranking / recommendation logic changed | **NO** |
| Audit-only maintained | **YES**（diff は本文書 1 ファイルのみ） |
