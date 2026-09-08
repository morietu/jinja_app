# Intent Variation Definition v1

> **Status: AUDIT / DEFINITION ONLY**
>
> 本文書は、KAMI MUSUBI の Concierge / Compass が共有する Purpose に対して、
> **同一Purpose内で異なるユーザー意図をどのように表現するか**を監査・定義するための文書である。
>
> 本文書では Ranking / Score / Need → Goriyaku Mapping / Production Data / API Contract を変更しない。Intent
> Variation の候補は設計案であり、明示的に `APPROVED` とされるまでは Recommendation の正本ロジックとして扱わない。
>
> Audit base: `origin/develop` = `4e6d6df4` 以降

---

# 1. Purpose

## 1.1 この監査の目的

現行KAMI MUSUBIでは、ユーザーの相談を主に `need_tag` によって分類している。

例:

```text
転職について相談したい
→ career

復縁したい
→ love

試験に合格したい
→ study
```

この構造は「何について相談しているか」を捉えるには有効だが、

```text
career
```

だけでは、

```text
転職したい
昇進したい
独立したい
今の仕事を続けるか迷っている
仕事で疲れて立て直したい
一歩踏み出したい
```

の差を十分に表現できない。

本監査では、

```text
Purpose
= 何について相談しているか

Intent Variation
= そのPurposeについて、どうしたいのか
```

として分離し、Recommendation が同一Purpose内の意味差を保持できる構造を検討する。

---

# 2. Problem Statement

## 2.1 現行Recommendationの特徴

現行の相談解釈は主に以下の信号を持つ。

```text
free text
  ↓
need_tag
  ↓
consultation_axis
  ↓
Need → GoriyakuTag
  ↓
Evidence
  ↓
score / ranking / reason
```

現行監査では、相談Interpreterについて以下が確認されている。

- Topicの認識は比較的強い
- Stateの認識は部分的
- Intentionの認識は弱い
- Negationは十分に扱えていない
- 同一Purpose内の意味差が `need_tag` に圧縮される場合がある

また `interpretation_profile` には既に以下の横断signalが存在する。

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

しかし現時点では、これらの多くは Recommendation Ranking / `score_need` / primary
Reason に対して主要な入力ではなく、shadowまたは補助的な利用に留まる。

したがって本監査では、新しい概念を無条件に追加するのではなく、

**既存の相談理解signalを整理し、Intent Variationとして何を独立して扱うべきか**

を確認する。

---

# 3. Non-Goals

本監査では以下を行わない。

- Ranking weight変更
- Recommendation Score変更
- Candidate Generation変更
- Need → GoriyakuTag Mapping変更
- Goriyaku canonical registry変更
- Shrine Knowledge変更
- Base Shrine Seed変更
- `visit_style_tags`変更
- Concierge API変更
- Compass API変更
- Frontend変更
- Mobile変更
- Production DB変更
- Render設定変更
- Astrology / 九星 / 方位ロジック追加
- LLMによる新taxonomy自動生成

Intent候補が見つかっても、本監査内では直接Recommendationへ反映しない。

---

# 4. Current Source of Truth

## 4.1 Purpose / Need

現行のload-bearingなPurpose表現は、

```text
backend/temples/domain/need_tags.py
```

の `NEED_TAGS` とする。

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

優先順位は `NEED_PRIORITY` で管理される。

---

## 4.2 Compass

Compassは新しいPurpose taxonomyを作らず、同じ15 `need_tag` を再利用する。

Frontend:

```text
apps/web/src/features/compass/compassPurposes.ts
```

表示ラベル:

| Purpose       | Label        |
| ------------- | ------------ |
| love          | 恋愛         |
| relationship  | 人間関係     |
| marriage      | 縁結び・結婚 |
| communication | 対話・発信   |
| career        | 転機・仕事   |
| money         | 金運         |
| study         | 学業・合格   |
| health        | 健康         |
| mental        | 不安・心     |
| protection    | 厄除け・守り |
| courage       | 前進・後押し |
| focus         | 集中・継続   |
| rest          | 休息         |
| family        | 子宝・家族   |
| travel_safe   | 移動・安全   |

したがってIntent Variationを導入する場合でも、

```text
Concierge Purpose
Compass Purpose
```

を別taxonomyに分裂させないことを基本方針候補とする。

---

# 5. Definition

## 5.1 Purpose

Purposeは、

**相談対象となっている主題・領域**

を表す。

例:

```text
恋愛
仕事
金運
学業
健康
人間関係
```

Purposeは可能な限り、

```text
何について？
```

に答える。

---

## 5.2 Intent

Intentは、

**そのPurposeについてユーザーが望んでいる変化・方向・行為**

を表す。

Intentは、

```text
どうしたい？
```

に答える。

例:

```text
Purpose = career

転職したい
→ change

昇進したい
→ growth

独立したい
→ independence

続けるか迷っている
→ decision

一歩踏み出したい
→ action
```

ただし上記slugは現時点では候補であり、正本ではない。

---

# 6. Intentと他Signalの境界

Intent Variationを定義する際、以下をIntentへ混在させない。

---

## 6.1 State

Stateは、

**今どういう状態か**

を表す。

例:

```text
疲れている
不安
迷っている
焦っている
落ち込んでいる
```

例:

```text
転職したいけど疲れている
```

は、

```text
Purpose
career

Intent
change

State
fatigue
```

として扱う候補とする。

`fatigue` を `career` 固有Intentにはしない。

---

## 6.2 Decision Context

Decision Contextは、

**選択や判断の必要性が存在するか**

を表す。

例:

```text
今の会社を続けるか辞めるか迷っている
```

候補構造:

```text
Purpose
career

Intent
change? / stay?

Decision Context
choice_required
```

「判断したい」をIntentにするかDecision Contextに残すかは本監査のDecision Pointとする。

---

## 6.3 Outcome

Outcomeは、

**最終的にどうなりたいか**

を表す。

例:

```text
独立して自由に働きたい
```

候補:

```text
Purpose
career

Intent
independence

Outcome
autonomy
```

IntentとOutcomeを同一視しない。

---

## 6.4 Constraint

Constraintは、

**提案に対する現実的制約**

を表す。

例:

```text
遠くには行けない
今日は1時間しかない
人混みは避けたい
```

これはIntentではない。

---

## 6.5 Visit Preference

例:

```text
静かな神社
自然が多い
人が少ない
昔ながら
```

は、

```text
visit_style_tags
```

などの参拝体験条件であり、Purpose内Intentとは分離する。

---

## 6.6 Cross Need

相談文に複数Needが存在する場合は、一方をもう一方のIntentへ吸収しない。

例:

```text
独立したいけど、一歩踏み出す勇気がほしい
```

候補:

```text
Primary Purpose
career

Intent
independence

Cross Need
courage

State
hesitation
```

`courage` を `career/action` に完全統合するかは慎重に扱う。

---

# 7. Horizontal Interpretation Model

目標とする相談理解構造の候補:

```text
Consultation
    │
    ├─ Purpose
    │    └─ 何について
    │
    ├─ Intent
    │    └─ どうしたい
    │
    ├─ State
    │    └─ 今どういう状態
    │
    ├─ Decision Context
    │    └─ 判断が必要か
    │
    ├─ Outcome
    │    └─ どうなりたい
    │
    ├─ Constraint
    │    └─ 現実的制約
    │
    ├─ Cross Need
    │    └─ 同時に存在する別Need
    │
    └─ Visit Preference
         └─ どんな参拝体験を望むか
```

Purposeを縦軸とした場合、

Intent / State / Outcome / Decision / Constraintは

**Purposeを横断する意味レイヤー**

として扱う可能性を検証する。

---

# 8. Existing Consultation Corpus

既存 `recommendation-nuance-quality-audit.md` には、34件の自然言語Consultation Caseが存在する。

既存分類:

```text
Career       6
Love         5
Family       4
Mental/Rest  4
Negation     5
Theme        3
Other        7
----------------
Total       34
```

本監査では新しい相談文を先に発明せず、まずこの34ケースを再利用する。

## 8.1 First Structural Finding — `need_tag` is not a homogeneous Purpose taxonomy

34 Consultation CasesをIntent Variationの観点から再読した結果、現行15 `need_tag`
は意味的に同一種類のtaxonomyではないことが確認された。

これは既存runtime契約を否定するものではない。

`need_tag` はRecommendation runtime上のcanonical signalとして維持されているが、Intent Variation設計において全15
tagをそのまま「何について」を表すPurposeとして扱うと、Topic / State / Intentが二重化する可能性がある。

初期分類:

| need_tag      | Semantic tendency     | Audit note                                 |
| ------------- | --------------------- | ------------------------------------------ |
| love          | Topic-like            | 恋愛について                               |
| relationship  | Topic-like            | 人間関係について                           |
| marriage      | Topic-like            | 結婚・夫婦について                         |
| communication | Topic / Action mixed  | 対話という領域と「伝える」という行為が混在 |
| career        | Topic-like            | 仕事・キャリアについて                     |
| money         | Topic-like            | お金・事業について                         |
| study         | Topic-like            | 学習・試験について                         |
| health        | Topic-like            | 健康について                               |
| mental        | State-heavy           | 不安・疲労・落ち込み等の状態を多く保持     |
| protection    | Goal / Intent-heavy   | 守られたい・清めたい等                     |
| courage       | Intent-heavy          | 踏み出したい・挑戦したい等                 |
| focus         | Intent-heavy          | 集中・継続したい等                         |
| rest          | State / Intent mixed  | 疲労状態と休息希望が混在                   |
| family        | Topic-like but narrow | 現行runtimeでは主に子宝・安産・育児        |
| travel_safe   | Topic / Goal mixed    | 移動というTopicと安全というOutcomeが結合   |

### Consequence

Intent Variation v1では、

```text
current need_tag
=
runtime recommendation signal
```

と、

```text
semantic Purpose
=
何について相談しているか
```

を同一視しない。

34ケース分類では以下を別々に記録する。

```text
Semantic Purpose
Intent Candidate
State
Decision Context
Outcome
Current Runtime Need
```

Semantic Purposeが明示されていない相談では、既存15 Purposeのいずれかへ無理に割り当てず、

```text
UNSPECIFIED
```

を許容する。

また、現行15 NeedではTopic自体を表現できない場合は、

```text
UNREPRESENTED_TOPIC
```

として記録する。

例:

```text
「背中を押してほしい」

Semantic Purpose:
UNSPECIFIED

Intent:
act / move_forward

Current Runtime Need:
courage
```

この区別によって、

```text
Purpose = 何について
Intent = どうしたい
State = 今どういう状態
```

というHorizontal Interpretation Modelを維持する。

---

# 9. Classification Procedure

各ケースについて以下を記録する。

| Field                  | Question                   |
| ---------------------- | -------------------------- |
| Consultation           | 元相談文                   |
| Purpose                | 何について話しているか     |
| Intent Candidate       | どうしたいか               |
| State                  | 今どんな状態か             |
| Decision Context       | 判断が必要か               |
| Outcome                | どうなりたいか             |
| Constraint             | 制約はあるか               |
| Cross Need             | 他Needが共存しているか     |
| Negation               | 否定・優先順位表現があるか |
| Current Runtime Result | 現行 need_tags / axis      |
| Loss Point             | どこで意味が失われるか     |

---

# 10. Initial Intent Candidate Principles

Intent candidateは以下を満たすものを優先する。

## 10.1 Purposeをまたいで再利用可能

例:

```text
change
growth
restore
protect
decide
release
prepare
recover
act
connect
```

同じ意味が複数Purposeで利用可能なら、Purpose固有slugを乱立させない。

---

## 10.2 Stateではない

NG候補:

```text
anxious
tired
sad
confused
```

これらはState候補。

---

## 10.3 Outcomeだけではない

例:

```text
happy
successful
peaceful
```

は抽象的すぎるためIntentにはしない。

---

## 10.4 神社taxonomyではない

Intentはユーザー側の意味であり、

```text
縁結び
商売繁盛
厄除け
学業成就
```

などのGoriyaku分類そのものにはしない。

---

## 10.5 Recommendation Evidenceと分離する

```text
Intent
= ユーザーがどうしたいか

Evidence
= 神社側がなぜそのIntentに適合するのか
```

を分離する。

---

# 11. Preliminary Purpose × Intent Hypotheses

以下は監査開始時点の**仮説**であり、APPROVED taxonomyではない。

---

## 11.1 career

Consultation examples:

```text
転職したい
昇進したい
独立したい
仕事を続けるか迷っている
環境を変えたい
一歩踏み出したい
```

Candidate Intent:

| Candidate    | Meaning              |
| ------------ | -------------------- |
| change       | 環境・仕事を変えたい |
| growth       | 成長・昇進したい     |
| independence | 独立・自立したい     |
| decision     | 選択をしたい         |
| action       | 行動へ移したい       |
| recover      | 立て直したい         |

Audit注意:

`recover` はState / restとの境界を確認する。

`action` は `courage` との重複を確認する。

`decision` は Decision Contextへの移動も検討する。

---

## 11.2 love

Candidate Intent:

| Candidate | Meaning                  |
| --------- | ------------------------ |
| connect   | 新しい縁・関係を作りたい |
| reconnect | 復縁・再接続したい       |
| deepen    | 関係を深めたい           |
| release   | 手放して次へ進みたい     |
| express   | 気持ちを伝えたい         |

Audit注意:

`express` は `communication` と重複する可能性。

`connect` は `marriage` との境界確認が必要。

---

## 11.3 marriage

Candidate Intent:

| Candidate | Meaning                  |
| --------- | ------------------------ |
| connect   | 良縁を得たい             |
| commit    | 結婚へ進みたい           |
| restore   | 夫婦関係を整えたい       |
| prepare   | 結婚・家庭形成へ備えたい |

Audit注意:

`connect` はloveとの境界。

`restore` はrelationshipとの境界。

---

## 11.4 relationship

Candidate Intent:

| Candidate | Meaning              |
| --------- | -------------------- |
| restore   | 関係を修復したい     |
| ease      | 摩擦を減らしたい     |
| connect   | 関係性を作りたい     |
| distance  | 適切な距離を取りたい |

`distance` は候補。既存相談Corpusに十分なEvidenceがあるか確認する。

---

## 11.5 communication

Candidate Intent:

| Candidate  | Meaning              |
| ---------- | -------------------- |
| express    | 伝えたい             |
| understand | 相手を理解したい     |
| negotiate  | 交渉・調整したい     |
| present    | 発信・プレゼンしたい |

---

## 11.6 money

Candidate Intent:

| Candidate | Meaning                |
| --------- | ---------------------- |
| grow      | 収入・売上を増やしたい |
| stabilize | お金を安定させたい     |
| protect   | 資産・生活を守りたい   |
| expand    | 商売・事業を広げたい   |
| recover   | 経済状態を立て直したい |

Audit注意:

`protect` は protection Need と区別する。

---

## 11.7 study

Candidate Intent:

| Candidate | Meaning                |
| --------- | ---------------------- |
| achieve   | 合格・成果を得たい     |
| learn     | 学びたい               |
| improve   | 成績・能力を伸ばしたい |
| persist   | 継続したい             |
| prepare   | 試験へ備えたい         |

`persist` はfocusとの重複を確認する。

---

## 11.8 health

Candidate Intent:

| Candidate  | Meaning                |
| ---------- | ---------------------- |
| recover    | 回復したい             |
| maintain   | 健康を保ちたい         |
| strengthen | 体力・状態を整えたい   |
| protect    | 健康上の無事を願いたい |

医学的な診断・治療効果をRecommendation Reasonとして断定しない。

---

## 11.9 mental

Candidate Intent:

| Candidate | Meaning                |
| --------- | ---------------------- |
| steady    | 心を整えたい           |
| release   | 不安・重さを手放したい |
| recover   | 気持ちを立て直したい   |
| clarify   | 気持ちを整理したい     |

Audit注意:

mentalはStateとの混同リスクが高い。

---

## 11.10 protection

Candidate Intent:

| Candidate | Meaning                |
| --------- | ---------------------- |
| protect   | 守りを求める           |
| cleanse   | 清めたい               |
| reset     | 悪い流れを切り替えたい |
| prevent   | 災難を避けたい         |

宗教的・心理的効果を断定しない。

---

## 11.11 courage

Candidate Intent:

| Candidate | Meaning          |
| --------- | ---------------- |
| act       | 一歩踏み出したい |
| challenge | 挑戦したい       |
| decide    | 決断したい       |
| change    | 流れを変えたい   |

Purposeというより横断Intentに近い可能性が高いため、Intent Layer導入時に `courage` Need自体との役割重複を重点監査する。

---

## 11.12 focus

Candidate Intent:

| Candidate | Meaning            |
| --------- | ------------------ |
| focus     | 集中したい         |
| persist   | 継続したい         |
| restart   | 習慣を立て直したい |
| complete  | やり切りたい       |

---

## 11.13 rest

Candidate Intent:

| Candidate | Meaning              |
| --------- | -------------------- |
| rest      | 休みたい             |
| recover   | 回復したい           |
| reset     | 日常から切り替えたい |
| slow_down | 落ち着きたい         |

State / Visit Preferenceとの境界を重点監査する。

---

## 11.14 family

現行 `family` は名称だけでは意味範囲が広く見えるが、実際のkeywordは主に、

```text
子宝
安産
妊活
授かり
出産
育児
```

を扱う。

Candidate Intent:

| Candidate | Meaning            |
| --------- | ------------------ |
| conceive  | 授かりを願う       |
| protect   | 安産・無事を願う   |
| prepare   | 出産・育児へ備える |
| support   | 家族を支えたい     |

`family relationship` をここへ含めるかは決めない。現行実装ではrelationship側との意味差を確認する必要がある。

---

## 11.15 travel_safe

Candidate Intent:

| Candidate   | Meaning          |
| ----------- | ---------------- |
| protect     | 移動の安全を願う |
| prepare     | 旅・出張へ備える |
| return_safe | 無事に戻りたい   |

Intentを細分化するだけのEvidenceが十分存在するかを確認する。

---

# 12. Cross-Purpose Intent Candidates

Purposeごとの仮説を並べると、重複するIntentが見える。

初期候補:

```text
change
grow
connect
restore
release
protect
prepare
recover
decide
act
persist
express
stabilize
```

これらがPurpose横断Intentとして成立するかを確認する。

例:

```text
career × change
mental × change
courage × change

love × restore
relationship × restore
marriage × restore

health × recover
mental × recover
rest × recover
money × recover
```

同じslugでも意味が著しく異なる場合は、無理に共通化しない。

---

# 13. Candidate Architecture

## Option A: Purpose-specific Intent

```text
career_change
career_growth
career_independence

love_reconnect
love_release
love_connect
```

### Merit

- 意味が明確
- collisionしにくい

### Risk

- taxonomyが急速に増える
- 横断意味を共有しにくい
- Concierge / Compass両方で管理コストが高い

---

## Option B: Shared Intent Layer

```text
Purpose = career
Intent = change

Purpose = love
Intent = restore

Purpose = health
Intent = recover
```

### Merit

- 横断的な相談理解が可能
- 共通Reason構造を作りやすい
- interpretation_profileとの親和性が高い

### Risk

- 同じIntent名がPurposeごとに異なる意味になる可能性
- Evidence mappingを単純化しすぎる危険

---

## Option C: Hybrid

```text
Shared Intent
+
Purpose-specific Intent
```

例:

```text
shared:
change
restore
recover
protect
prepare
act

career-specific:
independence

love-specific:
reconnect
```

本監査ではA/B/Cを比較する。選定はMother Ship Decisionとする。

---

# 14. Primary / Secondary Intent

一つの相談文に複数Intentが存在する場合がある。

例:

```text
独立したいけど、
今の仕事を辞める決断ができず、
一歩踏み出す勇気がほしい
```

候補:

```text
Purpose
career

Primary Intent
independence

Secondary Intent
decision
action

Cross Need
courage

State
hesitation
```

検証項目:

- Intentは1つに絞るべきか
- Primary + Secondaryを許容するか
- Secondary上限は必要か
- NeedTag max 3との関係
- priority orderでユーザー意図を潰さないか

本監査では実装しない。

---

# 15. Negation

Intent Variation導入時も、Negation処理を無視してはならない。

例:

```text
恋愛の相談ではない
```

`love` として扱わない必要がある。

例:

```text
結婚より今は仕事を優先したい
```

単純keywordでは、

```text
marriage
career
```

の両方がhitする可能性がある。

しかしユーザー意図は、

```text
Primary
career

De-emphasized
marriage
```

である。

Intent層を追加するだけではNegation問題は解決しない。

Negationは独立Decision Pointとして記録する。

---

# 16. Evidence Relationship

IntentをRecommendationへ将来接続する場合でも、

```text
Intent
→ 神社を直接断定
```

とはしない。

候補構造:

```text
Purpose
+
Intent
+
State
+
Outcome
        ↓
Evidence Query / Interpretation
        ↓
Shrine Knowledge
        ↓
Recommendation
        ↓
Reason
```

Recommendation Reasonは、

```text
あなたは career/change だからこの神社
```

ではなく、

```text
仕事環境を変えたいという相談意図と、
この神社に登録された再出発・転機に関するEvidenceが重なるため候補とした
```

のように、実際のEvidenceを根拠とする。

---

# 17. Concierge / Compass Boundary

## Concierge

ConciergeではIntentを、

**相談内容の意味解釈**

として利用する候補。

```text
Purpose
Intent
State
Decision
Outcome
```

を比較的深く扱う。

---

## Compass

Compassでは同じIntent Layerを利用可能だが、Conciergeと同じ重みで扱うとは限らない。

Compassは、

```text
Purpose
+
Intent
+
現在地
+
方向
+
距離
+
Visit Preference
+
Eligibility
```

の組み合わせ候補となる。

例:

```text
Purpose
career

Intent
change

Direction
east

Visit Preference
quiet
```

Concierge / CompassはIntent taxonomyを共有しても、Recommendation weightまで共有する必要はない。

---

# 18. 34 Consultation Intent Classification Matrix

以下のIntentはAUDIT CANDIDATEであり、runtime taxonomyまたはRecommendation Rankingへまだ採用しない。

| ID        | Semantic Purpose                       | Intent Candidate                 | State                        | Decision / Outcome             | Cross Need  | Negation               | Current Runtime                                  | First Loss    |
| --------- | -------------------------------------- | -------------------------------- | ---------------------------- | ------------------------------ | ----------- | ---------------------- | ------------------------------------------------ | ------------- |
| Career-A  | career                                 | `change`                         | —                            | move_forward / new_environment | —           | —                      | `career` / career_change                         | NONE          |
| Career-B  | career                                 | `change` + `act`                 | anxious / fear               | move_forward                   | courage     | —                      | `career,courage` / career_change                 | INTERPRETER   |
| Career-C  | career                                 | `continue` candidate             | confidence_loss              | continue_or_change未確定       | mental      | —                      | `career,mental` / career_change                  | NEED→GORIYAKU |
| Career-D  | career                                 | `recover` / `steady` candidate   | overwhelmed / restless       | calm                           | rest        | —                      | `career,rest` / career_change                    | NEED→GORIYAKU |
| Career-E  | career                                 | `focus`                          | difficulty_focusing          | improve_focus                  | focus       | —                      | `career,focus` / study_success                   | AXIS/MULTI    |
| Career-F  | relationship                           | `restore` / `ease`               | strain                       | better_relationship            | —           | —                      | `relationship` / relationship_repair             | NEED→GORIYAKU |
| Love-A    | love                                   | `connect`                        | —                            | new_connection                 | —           | —                      | `love` / relationship_repair                     | NONE          |
| Love-B    | love                                   | `maintain` / `nurture` candidate | —                            | preserve_relationship          | —           | —                      | `love` / relationship_repair                     | INTERPRETER   |
| Love-C    | marriage                               | `decide` candidate               | uncertain                    | decision_required              | —           | —                      | `marriage` / relationship_repair                 | NONE          |
| Love-D    | love                                   | `express`                        | hesitation                   | communicate_feeling            | courage     | —                      | `communication,courage` / restart_mindset        | NEED→GORIYAKU |
| Love-E    | love                                   | `release` + `clarify` candidate  | lingering / grief-like state | closure / clarity              | —           | —                      | `[]` / other                                     | INTERPRETER   |
| Family-A  | UNREPRESENTED_TOPIC: family_wellbeing  | `maintain` / `steady`            | —                            | peaceful_family                | rest        | —                      | `relationship,rest` / rest_healing               | PURPOSE/NEED  |
| Family-B  | UNREPRESENTED_TOPIC: parenting_concern | `protect` / `care` candidate     | anxious                      | child_wellbeing                | —           | —                      | `[]` / other                                     | INTERPRETER   |
| Family-C  | family                                 | `prepare` + `protect`            | anxious                      | safe_birth                     | mental      | —                      | `family,mental` / restart_mindset                | NEED→GORIYAKU |
| Family-D  | relationship                           | `restore` / `ease`               | uncertain / troubled         | better_relationship            | —           | —                      | `relationship` / relationship_repair             | NEED→GORIYAKU |
| MR-A      | mental                                 | `steady`                         | restless                     | calm                           | rest        | —                      | `rest` / rest_healing                            | NEED→GORIYAKU |
| MR-B      | UNSPECIFIED                            | `recover` + `rest`               | exhausted                    | recovery                       | mental/rest | —                      | `mental,rest` / rest_healing                     | NEED→GORIYAKU |
| MR-C      | UNSPECIFIED                            | `rest`                           | tired                        | recovery                       | rest        | —                      | `rest` / rest_healing                            | NEED→GORIYAKU |
| MR-D      | UNSPECIFIED                            | `move_forward` / `act`           | anxious                      | move_forward                   | mental      | —                      | `mental` / restart_mindset                       | INTERPRETER   |
| Neg-1     | UNSPECIFIED                            | —                                | —                            | —                              | —           | excludes love          | `love` / relationship_repair                     | NEGATION      |
| Neg-2     | UNSPECIFIED                            | —                                | —                            | —                              | —           | excludes career_change | `career` / career_change                         | NEGATION      |
| Neg-3     | UNSPECIFIED                            | TBD                              | uncertain                    | decision_context               | —           | excludes anxiety       | `mental` / restart_mindset                       | NEGATION      |
| Neg-4     | career                                 | `prioritize` candidate           | —                            | career_priority                | —           | de-emphasizes marriage | `marriage,career` / relationship_repair          | NEGATION      |
| Neg-5     | UNSPECIFIED                            | `change`                         | ready_to_change              | change_environment             | —           | de-emphasizes rest     | `rest` / rest_healing                            | NEGATION      |
| Theme-1   | career                                 | `challenge`                      | —                            | growth / new_work              | courage     | —                      | `career,courage` / career_change                 | AXIS/MULTI    |
| Theme-2   | UNSPECIFIED                            | `rest` + `recover`               | tired                        | recovery                       | mental      | —                      | `mental,rest` / rest_healing                     | NEED→GORIYAKU |
| Theme-3   | career                                 | `prioritize` candidate           | uncertain                    | career_priority                | —           | de-emphasizes love     | `love,career` / relationship_repair              | NEGATION      |
| Money-A   | money                                  | `grow`                           | —                            | increased_income               | —           | —                      | `money` / money_growth                           | NONE          |
| Study-A   | study                                  | `achieve` + `prepare`            | —                            | exam_success                   | —           | —                      | `study` / study_success                          | NONE          |
| Travel-A  | travel_safe                            | `protect`                        | —                            | safe_travel                    | —           | —                      | `relationship,travel_safe` / relationship_repair | AXIS/MULTI    |
| Health-A  | health                                 | `maintain`                       | —                            | longevity                      | —           | —                      | `health` / other                                 | PURPOSE/NEED  |
| Protect-A | protection                             | `cleanse` + `reset`              | stuck / bad_flow candidate   | protection / reset             | —           | —                      | `protection,mental` / restart_mindset            | NONE          |
| Courage-A | UNSPECIFIED                            | `act` / `move_forward`           | hesitation implied           | move_forward                   | courage     | —                      | `courage` / restart_mindset                      | NEED→GORIYAKU |
| Focus-A   | study                                  | `focus` + `persist`              | —                            | continue_study                 | focus       | —                      | `study,focus` / study_success                    | NONE          |

---

## 18.1 Initial Intent Candidate Registry derived from the 34 cases

34ケースから直接観測できるIntent Candidateを重複排除すると、初期候補は以下となる。

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

これはcanonical registryではない。

次工程で以下を行う。

1. 同義語を統合する
2. State / Outcome / Decisionへ移すべきcandidateを除外する
3. Purpose横断で意味が維持されるcandidateを抽出する
4. 1ケースしか存在しないcandidateを評価する
5. Purpose-specificに残すべきcandidateを抽出する

---

## 18.2 Immediate Collision Findings

### `decide`

```text
Intent
```

として扱う可能性と、

```text
decision_context
```

として扱う可能性が衝突する。

現時点では未確定。

---

### `recover`

以下を横断する。

```text
career
mental
rest
health
money
```

ただし、

```text
仕事を立て直す
身体的に回復する
疲労から回復する
経済状態を立て直す
```

ではEvidenceが異なるため、shared Intentとして成立するか追加検証が必要。

---

### `protect`

以下を横断する可能性がある。

```text
family
health
travel_safe
protection
money
```

しかし `protection` 自体が現行Needであるため、Intent Layerを追加すると意味が二重化する可能性がある。

---

### `act / move_forward / challenge`

現行 `courage` Needと強く重複する。

この結果は、

```text
courage
```

がTopic PurposeというよりHorizontal Intentとして振る舞っている可能性を示す。

---

### `focus / persist`

現行 `focus` Needと重複する。

さらに現行Evidenceは `study` と同一であるため、

```text
Purpose = study
Intent = focus
```

という構造の方が意味的に自然なケースが存在する。

ただし `focus` Need自体を廃止・変更する判断は本監査では行わない。

---

### `rest / recover / steady`

現行 `rest` / `mental` Needとの境界が大きく重なる。

したがってIntent Layer導入前に、

```text
State
Intent
Current Need
```

の責務分離が必要。

---

## 18.3 First Audit Verdict

34ケースの初期分類から、

```text
Purpose-specific Intent taxonomy
```

だけを増築する案には構造的な重複リスクがある。

観測結果はむしろ、

```text
Semantic Topic
+
Horizontal Intent
+
State
+
Decision
+
Outcome
```

という構造の検証を支持する。

ただし、

```text
ADD_INTENT_LAYER
SHARED
HYBRID
```

のいずれもまだAPPROVEDしない。

現行 `need_tag` はruntime contractとして維持し、Intent Variationはshadow/audit layerとして引き続き評価する。

```text
INTENT_VARIATION_34_CASE_CLASSIFICATION = COMPLETE
INTENT_TAXONOMY_DECISION = OPEN
RANKING_CHANGE = NONE
SCORE_CHANGE = NONE
MAPPING_CHANGE = NONE
PRODUCTION_CHANGE = NONE
```

---

# 19. Evaluation Questions

各Intent Candidateについて以下を確認する。

## Semantic

- PurposeではなくIntentになっているか
- Stateと混ざっていないか
- Outcomeと混ざっていないか
- Cross Needと混ざっていないか
- Visit Preferenceと混ざっていないか

## Coverage

- 既存34ケースに複数回出現するか
- 1ケース専用taxonomyになっていないか
- 他Purposeでも再利用可能か

## Recommendation

- 神社Evidenceと接続可能か
- 現行history_themeで扱えるか
- Goriyakuだけでは表現できない意味か
- Reasonの説明力を高めるか

## Architecture

- existing `interpretation_profile`を再利用可能か
- 新しいfield追加が本当に必要か
- Concierge / Compassで共有可能か
- Purpose taxonomyを破壊しないか

---

# 20. Decision Gates

## D1. Intent Layerを作るか

候補:

```text
KEEP_CURRENT_NEED_ONLY
ADD_INTENT_LAYER
SHADOW_INTENT_FIRST
```

---

## D2. Intent Taxonomy構造

候補:

```text
PURPOSE_SPECIFIC
SHARED
HYBRID
```

---

## D3. Multi Intent

候補:

```text
SINGLE
PRIMARY_SECONDARY
MULTI_UNORDERED
```

---

## D4. Existing interpretation_profile

候補:

```text
REUSE
PARTIAL_REUSE
NEW_FIELD
```

---

## D5. Ranking接続

本監査では決定しない。

将来候補:

```text
EXPLANATION_ONLY
TIE_BREAK_ONLY
RANKING_SIGNAL
CANDIDATE_SIGNAL
```

---

# 21. Acceptance Criteria

本監査完了条件:

```text
1. 現行15 Purposeが固定されている
2. 既存34 Consultation Caseが全件分類されている
3. Purpose / Intent / State / Outcome / Decision / Constraintが分離されている
4. Intent Candidate一覧が抽出されている
5. Purpose固有Intentと横断Intentが分類されている
6. collisionが記録されている
7. Negation問題が別問題として記録されている
8. Concierge / Compass共有境界が記録されている
9. Ranking / Score変更が行われていない
10. Mother Ship Decision項目が明示されている
```

---

# 22. TODO

```markdown
- [ ] 現行15 Purposeを正本コードから固定
- [ ] 現行Need keyword / regexを一覧化
- [ ] consultation_axisとの関係を整理
- [ ] interpretation_profileの各field責務を整理
- [ ] 既存34 Consultation Casesを抽出
- [ ] 34ケースをPurposeへ再分類
- [ ] 各ケースの「何について」をPurposeとして分離
- [ ] 各ケースの「どうしたい」をIntent候補として抽出
- [ ] StateをIntentから分離
- [ ] Decision ContextをIntentから分離
- [ ] Outcome HintをIntentから分離
- [ ] ConstraintをIntentから分離
- [ ] Cross NeedをIntentから分離
- [ ] career内のIntent Variation候補を定義
- [ ] love内のIntent Variation候補を定義
- [ ] marriage / relationship / communicationを定義
- [ ] money / study / healthを定義
- [ ] mental / rest / courage / focusを定義
- [ ] protection / family / travel_safeを定義
- [ ] Purpose間で重複するIntentを抽出
- [ ] 横断Intentとして共通化可能か確認
- [ ] Purpose固有Intentと共通Intentを分類
- [ ] Primary / Secondary Intentの必要性を検証
- [ ] Negationの扱いを記録
- [ ] Intent Variation v1 Matrixを完成
- [ ] Ranking変更なし
- [ ] Score変更なし
- [ ] Mapping変更なし
- [ ] Production変更なし
- [ ] Mother Ship Decision項目を整理
- [ ] PR作成
- [ ] STOP
```

---

# 23. Expected Output

本監査終了時に最低限以下を残す。

```text
Purpose Inventory
Intent Candidate Registry
Purpose × Intent Matrix
34 Consultation Classification Matrix
Cross-Purpose Intent Matrix
Collision List
Mother Ship Decision Packet
```

実装PRは、本監査と分離する。

---

# 24. Current Status

```text
INTENT_VARIATION_DEFINITION_STATUS = STARTED
RANKING_CHANGE = NONE
SCORE_CHANGE = NONE
MAPPING_CHANGE = NONE
PRODUCTION_CHANGE = NONE
```
