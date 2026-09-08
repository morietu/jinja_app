# Intent Candidate Normalization v1

> **Status: AUDIT / NORMALIZATION ONLY**
>
> 本文書は、`docs/audit/intent-variation-definition-v1.md` で抽出された
> Intent Candidateを正規化し、
> KAMI MUSUBIのHorizontal Interpretation Modelにおける
> Intent Layerの候補構造を評価するための監査文書である。
>
> 本文書では、
> Ranking / Score / Candidate Generation / Need → Goriyaku Mapping /
> Production Data / API Contractを変更しない。
>
> Intent Candidateの分類結果は設計上の監査結果であり、
> `APPROVED` と明示されるまではRecommendationの正本ロジックとして扱わない。
>
> Audit base: `origin/develop = 2431f856` 以降
>
> Parent audit:
>
> `docs/audit/intent-variation-definition-v1.md`

---

# 1. Purpose

## 1.1 この監査の目的

前段のIntent Variation監査では、
既存34 Consultation Casesを再分類し、

```text
Semantic Purpose
Intent
State
Decision Context
Outcome
Constraint
Cross Need
Visit Preference
```

を分離して扱う必要性を確認した。

また、現行15 `need_tag` がすべて同じ種類のPurposeではなく、

```text
Topic-like
State-heavy
Intent-heavy
Topic / Action mixed
State / Intent mixed
```

を含むことも確認した。

その結果、34ケースから以下の27 Intent Candidateが抽出された。

```text
change
act
continue
recover
steady
focus
restore
ease
connect
maintain
nurture
decide
express
release
clarify
prepare
protect
care
rest
move_forward
prioritize
challenge
grow
achieve
cleanse
reset
persist
```

本監査では、この27候補をそのままtaxonomy化しない。

以下を確認する。

```text
1. 本当にIntentなのか
2. State / Decision / Outcomeと混ざっていないか
3. 同義Candidateが重複していないか
4. Purposeを横断可能か
5. Purpose固有で残す必要があるか
6. 既存need_tagと意味が二重化しないか
7. 34ケースから十分なEvidenceがあるか
8. existing interpretation_profileを再利用可能か
```

最終的に、

```text
Normalized Intent Candidate Registry
Cross-Purpose Evidence Matrix
Collision Registry
Mother Ship Decision Packet
```

を作成する。

---

# 2. Non-Goals

本監査では以下を行わない。

* Runtime `need_tag` の追加・削除
* `NEED_PRIORITY`変更
* Need keyword / regex変更
* Negation実装
* Consultation Axis変更
* Need → GoriyakuTag Mapping変更
* Goriyaku canonical registry変更
* Shrine Knowledge変更
* Candidate Generation変更
* Recommendation Ranking変更
* Recommendation Score変更
* Reason本番ロジック変更
* Concierge API変更
* Compass API変更
* Frontend変更
* Mobile変更
* Production DB変更
* Astrology / 九星 / 方位ロジック変更
* Intent Candidateの即時load-bearing化

また、

```text
courage
focus
rest
mental
protection
communication
```

など既存Needの廃止・再定義も、
本監査では決定しない。

---

# 3. Source of Truth

## 3.1 Parent Audit

Intent Candidateの抽出元は、

```text
docs/audit/intent-variation-definition-v1.md
```

とする。

特に以下を正本とする。

```text
34 Consultation Intent Classification Matrix
Initial Intent Candidate Registry
Immediate Collision Findings
First Audit Verdict
```

---

## 3.2 Runtime Need

現行runtimeのNeed正本:

```text
backend/temples/domain/need_tags.py
```

現行15 Need:

```text
love
relationship
marriage
communication
career
money
study
health
mental
protection
courage
focus
rest
family
travel_safe
```

Intent Candidateを正規化しても、
本監査内ではこのruntime contractを変更しない。

---

## 3.3 Existing Interpretation Profile

既存Consultation Interpreterには、

```text
state_profile
need_profile
direction_profile
emotion_profile
action_intent
decision_context
constraint_profile
outcome_hint
```

が存在する。

ただしfield名だけでIntent Layerと同一視しない。

特に既存 `action_intent` は、

```text
visit
reflect
save
```

などプロダクト上の行動意図を主に扱っており、

```text
change
restore
connect
recover
```

のような相談内容上のSemantic Intentとは責務が異なる。

したがって、

```text
existing action_intent
=
new semantic Intent
```

とは扱わない。

---

# 4. Normalization Principles

Intent Candidateを以下の基準で評価する。

---

## 4.1 Intent Test

Candidateは原則として、

```text
ユーザーはどうしたい？
```

に回答できる必要がある。

例:

```text
環境を変えたい
→ change

気持ちを伝えたい
→ express

休みたい
→ rest
```

---

## 4.2 State Exclusion

以下のような、

```text
今どんな状態？
```

への回答はIntentへ含めない。

例:

```text
anxious
tired
uncertain
restless
overwhelmed
```

---

## 4.3 Decision Separation

```text
選択や判断が必要か
```

を示すものは、
Decision Contextとの境界を確認する。

例:

```text
decide
prioritize
```

---

## 4.4 Outcome Separation

```text
最終的にどうなりたいか
```

だけを表すCandidateは、
Outcomeへ移動できないか確認する。

例:

```text
move_forward
achieve
clarify
```

---

## 4.5 No Automatic Synonym Merge

意味が近くても、

```text
recover
reset
restore
steady
```

を自動的に同一化しない。

34ケース上の使用文脈を確認し、
意味差が説明できない場合のみMerge Candidateとする。

---

## 4.6 Corpus First

本監査では新しい相談文を作ってtaxonomyを補強しない。

まず既存34 Consultation Casesから確認できるEvidenceを優先する。

候補が一般論として使えそうでも、

```text
34ケース内で実際に複数Purposeへ出現した
```

こととは区別する。

---

# 5. Normalization Status

各Candidateを以下のstatusで分類する。

| Status                            | Meaning                                   |
| --------------------------------- | ----------------------------------------- |
| `KEEP_SHARED_CANDIDATE`           | Purpose横断Intentとして保持する候補                  |
| `KEEP_PURPOSE_SPECIFIC_CANDIDATE` | 特定Purpose依存で保持する候補                        |
| `MERGE_CANDIDATE`                 | 他Candidateとの統合を検討                         |
| `MOVE_TO_OTHER_SIGNAL`            | IntentよりState / Decision / Outcome等が適切な候補 |
| `INSUFFICIENT_EVIDENCE`           | 34ケースだけではIntentとして保持するEvidence不足          |
| `UNRESOLVED`                      | 複数解釈が残り、現時点で分類しない                         |

これらはNormalization上のstatusであり、
canonical taxonomy採用状態ではない。

---

# 6. 27 Intent Candidate Normalization Matrix

| Candidate      | Status                            | Observed Context                 | Normalization Note                                         |
| -------------- | --------------------------------- | -------------------------------- | ---------------------------------------------------------- |
| `change`       | `KEEP_SHARED_CANDIDATE`           | Career-A / Career-B / Neg-5      | 「環境・状況を変えたい」という変化意図を直接表現可能                                 |
| `act`          | `KEEP_SHARED_CANDIDATE`           | Career-B / MR-D / Courage-A      | 行動へ移したい意図。`courage` Needとのcollisionあり                      |
| `continue`     | `UNRESOLVED`                      | Career-C                         | Career-Cは「続けたい」ではなく継続への自信喪失。Intent断定はできない                  |
| `recover`      | `KEEP_SHARED_CANDIDATE`           | Career-D / MR-B / MR-C / Theme-2 | 立て直し・回復意図として再利用可能。ただしPurposeごとにEvidence意味が異なる              |
| `steady`       | `UNRESOLVED`                      | Career-D / MR-A / Family-A       | IntentかOutcome/State stabilizationか境界が曖昧                   |
| `focus`        | `KEEP_SHARED_CANDIDATE`           | Career-E / Focus-A               | career / study双方で観測される明確なIntent                            |
| `restore`      | `KEEP_SHARED_CANDIDATE`           | Career-F / Family-D              | 現Corpusではrelationship文脈中心。意味としては横断可能性あり                    |
| `ease`         | `INSUFFICIENT_EVIDENCE`           | Career-F / Family-Dの補助解釈         | 「摩擦を減らしたい」が相談文から直接観測されているとは言いにくい                           |
| `connect`      | `KEEP_SHARED_CANDIDATE`           | Love-A                           | 新しい関係・接続を求める意図として明確。ただしCorpus上の横断Evidenceは未確認              |
| `maintain`     | `KEEP_SHARED_CANDIDATE`           | Love-B / Family-A                | 既存の良い状態を保ちたい意図として利用可能                                      |
| `nurture`      | `MERGE_CANDIDATE`                 | Love-B                           | `maintain`との意味差が現34ケースだけでは十分に説明できない                        |
| `decide`       | `MOVE_TO_OTHER_SIGNAL`            | Love-C                           | Decision Contextとの責務重複が大きい                                 |
| `express`      | `KEEP_SHARED_CANDIDATE`           | Love-D                           | 「気持ちを伝える」という行為意図として明確。`communication` Needとcollision       |
| `release`      | `UNRESOLVED`                      | Love-E                           | 「整理したい」から「手放したい」まで断定するのは過剰解釈の可能性                           |
| `clarify`      | `UNRESOLVED`                      | Love-E                           | IntentとしてもOutcomeとしても解釈可能。既存`outcome_hint`とのcollisionあり    |
| `prepare`      | `KEEP_SHARED_CANDIDATE`           | Family-C / Study-A               | family / studyで実際に横断観測される                                  |
| `protect`      | `KEEP_SHARED_CANDIDATE`           | Family-B / Family-C / Travel-A   | family / travelで横断観測。`protection` Needとのcollisionあり        |
| `care`         | `INSUFFICIENT_EVIDENCE`           | Family-B                         | 「子どものことが心配」からcare意図を断定するにはEvidence不足                       |
| `rest`         | `KEEP_SHARED_CANDIDATE`           | MR-B / MR-C / Theme-2            | 「休みたい」という直接的Intent。`rest` Needとの完全重複あり                     |
| `move_forward` | `MOVE_TO_OTHER_SIGNAL`            | MR-D / Courage-A                 | 既存`outcome_hint`側の意味と強く一致                                  |
| `prioritize`   | `MOVE_TO_OTHER_SIGNAL`            | Neg-4 / Theme-3                  | IntentよりDecision / Emphasis / Priority Contextとして扱う方が責務が明確 |
| `challenge`    | `KEEP_SHARED_CANDIDATE`           | Theme-1                          | 挑戦したいという明確なIntent。`courage` Needとcollision                 |
| `grow`         | `KEEP_SHARED_CANDIDATE`           | Money-A                          | 成長・拡大Intentとして再利用可能だが、34ケース上はmoneyのみ                       |
| `achieve`      | `MOVE_TO_OTHER_SIGNAL`            | Study-A                          | 「合格」という達成結果はOutcome側へ寄る                                    |
| `cleanse`      | `KEEP_PURPOSE_SPECIFIC_CANDIDATE` | Protect-A                        | 現Corpusではprotection文脈に強く依存                                 |
| `reset`        | `KEEP_SHARED_CANDIDATE`           | Protect-A                        | 切り替え・再始動の意味として横断可能性。ただしCorpus上ではprotectionのみ               |
| `persist`      | `KEEP_SHARED_CANDIDATE`           | Focus-A                          | 継続したいという明確なIntent。`focus` Needとcollision                   |

---

# 7. First Normalized Registry

27候補をNormalization Statusで分けると以下となる。

---

## 7.1 Shared Intent Candidate

```text
change
act
recover
focus
restore
connect
maintain
express
prepare
protect
rest
challenge
grow
reset
persist
```

Count:

```text
15
```

ただし、

```text
KEEP_SHARED_CANDIDATE
```

は、

```text
34ケースで複数Purpose横断が実証済み
```

という意味ではない。

意味構造上、
Purpose横断Intentとして保持する価値がある候補という意味である。

---

## 7.2 Purpose-Specific Candidate

```text
cleanse
```

Count:

```text
1
```

現時点ではprotection以外でのCorpus Evidenceがない。

---

## 7.3 Merge Candidate

```text
nurture
→ maintain ?
```

Count:

```text
1
```

まだAPPROVED Mergeではない。

---

## 7.4 Move to Other Signal Candidate

```text
decide
→ Decision Context

move_forward
→ Outcome

prioritize
→ Decision / Priority Context

achieve
→ Outcome
```

Count:

```text
4
```

---

## 7.5 Insufficient Evidence

```text
ease
care
```

Count:

```text
2
```

Candidate自体を否定するものではなく、
現34ケースだけではcanonical Intentとして残す根拠が弱いことを示す。

---

## 7.6 Unresolved

```text
continue
steady
release
clarify
```

Count:

```text
4
```

---

## 7.7 Reconciliation

```text
Shared                 15
Purpose-specific        1
Merge                    1
Move to other signal     4
Insufficient evidence    2
Unresolved               4
---------------------------
Total                    27
```

---

# 8. Observed Cross-Purpose Evidence

Shared Candidateと、
実際の34ケースで複数Semantic Purposeに出現したCandidateを区別する。

---

## 8.1 Strong Observed Cross-Purpose

### `focus`

Observed:

```text
Career-E
Semantic Purpose = career
Intent = focus

Focus-A
Semantic Purpose = study
Intent = focus
```

したがって、

```text
focus
```

は34ケース内で明確に複数Purposeを横断している。

---

### `prepare`

Observed:

```text
Family-C
Semantic Purpose = family
Intent = prepare

Study-A
Semantic Purpose = study
Intent = prepare
```

したがって、

```text
prepare
```

も複数Purpose横断Evidenceを持つ。

---

### `protect`

Observed:

```text
Family-B
Semantic Purpose = UNREPRESENTED_TOPIC: parenting_concern

Family-C
Semantic Purpose = family

Travel-A
Semantic Purpose = travel_safe
```

少なくとも、

```text
family
travel_safe
```

を横断するEvidenceが存在する。

---

## 8.2 Partial Cross-Purpose Evidence

### `maintain`

Observed:

```text
Love-B
Semantic Purpose = love

Family-A
Semantic Purpose = UNREPRESENTED_TOPIC: family_wellbeing
```

複数領域への適用可能性は見えるが、
Family-Aは現行Purpose taxonomy外であるため、
Strong Cross-Purposeとは分けて扱う。

---

## 8.3 Semantic Reuse Candidate Only

以下は意味上は横断可能に見えるが、
34ケース内では複数の明示的Semantic Purposeへの出現が十分確認できない。

```text
change
act
recover
restore
connect
express
rest
challenge
grow
reset
persist
```

したがって、

```text
Shared Intentとして使えそう
```

と、

```text
34ケースでShared Intentとして実証された
```

を同義にしない。

---

# 9. Current Need Collision Registry

Intent Layerを追加する場合、
現行Needと同じ意味を持つCandidateが存在する。

---

## 9.1 courage

Current Need:

```text
courage
```

Collision:

```text
act
challenge
change
move_forward
```

特に、

```text
背中を押してほしい
一歩踏み出したい
挑戦したい
```

はTopicというよりHorizontal Intentとして振る舞う可能性がある。

ただし本監査では `courage` Needを削除しない。

---

## 9.2 focus

Current Need:

```text
focus
```

Collision:

```text
focus
persist
```

例:

```text
Purpose = study
Intent = focus / persist
Current Need = study / focus
```

同一意味がSemantic LayerとRuntime Needの双方に存在する可能性がある。

---

## 9.3 rest

Current Need:

```text
rest
```

Collision:

```text
rest
recover
reset
steady
```

`rest` Needは、

```text
State
Intent
Visit Preference
```

の複数意味と重なる可能性がある。

---

## 9.4 protection

Current Need:

```text
protection
```

Collision:

```text
protect
cleanse
reset
```

Intent Layer導入時に、

```text
Purpose = protection
Intent = protect
```

のような意味重複が起こり得る。

---

## 9.5 mental

Current Need:

```text
mental
```

Collision:

```text
recover
steady
release
clarify
```

ただし `mental` は主にState-heavy Needであるため、
Intentと完全同義ではない。

---

## 9.6 communication

Current Need:

```text
communication
```

Collision:

```text
express
```

`communication` はTopic / Action mixedであり、

```text
何について
```

と、

```text
どうしたい
```

が同じNeed内に混在している可能性がある。

---

# 10. Intent Family Collision

Candidate間にも意味的近接が存在する。

---

## 10.1 Change / Action Family

```text
change
act
challenge
move_forward
reset
```

これらを1 slugへ統合しない。

暫定意味:

```text
change
= 状況・環境を変えたい

act
= 行動へ移したい

challenge
= 新しい・難しいことへ挑みたい

move_forward
= 最終的に前進したい
  → Outcome候補

reset
= 現状を切り替え再始動したい
```

---

## 10.2 Recovery Family

```text
recover
steady
restore
reset
```

暫定意味:

```text
recover
= 損なわれた状態から回復・立て直したい

steady
= 安定・落ち着きを得たい

restore
= 既存の関係・状態を修復したい

reset
= 現状を切り替えたい
```

この意味差がRecommendation Evidence上でも維持可能かは未確定。

---

## 10.3 Relationship Family

```text
connect
maintain
nurture
restore
release
```

暫定:

```text
connect
= 新しい関係を作る

maintain
= 現在の関係を保つ

nurture
= 現在の関係を育てる
  → maintainとのMerge候補

restore
= 壊れた・悪化した関係を修復する

release
= 関係・感情を手放す
  → 現CorpusではEvidence不足
```

---

## 10.4 Preparation / Protection Family

```text
prepare
protect
```

これは同義ではない。

```text
prepare
= 将来の出来事へ備える

protect
= 無事・安全を願う
```

Family-Cのように、

```text
prepare + protect
```

が同時に成立するため、
統合しない。

---

# 11. Multi Intent Observation

34ケースでは、
複数Intent Candidateが同時に成立するケースが存在する。

例:

```text
Career-B
change + act

Career-D
recover + steady

Love-E
release + clarify

Family-C
prepare + protect

Study-A
achieve + prepare

Protect-A
cleanse + reset

Focus-A
focus + persist
```

したがって、

```text
1 consultation = 必ず1 Intent
```

とすると意味を失う可能性がある。

ただし、

Mother Ship Decisionにより、
複数Intentは PRIMARY_SECONDARY として保持する。

1 consultation に複数Intentを許容するが、
相談の中心となるIntentを Primary、
補助的なIntentを Secondary として区別する。

この判断はShadow Interpretation上の保持方式を定義するものであり、
Ranking / Scoreへの重み付けを定義するものではない。

---

# 12. Existing interpretation_profile Reuse Audit

Intent Layer導入時に、
既存 `interpretation_profile` をそのまま再利用できるか確認する。

---

## 12.1 state_profile

Semantic Stateとの責務が近い。

候補:

```text
REUSE可能性あり
```

ただしcoverageとkeyword精度は別途確認が必要。

---

## 12.2 decision_context

Semantic Decision Contextとの責務が近い。

候補:

```text
REUSE可能性あり
```

---

## 12.3 constraint_profile

Semantic Constraintとの責務が近い。

候補:

```text
REUSE可能性あり
```

---

## 12.4 outcome_hint

Semantic Outcomeとの責務が近い。

特に、

```text
move_forward
clarify
decide
calm
```

などとのcollisionがある。

候補:

```text
PARTIAL_REUSE可能性あり
```

---

## 12.5 action_intent

既存 `action_intent` は、

```text
visit
reflect
save
```

等を扱う。

これは、

```text
change
restore
connect
recover
act
```

等のSemantic Intentとは異なる。

したがって、

```text
action_intentをSemantic Intentとしてそのまま再利用
```

は責務衝突を起こす可能性が高い。

---

## 12.6 Reuse Finding

既存profile全体を、

```text
REUSE
```

として無条件利用することはできない。

一方、

```text
state_profile
decision_context
constraint_profile
outcome_hint
```

など利用可能な構造は存在する。

Mother Ship Decisionにより、

PARTIAL_REUSE

を採用する。

state_profile
decision_context
constraint_profile
outcome_hint

など、既存Semantic Modelと責務が近い構造は再利用候補とする。

一方、既存 action_intent は
Semantic Intentと責務が異なるため、
そのままSemantic Intentの格納先として再利用しない。

既存構造を壊さず、
意味が不足する部分のみ拡張する。

---

# 13. Candidate Architecture Re-evaluation

前監査で以下の3案を定義した。

```text
PURPOSE_SPECIFIC
SHARED
HYBRID
```

27候補の正規化結果を使って再評価する。

---

## 13.1 PURPOSE_SPECIFIC

例:

```text
career_change
career_recover
career_focus

love_connect
love_maintain
love_express

study_prepare
study_focus
study_persist
```

### Merit

* Purposeごとの意味が明確
* Evidence MappingをPurpose単位で管理しやすい
* `recover`等の意味差を保持しやすい

### Risk

* taxonomy数が急増する
* 同一意味を複数Purposeで重複管理する
* Concierge / Compass共有コストが増える
* `focus` / `prepare` / `protect`など実際に横断するCandidateを重複定義する

### Audit Status

```text
STILL_VALID
```

34ケースだけでは完全否定できない。

---

## 13.2 SHARED

例:

```text
Purpose = career
Intent = change

Purpose = study
Intent = focus

Purpose = family
Intent = prepare
```

### Merit

* 横断意味を共有できる
* Semantic Modelが単純
* Reason構造を共通化しやすい
* `focus / prepare / protect`の観測結果と整合する

### Risk

* `recover`などPurposeごとに意味・Evidenceが大きく異なる
* CorpusでCross-Purposeが実証されていないCandidateも多い
* Shared slugだけでEvidenceを決めると粗くなる

### Audit Status

```text
STILL_VALID
```

---

## 13.3 HYBRID

例:

```text
Shared:
change
focus
prepare
protect
recover

Purpose-specific:
protection / cleanse
love / reconnect
career / independence
```

### Merit

* 横断Intentを共有できる
* Purpose固有の意味も保持できる
* Evidence precisionを落としにくい

### Risk

* Shared / Specificの境界ルールが必要
* taxonomy governanceが複雑になる
* 実装者ごとの判断差が出やすい

### Audit Status

```text
STILL_VALID
```

---

# 14. Mother Ship Decision Packet

以下はMother Shipが明示的に選択する。

本監査では値を推測しない。

---

## D1. Intent Layer導入方式

候補:

```text
KEEP_CURRENT_NEED_ONLY
SHADOW_INTENT_FIRST
ADD_INTENT_LAYER
```

### KEEP_CURRENT_NEED_ONLY

現在の15 Needのみを維持する。

Known consequence:

```text
Love-A
新しい出会いがほしい

Love-B
今の恋人との関係を大切にしたい
```

等の同一Need内Intent差をRecommendationのload-bearing signalとして保持できない。

---

### SHADOW_INTENT_FIRST

IntentをSemantic Interpretationとして保持するが、

```text
Candidate Generation
Ranking
Score
```

にはまだ接続しない。

利用候補:

```text
QA
Analytics
Reason Preview
Recommendation Comparison
Intent Coverage Audit
```

---

### ADD_INTENT_LAYER

Intentをload-bearing Recommendation Signalへ直接接続する。

未解決事項:

```text
Candidate Registry
Need collision
Evidence Mapping
Multi Intent
Negation
Purpose / Intent boundary
```

が残っている。

---

### Decision

```text
Decision D1:
SHADOW_INTENT_FIRST
```

---

# 15. D2. Intent Taxonomy Structure

候補:

```text
PURPOSE_SPECIFIC
SHARED
HYBRID
```

Evidence:

```text
Cross-Purpose observed:
focus
prepare
protect

Partial:
maintain

Semantic reuse candidate only:
change
act
recover
restore
connect
express
rest
challenge
grow
reset
persist

Purpose-specific observed:
cleanse
```

この結果だけでは、
3案のいずれかを自動選択しない。

### Decision

```text
Decision D2:
HYBRID
```

---

# 16. D3. Multi Intent

候補:

```text
SINGLE
PRIMARY_SECONDARY
MULTI_UNORDERED
```

Observed multiple-intent cases:

```text
Career-B
change + act

Family-C
prepare + protect

Protect-A
cleanse + reset

Focus-A
focus + persist
```

`SINGLE` を選択する場合、
どのIntentを残すかというpriority ruleが別途必要になる。

### Decision

```text
Decision D3:
PRIMARY_SECONDARY
```

---

# 17. D4. Existing interpretation_profile

候補:

```text
REUSE
PARTIAL_REUSE
NEW_FIELD
```

Known finding:

```text
state_profile
decision_context
constraint_profile
outcome_hint
```

はSemantic Modelとの親和性がある。

一方、

```text
action_intent
```

はSemantic Intentとは責務が異なる。

### Decision

```text
Decision D4:
PARTIAL_REUSE
```
---

# 18. D5. Ranking Connection

本監査では決定しない。

将来候補:

```text
EXPLANATION_ONLY
TIE_BREAK_ONLY
RANKING_SIGNAL
CANDIDATE_SIGNAL
```

現在:

```text
Decision D5:
DEFERRED
```

---

# 19. D6. Current Need Relationship

Intent Layerを導入したとしても、
既存 `need_tag` をこの監査内で置換しない。

現時点:

```text
CURRENT_NEED_RUNTIME_CONTRACT = PRESERVE
```

将来的に、

```text
courage
focus
rest
mental
protection
communication
```

の責務をSemantic Layerと再整理する場合は、
別監査・別PRとする。

---

# 20. Mother Ship Decision Form

Mother Shipは最終的に以下を1値ずつ指定する。

```text
D1 Intent Layer:
SHADOW_INTENT_FIRST

D2 Taxonomy:
HYBRID

D3 Multi Intent:
PRIMARY_SECONDARY

D4 interpretation_profile:
PARTIAL_REUSE

D5 Ranking:
DEFERRED
```

複数候補をslash付きのままDecision値として記録しない。

各Decisionは、
Mother Shipが明示的に1つ選択するまで、

```text
UNRESOLVED
```

とする。

---

# 21. Decision Gate

現時点:

```text
D1_INTENT_LAYER = SHADOW_INTENT_FIRST
D2_TAXONOMY = HYBRID
D3_MULTI_INTENT = PRIMARY_SECONDARY
D4_INTERPRETATION_PROFILE = PARTIAL_REUSE
D5_RANKING = DEFERRED
```

Decision未確定の状態では、

```text
Intent Runtime Implementation
Ranking Integration
Score Integration
Candidate Generation Integration
```

へ進まない。

---

# 22. Acceptance Criteria

本監査完了条件:

```text
1. 27 Intent Candidateが全件分類されている
2. Candidate数のreconciliationが27件で一致する
3. Shared CandidateとObserved Cross-Purposeを区別している
4. Purpose-specific Candidateが記録されている
5. Merge Candidateが記録されている
6. State / Decision / Outcome移動候補が記録されている
7. Evidence不足Candidateが記録されている
8. Current Need collisionが記録されている
9. Multi Intent実例が記録されている
10. interpretation_profile再利用範囲が記録されている
11. Mother Ship Decision D1-D4が明示されている
12. Ranking DecisionがDEFERREDである
13. Ranking変更がない
14. Score変更がない
15. Mapping変更がない
16. Production変更がない
```

---

# 23. TODO

```markdown
- [x] Parent Intent Variation Auditを正本として固定
- [x] 27 Intent Candidateを抽出
- [x] Normalization Statusを定義
- [x] 27 Candidateを全件分類
- [x] Shared Candidateを抽出
- [x] Purpose-specific Candidateを抽出
- [x] Merge Candidateを抽出
- [x] Move to Other Signal Candidateを抽出
- [x] Insufficient Evidence Candidateを抽出
- [x] Unresolved Candidateを抽出
- [x] Candidate countを27件へreconcile
- [x] Observed Cross-Purpose Evidenceを整理
- [x] Semantic reuseとObserved reuseを分離
- [x] Current Need collisionを整理
- [x] Intent Family collisionを整理
- [x] Multi Intent実例を整理
- [x] interpretation_profile再利用範囲を整理
- [x] Candidate Architecture A/B/Cを再評価
- [x] Mother Ship Decision Packetを作成
- [x] Mother Ship D1 = SHADOW_INTENT_FIRST を確定
- [x] Mother Ship D2 = HYBRID を確定
- [x] Mother Ship D3 = PRIMARY_SECONDARY を確定
- [x] Mother Ship D4 = PARTIAL_REUSE を確定
- [x] D5 Ranking DecisionをDEFERREDとして固定
- [x] Decision結果を本文へ反映
- [ ] 文書最終レビュー
- [ ] PR作成
- [ ] STOP
```

---

# 24. Expected Output

本監査終了時に以下を正本として残す。

```text
Normalized Intent Candidate Registry
Observed Cross-Purpose Evidence Matrix
Current Need Collision Registry
Intent Family Collision Registry
Multi Intent Observation
interpretation_profile Reuse Audit
Candidate Architecture Re-evaluation
Mother Ship Decision Packet
```

実装PRは本監査と分離する。

---

# 25. Current Status

```text
INTENT_CANDIDATE_NORMALIZATION = COMPLETE
NORMALIZED_CANDIDATE_COUNT = 27

KEEP_SHARED_CANDIDATE = 15
KEEP_PURPOSE_SPECIFIC_CANDIDATE = 1
MERGE_CANDIDATE = 1
MOVE_TO_OTHER_SIGNAL = 4
INSUFFICIENT_EVIDENCE = 2
UNRESOLVED = 4

D1_INTENT_LAYER = SHADOW_INTENT_FIRST
D2_TAXONOMY = HYBRID
D3_MULTI_INTENT = PRIMARY_SECONDARY
D4_INTERPRETATION_PROFILE = PARTIAL_REUSE
D5_RANKING = DEFERRED

CURRENT_NEED_RUNTIME_CONTRACT = PRESERVE

RANKING_CHANGE = NONE
SCORE_CHANGE = NONE
MAPPING_CHANGE = NONE
PRODUCTION_CHANGE = NONE
```
