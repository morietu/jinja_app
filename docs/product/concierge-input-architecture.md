> **Status: Active（Architecture Decision）**
>
> 本ドキュメントは、[PR #2397 Concierge Input Level / Learning Signals現状監査](../audit/concierge-input-level-signal-inventory.md)
> の結果を根拠として、KAMI MUSUBIのConcierge入力をLevel 1（相談）/
> Level 2（今回の参拝Preference）/ Level 3（個人Profile・強条件）/
> Learning Signals（行動学習）という4責務へ正式に整理する
> Architecture Decisionである。**設計・責務定義のみを扱い、実装は
> 一切行わない。** Frontend UI・Backendロジック・Candidate filtering・
> Ranking weight・Recommendation Reason・API field・Model・Migration・
> Analytics Event・既存Signalの削除やrename・preset chip削除・Signal
> parser・Score v3切替は、いずれも変更していない。
>
> 現行実装と本書のProposed定義が一致しない箇所は、Current / Proposed /
> Gapを分離して記載する。監査で確認済みの現行実装のみを根拠とし、
> 推測でSignalの責務を変更していない。

---

## 1. Purpose

Concierge入力（相談・今回のPreference・個人Profile/強条件・行動学習）を、
Product/Recommendation上の責務として正式に定義し、後続実装PRの判断
基準となるArchitecture Decisionを作成する。根拠は
[docs/audit/concierge-input-level-signal-inventory.md](../audit/concierge-input-level-signal-inventory.md)
（PR #2397）で確認済みの現行実装のみとする。

---

## 2. Scope

**対象**: Concierge chat（`/api/concierge/chat/`）の入力責務分類
（Level 1〜3、Learning Signals）、Signal属性モデル、Level間の優先順位、
現行Signalの Keep/Redesign/Hold/Remove分類、Current→Proposed Gap。

**対象外**:
- Recommendation Scoreの重み付けロジック本体・Ranking計算式の変更
  （`docs/core/recommendation-architecture.md`等の管轄）
- Shrine側プロフィール（神社が何者か）の7層構造
  （`docs/knowledge/shrine-profile-spec.md`の管轄）
- Knowledge Coverage / Governance（`docs/core/recommendation-readiness.md`
  の管轄）
- API契約の物理的な破壊禁止項目・birthdate正規化の詳細規則
  （`docs/core/concierge-spec.md`の管轄、本書はこれを上書きしない）
- theme_keyタクソノミー本体（`docs/product/consultation-theme-taxonomy.md`
  の管轄）
- Filter画面のUI構成・表示文言（`docs/product/concierge-filter-area.md`
  の管轄）

---

## 3. Core Principles

1. Level 1（相談）はRecommendationの意味的主軸である。
2. Level 2 / Level 3はLevel 1を補助し、原則としてLevel 1の意味を
   上書きしない。
3. Personal Profile（3-A）とExplicit Constraint（3-B）とContext（3-C）
   は同一概念として扱わない — 名前や画面配置が同じ「Level 3」でも、
   内部Contractは分離する。
4. Learning Signalsはユーザーへ毎回入力を求めない継続的な学習情報
   であり、L1〜L3とは別責務とする。
5. Raw User InputとDerived Signalは常に分離する — `need_tags`や
   `consultation_axis`をユーザー入力そのものとして扱わない。
6. 分類は実装上の責務を根拠とする。UI上の見た目や名前からの類推で
   Signalの責務を判断しない（[PR #2397](../audit/concierge-input-level-signal-inventory.md)
   と同じ原則）。

---

## 4. Level 1 — Consultation

### 定義

ユーザーが今回何を求めているかを表し、Recommendationの意味を成立
させる主入力。Level 1は「推薦を始めるために最低限必要なユーザー
入力」を管理する。

### Raw Input と Derived Signal

```text
Raw User Input
  query（message はqueryへ統合される別名）
    ↓
Derived Interpretation
  need_tags
  consultation_axis
  interpretation_profile（自己申告shadow、reason生成へのみ実効）
  intent（現状dead、下流消費者なし）
```

`need_tags`・`consultation_axis`・`interpretation_profile`・`intent`
は、いずれも**ユーザー入力そのものではない**。ユーザーが直接値を
入力・選択する対象ではなく、`query`から都度計算される派生値である。

### Current（[PR #2397](../audit/concierge-input-level-signal-inventory.md) §5 根拠）

| Signal | Raw/Derived | Candidate影響 | Ranking影響 | Reason影響 |
|---|---|---|---|---|
| `query`/`message` | Raw | LLM有効時: 直接／LLM無効時: need_tags経由 | 間接 | 間接 |
| `need_tags` | Derived | ✅（deterministic pathのみ） | ✅（常時、`score_need`） | ✅ |
| `consultation_axis` | Derived | ✅（deterministic pathのみ） | **✅（本番実効、shadowではない）** | ✅ |
| `intent`/`extract_intent` | Derived | ❌ | ❌ | ❌（下流消費者ゼロ） |
| `interpretation_profile` | Derived | △（表示のみ） | ❌（自己申告shadow） | ✅（reason_v4経由） |

### 定義事項（Proposed）

- **Level 1の最小入力**: `query`（`message`はqueryへ統合される別名として
  扱う。物理フィールド名の統一自体は本書では実施しない — `docs/core/
  concierge-spec.md`のAPI契約変更が必要なため、後続PR判断とする）。
- **queryとmessageの正本関係**: `query`を正本とする。`message`は互換
  目的で受理し続けるが、新規実装は`query`のみを参照する（Proposed、
  API契約自体は本書では変更しない）。
- **Derived Signalの責務**: `need_tags`/`consultation_axis`は「相談の
  構造化要約」として扱い、Raw Inputと明示的に区別する。UI/API上で
  ユーザー入力欄のように見せない。
- **consultation_axisのRanking影響**: 本番rankingへ実効する
  （`HISTORY_THEME_CANDIDATE_BOOST_BY_AXIS`経由、shadowではない）。
  この事実は今後の設計判断・監査で「shadowだから無視してよい」と
  誤解しないよう明記する。
- **Level 1が空の場合の扱い（Current）**: frontendがfilters存在時に
  合成placeholder文を生成、backendはbirthdate-only compat modeへ
  フォールバックする。この挙動を変更するかはProduct判断
  （§15 Open Questionsへ）。
- **Level 2 / 3による上書き禁止条件**: L2（`extra_condition`）・L3
  （`birthdate`/`goriyaku_tag_ids`/Context）は、`query`/`need_tags`/
  `consultation_axis`の値そのものを書き換えない。現行実装でこの
  原則への明示的な違反は確認されていないが、`need_tags`/
  `consultation_axis`が`resolve_need_payload`/`resolve_consultation_axis`
  （本流）と`interpret_consultation`内部（shadow用）の2つの独立
  パスで別々に計算されている点はdrift riskとしてGap（§12）へ記録する。

---

## 5. Level 2 — Visit Preference

### 定義

相談内容を主軸として維持しながら、今回の参拝で望む体験・環境・
行きやすさを調整する任意入力。

### 性質

Level 2は原則としてSession単位のPreferenceとする。永続的な人格・
属性・プロフィールとして扱わない（現行実装でも`extraCondition`は
`user.profile`へ永続化されない — Current通り）。

### Current（[PR #2397](../audit/concierge-input-level-signal-inventory.md) §6 根拠）

`extra_condition`責務のCurrent構造:

```text
UI preset chip（12件） または 自由記述
  ↓
日本語文（extraCondition文字列）
  ↓
keyword parser（extract_extra_tags）
  ↓
最大3タグ（sort_override / hard_filter(常に空) / soft_signal / visit_style）
```

Preset chip 12件の実効性:

| 分類 | 該当chip | Current効果 |
|---|---|---|
| Signal成立 | quiet, calm, reset, nature, sort_distance, classic, less_crowded | ✅ score/highlightに反映 |
| 部分成立 | energize（highlightなし）、nearby（該当shrine 0件） | 一部無効 |
| **不成立（キーワード一致ゼロ）** | 歴史や文化に触れたい、アクセスしやすい場所がいい、由緒を知りたい、御朱印を楽しみたい、神話に触れたい | **完全に無効** |

`soft_signal`分類9タグ中8タグ（`calm`以外）はhighlightにもscoreにも
影響しない（仕様として明示、`test_concierge_soft_signal_affects_
highlights_not_score`）。`hard_filter`分類は定義上空集合で、一度も
実タグに割り当てられたことがない。

### Keep / Redesign / Hold / Remove 分類（§7の原則を適用）

| Signal | 分類 | 理由 |
|---|---|---|
| quiet/calm/reset/nature/sort_distance/classic/less_crowded | **Keep** | Current実装で責務が成立している |
| energize（highlight未定義）、nearby（データ生成ギャップ） | **Redesign** | Signal意図は妥当だが実装が不完全 |
| 歴史や文化に触れたい | **Redesign** | Product価値はあり得るが現行parserが理解できない |
| アクセスしやすい場所がいい | **Redesign** | 同上 |
| 由緒を知りたい | **Redesign** | 同上 |
| 御朱印を楽しみたい | **Redesign** | 同上 |
| 神話に触れたい | **Redesign** | 同上 |
| `duration_max_min` | **Hold** | frontendが計算するがbackend消費経路が未確認。MVP段階では正式Signal化しない |
| `hard_filter_tags`カテゴリ | **Remove Candidate** | 定義上到達不能な空カテゴリ。ただし削除は本書では実施しない |

いずれも本書内では**削除を決定しない**（指示通り）。次PR判断へ
委譲する（§14）。

### 定義事項（Proposed）

- **Level 2に属するPreferenceの基準**: 「今回の参拝」に限定した
  体験・環境調整であり、次回セッションへ引き継がない。
- **Session-only**: すべてのL2 Signalはsession-onlyとする。永続化
  しない（Current通り、変更なし）。
- **Preference数の扱い**: 現行実装の「最大3タグ」制限をCurrentとして
  記録する。制限を見直すかはHold。
- **優先順位**: 複数タグ抽出時の優先順位は現行`extract_extra_tags`の
  hit count順をCurrentとする。
- **sort overrideとscore bonusの違い**: `sort_override`（例:
  `sort_distance`）は候補の並び順自体を変更する。`score bonus`
  （`soft_signal`/`visit_style`）はスコアへの加点のみで並び順の
  決定打にはならない。この区別を今後もLevel 2の内部Contractとして
  維持する。
- **Presentation-only Signalの扱い**: highlightのみでscoreに影響
  しないSignal（現状`calm`のみ実効）は、Presentation-only Signalとして
  明示的に区別し、「効果があるように見えて実は表示のみ」という状態を
  今後は設計時点で意識する。
- **UIが存在するがBackendが理解できない項目の扱い**: 該当5 preset
  chipは**Redesign Candidate**として扱う。削除もしないし、黙認も
  しない — 次PR（PR3、§14）でSignal Contractそのものを再設計する
  候補とする。

---

## 6. Level 3 — Profile / Constraints

### 定義

ユーザー固有の継続情報、またはRecommendation候補集合・順位へ強く
影響する明示的条件を管理する。**「Profile」と「Constraint」を同一
概念として扱わない**。UI上はLevel 3としてまとめて表示してよいが、
内部Contractは3-A/3-B/3-Cへ分離する。

### 3-A Personal Profile

継続利用できるユーザー固有情報。

| 属性 | 値 |
|---|---|
| Persistence | Persistent |
| Scope | User |
| Effect | Personalization |

**Current該当Signal**: `birthdate`（element/astrology/direction
Personalization Signalとして利用される）。`profile_context.
user_profile`（`birth_place`/`birth_time`、backendで永続化される）。

> `worshipStyle`（`UserProfile.worship_style`）はRecommendation Signal
> としてもProfile schemaとしても退役済み。Recommendation側の除外は
> PR #2751、永続化Profile / API contractからの削除は本節の改訂と同じPRで
> 完了しており、`GET/PATCH /api/users/me/`のresponseにも含まれない。

### 3-B Explicit Constraint

今回のRecommendationを明示的に制約する条件。

| 属性 | 値 |
|---|---|
| Persistence | Session |
| Scope | Recommendation |
| Effect | Candidate Constraint |

**Current該当Signal**: `goriyaku_tag_ids`（[PR #2397](../audit/concierge-input-level-signal-inventory.md)
§7で確認済み — DB-level hard candidate filter、`Personal Profileへ
分類しない`）。将来の`radius`指定・特定カテゴリー指定も本カテゴリの
候補（現状`radius`はConcierge Chatパイプライン内で実質無効 —
Current状態としてGap§12へ記録）。

### 3-C Context

ユーザー固有情報ではないが、今回のRecommendationに必要な現実条件。

| 属性 | 値 |
|---|---|
| Persistence | Request（毎回送信） |
| Scope | Recommendation |
| Effect | Ranking Bonus（soft） |

**Current該当Signal**: `lat`/`lng`/`origin`（[PR #2397](../audit/concierge-input-level-signal-inventory.md)
§7で確認済み — Concierge Chatパイプライン内ではContext + soft
Ranking Bonusのみ、hard filterではない）、`visit_date`/
`planned_visit_date`（direction計算の分岐条件）。

### Current（監査結果の反映）

**`goriyaku_tag_ids`**: 現行実装ではProfileではなく、**DB-level
Candidate Hard Filter**として機能する（`concierge_chat_candidates.py`
の`qs.filter(goriyaku_tags__id__in=...)`）。したがってPersonal Profile
（3-A）へ分類せず、3-B Explicit Constraintへ分類する。

**`birthdate`**: 現行実装ではelement/astrology/directionの
Personalization Signalとして利用される。hard filterには一切使われ
ない。3-A Personal Profileへ分類する。

**`location`（lat/lng/radius）**: Concierge Chatと`/nearest`
endpointで責務が異なる。同じfield名でもEndpoint別にCurrent
behaviorを記録する。

| Endpoint | Current behavior |
|---|---|
| Concierge Chat（本書の対象） | Context + soft Ranking Bonus（distance decay + direction bearing）。`radius`は候補を絞り込まない |
| `/nearest`（別endpoint、対象外） | 真のhard filter（`d_m &lt;= radius_m`） |

本書は**Concierge Chatの`location`を3-C Context**として分類する。
`/nearest` endpointの挙動は本書の対象外（別の設計判断が必要な場合は
別文書とする）。

### 定義事項（Proposed）

- **Personal Profileの保存期間**: Persistent（`UserProfile`モデルに
  永続化、次回セッション以降も引き継ぐ）。
- **Explicit ConstraintのSession性**: Session限定。次回セッションへ
  引き継がない（Current: `goriyaku_tag_ids`は`user.profile`へ保存
  されない）。
- **Contextとの境界**: Contextは「ユーザーが選んだ制約」ではなく
  「今回のRecommendationに必要な現実世界の状態」（現在地、参拝予定日
  等）。Constraintのように候補を絞り込むことはなく、Personalization
  同様にsoft bonusとして扱う。
- **Candidate FilterとRanking Bonusの境界**: Candidate Filter
  （3-B）は候補集合そのものを変更する。Ranking Bonus（3-A/3-C）は
  既に選ばれた候補の順位のみを調整する。この境界は現行実装
  （`goriyaku_tag_ids`のみが真のCandidate Filter）と一致する。
- **強条件がLevel 1を上書き可能か**: 3-B Explicit Constraintは
  Candidate集合を変更できる（Rule 3、§9）が、`query`/`need_tags`/
  `consultation_axis`の**値そのもの**は上書きしない — 候補を絞り込む
  だけで、相談の意味解釈には介入しない。
- **ご利益指定のProduct上の位置づけ**: 検索facet（3-B Explicit
  Constraint）として扱う。「あなたについての情報」ではなく「今回の
  検索条件」として、将来UI文言・データモデルを見直す際の判断材料
  とする（実装は本書では行わない）。

---

## 7. Learning Signals

### 定義

ユーザーへ毎回入力を求めず、利用行動・参拝・振り返りから継続的に
獲得するSignal。L1/L2/L3とは別責務とする。

### Lifecycle

```text
Behavior Event
  （閲覧・地図・お気に入り・参拝・振り返り・アクション完了）
    ↓
Persistent Event / State
  （ShrineInteractionLog / Favorite / Visit / ShrineReflection / ActionEvent）
    ↓
Aggregated Learning Signal
  （calculate_shrine_behavior_signal_breakdown）
    ↓
Recommendation Feedback
  （score_total_ranked への capped 加算）
```

### Current（[PR #2397](../audit/concierge-input-level-signal-inventory.md) §8 根拠）

| Signal | 保存 | User紐付け | Shrine紐付け | Session限定 | Ranking戻し | Analyticsのみ | Profile更新 |
|---|---|---|---|---|---|---|---|
| Detail view | ✅ | ✅ | ✅ | ❌ | **✅** | ❌ | ❌ |
| Route open | ✅ | ✅ | ✅ | ❌ | **✅** | ❌ | ❌ |
| Favorite/save | ✅ | ✅ | ✅ | ❌ | **✅** | ❌ | ❌ |
| Visit（参拝した） | ✅ | ✅ | ✅ | ❌ | **✅** | ❌ | ❌ |
| Reflection（振り返り） | ✅ | ✅ | ✅ | ❌ | **✅** | ❌ | ❌ |
| Action completed | ✅ | ✅ | ✅（nullable） | ❌ | **✅** | ❌ | ❌ |
| Action started | ✅ | ✅ | ✅ | ❌ | ❌（永続化のみ） | ❌ | ❌ |
| `action_state`分類 | ❌（都度計算） | ✅ | ✅ | — | **❌（表示専用）** | ❌ | ❌ |
| Recent reflection hint | ❌（都度計算） | ✅ | ✅ | — | **❌（表示専用）** | ❌ | ❌ |
| Shrine card click | schema有のみ | — | — | — | ❌ | 実質✅（PostHog） | ❌ |
| Impression/click等 | ❌（PostHog側） | PostHog identity | 部分的 | — | ❌ | **✅** | ❌ |

**`calculate_shrine_behavior_signal_breakdown`**が、Detail view
（0.2×recency）/Route open（0.6×recency）/Favorite（1.5×recency）/
Visit（3.0×recency）/Reflection（4.0×recency）/Action completed
（2.0×recency）を合算（上限10.0）し、**唯一実際にrankingへ
フィードバックする**（`score_total_ranked`へ、base scoreの30%または
+0.5の小さい方を上限として加算）。

`classify_shrine_action_state`と`build_recent_reflection_hint`は
同じ元データから計算されるが、**現状Rankingには一切影響しない**
（表示・API専用）。`Score v3`という、より広範なLearning Signal統合
スコア体系は完全実装済みだが、全環境で`SCORE_V3_MODE`未設定により
shadow固定。

### 定義事項（Proposed）

各Learning Signalについて、上記表の7属性（保存有無/User紐付け/
Shrine紐付け/Session限定/Ranking戻し/Analyticsのみ/Profile更新）を
公式なSignal属性として維持する。`action_state`/`recent_reflection_hint`
は「元データはLearningだが出力はPresentation Signal」という**Signal
Attribute Model上の二重責務**として記録する（§8）。

---

## 8. Signal Attribute Model

各Signalを、Level単独ではなく以下5属性で分類する。

**Level**: L1 / L2 / L3 / Learning / Internal / Hold
**Type**: Raw Input / Derived Signal / Preference / Personal Profile /
Explicit Constraint / Context / Behavior Event / Learning Signal /
Presentation Signal
**Persistence**: Request / Session / Persistent / Derived Runtime
**Effect**: Candidate Filter / Sort Override / Ranking Bonus /
Interpretation / Reason / Presentation / Analytics / Learning Feedback
**Strength**: Primary / Strong / Soft / Presentation-only / None

| Signal | Level | Type | Persistence | Effect | Strength | Current/Proposed |
|---|---|---|---|---|---|---|
| `query`/`message` | L1 | Raw Input | Request | Interpretation | Primary | Current |
| `need_tags` | L1 | Derived Signal | Derived Runtime | Ranking Bonus + Candidate Filter（deterministic path） | Strong | Current |
| `consultation_axis` | L1 | Derived Signal | Derived Runtime | Ranking Bonus（本番実効） | Strong | Current |
| `intent`/`extract_intent` | Internal | Derived Signal | Derived Runtime | None | None | Current（Deprecated Candidate） |
| `interpretation_profile` | Internal | Derived Signal | Derived Runtime | Reason | Presentation-only | Current |
| `extra_condition`（自由記述） | L2 | Preference | Session | Sort Override / Ranking Bonus | Soft | Current |
| Preset chip（有効7件） | L2 | Preference | Session | Ranking Bonus | Soft | Current |
| Preset chip（無効5件） | L2 | Preference | Session | None | None | Current（Redesign Candidate） |
| `crowd`/`duration_max_min` | L2 | Preference（派生） | Session | soft_signal/未確認 | Soft/None | Current |
| `birthdate` | L3-A | Personal Profile | Persistent | Ranking Bonus | Soft | Current |
| `profile_context`/`user_profile`/`derived_profile` | L3-A | Personal Profile | Request（毎回送信、DB側は`birthdate`のみPersistent） | Ranking Bonus | Soft | Current |
| `goriyaku_tag_ids` | L3-B | Explicit Constraint | Session | **Candidate Filter** | Strong | Current |
| `radius`（Concierge Chat内） | L3-B（意図） | Explicit Constraint | Session | None（実質無効） | None | Current（Gap） |
| `lat`/`lng`/`origin` | L3-C | Context | Request | Ranking Bonus | Soft | Current |
| `visit_date`/`planned_visit_date` | L3-C | Context | Request | Ranking Bonus（direction計算の分岐） | Soft | Current |
| Detail view/Route open/Favorite/Visit/Reflection/Action completed | Learning | Behavior Event → Learning Signal | Persistent | **Learning Feedback**（capped） | Strong（capped） | Current |
| `action_state`/`recent_reflection_hint` | Learning | Presentation Signal | Derived Runtime | Presentation | Presentation-only | Current |
| `score_v3`一式 | Hold | Learning Signal（統合） | Derived Runtime | None（shadow固定） | None | Current（Hold） |
| `mode` | Internal | Derived Signal | Request | Ranking（weight切替） | Strong | Current |
| `flow` | Internal | Presentation Signal | Request（backend推定） | Presentation | Presentation-only | Current（Deprecated Candidate） |

---

## 9. Priority / Override Rules

以下5原則を、監査結果と照合した上で正式に採用する。

**Rule 1 — Level 1はRecommendationの意味の主軸。**
根拠: `need_tags`は常にranking（`score_need`）へ影響し、
`consultation_axis`は本番rankingへ実効する（shadowではない）。両者は
`query`から派生する、意味の中核を担うSignalである。**採用。**

**Rule 2 — Level 2はLevel 1を補助し、原則上書きしない。**
根拠: 現行実装で`extra_condition`が`query`/`need_tags`/
`consultation_axis`の値そのものを書き換える経路は確認されなかった。
ただし`crowd`が`extra_condition`テキストへround-tripする実装
（Gap、§12）は、Level間の境界を曖昧にする設計として今後注意する。
**採用。**

**Rule 3 — Level 3のExplicit ConstraintはCandidate集合を変更できる。**
根拠: `goriyaku_tag_ids`はDB-level hard filterとして候補集合を実際に
絞り込む、現行唯一のCandidate Filter。**採用。**

**Rule 4 — Personal ProfileはLevel 1の意味を上書きしない。**
根拠: `birthdate`はelement/direction/profile bonusとして常に加算的
（additive）に働き、`need_tags`/`consultation_axis`ベースの候補選定・
reason生成を上書きすることはない。**採用。**

**Rule 5 — Learning Signalは過去行動による補正として利用し、今回
明示されたLevel 1〜3の入力より優先しない。**
根拠: `calculate_shrine_behavior_signal_breakdown`の寄与は
`score_total_ranked_base`の30%または+0.5の小さい方に構造的に上限
設定されており、Level 1〜3由来のbase scoreを上回ることがないよう
設計されている。**採用。**

5原則すべてが現行実装の方向性と一致していることを確認した。

---

## 10. Current → Proposed Mapping

| # | Current | Actual（実装確認済み） | Proposed | Gap |
|---|---|---|---|---|
| 1 | ご利益 = 補助条件UI（Filter内表示） | DB-level Candidate Hard Filter | L3-B Explicit Constraint | UI上の重要度とRecommendationへの影響度が不一致（強い絞り込みなのに「補助条件」という控えめな表現） |
| 2 | `duration_max_min` = 補助条件の一部として送信 | backend消費経路が確認できない | Hold（配線または削除を後続PRで判断） | UIが計算したSignalがBackendへ実質的に届いていない可能性 |
| 3 | `hard_filter_tags` = 条件未反映時のfallback判定に利用される設計 | `EXTRA_TAG_META`上どのタグにも割り当てられておらず常に空集合 | Remove Candidate | 設計と実装が完全に乖離、到達不能なdead scaffolding |
| 4 | `soft_signal`（9タグ） = ユーザーの気分・目的を微調整する意図 | 8/9タグがscoreにもhighlightにも影響しない | Redesign Candidate（8タグ）／Keep（`calm`） | 実装意図と実効性の乖離 |
| 5 | Level 2 preset chip 5件（歴史/文化・アクセス・由緒・御朱印・神話） | キーワード一致ゼロで完全に無効 | Redesign Candidate | UIの約束とBackendの理解可能性が完全に不一致 |
| 6 | `free_text`/`extra_condition` = 別概念のfilter fieldに見える | 実質同一文字列を別keyで二重送信 | 単一fieldへ統合（実装は本書では行わない） | 冗長な二重管理 |
| 7 | `crowd`/`extra_condition` = 独立したstructured signal | crowdはextra_conditionテキストへround-tripする派生値 | crowdをstructured signalとして直接送信する設計（Proposed、実装なし） | text→derive→text再注入という不必要な往復 |
| 8 | filters/top-level compatibility copy = 移行期の互換措置 | `birthdate`最大4重複、`goriyaku_tag_ids`/`extra_condition`各2重複、恒常的な設計として定着 | 各fieldにsingle source of truthを定義（実装は本書では行わない） | 「暫定」とコメントされたまま定着し、恒久的な複雑さになっている |
| 9 | `direction_profile` = 単一の方位計算結果 | kyusei方位計算（L3-C、実効ranking）と相談状態のnarrative（Internal、shadow）という無関係な2概念が同名 | rename等による名前衝突解消（実装は本書では行わない） | 過去の`history_theme`/`ShrineHistory`衝突と同種のリスクパターン |
| 10 | `location`/`radius` = Level 3の個人Profile系候補 | Concierge Chatでは3-C Context（soft bonus）、`/nearest`ではhard filter。同名field、endpoint別に異なる責務 | Concierge Chat内では3-C Contextとして正式分類（本書で実施） | endpoint横断の意味不整合が残存（`/nearest`側の設計は本書対象外） |

---

## 11. Keep / Redesign / Hold / Remove Matrix

| 分類 | Signal |
|---|---|
| **Keep** | `query`/`message`、`need_tags`、`consultation_axis`、quiet/calm/reset/nature/sort_distance/classic/less_crowded（preset chip）、`birthdate`、`goriyaku_tag_ids`、`lat`/`lng`/`origin`、`visit_date`、Detail view/Route open/Favorite/Visit/Reflection/Action completed（Learning Signal） |
| **Redesign** | Level 2 preset chip 5件（歴史や文化に触れたい／アクセスしやすい場所がいい／由緒を知りたい／御朱印を楽しみたい／神話に触れたい）、`soft_signal`タグ8/9件、`nearby` visit_style tag、`study` visit_style tag（UI未接続＋reason未定義）、`direction_profile`（naming collision解消） |
| **Hold** | `duration_max_min`、`radius`（Concierge Chat内でのExplicit Constraint化）、`score_v3`一式（activate判断）、`action_state`/`recent_reflection_hint`のRanking接続 |
| **Remove Candidate** | `intent`/`extract_intent`、`hard_filter_tags`カテゴリ、`ConciergeSessionState.mode`（未使用型）、`ConciergeChatFilters.area_pref`/`.goriyaku`（未代入型）、`astro_priority`、`backend/favorites/`アプリ（重複・到達不能）、`ConciergeRecommendationClickLog`/`RankingLog`（孤立model）、`_resolve_flow_from_mode`（未使用関数）、`flow`（frontend未送信・weight未接続） |

監査結果だけを根拠に自動削除はしない（指示通り）。上記はいずれも
**分類のみ**であり、削除・変更の実施は後続PR（§14）でのMother Ship
判断とする。

---

## 12. Gap Analysis

[PR #2397](../audit/concierge-input-level-signal-inventory.md) §11の
Gap A〜Eを本書のLevel構造に照らして再整理する。

- **A. UI exists / Backend ineffective** — Level 2 preset chip 5件、
  `soft_signal`8タグ、`nearby`、`duration_max_min`、`hard_filter_tags`、
  Concierge Chat内`radius`。→ 本書§5/§11でRedesign/Hold/Remove
  Candidateへ分類済み。
- **B. Backend exists / UI inaccessible** — `study`/`business`
  visit_style tag、`soft_signal`の残り8タグ、`planned_visit_lucky_
  directions`依存の暗黙UI要件。→ 本書§5でRedesign Candidateへ
  分類、UI要件の明文化は後続PR（PR6、§14）。
- **C. Duplicate Signals** — `birthdate`4重複、`goriyaku_tag_ids`/
  `extra_condition`各2重複、`need_tags`/`consultation_axis`の2独立
  導出パス。→ 本書§10 Current→Proposed Mapping #6〜8で記録、
  single source of truth化はPR1（§14）。
- **D. Misclassified Signals** — `goriyaku_tag_ids`（Profileではなく
  Explicit Constraint）、`location`（L3 PersonalizationではなくL3-C
  Context）、`direction_profile`名前衝突。→ **本書§6でL3-A/B/C分離、
  §10 #10で正式に解消**。`intent`（L1候補に見えるが実質dead）、
  `astro_elements`（ユーザーinputではなくshrine側属性、Level分類対象
  外）も本書§4/§8で明示。
- **E. Dead / Legacy Fields** — `message`/`flow`単独送信なし、
  `ConciergeSessionState.mode`、`area_pref`/`goriyaku`型、
  `astro_priority`、`derived_profile.kyusei`/`.lifePath`、`intent`、
  `backend/favorites/`、`ConciergeRecommendationClickLog`/
  `RankingLog`、`ShrineCardClick`、`hard_filter_tags`、`nearby`、
  `lib/conciergeChat.ts`、`_resolve_flow_from_mode`、`radius_m`（Concierge
  Chat内）。→ 本書§11でRemove Candidateへ分類。

---

## 13. Responsibility Boundary（正本文書との接続）

本Architecture Decision（`docs/product/concierge-input-architecture.md`）は、
以下を正本とする:

- Concierge入力のLevel 1 / Level 2 / Level 3（3-A/3-B/3-C） /
  Learning Signals責務分類
- Signal Attribute Model（Level/Type/Persistence/Effect/Strength）
- Level間の優先順位・上書きルール（§9 Rule 1-5）
- 現行SignalのKeep/Redesign/Hold/Remove分類
- Current→Proposed Gap一覧

以下の既存正本は**本書では上書きしない**:

| 既存正本 | 責務 | 本書との関係 |
|---|---|---|
| `docs/core/concierge-spec.md` | 入力の物理API契約（birthdate正規化規則、mode/flow判定、破壊禁止フィールド） | 本書は責務分類のみを扱い、物理契約の詳細は同書に従う。矛盾があれば同書を優先する |
| `docs/product/concierge-first-final-spec.md` | HomeHero/ConciergeEntry/Filter/Need Mode/Compat Mode/Score v2/User State Profileの統合責務、既存の「主入力/補助入力」区分 | 本書は同書の「主入力（query/need_tags/consultation_axis/matched_need_tags）/補助入力（goriyaku/extra_condition/birthdate等）」区分を**精緻化・拡張**するものであり、置き換えない。同書のNeed Mode/Compat Mode境界ルールとも整合させた（§9 Rule 2/4） |
| `docs/product/concierge-filter-area.md` | Filter画面のUI構成・表示文言 | 本書はFilterが扱う各Signalの**Backend責務**を定義する。画面構成・文言は同書が正本のまま |
| `docs/product/consultation-theme-taxonomy.md` | theme_key分類・表示文言・consultation_axis/need_tagsとの対応表 | 本書は同書が既に「推薦入力の正本はneed_tagsとconsultation_axis」と定めていることを§4で踏襲する。theme_key個別の対応表は同書のまま |
| `docs/core/recommendation-readiness.md` | Shrine側Knowledge Coverage/Governance | 対象が異なる（ユーザー入力 vs 神社データ品質）。関連なし |
| `docs/knowledge/shrine-profile-spec.md` | Shrine側7層プロフィール構造（Fact/Meaning/Consultation/Action/Reflection/Trust/Readiness） | 対象が異なる（ユーザー入力 vs 神社プロフィール）。同書の「③ Consultation Layer」（`matched_need_tags`等、User×ShrineのRuntimeマッチング結果）とは補完関係にあり、本書のL1出力（`need_tags`/`consultation_axis`）が同書Consultation Layerへの入力にあたる |

**既存正本の内容そのものは本PRで変更していない。** 本書からの参照
リンク追加や、既存正本側からの本書への参照追加は、後続PRの対象
とする（§15 Open Questions）。

---

## 14. Follow-up PR Plan（実装しない、案のみ）

| PR | 目的 | Scope |
|---|---|---|
| PR1 | Input Contract Foundation | `birthdate`/`goriyaku_tag_ids`/`extra_condition`のtop-level⇄filters重複解消、single source of truth定義 |
| PR2 | Level 1 Consultation Contract Cleanup | `intent`/`extract_intent`の扱い決定、`need_tags`/`consultation_axis`の2導出パス統合、serializer choice-list不一致修正 |
| PR3 | Level 2 Visit Preference Signal Redesign | 無効5 preset chip・8 soft_signalタグの再設計、`nearby`データ生成、`study` reasonテキスト追加、`hard_filter`死んだscaffolding整理 |
| PR4 | Level 3 Profile / Explicit Constraint Separation | `goriyaku_tag_ids`を検索facetとして明示的に再定義、`direction_profile`名前衝突解消、`derived_profile.kyusei`/`.lifePath`の扱い決定、Concierge Chat内`radius`の扱い決定 |
| PR5 | Learning Signal Contract | `ShrineCardClick`/`ConciergeRecommendationClickLog`/`RankingLog`の配線再開または削除、`backend/favorites/`削除、`action_state`/`build_recent_reflection_hint`のRanking接続要否評価 |
| PR6 | Frontend Information Architecture / 375px UI | `ConciergeFilterPanel`の2つの独立preset UI統合、Redesign対象chipのUI表現見直し、死コード（`lib/conciergeChat.ts`等）削除、375px幅での表示検証 |
| PR7 | Analytics / Recommendation Feedback Loop | Learning→Rankingフィードバックの拡張方針検討、`Score v3`のactivate判断 |

必要に応じて分割・統合案を変更してよい。今回これらを実装しない。

---

## 15. Open Questions（Mother Ship判断が必要）

- L1/L2/L3/Learningの4分類を実際にAPI/DBレベルで物理的に分離する
  か、現行の`filters`構造を維持したまま論理分類のみに留めるか。
- Level 1が空（query/need_tagsとも空）の場合の現行フォールバック
  挙動（placeholder query文の合成、birthdate-only compat mode）を
  維持するか見直すか。
- `radius`をConcierge Chat内で3-B Explicit Constraintとして実際に
  機能させるか（現状は3-Bの意図はあるが実装が伴っていない）。
- `goriyaku_tag_ids`のProduct上の呼称・UI表現を「補助条件」から
  変更するか（現行`docs/product/concierge-filter-area.md`の表現との
  整合）。
- Level 2 Redesign Candidate（5 preset chip、8 soft_signalタグ）を
  実装レベルで直すか、UIから削除するか、それとも意図的に「今は
  効果がないが将来のための布石」として残すか。
- Learning Signal（`action_state`/`build_recent_reflection_hint`）を
  将来Rankingへ接続するか。接続する場合、Rule 5（Learning Signalは
  Level 1〜3を上回らない）とどう両立させるか。
- `Score v3`を将来activateする場合の判断基準・検証計画。
- 本書と`docs/product/concierge-first-final-spec.md`/
  `docs/product/concierge-filter-area.md`間の相互参照リンクを
  追加する後続PRの要否・タイミング。
- `direction_profile`の名前衝突解消（rename）の具体的な命名案。

---

## Verification

```
$ git status
On branch develop
Your branch is up to date with 'origin/develop'.
nothing to commit, working tree clean
```

本書は[PR #2397](../audit/concierge-input-level-signal-inventory.md)の
監査結果と、既存6正本文書（`docs/core/concierge-spec.md`、
`docs/product/concierge-first-final-spec.md`、
`docs/product/concierge-filter-area.md`、
`docs/product/consultation-theme-taxonomy.md`、
`docs/core/recommendation-readiness.md`、
`docs/knowledge/shrine-profile-spec.md`）を確認した上で作成した。
Frontend UI・Backendロジック・Candidate filtering・Ranking weight・
Recommendation Reason・API field追加/削除/rename・Model・Migration・
Analytics Event・既存Signalの削除やrename・preset chip削除・Signal
parser・Score v3切替は、いずれも変更していない（docs-onlyの
Architecture Decision）。

Frontend UI変更 = 0
Backendロジック変更 = 0
Candidate filtering変更 = 0
Ranking weight変更 = 0
Recommendation Reason変更 = 0
API field追加・削除・rename = 0
Model変更 = 0
Migration追加 = 0
Analytics Event変更 = 0
Dead field削除 = 0
preset chip削除 = 0
Signal parser変更 = 0
Score v3切替 = 0

---

## Addendum: Implemented Contract Foundation

> 本Addendumは「Concierge Input Contract Foundation」PRの実装状況を
> 記録する。Architecture Decision本文（§1〜§15）は書き換えていない。

Backend側に、Raw Request → Canonical Concierge Input →
Compatibility Normalization → Derived Signal → Recommendation の
境界を実装した（`backend/temples/services/concierge_input_contract.py`）。
Recommendation挙動・Candidate filtering・Ranking weight・API contractは
一切変更していない（既存の compatibility 処理をそのまま関数単位で
移設し、呼び出し順序も変更していない）。

### Current Request Contract Inventory（実装確認済み）

| Field | Frontend source | Request位置 | Backend read | Canonical化 | Status |
|---|---|---|---|---|---|
| `query`/`message` | `ConciergeClientFull.tsx`（textarea等） | top-level | `normalize_concierge_request()` | ✅ `ConciergeCanonicalInput.query` | Active |
| `birthdate` | `ConciergeFilterPanel.tsx` | top-level + `filters` | 同上 | ✅ `ConciergeCanonicalInput.birthdate` | Active（Compatibility重複は維持） |
| `goriyaku_tag_ids` | `ConciergeFilterPanel.tsx` | top-level + `filters` | 同上 | ✅ `ConciergeCanonicalInput.goriyaku_tag_ids` | Active（Compatibility重複は維持） |
| `extra_condition` | `ConciergeFilterPanel.tsx`（preset/自由記述） | top-level + `filters` | 同上 | ✅ `ConciergeCanonicalInput.extra_condition`（Legacy/Transitional） | Active |
| `free_text` | hooks.ts（クライアント側でextra_conditionへ畳み込み） | `filters`のみ | 未読（backend契約に存在しない） | 対象外 | Compatibility（frontend限定） |
| `crowd` | hooks.ts（同上） | `filters`のみ | 未読 | 対象外 | Compatibility（frontend限定） |
| `duration_max_min` | `ConciergeClientFull.tsx` | `filters`のみ | 未読（既存コードに読み出し経路なし、PR #2397で既知） | 対象外 | Legacy Candidate |
| `location`/`lat`/`lng` | `OriginSelector` | top-level | `_resolve_request_location_inputs`（未移設、理由は下記） | ✅（未使用wrapper）`build_concierge_recommendation_context()` | Active |
| `radius`/`radius_m` | 未送信（frontendに存在せず） | — | `_parse_radius`（未移設） | ✅（未使用wrapper） | Active（backend既定値のみ） |
| `area`/`where`/`location_text` | 未送信（frontendに存在せず、backend内部fallback用） | top-level | `normalize_concierge_request()` | ✅ `ConciergeCanonicalInput.area` | Active |
| `visit_date`/`planned_visit_date` | `ConciergeEntryCard.tsx` | top-level | view内で直接読み出し（未移設） | ✅（未使用wrapper） | Active |
| `mode` | 送信ボタン種別で決定 | top-level | view内で直接読み出し（未移設、`_resolve_public_mode`はbirthdate依存のため対象外） | 未実施 | Active（Follow-up PR4対象） |
| `flow` | 未送信（backend推定のみ） | — | view内で直接読み出し（未移設） | 未実施 | Deprecated Candidate（PR #2397で既知） |
| `thread_id` | `ConciergeClientFull.tsx` | top-level | view内で直接読み出し（未移設） | 未実施 | Active（Follow-up PR4対象） |
| `profile_context` | `derivedProfile.ts` | top-level | view内で直接読み出し（未移設、`direction_profile`計算と密結合） | 未実施 | Active（Follow-up PR4対象） |

`need_tags`/`consultation_axis`/`interpretation_profile`/`intent`は、
実装確認の結果、`ConciergeCanonicalInput`のいずれのfieldにも含まれて
いないことをテストで固定化した
（`test_canonical_input_does_not_include_derived_signals`）。

### 実装したもの

- `backend/temples/services/concierge_input_contract.py`（新規）:
  `normalize_birthdate()`・`_resolve_request_inputs_basic()`を
  `api_views_concierge.py`から**移設**（ロジック変更なし）。
  `ConciergeCanonicalInput`（Level 1 / 3-A / 3-B / 2 の canonical dataclass）
  と`normalize_concierge_request()`を新設。
- `ConciergeRecommendationContext`（Level 3-C）: `lat`/`lng`/`radius_m`/
  `visit_date`のcanonical shapeを定義したが、**view側では未配線**。
  理由: `_resolve_request_location_inputs`は外部geocode呼び出しを
  伴い、既存実装はquota判定通過後にのみ解決することでblocked/invalid
  requestへの無駄なgeocode呼び出しを避けている。これをphase-1解決へ
  前倒しすることは挙動変更（無駄な外部通信の発生）にあたるため、
  本Foundation PRでは意図的に行わなかった（Follow-up PR4）。
- `api_views_concierge.py`: phase-1入力解決を`normalize_concierge_request()`
  呼び出しへ置き換え（内部的には移設前と同一関数を呼ぶだけのため、
  挙動は完全に同一）。
- `apps/web/src/features/concierge/types/chatRequest.ts`: 型定義に
  Level/Canonical/Compatibility/Legacy Candidateの注釈を追加
  （コメントのみ、型shape・optionality変更なし）。
- Contract tests: `backend/temples/tests/test_concierge_input_contract.py`
  （35件、query/message/birthdate/goriyaku_tag_ids/extra_condition/
  free_text・crowd非対応/area/language/Raw-Derived分離/mutation側効果/
  Level 3-C packaging を網羅）。

### 実装しなかったもの（意図的、Follow-up対象）

- Level 3-C Context（`lat`/`lng`/`radius_m`/`visit_date`）のview実配線
  （上記理由により見送り、Follow-up PR4）。
- `mode`/`flow`/`thread_id`/`profile_context`のcanonical化
  （`public_mode`解決が`birthdate`に依存する等、密結合を安全に分離
  するにはより広いFollow-up PRが必要と判断、Follow-up PR4）。
- Level 2 Signal Contract自体の再設計（dead preset・soft_signal等）:
  今回のPRの対象外（Follow-up PR3）。
- `filters`/top-level二重送信の解消（Compatibility処理はそのまま維持、
  Follow-up PR1）。

### No Behavior Change Verification（実行結果）

```
Backend: python3 -m pytest -p no:dotenv temples/ -q
  -> 1182 passed, 9 skipped（環境要因、既存と同数）
  （うち371件がconcierge関連、うち新規contract test 35件）

Web: pnpm --filter ./apps/web test:contract
  -> Test Files 117 passed, Tests 759 passed

Web build: pnpm --filter ./apps/web build -> success
Web lint: pnpm --filter ./apps/web lint -> 0 errors（既存2 warning、無関係ファイル）
Web typecheck: tsc --noEmit -> no errors
Backend lint (ruff): 既存6件のみ（本PR起因の新規lint findingsは0、
  移設前後で完全一致を確認済み）
Migration: 0件
```

Recommendation behavior changes = 0
Ranking changes = 0
Candidate filtering changes = 0
API contract changes = 0

---

## Addendum: Level 2 Visit Preference Signal Redesign

> 本Addendumは「Level 2 Visit Preference Signal Redesign」PR（Follow-up
> PR3、§14）の実装状況を記録する。Architecture Decision本文（§1〜§15）
> および前Addendum（Implemented Contract Foundation）は書き換えていない。
> Concierge画面の大規模UI変更・375px Information Architecture変更・
> Level 1 query契約変更・Level 3 birthdate契約変更・`goriyaku_tag_ids`
> hard filter semantics変更・Learning Signal変更・Score v3 mode変更・
> Recommendation Reason全面変更・DB Model変更・Migrationは、いずれも
> 行っていない。

### 責務の再整理

§5 Current（`extra_condition`責務）で記録した経路を、以下へ整理した。

```text
Current（維持、Compatibility Layerとして残す）:
  UI preset chip / 自由記述
    -> extraCondition（自然文）
    -> extract_extra_tags（keyword parser）
    -> 最大3タグ

Proposed（新規、並走）:
  UI preset chip
    -> canonical tag（Structured, パーサを経由しない）
    -> visit_preferences（Level 2 Visit Preference, Structured）
```

Structured と Legacy は `resolve_visit_preference_tags()`
（`backend/temples/services/concierge_chat_extra_condition.py`）で合流する。
両者は同一の canonical tag 語彙を使うため、単純な set union で
dedupeされ、二重加点は発生しない（`score_visit_style` は distinct な
tag 数のみを数える、`concierge_chat_ranking._attach_breakdown`）。

### Canonical Visit Preference Model

`backend/temples/domain/visit_preference.py`（新規）:

```python
VISIT_PREFERENCE_TAGS = frozenset(
    {"quiet", "nature", "reset", "less_crowded", "nearby", "classic"}
)
MAX_VISIT_PREFERENCES = 6
```

- `EXTRA_TAG_META`の`visit_style`kind（8タグ）のうち、
  `docs/product/visit-style-taxonomy.md`がUI-facing MVP選択肢として
  定義する6タグの部分集合。`business`/`study`は既存の`visit_style`
  タグとして残るが、canonical structured語彙には含めない（Taxonomy文書
  がUI主要選択肢として扱っていないため）。
- Shrine側の`Shrine.visit_style_tags`（DB field名）とは意図的に
  field名を分離した: request側は`visit_preferences`
  （`ConciergeCanonicalInput.visit_preferences`）、Shrine側は従来通り
  `visit_style_tags`のまま。ユーザーの希望と神社の属性を同一名で
  混同しない。
- 上限（`MAX_VISIT_PREFERENCES = 6`）は、legacy `extract_extra_tags`の
  `max_tags=3`とは無関係に定義した — legacyの3件制限はkeyword
  parserのスコアリング実装上の副産物であり、Product上意図された
  Level 2 Preference数の上限ではなかった。Structuredはparserを経由
  しないため、その制限を継承しない。上限はcanonical語彙のサイズ
  そのもの（6）とした。UI側の選択可能数そのものを変更する場合は
  Follow-up UI PR（§14 PR6）へ送る。

### Level間の責務境界（Rule 2の適用）

- Structured/Legacy いずれも `need_tags`/`consultation_axis`/`query`の
  値を上書きしない（Rule 2、§9）。`build_chat_recommendations()`の
  `visit_preferences`引数は`visit_style_tags`のみに合流し、
  Candidate filter（`goriyaku_tag_ids`）・need scoring
  （`score_need`）・birthdate由来スコア（`score_element`）とは独立
  に計算される（`test_need_score_unaffected_by_visit_preferences`、
  `test_goriyaku_match_unaffected_by_visit_preferences`、
  `test_birthdate_score_unaffected_by_visit_preferences`で固定化）。
- Personal Profileとして永続化しない。`visit_preferences`は
  top-levelのrequest fieldのみで解決し、`birthdate`/
  `goriyaku_tag_ids`/`extra_condition`が持つtop-level⇄filters二重
  送信（Gap C）を新規に継承しない — single source of truthとして
  新設した。

### Preference（Ranking Bonus）と Sort Directive の分離

`nearby`はPreference（`score_visit_style`経由のRanking Bonus）、
`sort_distance`は独立したSort Override（`_sort_chat_recommendations`
の`distance_mode`分岐）として扱う。両者は概念上別のEffectであり、
`visit_preferences`に`nearby`を含めても`sort_distance`と同じ
distance-first sortを引き起こさない
（`test_sort_distance_unaffected_by_visit_preferences`で固定化）。
将来同じUI chipから両方を送出する設計はあり得るが、内部責務は
本PRでも分離したままとする。

### Level 2 Keep / Redesign / Hold / Remove（更新）

§11 Keep/Redesign/Hold/Remove Matrixの Level 2 該当部分を、以下へ
更新する（§11本文は書き換えず、本Addendumで差分として記録する）。

| UI Preset | §11時点の分類 | 本PRでの扱い | Canonical tag |
|---|---|---|---|
| 静かな時間を過ごしたい | Keep | Structured化 | `quiet` |
| 気分を切り替えたい | Keep（reset部分） | Structured化 | `reset` |
| 自然を感じたい | Keep | Structured化 | `nature` |
| 近場がいい | Keep（sort部分）/ Redesign（nearby部分） | Structured化（Preference側のみ） | `nearby` |
| 有名な神社が安心 | Keep | Structured化 | `classic` |
| 人混みを避けたい | Keep | Structured化 | `less_crowded` |
| 境内をゆっくり歩きたい | Redesign | Structured化（`visit-style-taxonomy.md`が定義する`quiet`/`nature`の組み合わせを採用。Legacy parserは実際には`quiet`+`calm`しか生成しておらず、これはCurrent/Proposedの既知Gapとして記録する） | `quiet`, `nature` |
| 歴史や文化に触れたい | Redesign | **Structured化して解消**（`visit-style-taxonomy.md`の既定マッピングをそのまま採用） | `classic` |
| 由緒を知りたい | Redesign | **Structured化して解消** | `classic` |
| 神話に触れたい | Redesign | **Structured化して解消** | `classic` |
| アクセスしやすい場所がいい | Redesign | **Structured化して解消**（`visit-style-taxonomy.md`は`nearby`「アクセス情報と併用」と既定） | `nearby` |
| 御朱印を楽しみたい | Redesign | **Hold**（Shrine Data Capability Check: `Shrine`モデルに御朱印関連fieldが存在しない。自然文のみで保持、`visit-style-taxonomy.md`の既定通り） | なし |
| `energize`（気分を切り替えたいの一部） | Redesign | Hold（`soft_signal` kind、highlight未定義。Level 2 canonical語彙は`visit_style` kindのみを対象とし、`soft_signal`の再設計は本PR対象外） | なし |
| `soft_signal`タグ8/9件 | Redesign Candidate | Hold（変更なし。§8 Signal Kind整理を参照） | なし |
| `hard_filter`カテゴリ | Remove Candidate | Hold（変更なし。定義上到達不能のまま維持、削除は本PRで行わない） | なし |
| `duration_max_min` | Hold | 変更なし | — |

備考: 「近場がいい」「アクセスしやすい場所がいい」はいずれも`nearby`
へ収束する（`visit-style-taxonomy.md`が両者を同一内部タグとして
定義しているため）。`nearby`自体は`infer_visit_style_tags()`が
一度も生成しないため（PR #2397 Gap A、seedデータ0件）、
Shrine側のマッチ候補が実際には存在せず、現状の実効性はLegacy経路
と同じくゼロに近い。これはSignalの構造的な位置づけの問題ではなく
Shrine側データカバレッジの問題であり、Structured化によって
悪化も改善もしない（Current通りの実効性を維持するのみ）。data
backfillはDB Model変更を伴わない範囲であっても本PRのスコープ外
とし、Follow-upへ送る。

### Shrine Data Capability Check（Redesign対象の再評価）

| 項目 | Shrine側capability | 判定 |
|---|---|---|
| 歴史や文化に触れたい／由緒を知りたい／神話に触れたい | `Shrine.history_theme`（CharField）は存在するが、`consultation_axis`（Level 1）の`HISTORY_THEME_CANDIDATE_BOOST_BY_AXIS`経由でのみ接続されており、Level 2 `visit_style`スコアリングへの接続はない | Level 2としては`classic`（既存capability）へ収束。`history_theme`自体をLevel 2へ新規接続することはRecommendation Reason/consultation_axisロジックへ波及するため本PR対象外（Hold、Follow-up） |
| 御朱印を楽しみたい | `Shrine`モデルに対応fieldなし | Hold（データなし） |
| アクセスしやすい場所がいい | 専用の交通機関/駅fieldはなく、`lat`/`lng`のみ | `nearby`（既存capability）へ収束 |
| 境内をゆっくり歩きたい | 専用fieldなし | `quiet`+`nature`の組み合わせ（既存capability）で表現 |

DB capabilityのない項目（御朱印）へcanonical tagを新規発行することは
行っていない。

### Signal Kind整理（現状維持）

- `visit_style`: Level 2 canonical structured語彙の対象。維持。
- `sort_override`（`sort_distance`）: Sort Directiveとして維持、
  Preferenceとは別Effect。
- `soft_signal`（9タグ、`calm`以外は実質無効）: 本PRでは再設計しない。
  Level 2 canonical語彙は`visit_style` kindのみを対象とし、
  `soft_signal`の扱い（Presentation-only化 / Ranking Signal昇格 /
  Hold / 削除）はFollow-upの判断とする。
- `hard_filter`: 変更なし、常に空集合。削除はFollow-up。

### Frontend Request Contract（追加）

`apps/web/src/features/concierge/types/chatRequest.ts`へ
`visit_preferences?: string[]`を追加した（top-levelのみ、`filters`への
重複は行っていない）。

UI側の配線（Concierge画面の大規模変更は行わず、既存chipのonClick
挙動にcanonical tag送出を追加するのみ）:

- `apps/web/src/features/concierge/components/ConciergeFilterPanel.tsx`:
  `QUICK_PRESET_GROUPS`の各chipに`PRESET_VISIT_PREFERENCE_TAGS`
  マッピングを追加。クリック時、既存の`onExtraConditionChange`
  （Legacy、変更なし）に加えて`onVisitPreferencesChange`
  （Structured、新規）を呼ぶ。
- `apps/web/src/features/concierge/components/ConciergeSectionsRenderer.tsx`:
  閉じた4-preset card（「静か」「駅近」「ひとり」「階段少なめ」、
  Task 1で追加確認したLevel 2 UI。本Addendumの正本監査範囲外だったが
  実装として発見したため記録する）にも同様のmappingを追加
  （「静か」→`quiet`、「駅近」→`nearby`）。「ひとり」「階段少なめ」は
  Shrine側capabilityがないためHold（マッピングなし、Legacy free-text
  のまま）。
- `apps/web/src/app/concierge/ConciergeClientFull.tsx`: `extraCondition`
  と並走する`visitPreferences`state・`filter_set_visit_preferences`
  reducer caseを追加。匿名セッションスナップショット
  （`AnonymousConciergeSnapshot`）へは含めない（Level 2は
  Session/Request scopeであり、ページ再読み込み跨ぎの永続化は
  設計上不要という判断、§5「Session-only」原則に従う）。

### Backend Canonical Contract（追加）

`ConciergeCanonicalInput`（`backend/temples/services/concierge_input_contract.py`）
へ`visit_preferences: List[str]`を追加。`normalize_concierge_request()`が
`temples.domain.visit_preference.normalize_visit_preferences()`で
validate/dedupe/capする。`extra_condition`（Legacy Compatibility field）
は変更していない — 別属性として共存する。

`build_chat_recommendations()`（`backend/temples/services/concierge_chat.py`）
に`visit_preferences`引数を追加（default `None`、既存呼び出し元は
無変更で動作）。`resolve_visit_preference_tags()`
（`backend/temples/services/concierge_chat_extra_condition.py`、新規）が
Structured/Legacyの合流点。

### No Behavior Regression Verification（実行結果）

```
Backend: python3 -m pytest -p no:dotenv temples/ -q
  -> 1225 passed, 9 skipped（既存1182 + 新規Level 2 contract test 43件）

Web: pnpm test:run（vitest run）
  -> Test Files 118 passed, Tests 766 passed（既存759 + 新規7件）

Web typecheck: tsc -p tsconfig.json --noEmit -> no errors
```

`visit_preferences`未送信の既存clientは、`build_chat_recommendations()`
の`visit_preferences=None`デフォルトにより挙動不変
（`test_omitting_visit_preferences_kwarg_matches_explicit_empty_list`
で固定化）。

### 完了条件チェック

- Level 2 Canonical Visit Preference: 定義済み（`VISIT_PREFERENCE_TAGS`、6タグ）
- UI labelとCanonical valueの分離: 済み（`PRESET_VISIT_PREFERENCE_TAGS`マッピング）
- Structured PreferenceのFrontend→Backend到達: 済み（`visit_preferences`top-level field）
- Legacy `extra_condition`互換維持: 済み（別属性として共存、削除なし）
- Structured/Legacy二重加点なし: 済み（set union、`score_visit_style`はdistinct tag数のみ計上）
- Level 1非上書き: 済み（need_tags/consultation_axis/query不変を確認済み）
- Level 3非混在: 済み（goriyaku_tag_ids/birthdateスコア不変を確認済み）
- visit_style scoring parity: 済み（Structured/Legacy同一貢献度を確認済み）
- sort override責務分離: 済み（nearby選択がsort_distanceを誘発しないことを確認済み）
- dead presetのKeep/Redesign/Hold/Remove整理: 済み（本Addendum表を参照。5件中4件をStructured化して解消、1件（御朱印）はHold）
- DB capabilityのないSignal追加なし: 済み（御朱印にtagを発行していない）
- Backend/Web tests pass、typecheck pass、migration 0: 済み

### Follow-up（本PRでは実装しない）

- Frontend IA（Level 1/2/3段階表示、375px layout、accordion、chip数のUI変更）
- `soft_signal`（8/9タグ）の再設計方針決定
- `hard_filter`カテゴリの削除判断
- `nearby`のShrine側データ生成ギャップ解消（`infer_visit_style_tags()`
  backfill、DB Model変更を伴わない場合でも本PR対象外）
- `history_theme`をLevel 2 `visit_style`スコアリングへ接続するかの判断
  （現状はLevel 1 consultation_axis経由のみ）
- 御朱印関連fieldをShrineモデルへ追加するかのProduct判断
- `duration_max_min`の配線または削除判断（PR1 Input Contract Foundation
  時点から持ち越し）

---

## Addendum: Level 3 Profile / Explicit Constraint / Recommendation Context Contract

> 本Addendumは「Level 3 Profile / Explicit Constraint / Recommendation
> Context Contract」PR（Follow-up PR4、§14）の実装状況を記録する。
> Architecture Decision本文（§1〜§15）および前2つのAddendum
> （Implemented Contract Foundation / Level 2 Visit Preference Signal
> Redesign）は書き換えていない。Level 1 consultation semantics・Level 2
> visit preference semantics・`goriyaku_tag_ids` hard candidate filter
> semantics・birthdate astrology scoring semantics・direction bonus
> semantics・Recommendation ranking weights・Score v3 mode・Recommendation
> Reason全面変更・Learning Signal・Frontend Information
> Architecture・375px UI・DB schema・Migrationは、いずれも変更していない。
> `radius`を「名前から見てhard filterだろう」と解釈した変更も行っていない
> （現行のsoft bias/観測用途のsemanticsを維持）。

### Task 1: Level 3 Current Inventory

| Signal | Input source | Current scope | Current effect | Persistence | Proposed L3 type |
|---|---|---|---|---|---|
| `birthdate`（canonical, top-level/filters/query-rescue） | `ConciergeCanonicalInput.birthdate`（`_resolve_request_inputs_basic`経由） | Request | Astrology/element scoring（`score_element`）、`astro_bonus`。profile_context不在時のdirection-calc fallback | なし（Concierge Chat経由でDB保存されない） | **3-A Personal Profile** |
| `profile_context.user_profile.{birthdate,birthday}` | request top-level `profile_context` | Request | **direction-calc専用**の別優先順位chain（`planned_visit_lucky_directions`/`annual_lucky_directions`呼び出し時、canonical birthdateより優先） | なし（Concierge Chat内では未保存。`UserProfile`モデルへの永続化は別経路） | **3-A Personal Profile**（canonical birthdateとは独立した別chain、Current Gapとして記録） |
| `profile_context.derived_profile`（kyusei/gogyo/lifePath） | request top-level `profile_context` | Request | `gogyo`のみ`_score_profile_signal`で実効。`kyusei`/`lifePath`は未消費（PR #2397既知） | なし | **3-A Personal Profile（Derived）**、変更なし |
| `goriyaku_tag_ids` | top-level/filters | Request/Session | DB-level candidate hard filter（`build_chat_candidates`） | なし（`user.profile`へ保存されない） | **3-B Explicit Constraint** |
| `location`/`lat`/`lng` | top-level lat/lng ＞ `location{lat,lng}` ＞ area geocode fallback | Request | Context + soft Ranking Bonus（distance decay + direction bearing）、候補pool構築時のbias中心点 | なし | **3-C Recommendation Context** |
| `radius`/`radius_m`（frontendは現状未送信） | top-level `radius_m`/`radius_km`（既定8000、1〜50000へclip） | Request | soft bias parameterのみ（`bias`辞書）。Concierge Chatパイプライン内では**candidate hard filterには一度もならない**（`/nearest` endpointのみhard filter） | なし | **3-C Recommendation Context** |
| `area`/`where`/`location_text` | top-level（どれか1つ） | Request | `lat`/`lng`未解決時のみ、quota gate通過後にgeocodeへ利用 | なし | **3-C Recommendation Context**（解決材料。canonical valueそのものではない） |
| `visit_date`/`planned_visit_date` | top-level、`visit_date`優先 | Request | どちらの分岐（`planned_visit_lucky_directions` vs `annual_lucky_directions`）を使うかを決定し、direction bonus/表示へ影響 | なし | **3-C Recommendation Context** |

### Task 2/3: Level 3-A Personal Profile Contract

`birthdate`をPersonal Profile入力として明示する（Type=Personal Profile,
Scope=Request, Effect=Personalization, Strength=Soft）。現行実装を確認した
結果、Concierge Chat経由でbirthdateがDBへ永続保存される経路は**存在しない**
ため、今回migrationやprofile保存機能は追加していない。

**birthdateの2つの独立した優先順位chain（Current Gap）**:

```text
Chain A（Canonical scoring birthdate、_attach_breakdownで使用）:
  top-level birthdate
  ↓（無ければ）
  filters.birthdate
  ↓（無ければ）
  query date rescue（"1990-01-01"等の文字列をqueryから救済）

Chain B（direction-calc専用、resolve_profile_context_birthdate()）:
  profile_context.user_profile.birthdate
  ↓（無ければ）
  profile_context.user_profile.birthday
  ↓（無ければ）
  Chain Aの結果（canonical birthdate）にfallback
```

`api_views_concierge.py`の呼び出し:
`planned_visit_lucky_directions(profile_birthdate or birthdate, visit_date)`
— **Chain BがChain Aより優先される**のはdirection-calcの時だけであり、
astrology/element scoring（`score_element`）は常にChain Aのみを使う。
この2 chain構造は今回**統一しない**（統一すると既存のdirection-calc結果が
変わるリクエストが存在しうるため、スコープ外）。`resolve_profile_context_birthdate()`
（`backend/temples/services/concierge_input_contract.py`、新規）へ既存ロジックを
verbatim抽出し、Contractとして明示・テスト固定した。

### Task 3: birthdate Derived Signal Boundary

`astro_profile`/`score_element`/`direction_bonus`等はbirthdateから都度計算
される Derived Runtime Signal であり、`ConciergeCanonicalInput`には含まれない
（`test_canonical_input_does_not_include_astro_or_direction_derived_signals`
で固定化）。

### Task 4/5: Level 3-B Explicit Constraint Contract

`goriyaku_tag_ids`を`Personal Profile`から明確に分離済み（PR #2399時点で
既に`ConciergeCanonicalInput`docstring上でL3-Bタグ付け済み、本PRで変更なし）。

```text
Level = L3, Type = Explicit Constraint, Scope = Request/Session,
Effect = Candidate Filter, Strength = Strong
```

DB-level hard filter semanticsは維持（変更なし）。API field名`goriyaku_tag_ids`
は後方互換のため維持する。内部コードでは`concierge_chat_ranking._attach_breakdown`
の`requested_goriyaku_tag_ids`引数名が既に責務の分かる名称になっており
（PR #2399以前から存在）、本PRで新たなrenameは行っていない — 大規模rename
は今回のGoalではない。

### Task 6/7: Level 3-C Recommendation Context Contract

PR #2399で定義済みの`ConciergeRecommendationContext`
（`backend/temples/services/concierge_input_contract.py`）を再発明せず、
`api_views_concierge.py`のview内で実配線した:

```python
lat, lng = _resolve_request_location_inputs(data, area=area)
radius_m = _parse_radius(data)  # 1回だけparse（後述）
l3_context = build_concierge_recommendation_context(
    lat=lat, lng=lng, radius_m=radius_m, visit_date=visit_date,
)
```

**geocode timingは変更していない**: `_resolve_request_location_inputs()`
の呼び出し位置は、既存通りquota gate通過後（`quota.allowed`チェックの後）の
ままである。`l3_context`の構築もこの直後に行っており、request開始直後への
前倒しは行っていない
（`test_blocked_request_does_not_trigger_geocode`で固定化 — quota
blocked時に`geocode_google_point`が一度も呼ばれないことを確認）。

`l3_context`は`recs["_debug"]["l3_context"]`へ内部観測用として付与した
（`candidate_pool_observation`/`score_v3_mode`と同じ既存パターン）。
`_build_chat_response()`が`_debug`を公開レスポンスから常に除外する既存
境界はそのまま利用しており、public API contractへの影響はない
（`test_l3_context_debug_payload_is_stripped_from_public_response`で
固定化）。

**副次的な簡略化（1件のみ）**: `radius_m`は従来`_parse_radius(data)`が
biasの計算用途と観測ログ用途で2回呼ばれていた（同一`data`からの純粋関数
なので値は常に同一）。本PRで1回にまとめ、両方の用途へ同じ変数を再利用する
よう変更した。挙動は完全に同一（`_parse_radius`はpure function）。

### Task 8: Location Source Priority

現行実装（`_resolve_request_location_inputs`）のpriorityを確認した:

```text
Priority 1: top-level lat/lng
Priority 2: location{lat,lng}
Priority 3: area text geocode fallback
```

このpriorityは既に`temples/tests/api/test_concierge_chat_view_characterization.py`
（`test_chat_view_uses_nested_location_latlng_as_bias`、
`test_chat_view_uses_area_geocode_when_latlng_absent`、
`test_chat_view_prefers_direct_latlng_even_with_area`）でcontract test化
済みであり、本PRでは重複させていない。

### Task 9: radius Contract

Concierge Chat内の`radius`/`radius_m`は`bias`辞書へのsoft parameterとして
のみ使われ、**candidate hard filterへは変更していない**
（`test_radius_is_never_passed_to_candidate_building_hard_filter_parity`で
固定化 — `build_chat_candidates`呼び出しに`radius`/`radius_m`が一切渡され
ないことを確認）。`/nearest` endpoint（別実装、`d_m <= radius_m`のhard
filter）とは責務が異なったままである。`radius` semantics統一は
Follow-upへ送る。

### Task 10: visit_date Contract

```text
Raw aliases: visit_date / planned_visit_date
  ↓（visit_date優先、data.get("visit_date") or data.get("planned_visit_date")）
Canonical Context: visit_date
```

API field自体の削除・rename は行っていない。`birthdate + visit_date →
planned_visit_lucky_directions`の挙動は維持
（`test_l3_context_visit_date_wins_over_planned_visit_date_alias`、
`test_l3_context_uses_planned_visit_date_when_visit_date_absent`で
固定化）。

### Task 11: profile_context Boundary（direction_profile naming collision）

既知の概念衝突を再確認した（PR #2397 Gap D、PR #2398 §10 #9で既に記録
済み、本PRで新規発見ではない）:

| Container | 実体 | 概念 |
|---|---|---|
| `profile_context.direction_profile`（`api_views_concierge.py`が`planned_visit_lucky_directions`/`annual_lucky_directions`の結果を格納） | kyusei方位計算結果 | L3-C Context、実効ranking（`_score_direction_signal`） |
| `interpretation_profile.direction_profile`（`consultation_interpreter.build_direction_profile()`の出力） | 相談状態のnarrative方位（`{"direction","themes","source_state"}`） | Internal/L1寄り、shadow |

同名だが完全に無関係な2概念であることを確認した。**Current collision**として
記録するのみとし、rename等の実施は本PRでは行わない（rename範囲が
`consultation_interpreter.py`/`concierge_chat_ranking.py`双方に及び、
広範囲変更になるため）。**Proposed rename（案）**: kyusei側を
`direction_bonus_profile`、narrative側を`consultation_direction_hint`等へ
分離することを候補として残す。**Follow-up**へ送る。

### Task 12: Canonical L3 Contract（実装形式）

`PersonalProfileInput`/`ExplicitConstraintInput`/`RecommendationContext`
という3つの独立classを新設する設計は採用しなかった（過剰なclass
hierarchyを避けるため）。代わりに:

- `ConciergeCanonicalInput`（既存、PR #2399）が`birthdate`（3-A）・
  `goriyaku_tag_ids`（3-B）を既にdocstring上でLevel-taggedな1つのfield
  として保持している。本PRではこのdocstringをさらに強化した
  （2つのbirthdate優先順位chainの明示、`resolve_profile_context_birthdate()`
  への参照追加）。
- `ConciergeRecommendationContext`（既存、PR #2399）が3-Cを表す。本PRで
  実際にview側から構築・使用するよう配線した（Task 6/7参照）。

これにより「概念として3分離されているが、過剰なclass階層はない」という
Task 12の要求を満たす。

### Task 13: Frontend Contract

`apps/web/src/features/concierge/types/chatRequest.ts`のコメントを拡充し、
Personal Profile（3-A）/ Explicit Constraint（3-B）/ Recommendation
Context（3-C）/ Compatibilityを型コメントレベルで識別できるようにした。
型のshape・optionality・フィールド追加削除は行っていない（コメントのみ）。
画面構造・UI layoutは変更していない。

### Task 14: Compatibility（維持）

以下の互換経路は本PRでも維持している（変更なし）:

- `birthdate`: top-level / `filters.birthdate` / query rescue
- `goriyaku_tag_ids`: top-level / `filters.goriyaku_tag_ids`
- `location`: top-level `lat`/`lng` / `location{lat,lng}` / `area` geocode
- `visit_date`/`planned_visit_date`のalias解決

### Task 18: Persistence Decision（現状確認）

| Signal | Request | Session | Persistent（Concierge Chat経由） |
|---|---|---|---|
| `birthdate`（canonical） | ✅ | ❌（frontend stateはsession中のみ保持、`sessionState.temporaryBirthdate`） | ❌ |
| `profile_context.user_profile.birthdate` | ✅ | — | ❌（`UserProfile`モデルへの永続化は別経路、Concierge Chat自体は保存しない） |
| `goriyaku_tag_ids` | ✅ | ✅（frontend `selectedTagIds` state） | ❌（`user.profile`へ保存されない、PR #2397確認済み） |
| `location`/`lat`/`lng` | ✅ | ✅（frontend `userOrigin` state） | ❌ |
| `visit_date` | ✅ | ✅（frontend `plannedVisitDate` state） | ❌ |

「ProfileだからbirthdateをDB保存する」という新規仕様は**今回追加していない**。
永続化が必要な場合は別Contractとして今後のFollow-upで判断する。

### No Behavior Change Verification（実行結果）

```
Backend: python -m pytest -p no:dotenv temples/ -q
  -> 1248 passed, 9 skipped（既存1225 + 新規Level 3 contract test 23件）

Web typecheck: tsc -p tsconfig.json --noEmit -> no errors
```

Candidate filtering behavior change = 0
Ranking behavior change = 0
API compatibility change = 0（`visit_preferences`と同様、新規fieldの追加は
  なし。`_debug.l3_context`は既存の`_debug`除外境界内の内部観測追加のみ）
Persistence change = 0
Migration = 0

### Follow-up（本PRでは実装しない）

- Profile Persistence: birthdate等をUser Profileとしてどこへ・いつ保存
  するか（Product判断）
- Radius Semantics: Concierge Chatと`/nearest`の責務統一可否
- `direction_profile` naming collision解消（rename案は本Addendumに記録済み）
- Frontend IA: L1/L2/L3の画面上段階表示
- Learning Contract: 行動学習の正式契約

---

## Addendum: Integrated Recommendation Intent Execution Contract

> 本Addendumは「Integrated Recommendation Intent Execution Contract」PR
> の実装状況を記録する。Architecture Decision本文（§1〜§15）および
> 前3つのAddendum（Implemented Contract Foundation / Level 2 Visit
> Preference Signal Redesign / Level 3 Profile / Explicit Constraint /
> Recommendation Context Contract）は書き換えていない。本PRは
> **既存Signal（L1〜L3）を統合Contractとしてテスト・監査するのみ**
> であり、ranking weight・candidate filtering semantics・
> Recommendation Reasonのテキスト生成ロジック・Score v3 mode・DB
> schema・Migration・Frontend IA・375px UIは、いずれも変更していない
> （プロダクションコードの変更は0行）。

### Core Principle（採用）

**Consultation Meaning is the primary recommendation axis.**

```text
L1 Consultation        -> 主軸（why this shrine）
L2 Visit Preference    -> 体験調整（what kind of visit experience fits）
L3-A Personal Profile  -> Personalization（how to personalize for this person）
L3-B Explicit Constraint -> Candidate制約（what must be satisfied）
L3-C Recommendation Context -> 現実適合（what is practical for this visit）
Learning                -> 将来の補正（今回は対象外、変更なし）
```

下位Signalが相談意味を勝手に置き換えない、という原則は、Integrated
Contract Test（後述）で実際のコード動作として確認済み（推測ではなく
実装から検証した）。

### Integrated Recommendation Flow（実装確認済み）

```text
Raw Consultation（query）
  ↓ resolve_need_payload / resolve_consultation_axis
Interpretation（need_tags, consultation_axis）
  ↓ build_chat_candidates（goriyaku_tag_idsのみhard filter適用）
Candidate Constraint（L3-B Explicit Constraint）
  ↓ _attach_breakdown（need/element/visit_style/distance/direction合算）
Ranking（L1 meaning + L2 experience + L3-A personalization + L3-C context）
  ↓ _build_reason_facts + _resolve_primary_reason + build_recommendation_reason
Recommendation Reason（reason_facts, _primary_reason_source, reason text）
```

### Signal Responsibility（実装確認済み、既存の割当てを再確認したのみ）

| Signal | Purpose | 実装箇所 |
|---|---|---|
| Consultation（`need_tags`/`consultation_axis`） | Why this shrine? | `resolve_need_payload`/`resolve_consultation_axis`、`_attach_breakdown`の`matched_by_tag`/`matched_by_text`/`matched_by_gid`→`score_need` |
| Visit Preference（`visit_style_tags`） | What kind of visit experience fits? | `resolve_visit_preference_tags`（PR #2405）→`_attach_breakdown`の`score_visit_style`（w5=0.35固定） |
| Personal Profile（`birthdate`） | How should this be personalized? | `_attach_breakdown`の`score_element`/`astro_bonus`、`_score_profile_signal` |
| Explicit Constraint（`goriyaku_tag_ids`） | What must be satisfied? | `build_chat_candidates`のDB-level hard filter（Candidate段階、Rankingではない） |
| Recommendation Context（`lat`/`lng`/`radius`/`visit_date`） | What is practical? | `_distance_decay`（`score_distance`）、`_resolve_direction_bonus`（`direction_bonus`） |

### Candidate Selection Contract（Task 4）

```text
Candidate Selectionを変更できるのは goriyaku_tag_ids のみ
（DB-level hard filter、build_chat_candidates内）
  ↓
Candidate Selection後、以下でRankingを決定:
  Consultation Meaning（need/consultation_axis）
  Visit Preference（visit_style）
  Personal Profile（element/astro）
  Recommendation Context（distance/direction）
```

`goriyaku_tag_ids`はCandidate集合を変えるが、Ranking Bonusとしての
score加算は行わない（`_attach_breakdown`内でgoriyaku一致は
`matched_by_gid`経由でneed scoreへ寄与することはあるが、hard filter
そのものは加点しない）。この区別は既存実装のまま、変更していない。

### Ranking Contract（Task 5、既存weight、変更なし）

| 概念 | 対応する既存weight | 現在値（needモード） | 現在値（compatモード） |
|---|---|---|---|
| Meaning Match | `need` | 0.3 | 0.2 |
| Personalization | `element` | 0.6 | 0.8 |
| Practical Fit | `distance` | 0.35 | 0.15 |
| Experience Fit | `visit_style`（固定w5） | 0.35（モード共通） | 0.35（モード共通） |

いずれも`_resolve_mode_weights()`/`_attach_breakdown()`の既存値であり、
本PRでのweight tuningは行っていない
（`test_weights_unchanged_from_documented_contract`で固定化）。

### Priority / Override Rules（Task 6、実装確認済み）

- **Rule 1** — ConsultationはRecommendation Meaningの主軸。採用。
- **Rule 2** — Visit PreferenceはConsultation Meaningを上書きしない。採用
  （`test_conflict_consultation_vs_visit_preference_does_not_flip_ranking`
  で確認: `visit_style`一致のみの候補は、`need_tag`一致する候補の後ろに
  並ぶ）。
- **Rule 3** — Personal ProfileはConsultation Meaningを上書きしない。採用
  （`test_conflict_consultation_vs_personal_profile_does_not_flip_ranking`
  で確認）。
- **Rule 4** — Explicit ConstraintはCandidate集合を変更できるが、
  Consultation Meaning自体は変更しない。採用
  （`test_conflict_consultation_vs_explicit_constraint_evaluates_meaning_within_filtered_set`
  で確認: 両候補がgoriyaku制約を満たしても、need一致する候補が上位）。
- **Rule 5** — Recommendation Contextは意味ではなく現実適合へ利用する。
  採用（`test_conflict_consultation_vs_context_does_not_relabel_reason_as_distance_only`
  で確認: 近いだけで一致していない候補は`need_tag`をprimary reasonに
  しない）。
- **Rule 6** — 複数Signalが存在する場合でも、Recommendation Reasonが
  単一補助Signalだけを主理由として誤表示しない。**部分的に採用、既知
  Mismatchあり（次項参照）**。

### Task 9/10/11: Primary Reason Audit（Current behavior / Mismatch / Proposed rule）

現行実装には**2つの独立したprimary reasonシステム**が並行して存在する
ことを確認した:

1. **`reason_facts`システム**（`concierge_chat_ranking._build_reason_facts`
   + `_resolve_primary_reason`）: `history_theme` > `culture_translation`
   > `need_tag` > `text_hint` > `user_selected_tag` > `goriyaku_tag` >
   `element` > `fallback` の優先順位。**`visit_style`はfact typeとして
   一切生成されない。**
2. **`_explanation_payload`システム**（`concierge_explanation_payload
   .build_explanation_payload`）: 上記`reason_facts`の結果を再利用しつつ、
   `_build_visit_style_primary_reason()`が独自に`primary_reason`を
   **上書き**する。条件は「`reason_facts`のprimary_reasonが存在しない、
   または`type == "fallback"`、かつvisit_style一致がある」場合のみ。

**Current behavior**: 相談に一致するfactが1つもない（fallbackのみ）
候補で、visit_style一致がある場合、`_explanation_payload.primary_reason.type`
は`"visit_style"`になるが、同じ候補の`rec["_primary_reason_source"]`
（`rank_explanation.primary_reason_source`と同じ値）は`"fallback"`の
ままである。

**Mismatch**: 同一レスポンス内の同一候補について、`rank_explanation
.primary_reason_source`（`"fallback"`）と`_explanation_payload
.primary_reason.type`（`"visit_style"`）が食い違う。両方ともpublicな
response fieldとして返っており、どちらを「正」として参照するかが
呼び出し側（frontend）に委ねられている。

**実害の範囲（確認済み）**: 実際にユーザーへ表示される`rec["reason"]`
文字列（`build_recommendation_reason`）は`_primary_reason_label`
（reason_factsシステム側）のみを参照し、visit_styleを一切考慮しない。
`_primary_reason_label`が`"element"`/`"fallback"`/`"user_selected_tag"`
等、`_build_need_reason_text`のintent_mapに存在しないlabelの場合は
汎用文言へ安全にfallbackする設計になっており、「静かな神社だから
仕事に良い」のような意味の逆転をvisible textが起こすことは確認できな
かった（`test_full_integration_visible_reason_text_reflects_consultation_not_lower_level_signal`
で固定化）。**Mismatchは構造化fieldレベル（`_explanation_payload`
vs `rank_explanation`）に留まり、主要な visible reason文言レベルには
及んでいない**、というのが今回の監査結果である。

**Proposed rule（案、未実装）**: `_build_visit_style_primary_reason()`の
override先を`_explanation_payload`だけでなく`reason_facts`/
`_resolve_primary_reason`側にも一貫させる（`PRIMARY_REASON_PRIORITY`へ
`visit_style`を`fallback`の直前に追加する等）。ただしこれは
`concierge_chat_ranking.py`と`concierge_explanation_payload.py`両方に
またがる変更であり、公開response fieldの値を変えるため、**Reason
Brush-up Follow-upへ送る**（今回のスコープでは「小さく安全な修正」
とは判断しなかった）。

### Task 10: Candidate Reason vs Rank Reason（既知の重なり、記録のみ）

`user_selected_tag`（goriyaku明示指定）のreason factは、その神社が
「候補に残った理由」（Candidate Eligibility、goriyaku hard filterを
通過した）と「相談との一致以外に説明できる理由」（Rank Reason寄り）を
兼ねている。`goriyaku_tag_ids`でフィルタされた候補群では、生き残った
候補**全員**が同じ`user_selected_tag` factを持ちうるため、これだけで
「なぜこの候補が1位か」を差別化する説明力は弱い。ただし
`PRIMARY_REASON_PRIORITY`上`user_selected_tag`（4）は`need_tag`（2）/
`text_hint`（3）より低優先度のため、Consultation一致がある限り
primary reasonにはならない（Rule 4の担保、確認済み）。この重なりは
**Current Gapとして記録するのみ**とし、Reason Brush-up Follow-upへ送る。

### Task 8/14: Explainability Boundary（既存breakdown構造の再利用）

新しいschemaは作らず、既存の`breakdown_detail.features`を以下へ対応
させて確認した:

| Explainability概念 | 既存field |
|---|---|
| candidate_eligibility | `build_chat_candidates`のgoriyaku hard filter（breakdown外、候補生成段階） |
| meaning_fit | `breakdown_detail.features.need`（`matched_tags`/`raw`/`rank_weighted`） |
| visit_preference_fit | `breakdown_detail.features.visit_style`（`matched_tags`/`raw`/`contribution`） |
| profile_fit | `breakdown_detail.features.element`（`raw`/`contribution`）、`astro_bonus` |
| context_fit | `breakdown_detail.features.distance`（`raw`/`contribution`）、`direction_bonus` |

`test_breakdown_detail_separates_meaning_visit_profile_context_features`
で、これら5つが同一Recommendationに対して独立して読み取れることを
確認した（Why eligible? / Why ranked? / Why recommended now? への分解、
Task 14参照。UIへの新規表示は行っていない）。

### Task 12/13: Integrated Contract Tests

`backend/temples/tests/test_concierge_integrated_recommendation_contract.py`
（新規、16件）:

- 組み合わせ行列: L1 only / L1+L2 / L1+L3-A / L1+L3-B / L1+L3-C /
  L1+L2+L3-A / L1+L2+L3-B / L1+L3-B+L3-C / Full Integration（全Signal
  同時）
- 競合シナリオ4件（§7）: Consultation vs Visit Preference / Personal
  Profile / Explicit Constraint / Recommendation Context
- Explainability境界の確認1件
- Weight不変の確認1件

Full Integrationでは、Candidate filter適用・need score維持・
consultation_axis維持・visit preference score反映・birthdate score
反映・context distance反映・primary reasonが補助Signalのみに乗っ取ら
れないこと・reason_factsが実際のSignalと一致することを、すべて
1つのテストで確認している。

### Task 16: Browser QA

- **Case A（相談のみ）**: dev server上で「仕事の転機で迷っています」を
  送信し、200 OK・console error無し・reasonが仕事/転機のconsultation
  文脈を正しく反映していることを確認した。
- **Case B（相談 + Visit Preference）**: 開いた`ConciergeFilterPanel`
  経由の構造化Visit Preference送信は、PR #2405のBrowser QAで
  `requested_visit_style_tags`が正しくbackendへ到達することを実機確認
  済み（本PRでの再検証は省略）。**閉じた4-preset card**
  （`ConciergeSectionsRenderer.tsx`の`togglePreset`、PR #2405で追加）
  経由の同等の検証は、本PRのBrowser QA中にライブE2Eでは再現性のある
  確認が取れなかった（自動化ブラウザ操作のタイミング起因の疑いが強い
  ── 同一操作で意図せず2回requestが発火する事象を観測）。ライブE2Eの
  代わりに、`ConciergeSectionsRenderer.closedCardVisitPreference.test.tsx`
  （新規、単体テスト）で`togglePreset`のonAction呼び出しを直接検証し、
  「静か」→`filter_set_visit_preferences({visitPreferences:["quiet"]})`、
  「駅近」→`["nearby"]`、「ひとり」→dispatchされない、をすべて確認した。
  コードパス自体は正しいと判断する。
- **Case C（Full Integration）**: 相談 + birthdate + goriyaku +
  Visit Preferenceの同時送信は、PR #2406のBrowser QAで実機確認済み
  （`score_element`/`matched_user_selected_goriyaku_tag_ids`/
  `score_visit_style`が同一レスポンス内ですべて正しく反映されることを
  確認）。本PRはranking/reasonロジックを変更していないため、再検証は
  省略した。

### No Behavior Change Verification（実行結果）

```
Backend: python -m pytest -p no:dotenv temples/ -q
  -> 1264 passed, 9 skipped（既存1248 + 新規Integrated Contract test 16件）

Web: vitest run
  -> Test Files 119 passed, Tests 769 passed（既存766 + 新規3件、
     closed-card visit preference dispatch回帰テスト）
```

Candidate filtering behavior change = 0
Ranking behavior change = 0
Recommendation Reasonのtext生成ロジック変更 = 0
API compatibility change = 0
Weight変更 = 0
Migration = 0
本PRのプロダクションコード変更 = 0行（backend/frontendとも、テスト
ファイル2件・本ドキュメントの追加のみ）

### Follow-up（本PRでは実装しない）

- **Reason Brush-up**: `_explanation_payload.primary_reason`（visit_style
  override）と`rank_explanation.primary_reason_source`（reason_facts）の
  Mismatch解消。`PRIMARY_REASON_PRIORITY`へ`visit_style`を統合するか、
  もしくは`_build_visit_style_primary_reason()`のoverride条件を
  `reason_facts`側にも一貫させるかをProduct/Engineering判断とする。
- **Weight Optimization**: 実ユーザーデータを使った重み調整（今回は
  意図的に対象外）。
- **Learning Feedback**: 過去行動によるPersonalization（Rule 5、既存の
  `calculate_shrine_behavior_signal_breakdown`ループを超えた拡張）。
- **Frontend IA**: L1→L2→L3段階UI表示。
- **Responsive Polish**: 375/390/430px全体調整。

---

## Addendum: Recommendation Primary Reason Contract Unification

> 本Addendumは「Recommendation Primary Reason Contract Unification」PR
> の実装状況を記録する。Architecture Decision本文（§1〜§15）および
> 前3つのAddendumは書き換えていない。Ranking weight・Candidate
> filtering semantics・goriyaku hard filter・Level 1/2/3 scoring
> semantics・distance/context scoring・Score v3 mode・DB schema・
> Migration・Frontend UI・375px Information Architecture・Learning
> Signalは、いずれも変更していない。

### 背景：PR #2407で発見されたMismatch

PR #2407（Integrated Recommendation Intent Execution Contract）は、
Primary Reasonの生成経路が2系統に分裂していることを発見した:

1. **`reason_facts`システム**
   （`concierge_chat_ranking._build_reason_facts` +
   `_resolve_primary_reason`、`PRIMARY_REASON_PRIORITY`で優先順位付け）
2. **`_explanation_payload`システム**
   （`concierge_explanation_payload._build_visit_style_primary_reason`が
   独自にvisit_style判定を上書きする、2つ目の独立resolver）

両者は同一Recommendationについて異なるprimary reasonを返しうる
（例: `rank_explanation.primary_reason_source == "fallback"`かつ
`_explanation_payload.primary_reason.type == "visit_style"`）。本PRは
これを解消する。

### Task 1: Primary Reason生成・加工・表示経路のInventory

repo全体を検索して確認した実際の経路:

| System | Producer | Input | Output field | Consumer | User visible | Ranking効果 |
|---|---|---|---|---|---|---|
| `reason_facts`（配列） | `concierge_chat_ranking._build_reason_facts` | matched_by_tag/gid/text, score_element, shrine_meaning_profile, **matched_visit_style_tags（本PRで追加）** | `rec["_reason_facts"]` / `rec["reason_facts"]` | `_resolve_primary_reason`、`_explanation_payload`、`concierge_explanations.py` | 間接（explanation経由） | なし（純粋に記述的、`_score_total`計算後に付与） |
| `_resolve_primary_reason` | 同上 | `reason_facts` + `PRIMARY_REASON_PRIORITY` | `rec["_primary_reason_source"]` / `rec["_primary_reason_label"]` | `build_recommendation_reason`、`rank_explanation` | 間接 | なし |
| `rank_explanation` | `_to_rank_explanation` | `rec`全体（breakdown, primary_reason等） | `rec["rank_explanation"]` | Frontend（debug/detail表示） | ✅（`ConciergeSectionsRenderer`等） | なし |
| `_explanation_payload` | `concierge_explanation_payload.build_explanation_payload` | `rec["_reason_facts"]`（**visit_style override廃止、本PR**） | `rec["_explanation_payload"]` | `concierge_explanations.build_explanation_for_chat_rec` | 間接（explanation経由） | なし |
| `explanation`（summary/reasons） | `concierge_explanations.build_explanation_for_chat_rec` | `_explanation_payload`, `breakdown_detail.features.visit_style` | `rec["explanation"]` | **Frontend表示カード**（"この神社について"等のsection） | **✅ 直接表示** | なし |
| `build_recommendation_reason` | `concierge_chat_ranking.build_recommendation_reason` | `_primary_reason_label`, `matched_need_tags`, public_mode | `rec["reason"]` | **Frontend表示（見出し文）** | **✅ 直接表示** | なし |
| `_attach_reason_source` | `concierge_chat_presentation.py` | `matched`, `public_mode`, `raw_reason` | `rec["reason_source"]` | Frontend（表示経路メタ情報） | 間接 | なし |
| `api_views_concierge.build_reason_facts`（単数形、`ConciergeReasonFacts`型） | `api_views_concierge.py` | — | — | Frontend型のみ（`ConciergeReasonFacts`） | ❌ **未使用（dead code、一度も呼ばれていない）** | なし |

**重要な発見**: `api_views_concierge.build_reason_facts()`（単数、
`concierge_chat_ranking._build_reason_facts`とは別の関数）は定義されて
いるが、repo全体で一度も呼び出されていない。対応するFrontend型
`ConciergeReasonFacts`（`matched_element`/`shrine_benefit`/
`visit_fit`/`distance_label`等）も常にnullである。これは既存のdead
codeであり、本PRの対象外として記録するのみ（削除は行わない）。

### Task 2: `reason_facts` / `_resolve_primary_reason`責務（Current）

`_build_reason_facts()`が生成するfact typeとその条件:

| Fact type | 生成条件 | Priority（`PRIMARY_REASON_PRIORITY`） |
|---|---|---|
| `history_theme` | `shrine_meaning_profile.matched_need_tags`かつ`history_theme`が存在 | 0 |
| `culture_translation` | 同上かつ`culture_translation_present` | 1 |
| `need_tag` | `matched_by_tag`（need_tagsとshrine astro_tagsの直接一致） | 2 |
| `text_hint` | `matched_by_text`（goriyaku/description文中のキーワード一致） | 3 |
| `user_selected_tag` | `matched_by_user_selected_gid`（ユーザーが明示選択したgoriyaku_tag_idsとcandidateの一致） | 4 |
| `goriyaku_tag` | `matched_by_gid`（need_tag→goriyaku_id推定マッピングとcandidateの一致） | 5 |
| `element` | `astro_bonus_enabled`（= `public_mode == "compat"`）かつ`score_element > 0` | 6 |
| **`visit_style`（本PRで追加）** | **`matched_visit_style_tags`が非空** | **7** |
| `fallback` | 他に何もない場合の`_resolve_primary_reason`のデフォルト | 9 |

### Task 3: `_explanation_payload.primary_reason`責務（Fix後）

`build_explanation_payload()`は、`rec["_reason_facts"]`から
`is_primary: true`のfactを取得するだけになった
（`_build_visit_style_primary_reason()`は削除）。独自のfallback判定
（`_primary_reason_source`/`_primary_reason_label`からの再構成）は
`reason_facts`が完全に空の防御的ケースのみに残す。

### Task 5: Single Source of Truthの選定

`reason_facts` + `_resolve_primary_reason`（`concierge_chat_ranking.py`）
を正本とした。理由:

- 唯一、実際のRanking根拠（`matched_by_tag`/`matched_by_gid`/
  `score_element`等、`_attach_breakdown`が計算した値そのもの）から
  直接構築されている。
- `rank_explanation`は既にこれを参照している。
- `_explanation_payload`は元々これを参照しつつ、visit_styleだけ独自
  resolverを持っていた（Mismatchの原因）。

新しい3つ目の独立ロジックは作っていない。`_explanation_payload`は
`reason_facts`からの**派生**（is_primaryのpassthrough）に統一した。

### Task 6: Reason責務の3分離（Contract）

| 責務 | 説明 | 対応する既存構造 |
|---|---|---|
| **Candidate Eligibility** | なぜ候補として残ったか | `goriyaku_tag_ids`のDB-level hard filter（`build_chat_candidates`、Rankingより前の段階） |
| **Rank Reason** | なぜこの候補が他より上位か | `breakdown_detail.features`（need/element/visit_style/distance等の重み付け合算、`_score_total`） |
| **Primary Recommendation Reason** | なぜ今この人にこの神社を勧めるのか | `reason_facts` + `_resolve_primary_reason`（本Addendumの対象） |

3つは既存実装上すでに別々の関数・別々のタイミングで計算されており、
今回新たに分離したわけではない。今回はPrimary Recommendation Reason
の**内部一貫性**（Single Source of Truth化）のみを扱った。

### Task 7〜12: Priority Rules（既存優先順位を確認、最小限の追加のみ）

- **Rule（Task 7）**: L1 Consultation由来（`history_theme`/
  `culture_translation`/`need_tag`/`text_hint`）が最優先。Fact-backed
  条件（`shrine_meaning_profile`/`matched_by_tag`等、実データに基づく
  一致）を満たさない限りfact化されない — 根拠なしのReason生成は
  現行実装でも発生しない。
- **Rule（Task 8）**: Visit Preferenceは`visit_style`
  priority=7として、element(6)より低くfallback(9)より高い位置に追加した。
  これは、旧`_build_visit_style_primary_reason`のoverride条件
  （`primary_reason is None or type == "fallback"`のときのみ発動 =
  実質的にelementより弱い最終手段だった）と**同じ相対的な強さ**を
  正式なpriority tierとして表現したものであり、既存の実効的な優先度を
  変更していない。
- **Rule（Task 9）**: `element`は`public_mode == "compat"`の場合のみ
  fact化される（`astro_bonus_enabled`条件）。need modeでは`element`
  factは一度も生成されない — 既存実装のまま、確認のみ
  （`test_conflict_consultation_plus_profile_meaning_wins_primary`）。
- **Rule（Task 10）**: `user_selected_tag`（Explicit Constraintかつ
  Meaning Match、priority=4）と`goriyaku_tag`（間接推定一致、
  priority=5）は区別されたまま。両方ともneed_tag/text_hint（Consultation
  直接一致）より優先度が低い。
- **Rule（Task 11）**: Context（distance/location/visit_date/direction）
  に対応するfact typeは存在しない（`distance`/`context`/`location`は
  `PRIMARY_REASON_PRIORITY`に含まれない）。ContextがPrimary
  Recommendation Meaningになることは構造的にあり得ない
  （`test_context_only_never_becomes_primary_meaning_reason`で固定化）。
- **Rule（Task 12）**: Fallback順は既存の`PRIMARY_REASON_PRIORITY`を
  そのまま正本とした（history_theme→culture_translation→need_tag→
  text_hint→user_selected_tag→goriyaku_tag→element→**visit_style（新規）**
  →fallback）。既存の6つのtierは並び替えていない。

### Task 13: 二系統の不一致を解消

```text
Single Primary Reason Resolver
  (concierge_chat_ranking._build_reason_facts + _resolve_primary_reason)
  ↓
rank_explanation.primary_reason_source
  ↓ （同じ rec["_reason_facts"] を参照）
_explanation_payload.primary_reason
  ↓
Frontend display metadata（explanation.summary / explanation.reasons）
```

`_build_visit_style_primary_reason()`（独立した2つ目のresolver）は
削除した。表示用途ごとのlabel変換（`NEED_LABELS_JA`等、日本語ラベル
辞書は複数ファイルに存在し続ける）は許容している — 意味の再判定は
行わず、`type`/`label`の変換のみ。

### Task 14: Recommendation Reason本文との整合

`build_recommendation_reason()`（`rec["reason"]`、見出し文）は変更して
いない — `_primary_reason_label`が需要タグ（study/mental/rest/love/
career/money/courage）以外の場合、既存通り安全な汎用文言へfallbackし、
矛盾する文言を生成しない（visit_style/elementが正本primary reasonで
あっても、生年月日文言や矛盾する主張はしない）。

`concierge_explanations._build_summary_from_primary_reason()`
（`rec["explanation"]["summary"]`、実際にFrontendへ表示されるカード
見出し）へは、`reason_type == "visit_style"`のケースを追加した
（Task 14の「小さなsource selection修正」に該当）。これにより、
visit_styleがprimary reasonの場合に`original_reason`（無関係な
fallback文言）へ落ちることなく、参拝スタイルに言及する適切な文言が
選ばれるようになった。本文の全面書き換えは行っていない。

### Task 15〜18: Contract Tests

`backend/temples/tests/test_concierge_primary_reason_unification_contract.py`
（新規14件）:

- Priority tier確認（visit_styleがelement/fallbackの間にあること）
- PR #2407のMismatch再現 → 解消確認（`rank_explanation.primary_reason_source`
  == `_explanation_payload.primary_reason.type`）
- 5パターンのgrounding確認（primary reasonが必ず`reason_facts`内に存在
  するか、fallbackであること）
- Full Integration test（相談+Preference+Profile+Constraint+Context
  同時投入で、Primary Reasonが統一され、reason_factsに根拠があり、
  visible reasonが矛盾しないことを確認）
- 4件のConflict Reason Test（Consultation+Visit Preference /
  +Profile / +Constraint / Context only）
- No Ranking Change確認（score_need/score_element/visit_style raw/
  `_score_total`/順序が本PRで変化しないことを確認）

既存の`test_concierge_explanations.py`中、旧`_build_visit_style_primary_reason`
の挙動を直接pinしていたテスト1件を、新しいSingle Source of Truth契約
（`_reason_facts`が空欄でbreakdown_detailにvisit_style一致がある、と
いう新設計では発生しえない入力に対して安全にfallbackすること）を
確認するテストへ更新し、正しい入力形状（`_reason_facts`に
`is_primary`付きvisit_style factが存在する状態）を確認する新規テストを
追加した。

### Task 19: Frontend Contract

Frontend側で複数のprimary reason fieldを独自に選択・判断しているコード
は見つからなかった（`pickExplanationPayloadFromThread.ts`は単に
`_explanation_payload`をそのまま正規化して受け渡すのみ）。したがって
Frontendコード変更は不要と判断し、行っていない。

`ConciergeReasonFacts`型（`apps/web/src/lib/api/concierge/types.ts`）は
前述の通りbackendで未使用のdead fieldであり、これに依存する
`buildRecommendationReasonViewModel.ts`等の分岐は常にfallback側へ
流れる（既知の限界として記録、本PRでは変更しない）。

### No Behavior Change Verification（実行結果）

```
Backend: python -m pytest -p no:dotenv temples/ -q
  -> 1279 passed, 9 skipped（既存1265 + 新規14件）
```

Ranking weight変更 = 0
Candidate filtering変更 = 0
goriyaku hard filter変更 = 0
Level 1/2/3 scoring semantics変更 = 0
Score v3 mode変更 = 0
DB schema変更 = 0
Migration = 0
Frontend UI変更 = 0（コード変更なし）
375px Information Architecture変更 = 0

Recommendation順位（`_score_total`/`score_total_ranked`/並び順）への
影響 = 0（`reason_facts`/`primary_reason`は`_score_total`計算後に
付与される、純粋に記述的なfieldであるため構造的に不可能）。

### Known Limitations（Follow-upへ送るもの）

- **Recommendation Reason Copy Brush-up**: `build_recommendation_reason()`
  本文（見出し文）にvisit_style専用の文言を追加するかは、本PRでは
  行わなかった（既存の安全な汎用fallbackのまま）。
- **`api_views_concierge.build_reason_facts()` / `ConciergeReasonFacts`**:
  未使用のdead code。削除判断はFollow-up。
- **Fact-backed Reason Quality**: Knowledge Model（history_theme/
  culture_translation）のcoverage改善は対象外。
- **Weight Optimization**: 実利用データ後の判断。
- **Frontend IA**: L1/L2/L3段階表示。
- **Learning**: 行動feedbackの正式契約。

---

## Addendum: Frontend IA Implementation — Concierge Entry Progressive Disclosure

`docs/audit/concierge-l1-freetext-final-readiness.md`のDecision
（**CONDITIONAL GO**、Free-text Primary = Yes / Assist chips visibility
= medium / L2/L3 collapsed by default = Yes）をFrontendへ実装した。
上記「Follow-up」に記録されていた「Frontend IA: L1/L2/L3段階表示」に
対応する。

Recommendation Logic自体は変更していない。これまで一画面に平坦に並んで
いた入力項目を、Signal Responsibility（本書§4-§6）に沿って
Progressive Disclosureへ再構成しただけである。

### Core UX Principle（実装確認済み）

Frontendでは内部の5層（L1 Consultation / L2 Visit Preference / L3-A
Personal Profile / L3-B Explicit Constraint / L3-C Recommendation
Context）を全て同時に見せない。3状態へ集約する。

| Frontend表示 | 内部Level | 初期状態 |
|---|---|---|
| Initial（まず相談する） | L1 Consultation | 表示（Primary Input） |
| Assist（必要なら相談を助ける） | Consultation Theme Chips | 表示（medium visibility、textarea直下） |
| Personalize（必要なら自分に合わせる） | L2 + L3-A + L3-B + L3-C | 折りたたみ（`isFilterOpen`初期値`false`、変更なし） |

### Initial State

`ConciergeEntryCard`（`apps/web/src/features/concierge/components/ConciergeEntryCard.tsx`）
をL1 Primary Inputとして再構成した。

- 表示順を Headline → Consultation textarea → Primary CTA → Assist
  chips へ変更（従来はCTAがchipsの後ろにあった）。
- textareaのlabelを「必要なら、今の状況を少しだけ書く」（任意感の強い
  文言）から「今、どんなことが気になっていますか？」（Primary Inputと
  して認識される文言）へ変更。
- Level 3-C（参拝予定日・出発地点）をこのcardから完全に除去し、
  Personalizeセクションへ移設（後述）。Initial画面には一切表示しない。
- 呼び名（Non-Recommendation）・ログイン案内は、consultation flow
  （textarea/CTA/chips）より後ろへ移動し、視覚的な強さも縮小した
  （見出しなしの`border-t`区切り、小さいfont）。**削除はしていない**
  -- `sessionNickname`はanonymous snapshot復元・greeting表示に実際に
  使われているため（`ConciergeClientFull.tsx`のruntime dependency
  確認済み）。

### Assist State

相談テーマchips（`feelExamples`）は削除せず、役割を
「Alternative Search Method」ではなく「Consultation Writing Assist」
として明示した。

- 見出しを「相談テーマ」から「うまく言葉にならないとき／近いテーマ
  から選べます」へ変更（入力補助であることを明示）。
- chip clickの挙動（`onPickExample` → `setNeedText(example.text)`、
  textareaを置き換えて編集可能にする）は**変更していない** --
  これは既存のsignal経路であり、chip専用payload fieldを新設していない
  （Do Not Change Recommendation Contract §Task 12）。
- 表示位置をtextarea/CTA直下（アコーディオン内に隠さない、textareaより
  強調しない）とし、medium visibilityとした。

### Personalize State

L2 Visit Preference + L3-A Personal Profile + L3-B Explicit Constraint
+ L3-C Recommendation Contextを、既存の`isFilterOpen`トグル1つの下へ
まとめて配置した（Task 10の3-state modelに従い、新規top-level state
は増やしていない）。ただし内部では、同一カテゴリに見せないよう
（Task 11）各責務ごとにaccessible sectionを分離した。

`apps/web/src/features/concierge/components/ConciergeFilterPanel.tsx`
（L2+L3-A+L3-B+L3-Cのopen Editorを保持）:

- 参拝スタイルpresetブロック（L2）を
  `<section aria-label="今回の参拝の希望（任意）">`へ。
- 誕生日ブロック（L3-A）を`<section aria-label="誕生日（任意）">`へ。
- ご利益ブロック（L3-B）を`<section aria-label="ご利益を指定する">`へ。
- Level 3-C（参拝予定日・出発地点）を
  `<section aria-label="参拝の詳細（任意）">`として配置した。
- open Editor内の順序は
  **L2 → L3-A → L3-B → L3-C → Apply**
  を正本とする。
- Preset値・`onToggleTag`/`onBirthdateChange`/
  `onVisitPreferencesChange`等の既存Signal mappingは変更していない。

`apps/web/src/app/concierge/ConciergeClientFull.tsx`
（Personalize outer / state source）:

- Personalize outerは、collapsed時のtitle・説明・「条件を開く」入口・
  選択済み条件summary・clearのみを担当する。
- open時はEditor titleやClose controlを重複表示せず、
  `ConciergeFilterPanel`へEditor責務を委譲する。
- `plannedVisitDate` / `userOrigin` / `locationError`のstateと、
  direction analyticsを含むhandlerは引き続きClientFullを正本とする。
- `ConciergeSectionsRenderer`はL3-Cを含むEditor state/actionの
  orchestration / bridgeのみを担当し、独自にbusiness ruleを判断しない。
- request payload（`visit_date` / `location`）の生成ロジックは変更していない。


### State Preservation

`filter_close`アクション（`ConciergeClientFull.tsx`）は
`setIsFilterOpen(false)`のみを行い、`birthdate`/`selectedTagIds`/
`extraCondition`/`visitPreferences`/`plannedVisitDate`/`userOrigin`の
いずれもクリアしない。これらは全て`ConciergeClientFull`のcomponent
stateとして保持されているため、開閉に伴うunmount/remountでも値は
構造的に保持される（Browser QAで誕生日・ご利益選択が閉じて再度
開いた後も保持されることを確認済み）。

### Editor Operation Contract

Closeは`filter_close`のみをdispatchし、Editorを閉じる。
入力済みのPersonalize stateは保持し、Recommendationは実行しない。

Cancelは設けず、draft / rollback stateも導入しない。

Apply labelはcontextによって以下を使用する。

- Entry: 「この条件で提案を見る」
- Result: 「この条件で提案を更新」

Apply可否は`ConciergeClientFull`を正本とし、

`canApply = executable query && !isBusy`

で判定する。

- queryなし + 条件あり → Apply不可
- queryあり + 条件なし → Apply可
- queryあり + 条件あり → Apply可
- queryあり + busy → Apply不可

`ConciergeSectionsRenderer`はこの判定を再計算せず、
`ConciergeFilterPanel`へpropとしてbridgeする。

### Request Payload Extraction（Task 17対応）

Request payload構築ロジック（従来`ConciergeClientFull.tsx`内に
inline実装されていたuseCallback）を
`apps/web/src/features/concierge/buildConciergeRequestPayload.ts`へ
純粋関数として抽出した。closure変数を明示的なparamsへ置き換えた
機械的な移動であり、**同一入力に対する出力は1バイトも変えていない**
-- `ConciergeClientFull.tsx`側は同じ関数を呼び出すだけの薄い
wrapperになった。

この抽出により、巨大な`ConciergeClientFull`をmountせずに、L1 only /
L1+Assist / L1+L2 / L1+L3-A / L1+L3-B / L1+L3-C / Full Integrationの
7パターンをunit testで直接検証できるようになった
（`apps/web/src/features/concierge/__tests__/buildConciergeRequestPayload.test.ts`）。

### Known Limitation（テストカバレッジ）

`ConciergeClientFull.tsx`（1990行超）は本PR以前からrender testが
一切存在しない（useAuth/useBilling/useConciergeChat等、依存が多く
mount costが高いため）。本PRもこの既存方針を踏襲し、新規にrender
harnessは追加していない。Personalizeの外側トグル（`isFilterOpen`）・
L3-C配置自体の自動テストは、`ConciergeFilterPanel`単体テスト
（section分離・値保持）とBrowser QA（後述）でカバーしている。将来
`ConciergeClientFull`のrender harnessを整備する場合はFollow-upとする。

### No Behavior Change Verification（実行結果）

```
Web unit tests: npx vitest run -> 784 passed（既存769 + 新規15件）
Web typecheck:  npx tsc -p tsconfig.json --noEmit -> no errors
Web lint:       npx eslint . -> no errors
Web build:      npm run build -> success
```

Recommendation Logic変更 = 0（query interpretation / need_tags /
consultation_axis / visit_preferences payload / birthdate semantics /
goriyaku hard filtering / location semantics / visit_date semantics /
Ranking weights / Primary Reason -- いずれも無変更）
Request payload shape変更 = 0（`buildConciergeRequestPayload`の
抽出は既存出力と1バイトも変わらないことをunit testで確認）
Backend変更 = 0
Migration = 0
Candidate filtering変更 = 0

Frontend UI変更 = Yes（本Addendumの対象そのもの、Progressive
Disclosureへの再構成）
375px Information Architecture = 崩れていないことをBrowser QAで確認
（textarea/CTA/chipsが縦積みで正しく表示され、横スクロール発生なし）

Browser QA（実機ではなくdev server + Browser preview、実backend接続）:

- Case A (Initial): textarea/CTA/chipsが最初に表示され、参拝予定日・
  出発地点・誕生日・ご利益はいずれも初期画面に表示されないことを
  確認。
- Case B (Assist): chip clickでtextareaが置き換わり編集可能になる
  ことを確認（既存挙動、変更なし）。
- Case C (Personalize): 開いてL2（参拝スタイル）・L3-A（誕生日）・
  L3-B（ご利益）・L3-C（参拝予定日・出発地点）が全て個別の
  accessible sectionとして表示されること、誕生日入力・ご利益選択
  後に閉じて再度開いても値が保持されることを確認。実際に
  `POST /api/concierge/chat/`を送信し、`birthdate`（1990-05-20由来の
  `gogyo:水`マッチ）と`goriyaku_tag_ids`（縁結び選択、
  `matched_user_selected_goriyaku_tag_ids:[1]`）の両方が実際の
  recommendation scoringへ反映されたレスポンスを確認 -- Personalize
  再配置後もrequest payloadがbackendへ正しく伝わることを、実際の
  end-to-endリクエストで検証した。

### Follow-up（本PRでは実装しない）

- `ConciergeClientFull.tsx`のrender test harness整備。
- Personalizeセクション内、L2/L3-A/L3-B/L3-Cそれぞれの個別開閉
  （本PRは全体を1つの`isFilterOpen`でまとめたまま、視覚的な
  section分離のみ実施）。
- 375/390/430pxのspacing/font size/chip density等のpixel polish
  （本PRはIA再構成のみ、visual designの磨き込みは対象外）。
- Color / Design Token全面変更。
- Recommendation結果画面（`ConciergeSectionsRenderer`の"recommendations"
  section等）の再設計。
- 呼び名フィールドのInitial Recommendation Flowからの完全除去
  （runtime dependencyがあるため今回は視覚的な優先度低下のみ）。

#### PR3 Editor Boundary — Integration Coverage Debt

PR3で確定した以下のEditor Contractは既存component / Renderer testsで固定済み。

- L2 → L3-A → L3-B → L3-C → ApplyのDOM order
- open時のClose controlは1つ
- Cancelなし
- Close後の値保持
- CloseのみではApplyしない
- Entry / Result別Apply label
- L3-C action bridge
- Apply disabled / enabled

一方、`ConciergeClientFull`専用のrender test harnessは既存しないため、
以下はIntegration Coverage Debtとして残す。

- `openFilter=1`のClientFull integration regression
- `filter_clear`後のL3-C state
  （`plannedVisitDate` / `userOrigin` / `locationError`）integration regression
- query / busy truth tableのClientFull integration regression

これらは実装未完了を意味せず、巨大なClientFull mock harnessを本PRで
新設しないというtest scope上の判断である。
