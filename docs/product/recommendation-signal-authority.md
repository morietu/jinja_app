> **Status: Active**
>
> 本ドキュメントは、KAMI MUSUBIにおけるRecommendation Signalの
> 責務（Eligibility / Primary Recommendation / Secondary Ranking /
> Personalization / Context / Explanation-only）と、競合時の優先順位を
> 設計判断として固定する正本である。`docs/audit/recommendation-signal-
> authority-audit.md`（PR #2415）が実測したCurrent Implementationと、
> 一般的なRecommendation System Architecture Patternを統合して作成した。
>
> 本書はDocsのみのPRとして作成された。production code・score
> weight・candidate filtering・recommendation reason・UI・schema・
> Migrationの変更は一切含まない。記載内容のうち「Desired Contract」
>「Should」「Future」「Follow-up PR Plan」は設計方針であり、実装済み
> であることを意味しない。最終決定・実装着手判断は母艦へ委ねる。

# Recommendation Signal Authority Decision

## 1. Purpose

本ドキュメントは、以下を単一の情報源として固定する。

1. Recommendation Signalの責務を、Eligibility / Primary Recommendation
   / Secondary Ranking / Personalization / Context / Explanation-only
   の6分類として定義する
2. 現在調査対象の17 Signal（`query`/`need_tags`/`consultation_axis`/
   `goriyaku`/`goriyaku_tag_ids`/`history_theme`/`deity`/
   `shrine_history`/`knowledge_deities`/`knowledge_histories`/
   `birthdate`/`visit_style`/`distance`/`direction`/`popularity`/
   `behavior`/`profile_context`）それぞれについて、Current Role
   （実測済み）とDesired Authority（設計判断）を対応付ける
3. Primary Recommendationの成立条件（Recommendation Meaningの定義）を
   明文化する
4. Signal競合時の優先順位ルールを定義する
5. 「良いRecommendationとは何か」を1文で固定する
6. 可視化される推薦理由（Explanation）が、実際にCandidate/Rankへ
   寄与したSignalと一致することをContract化する
7. Current ImplementationとDesired Contractの差分をMust/Should/Future
   へ分類し、後続PR候補（実装は行わない）を示す

本書はProduction Behaviorを変更しない。Desired Contractとして記載した
内容は、後続の個別PRでの実装判断・実装順序を決めるための設計文書
であり、本書自体の適用によって挙動が変わることはない。

## 2. Background

`docs/audit/recommendation-signal-authority-audit.md`（PR #2415、以下
「監査」）は、17 Signalそれぞれについて定義箇所・call path・score/
filter利用箇所・controlled experimentの4点でCurrent Implementationを
実測した。主な実測結果:

- 候補集合そのものを変更できるSignalは`goriyaku_tag_ids`（DB hard
  filter）のみ
- `goriyaku_tag_ids`は候補プール内では一切Rankへ寄与しない
  （Eligibilityとしては強いが、Rankとしてはゼロという非対称性）
- `history_theme`は`consultation_axis`一致時のみ発火するが、
  `reason_facts`のpriority最高位（0）を持つ
- `deity`/`shrine_history`/`knowledge_deities`/`knowledge_histories`
  はCandidate=No、Rank=No、`reason_facts`/`primary_reason`にも
  現れず、`recommendation_reason_v4`という別のExplanation経路にのみ
  現れる
- `direction_bonus`（常に0、`DIRECTION_BONUS_MAX=0.0`でハードコード）
  と`direction_signal_score`（実効、max+0.02）の2経路が並存する

本書はこの実測結果をCurrent Implementationとして採用し、そのうえで
Desired Contract（設計判断）を決定する。**Current Implementationを
Desired Contractと誤認しない**（本書全体の前提）。

## 3. External Benchmark Pattern

リポジトリ内には、Eligibility/Primary/Secondary/Personalization/
Context/Explanation-onlyという同一語彙を持つ外部Benchmark文書は
発見できなかった（監査§2で既報）。以下は、一般的なRecommendation
System設計（EC・コンテンツ・ハイブリッド推薦システムで広く採用される
段階構成）から得られる、外部調査結果として与えられた前提であり、
KAMI MUSUBI固有の正本や実装ではない。

```text
Candidate Generation（広め取得）
  ↓
Eligibility Filter（hard business rule: 在庫・除外条件等）
  ↓
Ranking
  ├─ Primary Relevance Signal（クエリ意図との意味的一致）
  └─ Secondary Signal（品質・鮮度等のtie-breaker）
  ↓
Personalization Layer（ユーザー固有の継続的Profileによる再重み付け）
  ↓
Context Layer（セッション依存の状況信号: 時刻・位置・デバイス等）
  ↓
Re-ranking / Business Rule Overlay（多様性・ポリシー調整）
  ↓
Explanation / Presentation Layer
```

外部パターンにおける一般的な原則:

- **Eligibility**は候補集合を変える。Rankingより前段に位置し、
  Rankingロジックに依存しない
- **Primary**はクエリ意図（Intent）との意味的一致を担う。これが
  無い、または弱い場合、Personalization/Contextだけで上位に来る
  ことは推薦の意味を損なうとされる（"cold intent, strong profile"
  問題として知られる）
- **Personalization**は継続的なユーザーProfile（過去の行動・属性）
  による補正であり、今回の相談内容（Intent）を上書きしない
  Continuous Signal
- **Context**はセッション依存の一時的信号（今回の場所・日時等）で
  あり、Personalizationと違い次回セッションには引き継がれない
- **Explanation**は「Faithful Explanation」（実際にランキングへ
  寄与した信号のみを理由として提示する）が近年のRecSys
  Explainability研究で重視される原則であり、寄与していない情報を
  理由として見せることは「ユーザーの信頼を損なう」問題として
  知られる

KAMI MUSUBIでは`docs/product/concierge-input-architecture.md` §9が
既に類似の5原則（Level 1が意味の主軸／Level 2はLevel 1を上書きしない
／Level 3 Explicit ConstraintはCandidate集合を変更できる／Personal
ProfileはLevel 1を上書きしない／Learning SignalはLevel 1〜3を上回ら
ない）を独自に導出しており、上記の外部パターンと方向性が一致して
いる。本書はこの一致を追認しつつ、監査で新たに実測された
`history_theme`/`consultation_axis`/Knowledge系Signalを同じ枠組みへ
統合する。

## 4. Current Implementation（監査からの要約）

詳細は`docs/audit/recommendation-signal-authority-audit.md`を参照。
要点のみ再掲する。

| 段階 | 実装 |
|---|---|
| Candidate Retrieval + Eligibility Filter | `build_chat_candidates()`（`concierge_chat_candidates.py`）。`goriyaku_tag_ids`のみがDB-level hard filter |
| Scoring | `_attach_breakdown()`（`concierge_chat_ranking.py`）。`score_total_ranked = score_element*w1 + score_need_rank_weighted*w2 + score_popular*w3 + score_distance*w4 + score_visit_style*w5 + astro_bonus + capped_behavior_contribution + profile_signal_score + direction_signal_score` |
| Evidence Assembly | `_build_reason_facts()` + `_resolve_primary_reason()`。`PRIMARY_REASON_PRIORITY`: history_theme(0) > culture_translation(1) > need_tag(2) > text_hint(3) > user_selected_tag(4) > goriyaku_tag(5) > element(6) > visit_style(7) > fallback(9) |
| Explanation Generation | `build_explanation_payload()`（`reason_facts`ベース）と`build_recommendation_reason_v4()`（`candidate_profile`ベース、Knowledge系はここのみ）の**2つの独立した経路** |

`docs/knowledge/shrine-knowledge-contract.md`は、`deity`/
`shrine_history`のFact利用条件を「Recommendation ReasonのFactとして
利用してよい条件」としてのみ定義しており（Score/Ranking利用は対象外、
同書冒頭の追記でも「Score/Rankingへの接続は引き続き未実装」と明記）、
監査の実測結果と完全に整合する。これは見落としではなく、意図的な
現状の設計境界である。

## 5. Authority Definitions

### Eligibility

候補集合へ入れるかどうかを決めるSignal。**Signalを変えるとCandidate
集合が変わる**。Rankingロジックより前段に位置し、Scoringに一切依存
しない（`goriyaku_tag_ids`が該当する唯一の現行Signal）。

### Primary Recommendation

今回の相談に対して「なぜこの神社なのか」の中心となるSignal。単なる
score寄与量の大小ではなく、**Recommendation Meaningの主根拠**である
こと（§7参照）。これを欠いた状態でも上位に来てしまう場合、
Recommendationの意味が成立していないとみなす。

### Secondary Ranking

Primaryとして意味が成立した候補同士の順位を補正するSignal。Primary
無しで単独では「なぜこの神社か」を説明する主根拠になれない。

### Personalization

ユーザー固有の**継続的な**情報（複数セッションを跨いで意味を持つ
情報）から順位や表示を調整するSignal。今回の相談の意味（Primary）を
上書きしない。

### Context

今回の参拝・場所・日付等、**session依存**（今回限りの状況）条件を
扱うSignal。Personalizationと異なり、ユーザー属性ではなく「今回の
現実世界の状態」を表す。

### Explanation-only

Candidate/Rankを一切変えず、推薦理由の説明にのみ使用するSignal。

## 6. Signal Authority Decision Table

| Signal | Current Role（実測） | Desired Authority | Reason | Confidence |
|---|---|---|---|---|
| `query` | Raw Input。直接スコア加点しない（`recommendation-architecture.md`の原則どおり）。`need_tags`/`consultation_axis`/text-hint matchingの元データ | Primary（の源泉） | Rawテキスト自体をscoreに使わず、必ず`need_tags`/`consultation_axis`という構造化Signalを経由させる現行設計は、外部パターンの「Query Understanding層を経由する」原則と一致 | High |
| `need_tags` | Primary（`score_need_rank_weighted`の主要項、実測で順位反転を確認、`reason_facts` priority 2） | **Primary** | Recommendation Meaningの主根拠そのもの。現状の実装・優先順位ともに妥当 | High |
| `consultation_axis` | 単独ではscoreに寄与しないが、`history_theme_candidate_boost`の発火を仲介するMediator | **Primary（Mediator）** | `need_tags`の意味を補正しhistory_theme一致を仲介する、Query Understanding層の一部として妥当。単独のSecondary/Contextへ格下げする理由はない | High |
| `goriyaku`（自由文） | Secondary（`matched_by_text`経由、`NEED_TEXT_WEIGHTS`） | **Secondary** | 構造化されていない自由文一致であり、`need_tags`ほど確実な意味一致ではない。現状のSecondary位置づけは妥当 | Medium |
| `goriyaku_tag_ids` | **Eligibility**（DB hard filter）。Rank寄与ゼロ（実測確認）。`reason_facts`ではpriority 4 | **Eligibility + Explanation**（Rank非寄与を維持） | §9で詳述。Eligibilityとして機能させつつ、Rankへ二重に加点しないことは、既にfilterした候補集合内で同一Signalを再度優遇しないという一貫性のある設計 | High |
| `history_theme` | `consultation_axis`一致時のみRank寄与（最大+1.0）。`reason_facts` priority最高位（0） | **Primary（条件付き）** | 一致時の説明力の強さ（priority 0）に見合うだけの実効力（他のneed_tag一致と同等以上）を既に持つ。現状維持が妥当 | Medium（発火条件の狭さは§12でGap記録） |
| `deity` | **Explanation-only**（`recommendation_reason_v4`のみ、`reason_facts`不接続） | **Explanation-only（現状維持、A）** | §8で詳述 | High |
| `shrine_history` | **Explanation-only**（同上） | **Explanation-only（現状維持、A）** | §8で詳述 | High |
| `knowledge_deities` | `deity`の入力元（新Knowledge Model優先、Legacy `sajin`へfallback） | **Explanation-only（現状維持、A）** | §8で詳述 | High |
| `knowledge_histories` | `shrine_history`の入力元（同上） | **Explanation-only（現状維持、A）** | §8で詳述 | High |
| `birthdate` | Secondary（`score_element*w1`。`public_mode="compat"`時のみ`astro_bonus`追加）。`reason_facts` priority 6 | **Personalization** | 継続的なユーザー属性（生年月日は不変）であり、セッションを跨いで意味を持つ。現行のSecondary的スコア実装はそのままで良いが、分類ラベルとしてはPersonalizationが実体に即している | Medium |
| `visit_style` | Secondary（`score_visit_style*w5=0.35`固定）。`reason_facts` priority 7（fallback一歩手前） | **Secondary/Personalization境界**（今回セッションの入力なら Context寄り、保存済みProfile由来ならPersonalization寄り。現状は毎回入力のためContext/Secondary） | 現状`visit_preferences`はrequest単位で送信され継続保存されない（`docs/product/concierge-input-architecture.md` Level 2定義と整合）。Personal Profileへの永続化は現状のスコープ外 | Medium |
| `distance` | Secondary（`score_distance*w4`）+ Candidate Retrieval段階でのpre-truncation sort key | **Context** | 「今回どこにいるか」というsession依存の現実世界情報であり、ユーザー属性ではない | High |
| `direction` | Context（`direction_signal_score`のみ実効、max+0.02。`direction_bonus`経路は死んでいる） | **Context** | 今回の参拝予定日・出発地点というsession依存情報。現状のContext分類は妥当。ただし`direction_bonus`のdead code整理はGap（§12） | High |
| `popularity` | Secondary（`score_popular*w3`）+ Candidate Retrieval段階でのpre-truncation sort key | **Secondary** | 神社側の静的属性であり、ユーザー固有でも今回固有でもない、候補全体に対する品質のtie-breaker | High |
| `behavior` | Secondary、`min(base*0.3, 0.5)`でcap | **Personalization** | 複数セッションを跨いだユーザー固有の行動履歴であり、継続的信号。Cap設計（Level 1〜3を上回らない）は`concierge-input-architecture.md` Rule 5と整合、現状維持が妥当 | Medium |
| `profile_context` | Context/Secondary、max+0.02 | **Personalization/Context混在**（`derived_profile.gogyo`はbirthdate由来のPersonalization。現状はsession単位で都度送信されており実質Context的に扱われている） | 五行は本来継続的なProfile情報だが、現行実装ではrequestごとに送信されるstatelessな値として扱われている。Personalizationとして永続化するかは今回の意思決定範囲外（Future）。なお`user_profile.worshipStyle`はRecommendation Signal（PR #2751）に続き永続Profile schema / APIからも退役済みで、本表の対象外 | Low（実装のstateless性が分類を曖昧にしている、§12） |

## 7. Primary Recommendation Contract

Recommendation Meaningを以下として定義する。

```text
Recommendation Meaning
  =
User Consultation Meaning（need_tags / consultation_axis / history_theme一致）
  ×
Shrine-side Meaning / Evidence（goriyaku一致 / history_theme / 意味的接続）
```

以下のSignalは、**単独ではPrimary Recommendationを成立させない**
（Primary Contract違反）。

- `distance`（Context）
- `popularity`（Secondary）
- `birthdate`（Personalization）
- `direction`（Context）
- `behavior`（Personalization）
- `visit_style`（Secondary/Context境界）

これらは監査の実測（§4/§6/§8のOrder-Flip実験）でも、他のSignalとの
併用時にRankを補正する効果は確認されたが、**単独でPrimary Reasonへ
到達した場合でも、それはRecommendationの意味的一致を示さない**
（`_reason_facts`の`PRIMARY_REASON_PRIORITY`で`visit_style`が
`fallback`の一歩手前という最下位に位置づけられていることが、この
現状の実装がすでにこの原則を反映していることを示す）。

**Contract**: `need_tags`/`consultation_axis`/`history_theme`/
`goriyaku`のいずれも一致しない場合、Primary Reasonは
"fallback"（またはそれに準ずる弱い理由）として明示的に扱われる
べきであり、`distance`/`popularity`/`birthdate`/`direction`/
`behavior`のみを根拠に「意味的に選ばれた」かのような強い理由を
提示してはならない。現行実装は`visit_style`をpriorityの最下位
（fallbackの1つ上）に置くことで、この原則を部分的に体現している。

## 8. Knowledge Authority

`deity`/`shrine_history`/`knowledge_deities`/`knowledge_histories`の
Authorityを判断する。

**Decision: A. 現状維持（Explanation-only）**

判断根拠（推測ではなく、Product Principleとの整合による）:

1. **`docs/knowledge/shrine-knowledge-contract.md`自体が、
   Score/Rankingへの接続を意図的に対象外としている。** 同書冒頭の
   追記（2026-08-02時点）は「Shrine Detail APIへの表示・
   Score/Rankingへの接続は引き続き未実装」と明記しており、これは
   実装漏れではなく、Evidence Gate（`verification_status`/
   `confidence`/`source_reference`）の整備を先行させるという
   意図的な順序である。
2. **Data Coverageが著しく不足している。** Legacy Field
   （`sajin`/`description`）は105件中105件で空
   （`docs/audit/reason-facts-coverage.md`、Blocker #1）。新Knowledge
   Model（`ShrineDeity`/`ShrineHistory`）もReal Data Pilot #1
   （明治神宮1社のみ）の段階であり、3〜5社規模のPilot本体・105件
   Rolloutは未実施。この状態でRank/Eligibilityへ接続すると、
   Coverageのある一部の神社だけが不透明に有利になり、Recommendation
   全体の公平性・予測可能性を損なう。
3. **Evidence Gateの設計目的自体がExplanation強度の制御である。**
   `confidence`（high/medium/low/未設定）は「Recommendation Reasonの
   表現強度（assertive/weakened/suppressed/legacy-compatible）」への
   接続として設計されており、Rankingスコアの強度制御としては設計
   されていない。Rankへ転用するには別のEvidence Gate設計
   （scoring用のconfidence閾値、weight設計等）が新たに必要になる。
4. **現行実装は既にこの境界を正確に実装している。**
   `_build_score_v3_candidate_profile()`が新Knowledge優先・Legacy
   fallbackという丁寧な優先順位ロジックを持ちながら、それでも
   Scoring（`_attach_breakdown`）には一切接続しない、という一貫した
   設計になっている（監査§7で実測確認）。これは事故ではなく明確な
   境界線として実装されている。

**Future Candidate（D）としての条件**: Pilot本体（3〜5社）・105件
Rolloutが完了し、Coverageが一定水準（例: 対象候補プールの過半数）に
達し、かつEvidence Gateのconfidence閾値をRanking用途向けに新規設計
した場合に限り、Secondary（B）への昇格をFollow-upとして検討可能。
本書では条件のみ記録し、昇格の是非・時期は決定しない（母艦判断）。

`goriyaku`（自由文）と`history_theme`は、Knowledge Modelとは別の
既存フィールド（`Shrine.goriyaku`/`Shrine.history_theme`、いずれも
新Knowledge Modelより前から存在しCoverageが相対的に高い静的field）
であり、既にSecondary/Primary相当のRank実効性を持つ。本書はこの
2つをKnowledge Authority判断（A/B/C/D）の対象に含めない
（既にB/C相当で稼働中のため）。

## 9. Conflict Rules

`docs/product/concierge-input-architecture.md` §9の5原則
（Rule 1〜5）を既存の正本として踏襲し、監査で新たに実測された
Signal（`history_theme`/`consultation_axis`/goriyaku_tag_ids の
Rank非寄与）を統合する形で、以下5つの競合ルールを定義する。

### Intent vs Profile

`need_tags`/`consultation_axis`（Intent）と`birthdate`
（Personalization）が競合する場合、**Intentを優先する**。根拠:
`concierge-input-architecture.md` Rule 4（Personal ProfileはLevel 1を
上書きしない）。監査§8のConflict Test実測でも、Intent一致候補が
Profile一致のみの候補に勝利することを確認済み。

### Semantic Fit vs Distance

`need_tags`/`history_theme`一致（Semantic Fit）と`distance`が競合する
場合、**現行実装は`weights`設定（`public_mode`/`flow`の組み合わせ）
依存であり、Signal自体に絶対的な優先順位規則を持たない**。監査§8の
実測では現行default weights（`public_mode="need"`, `flow="A"`）で
Semantic Fitが優位だったが、これはweight設計の結果であり、Signal
Authorityとしての規則ではない。**Desired Contract**: Semantic Fitが
Context（distance含む）に構造的に劣後することがないよう、
将来のweight変更時にもこの関係を壊さないことをGuardとして明文化
する（Should、§13）。

### Semantic Fit vs Popularity

Distanceと同様、現行weights依存でSemantic Fitが優位（監査§8実測）。
**Desired Contract**: Popularity（Secondary）がSemantic Fit
（Primary）を恒常的に上回ることがないことをGuardとして明文化する
（Should、§13）。

### Intent vs Visit Preference

`need_tags`一致と`visit_style`一致が競合する場合、**Intentを優先
する**。根拠: `reason_facts`の`PRIMARY_REASON_PRIORITY`で`need_tag`
(2)が`visit_style`(7)より高優先であることが既に実装されている
（監査§8実測でも確認）。**採用（現状維持）。**

### Intent vs Explicit Constraint

`need_tags`一致候補が`goriyaku_tag_ids`（Explicit Constraint）を
満たさない場合、**Explicit Constraintが優先し、候補から除外される**。
根拠: `concierge-input-architecture.md` Rule 3（Level 3の Explicit
ConstraintはCandidate集合を変更できる）。これはRankでの優先順位
競合ではなく、そもそもEligibility段階でCandidate集合から除外される
ため、Intentの強さに関わらず候補にすら残らない。**採用（現状
維持）。**

## 10. Explanation Contract

**「なぜこの神社？」への説明は、実際にCandidate/Rankへ寄与した
Signalと一致すること。**

- `_reason_facts`/`_primary_reason_source`/`_primary_reason_label`
  （`rank_explanation`/`_explanation_payload.primary_reason`の元
  データ）は、実際にScoringへ寄与したSignal（`need_tags`/
  `history_theme`/`text_hint`/`user_selected_tag`/`goriyaku_tag`/
  `element`/`visit_style`）のみから構成される。**この経路は現状
  すでにContractを満たしている**（監査で実測確認、Knowledgeは
  この経路に一切現れない）。
- `recommendation_reason_v4`（`rec["recommendation_reason_v4"]`/
  `_detail`）は、Knowledge（`deity`/`shrine_history`）を含む
  **別の経路**であり、Fact layerとして「この神社にはこういう情報が
  あります」という記述に使われる。**Contract**: この経路の文章が
  「（意味的に一致するため）順位が高い」という**Ranking根拠のように
  読める表現**を使ってはならない。現行の`build_recommendation_reason_v4`
  の出力例（"○○では、天照大神が祀られています。相談内容から、今
  扱いたいテーマを読み取っています。"）は、祭神情報の提示と相談解釈を
  別文として並置しており、祭神情報が推薦順位の根拠であるとは主張
  していない。**現状はContractに違反していないが、将来この文体が
  変わる場合は本Contractを崩さないことをGuardとして明記する**
  （Should、§13）。
- 禁止する具体例（本書が定義するアンチパターン）:
  - 「祭神が○○だから1位です」のように、Explanation-onlyの情報を
    Ranking根拠として提示する
  - `distance`/`popularity`/`birthdate`のみを根拠に「あなたの相談に
    最適です」という意味一致を暗示する文言を使う（§7 Primary
    Contractとも関連）

## 11. Good Recommendation Definition

**KAMI MUSUBIにおける良いRecommendationとは、ユーザーの相談の意味
（`need_tags`/`consultation_axis`/`history_theme`一致）に、神社側の
意味・根拠（`goriyaku`/`history_theme`/将来的なKnowledge Fact）が
実際に一致した候補を中心に据えつつ、今回の状況（距離・参拝スタイル・
方位等のContext）と、ユーザー固有の継続的情報（生年月日・行動履歴
等のPersonalization）で順位を補正し、その補正の内訳を可視化された
理由（Explanation）が正直に反映している状態である。**

## 12. Current Gaps

監査（§4/§6/§8）とCurrent Implementation調査で確認したGapを列挙する
（分類は§13）。

1. `goriyaku_tag_ids`のRank非寄与（Eligibilityとしては強いが、
   Rankとしてはゼロ）が、コード上明示的にコメントされていない
2. `direction_bonus`（常に0、`DIRECTION_BONUS_MAX=0.0`）が
   `_resolve_direction_bonus()`のdocstringで"Deprecated"と明記され
   ながら、`breakdown.direction_bonus`としてAPI応答に出力され続けて
   いる
3. `history_theme_candidate_boost`は`consultation_axis`一致という
   狭い条件でのみ発火し、`history_theme`単独一致では発火しない
4. Semantic Fit（Primary）がDistance/Popularity（Context/Secondary）
   に構造的に劣後しないことを保証するGuard/Testが存在しない
   （現状はweights設定に依存した結果論）
5. `recommendation_reason_v4`のExplanation文体が将来変化した場合に
   §10のExplanation Contractを壊さないことを検証する専用テストが
   存在しない
6. `profile_context`（`gogyo`）はPersonalization相当の
   継続的情報だが、現行実装はstatelessなrequest単位送信であり、
   分類上Context/Personalizationのどちらとも言い切れない曖昧さが
   残る（かつて同じ項目に含めていた`worshipStyle`は、Recommendation
   Signal・永続Profile schema・API contractのいずれからも退役済み）
7. Knowledge（`deity`/`shrine_history`）のCoverageが著しく低く
   （Legacy 105/105空、新Model 1件のみPilot）、A（現状維持）からの
   将来的な昇格判断に必要なデータが揃っていない

## 13. Must / Should / Future

### Must（Recommendation Meaningや説明整合性を壊すもの）

該当なし。監査の実測範囲では、現行実装がRecommendation Meaning
（§7）とExplanation Contract（§10）に違反しているケースは発見
されなかった。Gap 1（コメント不足）はドキュメンテーション上の
Gapであり、挙動そのものは既に正しい。

### Should（品質向上に重要だがMVPを阻害しないもの）

- Gap 1: `goriyaku_tag_ids`のRank非寄与をコードコメントとして明記
  する（PR4候補）
- Gap 2: `direction_bonus`のdead code整理（削除、またはコメントで
  「常に0、実効なし」を明記）（PR5候補）
- Gap 4: Semantic Fit優先を保証するRegression Guard Test追加
  （PR1候補）
- Gap 5: Explanation Contract（§10）のRegression Guard Test追加
  （PR4候補）

### Future（Knowledge/占術/behavior等の将来強化）

- Gap 3: `history_theme`単独一致での発火条件拡張（Product判断）
- Gap 6: `profile_context`のPersonalization化（永続化設計を含む、
  Product判断）
- Gap 7: Knowledge（`deity`/`shrine_history`）のB（Secondary）昇格
  （§8の昇格条件を満たした場合のみ、Pilot/Rollout完了後）

## 14. Follow-up PR Plan（実装しない、案のみ）

監査結果（§4/§6/§8/§12）に基づき、以下5PRへの分割を提案する。実装は
本書では行わない。実際の着手順序・要否は母艦判断へ委ねる。

**PR1 — Primary Semantic Authority Guard**
Semantic Fit（`need_tags`/`consultation_axis`/`history_theme`）が
Context（distance/popularity）に構造的に劣後しないことを保証する
Regression Guard Testを追加する（Gap 4）。production code変更は
最小限（既存weightsの意図を壊さないことをtestで固定するのみ）。

**PR2 — goriyaku_tag_ids Authority Documentation**
`goriyaku_tag_ids`のEligibility/Rank非対称性（Gap 1）をコード
コメントとして明記する。挙動変更なし。

**PR3 — direction_bonus Legacy Cleanup**
`direction_bonus`（Gap 2）を削除するか、"常に0、実効なし"を明記する
コメントを追加する。挙動変更なし（既に常に0であるため、削除しても
出力に影響しない前提を事前検証する）。

**PR4 — Explanation Contract Regression Guard**
§10のExplanation Contract（Knowledge情報がRanking根拠のように見える
表現になっていないこと）を検証するRegression Guard Testを追加する
（Gap 5）。

**PR5 — Knowledge Coverage & Evidence Gate for Ranking（Future、
今回着手しない）**
Pilot本体（3〜5社）・105件Rollout完了後、Ranking用途向けの
Evidence Gate設計（confidence閾値）を新規設計し、Knowledge Authority
のB（Secondary）昇格を検討する（§8 Future Candidate条件）。

## 15. Responsibility Boundary（正本文書との接続）

本書は以下の既存正本と責務を分担する。重複する内容は再定義しない。

- `docs/audit/recommendation-signal-authority-audit.md`: Current
  Implementationの実測結果（本書のCurrent Role列の根拠）。本書は
  この監査を上書きしない（Audit / Historicalとして凍結）
- `docs/core/recommendation-architecture.md`: Recommendation
  パイプライン全体の段階構成・正本地図。本書のSignal Authority
  判断はこの構成を前提とする
- `docs/product/concierge-input-architecture.md`: Level 1/2/3の
  入力層責務・Priority/Override Rules（§9）。本書§9の
  Conflict Rulesはこの5原則を踏襲・拡張する
  （Backward-compatible、矛盾なし）
- `docs/knowledge/shrine-knowledge-contract.md`: `deity`/
  `shrine_history`のFact利用条件・Evidence Gate設計。本書§8の
  Knowledge Authority判断はこの契約と整合する形で行った
- `docs/analytics/recommendation-score-v3-design.md`: Score計算式・
  Weightの数値そのもの。本書はWeight変更を提案しない
  （Conflict RulesのGuard追加のみ、§13/§14）

## 更新ルール

- 本書はSignal Authorityの設計判断を管理する。個別Signalの計算式・
  Weight数値は各専門正本（`docs/analytics/`）を参照する
- Desired ContractがMust/Should実装として着手される場合、当該PRで
  本書のCurrent Implementation（§4/§6）を実装後の状態へ更新する
  （本書自体は凍結しない、Activeとして維持する）
- 新しいSignalが追加される場合、§6のDecision Tableへ追記する
