# Final Production Smoke Re-check / Release Readiness 最終判定

## 1. Executive Summary

| 項目 | 値 |
|---|---|
| Base SHA | `a7aa257f491a2e92a91c06ec4d224115132d9623` |
| Build ID | `cHBEl4TiKKRtSw6e4j5De` |
| Verification Level | `VERIFIED_LOCAL_PRODUCTION_BUILD`（production実機はegress遮断のため `NOT_VERIFIED`） |
| P0 | **0** |
| 新規 P1 | **2** |
| 新規 P2 | 2 |
| 既知 P2 / P3 | 変化なし（escalationゼロ） |
| NF-1 regression | **PASS** |
| NF-2 regression | **PASS** |
| **Final Release Readiness** | **`BLOCKED`** |

新規P1 2件はいずれも **NF-1 / NF-2 remediation の regression ではなく**、
#2723 / #2725 / #2726 のいずれの変更ファイルにも含まれない既存コードである。
今回のハーネス修正（scroll二重補正バグの除去 + 全ページ走査）により、
従来のviewport限定sweepでは構造的に到達できなかった fold下 の要素が初めて測定対象になった結果として顕在化した。

---

## 2. Merge Preconditions

| 項目 | 検証方法 | 結果 |
|---|---|---|
| PR #2723 | ancestry（`5506576` は `origin/develop` の祖先）／develop history／`ConsultationHistoryDetailView.tsx` に `--kt-color-*` 28箇所・light residue 0 | **MERGED** |
| PR #2725 | squash merge `a9cb234` を develop history で確認／`app/map/page.tsx` heading が `text-[var(--kt-color-text-primary)]`／`PlaceSuggestBox` input が token 構成／追加testの存在 | **MERGED** |
| NF-3 / NF-4 未変更 | `NearbyShrineCardListClient.tsx` に light class 13行が残存／`MapPageClient.tsx` の `const mode = selected ? "search" : "nearby"` が不変 | **意図どおり未変更** |
| latest develop | `a7aa257`（#2726「神社一覧に14日間の新着バッジを追加」を含む） | 同期済 |
| working tree | audit branch 作成前後とも clean（untracked 0件） | clean |

API state のみに依存せず、いずれも **コード実体**で二重以上に確認した。

---

## 3. Environment

| 項目 | 内容 |
|---|---|
| actual production | **NOT_VERIFIED**（egress policy が `*.vercel.app` を遮断） |
| production preview | NOT_VERIFIED |
| local production build | `pnpm build` EXIT=0 / `next start` / Build ID `cHBEl4TiKKRtSw6e4j5De` |
| backend | ローカル stub（production shapeのペイロードを返す） |
| auth | `access_token` cookie による擬似ログイン。実 IdP フローは NOT_VERIFIED |
| browser | Chromium（`/opt/pw-browsers/chromium`）+ Playwright |
| viewport | 375 / 390 / 430 / 1280 |
| 制約 | `/api/shrine-interactions/`・`/api/visits/` は stub 未実装のため 404（production defect ではない） |

---

## 4. Harness Integrity

前回 NF-2 作業中に、contrast harness が `boundingBox()`（viewport相対）から
`window.scrollY` を二重減算していた計測バグを発見・修正済み。今回は修正後方式のみを使用した。

| 検査 | 結果 |
|---|---|
| coordinate method | `boundingBox().y === getBoundingClientRect().top` を実測で確認し、scroll補正を行わない方式に統一 |
| scroll handling | `scrollIntoView({block:"center"})` 後、viewport相対座標のまま sampling |
| background sampling | 対象要素に隣接する 6×6 パッチの最頻色。border画素の誤検出を避けるため、境界検証時は内側 inset で再測定 |
| color conversion | computed `color` の `rgb()` / `lab()` / `oklab()` を sRGB へ変換 |
| sanity check | `/map` の全対象要素で「painted背景 == 最近接不透明ancestorのCSS背景」を検査 → **OK=7 / NG=0**（scrollY>0 の要素を含む） |
| known reference | `text-primary` on `background-subtle` = **16.26:1**（既知値と一致） |
| 旧誤測定値 | 正本として再利用していない。Before/After はすべて修正後ハーネスで再取得 |

**重要**：修正前ハーネスは fold下 の要素で誤った背景（viewport上端）をサンプルしていた。
加えて従来の sweep は viewport内要素のみを対象にしていたため、fold下の要素は
そもそも測定対象外だった。今回の新規P1 2件は、この 2 点の解消により初めて可視化されたものである。

---

## 5. Route Matrix

| Route | 375 | 390 | 430 | 1280 | Runtime | Result |
|---|---|---|---|---|---|---|
| `/` | PASS | PASS | PASS | PASS | err 0 | PASS |
| `/concierge`（入力） | LOW3 | LOW3 | LOW3 | LOW3 | err 0 | **新規P1 1 / 新規P2 1 / 既知1** |
| `/concierge` 提案結果 | — | LOW3 | — | LOW3 | err 0 | 既知のみ（D-1 / PSQ-004） |
| `/concierge/full` | LOW3 | LOW3 | LOW3 | LOW3 | err 0 | `/concierge` と同一要因 |
| `/shrines` | PASS | PASS | PASS | PASS | err 0 | PASS（#2726 新着バッジ含む） |
| `/shrines/49` | LOW4 | LOW4 | LOW4 | LOW4 | 404×2（stub起因） | **新規P1 1 / 新規P2 1 / 既知2** |
| `/map` | LOW4 | LOW4 | LOW4 | LOW4 | err 0 | 既知のみ（NF-3面） |
| `/mypage` | LOW1 | LOW1 | LOW1 | LOW1 | err 0 | 計測アーティファクト（checkbox の value "on"） |
| `/mypage/history` | PASS | PASS | PASS | PASS | err 0 | PASS |
| `/mypage/history/9001` | **PASS** | **PASS** | **PASS** | **PASS** | err 0 | **NF-1 PASS** |
| `/favorites` | PASS | PASS | PASS | PASS | err 0 | PASS |
| `/compass`（入力） | LOW1 | LOW1 | LOW1 | LOW1 | err 0 | 既知（PSQ-004） |
| `/compass`（結果） | — | — | — | — | — | **NOT_VERIFIED**（stubで結果状態へ到達不可） |

横スクロール・clipping・`undefined`/`null`/内部キー露出は全route・全viewportで検出ゼロ。

---

## 6. NF-1 Re-check

| 項目 | 内容 |
|---|---|
| route | `/mypage/history/[tid]` |
| low contrast 件数 | **0件**（375 / 390 / 430 / 1280 すべて） |
| 主要contrast | title 17.78:1 / CTA 7.48:1相当 / ご利益 6.74:1 / 住所 9.36:1 / 参考情報 9.36:1 / 神社名 16.26:1 / 会話本文 15.66:1 |
| Hero側の歴史的P1 | Concierge 提案結果 Hero を実描画で確認。結論文 **16.26:1** / 参考情報 **9.03:1** / 次の一歩 **6.74:1**。「light card + dark token text」の再発なし |
| **regression** | **PASS** |
| verification | `VERIFIED_LOCAL_PRODUCTION_BUILD` |

---

## 7. NF-2 Re-check

| 項目 | 内容 |
|---|---|
| route | `/map` |
| low contrast 件数 | 4件（**すべて NF-3 面 = `NearbyShrineCardListClient.tsx`、今回未変更**） |
| heading contrast | **17.78:1**（修正前 1.15:1） |
| typed input contrast | **16.26:1**（修正前 1.78:1） |
| placeholder | 9.03:1 / input border `#384154` on `#101827` 判別可 / focus は `border-focus`(emerald-400) に変化 |
| 候補リスト・選択後カード | 神社名 16.26:1 / 住所 9.36:1 |
| **regression** | **PASS** |
| verification | `VERIFIED_LOCAL_PRODUCTION_BUILD` |

---

## 8. Evidence Boundary

| 面 | internal key leak | raw need slug | 分離 | 判定 |
|---|---|---|---|---|
| Concierge 提案結果 | なし | なし | Ranking Reason 枠＝「今回の相談内容に照らして…」／Explanation-only 枠＝「参考情報: 応神天皇」 | PASS |
| `/shrines/49` | なし | なし | — | PASS |
| `/mypage/history/[tid]` | なし | なし | `data-testid="consultation-history-explanation-only-fact"` に deity を分離 | PASS |
| `/shrines` | なし | なし | — | PASS |
| `/compass`（入力） | なし | なし | — | PASS |

- Explanation-only Fact（`deity` / `shrine_history`）の Ranking Reason への昇格：**なし**
- `recommendation_reason_v4` / `matched_need_tags` / `reason_facts` / raw `history_theme` / need slug の UI 露出：**なし**
- 5レイヤ（Stored Fact / Derived Meaning / Runtime Match / Ranking Reason / Filter Context）の混同：**なし**

---

## 9. Compass Ranking Truth

コード実体と描画の両方で確認した。

| 項目 | 結果 |
|---|---|
| direction eligibility | 九星気学 / 年盤 / 月盤 は `CompassClient.tsx` で **方位の成立条件**としてのみ文言化（「年盤と月盤の両方で重なる、今月の参考方位です」）。日盤は不使用と明示 |
| score contribution | `CompassClient.tsx` に `score` / `ranking` / `rank` の語が **1件も存在しない**。スコア寄与としての表示なし |
| astrology | 西洋占星術に類する表示：**なし** |
| history_theme | `resolveCompassSupplementaryFactText.ts` が Derived Meaning として `「〜という文脈（KAMI MUSUBIの解釈）」` を返す。公式Factとして描画しない |
| Filter Context | purpose 未一致時は「今回の方向・距離の条件に合う候補です」を返し、purpose一致を捏造しない |
| rendered output | `/compass` 入力状態のみ確認。**結果状態は stub で到達不可＝ NOT_VERIFIED** |
| 判定 | コード契約レベル **PASS**／描画は入力状態のみ検証 |

---

## 10. Console / Network

| 項目 | 結果 |
|---|---|
| console.error | `/shrines/49` で 2件のみ、他 route は 0件 |
| pageerror | 0件 |
| unhandled rejection | 0件 |
| hydration error | 0件 |
| Next runtime overlay | 0件 |
| 5xx | 0件 |
| unexpected 404 | `/api/shrine-interactions/`・`/api/visits/`（**ローカル stub 未実装が原因。production defect ではない**） |
| その他 API failure | なし |

---

## 11. Known P2 / P3

| ID | 内容 | 前回 | 今回 | 変化 |
|---|---|---|---|---|
| NF-3 | `/map` 近隣カード（住所 **2.32:1** ほか） | P2 | P2 | **不変**（#2721 記録値と完全一致） |
| NF-4 | `/map` 一覧・地図トグルが render mode を切り替えない | P3 | P3 | **不変**（`const mode = selected ? …` そのまま） |
| PSQ-004 | `action-primary` × `action-primary-text` = **2.47:1**（hover **2.08:1**） | P2 | P2 | **不変**（D-4 RECORD_ONLY） |
| D-1 KEEP_CURRENT | Hero accent ラベル `text-emerald-700` **3.43:1** / `text-teal-700` **3.42:1** | 決定済 | 同値 | **不変** |
| missing dark override | `--kt-color-*` 11件に `.dark` 未定義 | P2 | P2 | **不変** |
| map library 不在 | `/map` に地図実装なし（`@types/geojson` は型のみ） | 既知 | 同じ | **不変・悪化なし** |

既知P2/P3の escalation：**ゼロ**。

---

## 12. New Findings

| ID | Severity | Route | Owner | 実測 | Evidence | Blocking |
|---|---|---|---|---|---|---|
| **NEW-1** | **P1** | `/shrines/[id]` | `ShrineDetailArticle.tsx:945` | **2.34:1** | `border-emerald-200` + `text-emerald-800`(`#006045`) を `--kt-color-surface-default`(`#101827`) 上に配置。border画素を除外した内側sampling で glyph 画素 `#006045` を 87px 確認。**暗緑 on 準黒**で輝度・色相ともに分離が乏しい | **YES** |
| **NEW-2** | **P1** | `/concierge`, `/concierge/full` | `ConciergeEntryCard.tsx:204` | **2.44:1** | 「新規登録」ボタンの `text-slate-600`(`#45556c`) を `--kt-color-background-subtle`(`#0b1424`) 上に配置。glyph画素は描画ヒストグラム上位に現れないほど背景と同化。実描画クロップでも判読困難 | **YES** |
| NEW-3 | P2 | `/concierge`, `/concierge/full` | `ConciergeClientFull.tsx:1765-1766` | **1.81:1** | 任意セクションのラベル・説明文。`text-stone-500` を light residue カード `bg-stone-50/60`(`#9c9fa4`) 上に配置 | NO |
| NEW-4 | P2 | `/shrines/[id]` | `ShrineDetailArticle.tsx:866` | **3.31:1** | 「保存した神社を見る」`text-emerald-700`(`#007a55`) on `#101827`。副次的な導線で、同一遷移先は MyPage / お気に入りからも到達可能 | NO |

### Severity 判断の根拠

- **NEW-1 / NEW-2 を P1 とした理由**：いずれも core route 上の **major CTA** で、いずれも
  「暗色 on 準黒」であり輝度差・色相差の双方が不足している。Release Gate の
  「major text / CTA が実質判読不能」に該当する。クリック可能であることを理由に降格していない。
- **PSQ-004（2.47:1）との差**：PSQ-004 は `#ffffff` on `#00bc7d`（白 on 彩度の高い緑）で、
  輝度比は低いが色相差が大きく、実描画では判読できている。Mother Ship は
  これを systemic な token pair 課題として P2 に決定済み。NEW-1 / NEW-2 は
  色相差による救済がない別事象であり、数値の近さだけで同一視していない。
  この区別は数値ではなく**実描画クロップの目視証拠**に基づく。
- **NEW-3 を P2 とした理由**：`（任意）` と明示された補助セクションのラベル・説明文であり、
  相談入力 → 送信 → 提案取得という主ジャーニーを阻害しない。ページtitle・major CTA・
  typed input・primary result text のいずれにも該当しない。
  併設の「条件を開く」ボタンは 8.69:1 で可読。
- **NEW-4 を P2 とした理由**：副次導線であり、同一遷移先が他routeから到達可能。

### 反証（Mother Ship 判断が必要な境界）

- NEW-3 の 1.81:1 は本監査の最低値である。「セクション見出しも title に含める」と
  定義し直せば **P1 へ昇格**しうる。その場合も Release Readiness は BLOCKED のままで結論は変わらない。
- 逆に NEW-1 / NEW-2 を「PSQ-004 と同種の accent/secondary CTA」とみなして P2 に統合する解釈も
  ありうる。その場合 **新規P1 = 0 となり Release Readiness は READY へ移行可能**。
  ただし本監査はその統合を採用していない（上記の色相差の実証による）。
  この境界判断は Mother Ship の裁量領域であり、Codex 側では確定させていない。

---

## 13. Blind Spots

1. **production 実機の描画は未検証**。egress policy が `*.vercel.app` を遮断しており、
   本監査はすべてローカル production build。ビルド成果物が同一である以上一致するはずだが、
   これは**推測**であり実測ではない。
2. **backend はローカル stub**。Evidence Boundary / Compass Ranking Truth の判定は
   「presentation contract がデータ形状に対して正しく分岐するか」までしか保証していない。
   production データ内容に依存する違反可能性は未検証。
3. **auth は cookie による擬似ログイン**。実 IdP フロー・トークン失効・権限境界は NOT_VERIFIED。
4. **Compass 結果状態は未到達**（NOT_VERIFIED）。方位計算に必要な生年月日・出発地点の
   往復を stub が完全には backing していない。コード契約レベルのみ PASS。
5. **`/shrines/49` の 404 2件**は stub 未実装 endpoint 起因。production の同 endpoint の
   健全性は NOT_VERIFIED。
6. **device / browser**：Chromium のみ。Safari / iOS WebKit・実機タップ精度は未検証。
7. `/mypage` の LOW1（`#00bc7d` on `#ffffff` 2.46:1、テキスト "on"）は
   checkbox の `value` を拾った**計測アーティファクト**で、可視テキストではない。

---

## 14. Final Release Readiness

**`BLOCKED`**

### 根拠

| Gate 条件 | 結果 |
|---|---|
| new P0 = 0 | ✅ 0 |
| **new P1 = 0** | ❌ **2件**（NEW-1 / NEW-2） |
| NF-1 regression = 0 | ✅ PASS |
| NF-2 regression = 0 | ✅ PASS |
| Evidence Boundary | ✅ PASS |
| Compass Ranking Truth | ✅ PASS（描画は入力状態まで） |
| major runtime regression | ✅ なし |

既知 P2 / P3 のみを理由にした BLOCKED ではない。**新規P1 2件**が唯一の阻害要因である。

### 補足

- NF-1 / NF-2 remediation は完全に成功しており、**両者とも regression ゼロ**。
- 新規P1 2件は #2723 / #2725 / #2726 のいずれの変更ファイルにも含まれない既存コードであり、
  最終更新は `a6543ec`(2026-08-30, #2649) 以前。**今回の merge が引き起こした劣化ではない。**
- 本監査ではこれらを修正していない（AUDIT_ONLY）。severity も引き下げていない。
