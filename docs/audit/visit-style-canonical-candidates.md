# Visit Style Canonical Candidate Audit

**Status: AUDIT COMPLETE / HOLD ITEMS REMAIN**

本書は AUDIT ONLY である。Seed、Bootstrap、Backfill、Recommendation、DB、Production の挙動は一切変更していない。
canonical 採用判断および Seed 反映判断は Mother Ship が行う。

- Base branch: `develop`
- Audit base commit: `311dea9 fix: Nearbyの同一key自動再fetchを抑止する (#2733)`
- 作業開始時の既知基点として指示された `dd2eedc` は本監査時点で 1 commit 前だった。`311dea9` を基点として再集計している。

---

## 0. Scope

### 対象

`backend/temples/data/shrines_seed_clean.json` の Base Shrine のうち、`visit_style_tags` key が欠落している 52 社。

### 目的

PR-B2（Seed Canonicalization）に先立ち、52 社の canonical 候補値を「確定可能な状態」まで整理する。
本 PR は候補と根拠を提示するのみで、canonical を確定しない。

### 非対象

既存 51 社のフル再レビュー（§7 の read-only integrity scan のみ実施）、taxonomy の新規追加、`urban` DOC_CODE_DRIFT の修正、legacy drift の自動変換。

### 監査に使用したファイル（fresh read 済み）

| 種別 | パス |
|---|---|
| Base Seed | `backend/temples/data/shrines_seed_clean.json` |
| Candidate Generator | `backend/temples/management/commands/backfill_goriyaku_tags.py` の `infer_visit_style_tags()` |
| Product 正本 | `docs/product/visit-style-taxonomy.md` |
| User 側語彙 | `backend/temples/domain/visit_preference.py` |
| extraCondition 語彙 | `backend/temples/domain/extra_condition_tags.py` |
| Matching 実装 | `backend/temples/services/concierge_chat_ranking.py` |
| Knowledge Evidence | `backend/temples/data/knowledge_seeds/*.json`（11 batch） |
| 補助 Evidence | `backend/temples/migrations/0090_add_rest_healing_tag_to_silent_shrines.py`, `0091_fill_missing_local_shrine_reason_facts.py`, `0095_batch17_recommendation_evidence_activation.py` |

---

## 1. Base State

current `develop` の Base Seed から再集計した実測値。

| 指標 | 想定 | 実測 | 判定 |
|---|---:|---:|---|
| Base Shrine total | 103 | **103** | 一致 |
| `visit_style_tags` 定義済み | 51 | **51** | 一致 |
| `visit_style_tags` key 欠落 | 52 | **52** | 一致 |

補足事実:

- `visit_style_tags` key を持つ 51 社は **全件 non-empty**。空配列で key だけ存在する行は 0 件。
- Seed row の key 構成は全 103 行で共通（`name_jp` / `address` / `latitude` / `longitude` / `goriyaku` / `kyusei` / `astro_elements` / `location`）＋ 51 行のみ `visit_style_tags`。
- `name_jp` は 103 行すべてで一意。`(name_jp, address)` の重複も 0 件。**52 社の対象同定は一意に確定する。**

§21 の STOP 条件（total ≠ 103 / missing ≠ 52 / 対象同定不能）にはいずれも該当しない。

`infer_visit_style_tags()` の現行実装も fresh read し、想定からの大きな変更がないことを確認した。

---

## 2. Current Ownership

今回監査したのは **Shrine 側** の `Shrine.visit_style_tags` である。User 側の `visit_preferences` とは別物として扱う。

```text
User Visit Preference (Structured) ─┐
                                    ├─→ user_visit_style_tag_set ─┐
extra_condition 自由文 → extract ───┘                             │
                                                                  ├─→ matched_visit_style_tags
Shrine.visit_style_tags → shrine_visit_style_tag_set ──────────────┘        ↓
                                                                     score_visit_style
                                                                            ↓
                                                                     Recommendation
```

`concierge_chat_ranking.py:1264-1265` の実装は次の通りで、**純粋な集合積とその要素数**である。

```python
matched_visit_style_tags = sorted(user_visit_style_tag_set & shrine_visit_style_tag_set)
score_visit_style = len(matched_visit_style_tags)
```

この事実は §10 / §11 の影響判定の前提になる。

---

## 3. Allowed Taxonomy Contract

### Shrine Canonical Allowed（本 PR で固定、新規追加なし）

```text
quiet
less_crowded
nature
reset
classic
business
study
urban
```

### Request-only

```text
nearby
```

`nearby` はユーザー現在地に対する相対的な希望・距離条件であり、Shrine 自身の固定属性ではない。
**52 社の final_candidate_tags に `nearby` は 1 件も入れていない。**

### Forbidden canonical seed（既知の legacy）

```text
love
formal
tourism
```

### Cardinality

```text
visit_style_tags: 1〜3 tags per Shrine
```

0 件を「完成」とは扱わない。根拠不足の場合は 4 件以上へ詰め込まず `HOLD` とする。

---

## 4. Candidate Generation Method

### 生成元

**current repository の Base Seed のみ**。DB 上の値は candidate の生成元にしていない。

理由: DB 環境差の排除、Admin 変更等の runtime drift の混入防止、current repo からの再現可能性の確保。

### 生成方法

現行 `infer_visit_style_tags()` を**そのまま**（改変せず）Candidate Generator として使用した。
関数を再実装せず、`temples.management.commands.backfill_goriyaku_tags` から実関数を import している。

Seed row から `Shrine` 相当データを再現する際は、`import_shrines_seed` が構築する payload と同一のフィールド割り当てを用いた。

```text
name_jp     = row["name_jp"].strip()
address     = row["address"].strip()
goriyaku    = row.get("goriyaku") or ""
sajin       = row.get("sajin") or ""          → 全行 ""（Seed に key なし）
description = row.get("description")           → 全行 None（Seed に key なし）
```

### 分類

生成された候補は canonical 値ではない。

```text
AUTO_CANDIDATE / NON_CANONICAL
```

### 生成結果（52 社）— 定量事実

| inferred tag | 発火数 / 52 |
|---|---:|
| `urban` | **51** |
| `classic` | 38 |
| `quiet` | 34 |
| `reset` | 34 |
| `business` | 33 |
| `nature` | 17 |

| inferred cardinality | 社数 |
|---:|---:|
| 1 | 5 |
| 2 | 1 |
| 3 | 15 |
| 4 | 9 |
| 5 | 13 |
| 6 | 9 |

**`infer_visit_style_tags()` の出力そのものは canonical contract を満たさない。** 52 社中 **31 社（60%）が 4 タグ以上**で、§11 の cardinality 契約（1〜3）に違反する。

発火要因を実装から追うと以下になる（いずれも `name_jp + goriyaku + sajin + description + address` の連結文字列への部分一致）。

| tag | トリガ語 | 52 社での実際の発火要因 |
|---|---|---|
| `urban` | `東京 / 駅 / 区 / 市 / 町` | 日本の住所はほぼ必ず「市」または「町」を含むため、山岳鎮座社を含む 51 社で無差別に発火する |
| `quiet` + `reset` | `癒 / 静 / 安 / 清 / 休 / 疲 / 厄除 / 浄化` | 「家内**安**全」「厄除け」の文字列で発火。**「静かさ」とは無関係**の語からの誤検知 |
| `business` + `classic` | `金運 / 商売 / 仕事 / 出世 / **開運** / 勝負 / 成功` | 「開運」が極めて高頻度で、商売・仕事と無関係な社にも `business` が付く |
| `nature` | `森 / 山 / 自然 / 滝 / 湖 / 木 / 緑` | 「日光**市**山内」「榛名**山**町」など住所地名の文字列一致が主因 |

---

## 5. Runtime Comparison

**`RUNTIME COMPARISON NOT EXECUTED`**

理由: 本監査は Desktop Development Contract の Local Fresh DB に到達できない環境（repository の clone のみが存在し、developer local の `jinja_db` は存在しない）で実施した。

§6 の規定に従い、以下を遵守した。

- DB を新規作成・drop・restore していない
- Production へ接続していない
- 52 社の `runtime_tags` は全件 `NOT_CHECKED`
- `runtime_match` は全件 `RUNTIME_NOT_AVAILABLE`

| 結果 | 件数 |
|---|---:|
| MATCH | 0 |
| MISMATCH | 0 |
| NOT_CHECKED | **52** |

**Mother Ship への注記:** Local Fresh DB での比較は未実施のまま残っている。`Seed + infer_visit_style_tags()` と Local DB 実値の乖離（Admin 変更等の runtime drift）は本監査では検出できていない。PR-B2 の前に Desktop 環境で実行することを推奨するが、実行要否の判断は Mother Ship に委ねる。

---

## 6. 52 Shrine Review

### Review Rule（本監査で適用した判定基準）

§14 の Tag 別 Review Rule と、既存 51 社の tagging precedent（§13 優先度 6）から、以下の基準を適用した。
すべて「文字列一致だけでは付与しない」を共通の前提とする。

| tag | 付与条件 |
|---|---|
| `classic` | Evidence に 一之宮 / 総本宮 / 名神大社 / 式内社 / 国宝 / 重要文化財 / 世界遺産 / 官幣社・別表神社 / 三大◯◯ / 歴代崇敬 等の**確認可能な位置づけ**があること |
| `nature` | Evidence に 神体山 / 山頂 / 山麓 / 海岸・崖端 / 国立公園 / 森 等、**実際の環境特性の記述**があること。住所地名の文字列一致は不可 |
| `business` | `goriyaku` に 商売繁盛 / 仕事運 / 出世運 / 金運 が**明示**、または Evidence に商売信仰の記述があること。**「開運」単独は不可** |
| `study` | `goriyaku` に 学業成就 / 合格祈願 が明示、または Evidence に学問・教えとの明示的関連があること |
| `urban` | 東京特別区または政令指定都市の行政区に所在し、かつ Evidence／住所から中心市街地立地が読み取れること。「市」「町」の一致は不可 |
| `quiet` | 「常に静か」と断定しない。repository 内に明示的な根拠（例: migration 0090 の `history_theme="静寂"` 認定）がある場合のみ |
| `less_crowded` | 強い Evidence Gate。季節・時刻・祭事で変動するため、**repository 内に直接の根拠がない限り付与しない** |
| `reset` | 心理効果を断定しない。補助 matching signal に留める。本監査では repository 内に判定根拠が得られず、**新規付与は 0 件** |

### Evidence カバレッジ

| | 件数 |
|---|---:|
| `knowledge_seeds` に構造化 Evidence あり | 44 / 52 |
| Evidence なし | 8 / 52 |

Knowledge Evidence は `shrine_ref.name_jp` で Base Seed と突合した。全 11 batch に 89 社分が存在する。

### 分類結果

| review_status | 件数 |
|---|---:|
| `KEEP_INFERRED` | **0** |
| `ADJUST_WITH_EVIDENCE` | **43** |
| `HOLD` | **9** |

**`KEEP_INFERRED` が 0 件である点は、本監査の最も重要な所見である。**
52 社のうち、現行 `infer_visit_style_tags()` の出力をそのまま canonical 候補として採用できる社は 1 社も存在しなかった。§12 の規定通り「関数がそう出したから」を採用理由にしていないため、`urban` の無差別発火（51/52）と cardinality 違反（31/52）を通過できる行が残らなかった。

### final_candidate_tags 集計（ADJUST 43 社）

| tag | 件数 |
|---|---:|
| `classic` | 42 |
| `nature` | 12 |
| `business` | 7 |
| `urban` | 5 |
| `quiet` | 2 |
| `study` | 1 |
| `less_crowded` | 0 |
| `reset` | 0 |

| cardinality | 社数 |
|---:|---:|
| 1 | 22 |
| 2 | 16 |
| 3 | 5 |

`nearby` = 0 件、allowed 外 = 0 件、duplicate = 0 件、4 件以上 = 0 件。

### Review Table

| # | name_jp | address | seed_visit_style_tags | inferred_tags | runtime_tags | runtime_match | review_status | final_candidate_tags | changed_from_inference | evidence_basis | review_reason | recommendation_impact |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 伏見稲荷大社 | 京都府京都市伏見区深草薮之内町68 | MISSING | `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic`, `business`, `nature` | YES | knowledge_seeds/batch_1_7 (稲荷山へ大神が鎮座・和銅4年伝承, source_confirmed); seed goriyaku=商売繁盛 | business=goriyaku「商売繁盛」の明示。classic=公式由緒(和銅4年鎮座説話)。nature=Knowledgeが鎮座地を「稲荷山」と明記。urbanは住所の「市/区」一致のみで根拠なし→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 2 | 出雲大社 | 島根県出雲市大社町杵築東195 | MISSING | `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic` | YES | knowledge_seeds/batch_1_7 (本殿の国宝指定・大社造・延享元年造替, source_confirmed/high) | classic=本殿の国宝指定という確認可能な文化的位置づけ。business=goriyakuは「開運」のみで仕事・商売の明示なし→除外。urban=出雲市大社町は市街地中心部の根拠なし→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 3 | 宇佐神宮 | 大分県宇佐市南宇佐2859 | MISSING | `quiet`, `reset`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic` | YES | knowledge_seeds/batch_9 (神亀2年(725)一之御殿造立を公式由緒が創建とする, source_confirmed/high) | classic=公式由緒による古代創建の位置づけ。quiet/resetは「厄除け」「家内安全」の『安』文字列由来→根拠なし。urbanも住所文字列のみ→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 4 | 日光東照宮 | 栃木県日光市山内2301 | MISSING | `nature`, `quiet`, `reset`, `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic` | YES | knowledge_seeds/batch_1_7 (陽明門の国宝指定, 元和3年正遷宮, 正保2年宮号下賜, source_confirmed/high) | classic=国宝陽明門・宮号下賜。inferredは6件でcardinality契約(1〜3)違反。natureは当社自身のEvidenceに環境記述がなく住所「山内」の文字列一致のみ→除外。business/quiet/reset/urbanも文字列由来→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 5 | 住吉大社 | 大阪府大阪市住吉区住吉2-9-89 | MISSING | `quiet`, `reset`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic`, `urban` | YES | knowledge_seeds/batch_1_7 (記紀伝承・神功皇后摂政11年鎮斎); batch_12 (日本三大住吉の一として大阪住吉大社を明記) | classic=記紀由来と三大住吉の位置づけ。urban=大阪市住吉区、政令市の行政区内市街地立地。quiet/resetは『安』由来→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 6 | 石清水八幡宮 | 京都府八幡市八幡高坊30 | MISSING | `quiet`, `reset`, `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic`, `nature` | YES | knowledge_seeds/batch_1_7 (貞観元年(859)行教和尚の託宣により男山の峯へ奉安, source_confirmed/high) | classic=国家鎮護の勅願的由緒。nature=Evidenceが鎮座地を「男山の峯」と明記。business=goriyaku「開運」のみ→除外。quiet/reset/urbanは文字列由来→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 7 | 金刀比羅宮 | 香川県仲多度郡琴平町892-1 | MISSING | `quiet`, `reset`, `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic` | YES | knowledge_seeds/batch_1_7 (永万元年崇徳天皇合祀・明治元年宮号下賜, source_confirmed/high) | classic=宮号下賜という確認可能な位置づけ。nature相当の環境記述はrepository Evidenceに無く、山岳立地は推測になるため付与しない。quiet/reset/business/urbanは文字列由来→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 8 | 鹿島神宮 | 茨城県鹿嶋市宮中2306-1 | MISSING | `quiet`, `reset`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic` | YES | knowledge_seeds/batch_1_7 (神武天皇による勅祭伝承を公式サイトが伝承として記載, source_confirmed/high) | classic=神宮号と公式由緒。quiet/resetは「厄除け」の文字列由来、urbanは「鹿嶋市」由来→いずれも除外。 | `POTENTIAL_MATCH_CHANGE` |
| 9 | 香取神宮 | 千葉県香取市香取1697-1 | MISSING | `quiet`, `reset`, `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `HOLD` | TBD | — | knowledge_seeds/batch_1_7 に deities(経津主大神)のみ。histories 0件 | Knowledgeにhistoriesが無く、classicを支える確認可能な位置づけ(社格・文化財・由緒)がrepository内に存在しない。inferredの5タグは全て文字列一致由来。canonical化の根拠不足のためHOLD。 | `UNKNOWN` |
| 10 | 氷川神社（大宮） | 埼玉県さいたま市大宮区高鼻町1-407 | MISSING | `quiet`, `reset`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic` | YES | knowledge_seeds/batch_9 (『新抄格勅符抄』天平神護2年(766)の封戸寄進記録を公式由緒が引用, source_confirmed/high) | classic=奈良時代の文献記録という確認可能な由緒。urbanはさいたま市大宮区だが市街地型を示すEvidenceが無く、参道・大宮公園側の性格も判断できないため除外。quiet/resetは『安』由来→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 11 | 長太稲荷神社 | 日本、〒157-0065 東京都世田谷区上祖師谷１丁目３−１０ | MISSING | `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `HOLD` | TBD | — | knowledge_seeds に該当なし。seed goriyaku 空。(参考: migration 0091 が history_theme=「守り」と稲荷社としての goriyaku を runtime で付与するが Base Seed には未反映) | Base Seed側にgoriyakuが無くKnowledgeも存在しないため、canonical判定の根拠がゼロ。inferredの urban は住所文字列由来。0091のruntime文言をSeed正本の根拠に流用しない。HOLD。 | `UNKNOWN` |
| 12 | 給田六所神社 | 日本、〒157-0064 東京都世田谷区給田１丁目３−７ | MISSING | `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `HOLD` | TBD | — | knowledge_seeds/batch_1_7 (武蔵総社六所宮からの分霊勧請・村社列格・神明社合祀, source_confirmed/medium) | Knowledgeはあるが内容は村社列格と合祀で、classic(有名・定番・歴史文化)を支える位置づけには当たらない。urbanも世田谷区の小規模地域社で市街地型のEvidence無し。HOLD。 | `UNKNOWN` |
| 13 | 榛名神社 | 群馬県高崎市榛名山町849 | MISSING | `nature`, `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `business`, `quiet` | YES | migration 0090 SILENT_SHRINE_NAMES に「榛名神社」を含み history_theme=「静寂」で対象化; seed goriyaku=商売繁盛 | business=goriyaku「商売繁盛」の明示。quiet=0090がrepository内で当社を「静寂」テーマとして明示的に列挙しており、比較的静かに過ごしやすい特性の候補として扱える。classicはKnowledge不在のため付与しない。urbanは「高崎市榛名山町」の文字列由来→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 14 | 筑波山神社 | 茨城県つくば市筑波1 | MISSING | `nature`, `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic`, `nature`, `quiet` | YES | knowledge_seeds/batch_8 (崇神天皇御代・筑波国造・筑波一族の奉仕伝承, source_confirmed/high); migration 0090 SILENT_SHRINE_NAMES に「筑波山神社」を含み history_theme=「静寂」 | classic=公式由緒による古代からの奉仕。quiet=0090の静寂認定。nature=社名・鎮座地が筑波山であり、既存51社の山岳信仰社(三峯神社/武蔵御嶽神社=nature+quiet+reset)のtagging precedentと整合。business=goriyaku「開運」のみ→除外。urbanは「つくば市」由来→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 15 | 彌彦神社 | 新潟県西蒲原郡弥彦村弥彦2887-2 | MISSING | `business`, `classic` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic` | YES | knowledge_seeds/batch_1_7 (天香山命の越後平定伝承・神武天皇即位4年, source_confirmed/high) | classic=公式由緒による越後開拓の位置づけ。businessはEvidenceが「漁労・製塩の技術を伝えた」殖産伝承にとどまり、goriyakuにも商売・仕事の語が無いため明示的関連とは言えず除外。 | `POTENTIAL_MATCH_CHANGE` |
| 16 | 氣多大社 | 石川県羽咋市寺家町ク1-1 | MISSING | `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic` | YES | knowledge_seeds/batch_8 (『続日本紀』神護景雲2年(768)の封戸二十戸・田二町の寄進記録, source_confirmed/high) | classic=正史に基づく古代の社格的記録。business=goriyakuは縁結び・恋愛成就・開運で商売/仕事の明示なし→除外。urbanは「羽咋市」由来→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 17 | 越中一宮 高瀬神社 | 富山県南砺市高瀬291 | MISSING | `nature`, `quiet`, `reset`, `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic` | YES | knowledge_seeds/batch_12 (延喜式内社・越中一宮、大正12年国幣小社昇格, source_confirmed/high) | classic=式内社・一宮・国幣小社という確認可能な社格。inferredは6件でcardinality違反。nature/quiet/reset/business/urbanはいずれも文字列一致由来→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 18 | 賀茂御祖神社（下鴨神社） | 京都府京都市左京区下鴨泉川町59 | MISSING | `quiet`, `reset`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic` | YES | knowledge_seeds/batch_1_7 (平成6年 世界文化遺産登録・長元9年からの式年遷宮・葵祭記録, source_confirmed/high) | classic=世界文化遺産登録という最も強い確認可能な位置づけ。urbanは京都市左京区だが市街地型のEvidence無し。quiet/resetは「厄除け」由来→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 19 | 賀茂別雷神社（上賀茂神社） | 京都府京都市北区上賀茂本山339 | MISSING | `nature`, `quiet`, `reset`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic`, `nature` | YES | knowledge_seeds/batch_1_7 (天武天皇6年(677)賀茂神宮造営; 御神話で神山への降臨を公式が記載, source_confirmed/high) | classic=7世紀の造営由緒。nature=Evidenceが神体山「神山」への降臨を当社起源として明記。quiet/resetは『厄除け』由来、urbanは住所由来→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 20 | 生田神社 | 兵庫県神戸市中央区下山手通1-2-1 | MISSING | `nature`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic`, `urban` | YES | knowledge_seeds/batch_1_7 (神功皇后元年・活田長峡国の神占い伝承, source_confirmed/high) | classic=記紀系の公式由緒。urban=神戸市中央区下山手通、政令市の行政区かつ三宮中心市街地。natureはEvidenceに環境記述が無く社名の「生田」からの推測になるため除外。 | `POTENTIAL_MATCH_CHANGE` |
| 21 | 宮地嶽神社 | 福岡県福津市宮司元町7-1 | MISSING | `quiet`, `reset`, `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic`, `business`, `nature` | YES | knowledge_seeds/batch_1_7 (神功皇后が宮地嶽の山頂で天神地祇を祀った起源伝承, source_confirmed/high); seed goriyaku=商売繁盛 | classic=公式由緒。business=goriyaku「商売繁盛」の明示。nature=Evidenceが起源を「宮地嶽の山頂」と明記。quiet/reset/urbanは文字列由来→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 22 | 白山比咩神社 | 石川県白山市三宮町ニ105-1 | MISSING | `nature`, `quiet`, `reset`, `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic`, `nature` | YES | knowledge_seeds/batch_1_7 (崇神天皇7年 舟岡山創祀、霊亀2年 手取川畔へ遷座、文明12年 現在地へ, source_confirmed/high) | classic=全国白山信仰の中心としての遷座史。nature=Evidenceが舟岡山・手取川畔という自然地形の鎮座地を明記。inferredは6件でcardinality違反。business=「開運」のみ→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 23 | 水戸東照宮 | 茨城県水戸市宮町2-5-13 | MISSING | `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic` | YES | knowledge_seeds/batch_15 (元和7年(1621)創建、旧国宝重要文化財社殿の戦災焼失と再建, source_confirmed/high) | classic=藩主による創建と文化財指定の履歴。business=goriyakuは開運・勝運のみで商売/仕事の明示なし→除外。urbanは水戸市で、東京特別区・政令市行政区という本監査のurban判定基準に該当しない→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 24 | 二荒山神社 | 栃木県日光市山内2307 | MISSING | `nature`, `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic`, `nature` | YES | knowledge_seeds/batch_12 (霊峰二荒山(男体山)を神体山とする山岳信仰、日光国立公園中枢の3,400haの神域, source_confirmed/high) | nature=Evidenceが神体山・国立公園・広大な神域を明記しており、住所文字列に依存しない実際の環境特性が確認できる。classic=日光の氏神・奥宮/中宮祠/本社の構成という公式由緒。business=「開運」のみ→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 25 | 八坂神社 | 京都府京都市東山区祇園町北側625 | MISSING | `nature`, `quiet`, `reset`, `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic`, `urban` | YES | knowledge_seeds/batch_1_7 (斉明天皇2年/貞観18年の二つの社伝、貞観11年 祇園祭の初見, source_confirmed/high) | classic=祇園祭の初見を含む公式由緒。urban=京都市東山区祇園町北側、政令市行政区の中心市街地。inferredは6件でcardinality違反。nature/quiet/reset/businessは文字列由来→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 26 | 住吉神社（博多） | 福岡県福岡市博多区住吉3-1-51 | MISSING | `quiet`, `reset`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic`, `urban` | YES | knowledge_seeds/batch_12 (日本三大住吉・『住吉本社』、住吉造社殿の国重要文化財指定と25年毎の御遷宮, source_confirmed/high) | classic=三大住吉と重要文化財という確認可能な位置づけ。urban=福岡市博多区、政令市行政区の市街地立地。quiet/resetは「厄除け」由来→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 27 | 靖國神社 | 東京都千代田区九段北3-1-1 | MISSING | `quiet`, `reset`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `HOLD` | TBD | — | knowledge_seeds に該当なし。seed goriyaku=厄除け・家内安全・勝運のみ | Knowledge Evidenceがゼロで、classic等を支える確認可能な位置づけがrepository内に存在しない。urbanは千代田区立地だが構造化Evidenceを伴わず、§14のurban判定基準(文字列一致のみでは不可)を満たさない。HOLD。 | `UNKNOWN` |
| 28 | 武蔵一宮 氷川女體神社 | 埼玉県さいたま市緑区宮本2-17-1 | MISSING | `nature`, `quiet`, `reset`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `HOLD` | TBD | — | knowledge_seeds に該当なし。seed goriyaku=縁結び・安産・家内安全のみ | Knowledge Evidenceがゼロ。社名の「武蔵一宮」は社格を示唆するがrepository内の構造化Evidenceで裏付けられておらず、名称のみからのclassic付与は推測になる。HOLD。 | `UNKNOWN` |
| 29 | 鷲宮神社 | 埼玉県久喜市鷲宮1-6-1 | MISSING | `quiet`, `reset`, `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic` | YES | knowledge_seeds/batch_13 (関東最古といわれる大社、明治期の准勅祭社宣下、藤原秀郷・源頼朝・徳川家康の崇敬、四百石の神領, source_confirmed/high) | classic=准勅祭社・歴代武将の崇敬・神領という確認可能な位置づけ。quiet/reset/business/urbanはいずれも文字列一致由来→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 30 | 箭弓稲荷神社 | 埼玉県東松山市箭弓町2-5-14 | MISSING | `nature`, `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic`, `business` | YES | knowledge_seeds/batch_15 (和銅5年創建伝承、源頼信の戦勝祈願と社名改称、江戸期の社前市・百余の講社、商売繁昌の祈願社, source_confirmed/high); seed goriyaku=商売繁盛 | classic=創建伝承と江戸期の隆盛。business=goriyakuの「商売繁盛」に加えEvidenceが『商売繁昌…の祈願社として信仰を集めている』と明記。natureは住所「箭弓町」の文字列由来→除外。urbanも東松山市で基準外→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 31 | 安房神社 | 千葉県館山市大神宮589 | MISSING | `nature`, `quiet`, `reset`, `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic`, `business`, `nature` | YES | knowledge_seeds/batch_12 (延喜式神名帳の式内社・名神大社・安房国一之宮、養老元年 吾谷山の麓へ遷座, source_confirmed/high); seed goriyaku=仕事運・技芸上達 | classic=名神大社・一之宮。business=goriyaku「仕事運」の明示。nature=Evidenceが現鎮座地を「吾谷山の麓」と明記。inferredは6件でcardinality違反。quiet/reset/urbanは文字列由来→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 32 | 千葉神社 | 千葉県千葉市中央区院内1-16-1 | MISSING | `quiet`, `reset`, `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `HOLD` | TBD | — | knowledge_seeds に該当なし。seed goriyaku=厄除け・八方除け・開運のみ | Knowledge Evidenceがゼロ。urbanは千葉市中央区で基準に合致し得るが、構造化Evidenceを伴わないため本監査ではcanonical候補として確定しない。HOLD。 | `UNKNOWN` |
| 33 | 玉前神社 | 千葉県長生郡一宮町一宮3048 | MISSING | `quiet`, `reset`, `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic` | YES | knowledge_seeds/batch_14 (『延喜式神名帳』名神大社・上総国一之宮、千二百年以上の例祭, source_confirmed/high) | classic=名神大社・一之宮という確認可能な社格。business=「開運」のみ→除外。quiet/reset/urbanは文字列由来→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 34 | 笠間稲荷神社 | 茨城県笠間市笠間1 | MISSING | `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic`, `business` | YES | knowledge_seeds/batch_13 (日本三大稲荷、白雉2年(651)創建伝承、御本殿の国重要文化財指定, source_confirmed/high); seed goriyaku=商売繁盛 | classic=三大稲荷・重要文化財。business=goriyaku「商売繁盛」の明示。urbanは「笠間市」の文字列由来→除外。 | `NONE_EXPECTED` |
| 35 | 酒列磯前神社 | 茨城県ひたちなか市磯崎町4607-2 | MISSING | `quiet`, `reset`, `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic`, `nature` | YES | knowledge_seeds/batch_1_7 (斉衡3年 海岸への御降臨、天安元年 官社列格と神号授与, source_confirmed/high) | classic=官社列格と神号という確認可能な位置づけ。nature=Evidenceが起源を海岸への降臨とし、鎮座地も磯崎町の海浜であることが読み取れる。business=「開運」のみ→除外。quiet/reset/urbanは文字列由来→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 36 | 宇都宮二荒山神社 | 栃木県宇都宮市馬場通り1-1-1 | MISSING | `nature`, `quiet`, `reset`, `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic` | YES | knowledge_seeds/batch_16 (延長5年 延喜式神名帳の名神大社、栃木県内唯一の名神大社、下野国一之宮、承和5年 臼ケ峰遷座, source_confirmed/high) | classic=名神大社・一之宮。urbanは宇都宮市中心部だが東京特別区・政令市行政区という本監査の判定基準に該当しない→除外。nature/quiet/reset/businessは文字列由来→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 37 | 古峯神社 | 栃木県鹿沼市草久3027 | MISSING | `nature`, `quiet`, `reset`, `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `HOLD` | TBD | — | knowledge_seeds に該当なし。seed goriyaku=火防・厄除け・開運のみ | Knowledge Evidenceがゼロ。inferredは6件でcardinality違反かつ全て文字列一致由来。HOLD。 | `UNKNOWN` |
| 38 | 冠稲荷神社 | 群馬県太田市細谷町1 | MISSING | `quiet`, `reset`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `HOLD` | TBD | — | knowledge_seeds に該当なし。seed goriyaku=縁結び・子宝・安産のみ | Knowledge Evidenceがゼロ。classic/quiet/reset/urbanを支える根拠が無い。HOLD。 | `UNKNOWN` |
| 39 | 妙義神社 | 群馬県富岡市妙義町妙義6 | MISSING | `quiet`, `reset`, `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic` | YES | knowledge_seeds/batch_1_7 (社記『宣化天皇の二年(537)に鎮祭』、唐門の国指定重要文化財(1981)、歴代将軍・前田侯の崇敬, source_confirmed/high) | classic=重要文化財の唐門と歴代崇敬。natureは社号「妙義」の由来が『明魂』であることがEvidenceで示され、山岳環境の記述は無いため除外。quiet/reset/business/urbanは文字列由来→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 40 | 赤城神社 | 群馬県前橋市富士見町赤城山4-2 | MISSING | `nature`, `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `HOLD` | TBD | — | knowledge_seeds に該当なし。seed goriyaku=縁結び・開運・心願成就のみ | Knowledge Evidenceがゼロ。natureは住所「赤城山」から示唆されるが、住所文字列一致のみを根拠とするなという§14の規定に該当するためcanonical確定はしない。HOLD。 | `UNKNOWN` |
| 41 | 鶴嶺八幡宮 | 神奈川県茅ヶ崎市浜之郷462 | MISSING | `quiet`, `reset`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic` | YES | knowledge_seeds/batch_14 (長元3年(1030)石清水勧請伝承、康平6年の『本社八幡宮』呼称、弘安4年 蒙古退散祈祷と晦日祭、江戸幕府朱印地、昭和9年 郷社列格, source_confirmed/high) | classic=勧請由緒・朱印地・社格という確認可能な歴史的位置づけ。quiet/resetは「厄除け」「家内安全」由来、urbanは「茅ヶ崎市」由来→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 42 | 報徳二宮神社 | 神奈川県小田原市城内8-10 | MISSING | `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic`, `business`, `study` | YES | knowledge_seeds/batch_15 (明治27年 報徳社の総意による創建、天保飢饉時に米蔵を開いた尊徳翁の事績、神社本庁別表神社, source_confirmed/high); seed goriyaku=仕事運・学業成就 | business=goriyaku「仕事運」の明示に加え、御祭神二宮尊徳翁の報徳思想(勤労・分度・推譲)という明示的関連。study=goriyaku「学業成就」の明示と尊徳翁の『教え』を慕う報徳社による創建。classic=別表神社という確認可能な位置づけ。urbanは小田原市で基準外→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 43 | 平塚八幡宮 | 神奈川県平塚市浅間町1-6 | MISSING | `quiet`, `reset`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic` | YES | knowledge_seeds/batch_16 (仁徳天皇68年(380)創祀伝承、徳川家康公による復興、関東大震災後 昭和3年の現社殿竣工, source_confirmed/high) | classic=創祀伝承と歴代の崇敬・復興史。quiet/resetは「厄除け」「家内安全」由来、urbanは「平塚市」由来→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 44 | 忌宮神社 | 山口県下関市長府宮の内町1-18 | MISSING | `nature`, `quiet`, `reset`, `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic` | YES | knowledge_seeds/batch_13 (『古事記』『日本書紀』に記載、延喜式内社、長門二宮・旧国幣社, source_confirmed/high) | classic=記紀記載・式内社・国幣社という確認可能な社格。inferredは6件でcardinality違反。nature/quiet/reset/business/urbanはいずれも文字列由来→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 45 | 高良大社 | 福岡県久留米市御井町1 | MISSING | `quiet`, `reset`, `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic` | YES | knowledge_seeds/batch_13 (仁徳天皇御代の御鎮座伝承、文永・弘安の蒙古襲来時の勅使参向と綸旨、『武運長久の神』としての崇敬, source_confirmed/high) | classic=勅使参向・綸旨という確認可能な歴史的位置づけ。business=「開運」のみ→除外。quiet/reset/urbanは文字列由来→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 46 | 寳登山神社 | 埼玉県秩父郡長瀞町長瀞1828 | MISSING | `nature`, `quiet`, `reset`, `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic`, `nature` | YES | knowledge_seeds/batch_11 (日本武尊の東征伝承、宝登山山頂で神霊を祀ったことを公式由緒が創建の始めとする, source_confirmed/high) | classic=公式由緒による創建伝承。nature=Evidenceが創建地を「宝登山山頂」と明記し山岳信仰の性格が読み取れる。inferredは6件でcardinality違反。quiet/reset/businessは文字列由来→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 47 | 枚岡神社 | 大阪府東大阪市出雲井町7-16 | MISSING | `quiet`, `reset`, `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic`, `nature` | YES | knowledge_seeds/batch_12 (神津嶽に磐境を設けた創祀、白雉元年 山麓の現在地へ奉遷、神護景雲2年の『元春日』=春日大社の元宮, source_confirmed/high) | classic=『元春日』という確認可能な位置づけ。nature=Evidenceが創祀地「神津嶽」と現在地「山麓」を明記。business=goriyakuに商売繁盛があるが、Evidence側に商売信仰の記述が無く3枠の優先度で落とす(Mother Ship判断余地あり)。quiet/reset/urbanは文字列由来→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 48 | 護王神社 | 京都府京都市上京区烏丸通下長者町下ル桜鶴円町385 | MISSING | `quiet`, `reset`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic`, `urban` | YES | knowledge_seeds/batch_1_7 (嘉永4年 正一位護王大明神の神階神号、明治7年 別格官幣社列格、明治19年 勅命により京都御所蛤御門前へ遷座, source_confirmed/high) | classic=別格官幣社・勅命遷座という確認可能な位置づけ。urban=京都市上京区、京都御所前という政令市行政区の中心市街地立地がEvidenceの遷座先記述からも確認できる。quiet/resetは「厄除け」由来→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 49 | 阿蘇神社 | 熊本県阿蘇市一の宮町宮地3083-1 | MISSING | `quiet`, `reset`, `business`, `classic`, `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic` | YES | knowledge_seeds/batch_1_7 (健磐龍命による阿蘇開拓の伝承、2000年以上の歴史を有する古社, source_confirmed/medium) | classic=古社としての位置づけ(confidenceはmediumだがsource_confirmed)。natureは阿蘇の火山環境が想起されるがEvidenceに環境記述が無く住所文字列由来になるため除外。business=「開運」のみ→除外。quiet/reset/urbanも文字列由来→除外。 | `POTENTIAL_MATCH_CHANGE` |
| 50 | 北海道神宮 | 北海道札幌市中央区宮ヶ丘474 | MISSING | `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic` | YES | knowledge_seeds/batch_17 (明治2年 明治天皇の聖旨による北海道鎮座神祭を創祀とする、明治4年 円山遷座、昭和39年 明治天皇増祀と神宮号への改称, source_confirmed/high) | classic=勅祭を起源とし神宮号を有するという確認可能な位置づけ。natureは「円山」がEvidenceに地名として現れるのみで環境記述が無く除外。urbanは札幌市中央区だが円山側の立地でありEvidenceからは市街地型と断定できないため除外。 | `POTENTIAL_MATCH_CHANGE` |
| 51 | 建部大社 | 滋賀県大津市神領1-16-1 | MISSING | `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic` | YES | knowledge_seeds/batch_17 (景行天皇46年を起源とする公式由緒、源頼朝の祈願と神宝・神領の寄進伝承, source_confirmed/high。遷座年については disputed の記載も併存) | classic=公式由緒と源頼朝の寄進伝承という確認可能な歴史的位置づけ。urbanは「大津市」の文字列由来→除外。なお migration 0095 が当社(pk107)をbatch17 Evidence活性化の対象としている。 | `POTENTIAL_MATCH_CHANGE` |
| 52 | 波上宮 | 沖縄県那覇市若狭1-25-11 | MISSING | `urban` | NOT_CHECKED | RUNTIME_NOT_AVAILABLE | `ADJUST_WITH_EVIDENCE` | `classic`, `nature` | YES | knowledge_seeds/batch_17 (琉球八社の制で第一の神社、明治23年 官幣小社列格、波の上の崖端を聖地・拝所とした信仰背景、那覇港と海上交通の崇敬, source_confirmed/high) | classic=琉球八社第一・官幣小社という確認可能な位置づけ。nature=Evidenceが『波の上の崖端』を聖地とする信仰背景と海浜の霊石伝承を明記しており、住所文字列に依らない環境特性が確認できる。urbanは那覇市で本監査のurban判定基準(東京特別区・政令市行政区)に該当しない→除外。 | `POTENTIAL_MATCH_CHANGE` |
### HOLD 9 社の内訳

| # | name_jp | HOLD 理由の分類 |
|---|---|---|
| 9 | 香取神宮 | Knowledge に `deities` のみで `histories` 0 件 |
| 11 | 長太稲荷神社 | Knowledge なし ＋ Seed `goriyaku` 空 |
| 12 | 給田六所神社 | Knowledge はあるが村社列格・合祀の記録のみで canonical 根拠にならない |
| 27 | 靖國神社 | Knowledge なし |
| 28 | 武蔵一宮 氷川女體神社 | Knowledge なし |
| 32 | 千葉神社 | Knowledge なし |
| 37 | 古峯神社 | Knowledge なし |
| 38 | 冠稲荷神社 | Knowledge なし |
| 40 | 赤城神社 | Knowledge なし |

`HOLD` は失敗ではない。§12 の規定に従い、推測で埋めることを避けた結果である。

---

## 7. Existing 51 Shrine Integrity Scan

read-only。**1 件も修正していない。**

### 確認項目の結果

| 項目 | 期待 | 実測 | 判定 |
|---|---|---:|---|
| allowed taxonomy 外 tag | 0 | **13** | 違反あり |
| `nearby` | 0 | **0** | OK |
| duplicate | 0 | **0** | OK |
| empty array | 0 | **0** | OK |
| 4 tags 以上 | 0 | **0** | OK |
| non-string | 0 | **0** | OK |
| blank string | 0 | **0** | OK |
| non-list | 0 | **0** | OK |
| cardinality | 1〜3 | **全 51 社が正確に 3** | OK |

### 既存 51 社の tag 使用頻度

| tag | 件数 | 分類 |
|---|---:|---|
| `classic` | 34 | allowed |
| `reset` | 29 | allowed |
| `urban` | 20 | allowed |
| `nature` | 19 | allowed |
| `quiet` | 14 | allowed |
| `business` | 14 | allowed |
| `love` | **11** | **LEGACY_SEED_DRIFT** |
| `study` | 7 | allowed |
| `less_crowded` | 3 | allowed |
| `tourism` | **1** | **LEGACY_SEED_DRIFT** |
| `formal` | **1** | **LEGACY_SEED_DRIFT** |

### tagging precedent（52 社の Review Rule 導出に使用）

- `urban` は東京特別区・政令市中心部の社に集中する（神田明神・東京大神宮・芝大神宮・愛宕神社・富岡八幡宮・品川神社・花園神社・小網神社・湯島天満宮 等）。三峯神社・箱根神社・富士山本宮浅間大社・厳島神社・高千穂神社 のような山岳／自然立地社には**付与されていない**。
- 山岳信仰社は `nature` + `quiet` + `reset`（三峯神社、武蔵御嶽神社）という組み合わせで揃っている。
- `study` は天満宮系・学問神系に限定されている（太宰府天満宮・吉備津神社・亀戸天神社・湯島天満宮・秩父神社・櫻木神社・足利織姫神社）。
- `less_crowded` は 3 社のみで、いずれも「著名観光地に隣接しつつ相対的に空いている」性格の社（浅草神社・寒川神社・調神社）。安易には付与されていない。

---

## 8. Legacy Seed Drift

分類: `LEGACY_SEED_DRIFT`

**自動変換は行っていない。** `love -> classic` 等の推測変換も一切していない。

### forbidden tag を持つ Shrine（13 社）

| # | name_jp | forbidden tag | 現在の tag 配列 |
|---|---|---|---|
| 12 | 浅草神社 | `tourism` | `classic`, `tourism`, `less_crowded` |
| 19 | 川越氷川神社 | `love` | `classic`, `love`, `nature` |
| 21 | 日枝神社 | `formal` | `quiet`, `formal`, `classic` |
| 22 | 東京大神宮 | `love` | `quiet`, `urban`, `love` |
| 30 | 江島神社 | `love` | `nature`, `love`, `reset` |
| 31 | 貴船神社 | `love` | `nature`, `quiet`, `love` |
| 33 | 赤坂氷川神社 | `love` | `quiet`, `urban`, `love` |
| 38 | 白山神社 | `love` | `quiet`, `urban`, `love` |
| 43 | 多摩川浅間神社 | `love` | `nature`, `quiet`, `love` |
| 47 | 櫻木神社 | `love` | `study`, `love`, `reset` |
| 49 | 足利織姫神社 | `love` | `study`, `love`, `business` |
| 50 | 森戸大明神 | `love` | `nature`, `love`, `reset` |
| 51 | 九頭龍神社 新宮 | `love` | `nature`, `love`, `reset` |

- **該当 Shrine 数: 13**
- **unknown tag の延べ出現数: 13**（`love` 11 / `tourism` 1 / `formal` 1）
- いずれの社も 1 社あたり forbidden tag は 1 個で、残り 2 個は allowed taxonomy 内。

### Recommendation 上の現在の挙動（CURRENT FACT）

`love` / `formal` / `tourism` はいずれも `VISIT_PREFERENCE_TAGS` にも `EXTRA_TAG_META` にも存在しない。
`score_visit_style` は集合積であるため、**これら 3 tag は現時点で `matched_visit_style_tags` に入り得ず、スコアに寄与していない**。
つまり現在は「13 社が実質 2 tag で matching している」状態に等しい。

---

## 9. DOC_CODE_DRIFT

```text
urban
= SHRINE_CANONICAL_ALLOWED
= INTERNAL_ONLY
= INPUT_PATH_DOC_CODE_DRIFT
```

**本 PR では修正しない。** 以下は CURRENT FACT としての記録である。

### 実測した現状

| 参照元 | `urban` の扱い |
|---|---|
| `docs/product/visit-style-taxonomy.md`「内部タグ」表 | `urban` = 「都市型・市街地型」として**定義されている** |
| 同ドキュメント「extraCondition との接続」の変換例表 | `urban` の行は**存在しない** |
| `backend/temples/domain/visit_preference.py` docstring | 「`business`/`study`/`urban` remain valid legacy visit_style tags **reachable via free-text `extra_condition`**」と記述 |
| `backend/temples/domain/extra_condition_tags.py` の `EXTRA_TAG_META` | `urban` key が**存在しない**（`visit_style` kind は quiet / less_crowded / nearby / nature / reset / classic / business / study の 8 個） |
| 同ファイルの `EXTRA_TAGS`（自由文辞書） | `urban` key が**存在しない** |
| `backend/temples/domain/visit_preference.py` の `VISIT_PREFERENCE_TAGS` | `urban` を**含まない** |

### 帰結（本監査での確認事実）

ユーザー側が生成し得る visit_style tag の全体は次の和集合である。

```text
VISIT_PREFERENCE_TAGS      = {quiet, nature, reset, less_crowded, nearby, classic}
EXTRA_TAG_META visit_style = {quiet, less_crowded, nearby, nature, reset, classic, business, study}
─────────────────────────────────────────────────────────────────────────────
union                      = {quiet, less_crowded, nearby, nature, reset, classic, business, study}
```

`urban` はこの和集合に**含まれない**。`score_visit_style` が集合積である以上、
**`Shrine.visit_style_tags` に `urban` がいくつ入っていても `matched_visit_style_tags` には決して現れず、スコアに一切寄与しない。**

`visit_preference.py` の docstring が主張する「free-text `extra_condition` から到達可能」は、current `EXTRA_TAG_META` / `EXTRA_TAGS` の実装とは一致していない。
これは既存 51 社の `urban` 20 件と、52 社の inferred `urban` 51 件の双方に影響する事実である。

**修正しない。** doc と code のどちらを正本とするかは Mother Ship の判断事項。

---

## 10. Recommendation Impact

Recommendation code は変更していない。Ranking 再調整もしていない。
以下は Seed canonicalization 時に確認すべき影響の一覧である。

判定方法: `inferred_tags` と `final_candidate_tags` の対称差のうち、**ユーザー側が生成し得る tag（§9 の union）に属するものが存在するか**で分類した。`urban` のみが変化する場合は matching に影響しない。

| 分類 | 件数 |
|---|---:|
| `POTENTIAL_MATCH_CHANGE` | **42** |
| `NONE_EXPECTED` | **1** |
| `UNKNOWN` | **9** |

- `NONE_EXPECTED` の 1 件は **笠間稲荷神社**（`business, classic, urban` → `classic, business`）。差分が `urban` のみであり、`urban` はユーザー側語彙に存在しないため matching に影響しない。
- `UNKNOWN` の 9 件は `HOLD` 社。final candidate が未確定のため影響を判定できない。
- `POTENTIAL_MATCH_CHANGE` の主因は `quiet` / `reset` / `business` / `classic` / `nature` の増減である。

### 特に注意すべき変化の方向

現行 runtime では、52 社は `backfill_goriyaku_tags --with-visit-style` により **inferred 値がそのまま格納されている**（`import_shrines_seed` が `visit_style_tags = []` を入れ、backfill が空配列を埋めるため）。

したがって Seed canonicalization は「未設定を埋める」のではなく、**「現在 runtime に入っている inferred 値を置き換える」**操作になる。

| 変化 | 影響 |
|---|---|
| `quiet` / `reset` が 34 社 → 2 社 / 0 社 | 「静かな時間を過ごしたい」「気分を切り替えたい」を選んだユーザーに対し、これら 52 社の `score_visit_style` が大きく下がる |
| `business` が 33 社 → 7 社 | 自由文で「仕事」「商売」を含む相談での加点が減る |
| `classic` が 38 社 → 42 社 | 「有名な神社が安心」の加点はわずかに増える |
| `nature` が 17 社 → 12 社 | 「自然を感じたい」の加点が減る |
| `urban` が 51 社 → 5 社 | **matching への影響なし**（§9） |

これは「精度が上がる」とも「候補が減る」とも本監査では断定しない。Ranking への実影響の評価は PR-B2 以降の別作業である。

---

## 11. Hold Items

| # | name_jp | 不足している根拠 | 解消に必要なもの（案） |
|---|---|---|---|
| 9 | 香取神宮 | `histories` 0 件。社格・文化財等の位置づけが repository 内に無い | Knowledge Seed への histories 追加 |
| 11 | 長太稲荷神社 | Seed `goriyaku` 空 ＋ Knowledge 無し | Seed への `goriyaku` 追加、または Knowledge Seed 追加 |
| 12 | 給田六所神社 | Knowledge は村社列格・合祀のみ。地域社であり `classic` に当たらない | 地域社向けの canonical 方針の決定（Mother Ship） |
| 27 | 靖國神社 | Knowledge 無し | Knowledge Seed 追加 |
| 28 | 武蔵一宮 氷川女體神社 | Knowledge 無し（社名の「武蔵一宮」は名称からの推測になるため採らない） | Knowledge Seed 追加 |
| 32 | 千葉神社 | Knowledge 無し | Knowledge Seed 追加 |
| 37 | 古峯神社 | Knowledge 無し | Knowledge Seed 追加 |
| 38 | 冠稲荷神社 | Knowledge 無し | Knowledge Seed 追加 |
| 40 | 赤城神社 | Knowledge 無し（住所「赤城山」からの `nature` は文字列一致のため不可） | Knowledge Seed 追加 |

補足: #11 長太稲荷神社 と #12 給田六所神社 については、`migration 0091_fill_missing_local_shrine_reason_facts` が runtime で `history_theme` と `goriyaku` 本文を付与している。ただしこれは Base Seed には反映されておらず、Seed 正本化の根拠としては流用しなかった。この扱いの是非も Mother Ship 判断に含まれる。

---

## 12. Mother Ship Decision Gate

```text
Mother Ship must decide:

1. 52社のfinal_candidate_tagsをSeed canonical値として採用するか
2. ADJUST_WITH_EVIDENCEを承認するか
3. HOLD項目をどう扱うか
4. Existing 51 legacy driftを同じSeed Canonicalization PRで修正するか
5. Seed Canonicalization PR-B2へ進むか
```

本監査で確定していない事項（Codex は YES/NO を決めない）:

1. **`KEEP_INFERRED` が 0 件であること自体の受容可否。** 現行 `infer_visit_style_tags()` は canonical generator としては使えない、という所見を採るかどうか。
2. **`classic` 42 件への偏り。** Knowledge Seed が社格・文化財中心の構成であるため、Evidence ベースで判定すると `classic` に集中する。これを是とするか、体験スタイル側（`quiet` / `reset` / `nature`）の Evidence 源を別途整備するか。
3. **cardinality 1 件が 22 社ある点。** 契約上は合法（1〜3）だが、既存 51 社が全件 3 件であることとの非対称をどう扱うか。
4. **`urban` の位置づけ。** §9 の通り現状は matching に寄与しない。canonical allowed に残すか、Shrine 側から外すか、`EXTRA_TAG_META` 側に追加して到達可能にするか。
5. **`less_crowded` / `reset` が新規 0 件である点。** Evidence Gate を厳格に適用した結果であり、緩和するなら別途 Evidence 源が要る。
6. **Local Fresh Runtime 比較の未実施（§5）。** PR-B2 前に Desktop 環境で実行するか。
7. **Legacy drift 13 社の扱い。** 同一 PR で修正するか、別 PR に分けるか。`love` の変換先も未決定（本監査では推測変換していない）。
8. **`migration 0091` が runtime 付与する内容を Seed 正本の根拠に使ってよいか**（#11 / #12 に影響）。

---

## 13. Final Result

```text
Base total:               103
Existing tagged:           51
Missing:                   52

KEEP_INFERRED:              0
ADJUST_WITH_EVIDENCE:      43
HOLD:                       9

Runtime MATCH:              0
Runtime MISMATCH:           0
Runtime NOT_CHECKED:       52

Legacy drift Shrine count: 13
Unknown tag count:         13   (love 11 / tourism 1 / formal 1)
```

### Validation

| 項目 | 結果 |
|---|---|
| 52 社すべて Review Table に存在 | PASS（52 行） |
| 52 社の重複 | 0 |
| final_candidate_tags の allowed 外 tag | 0 |
| final_candidate_tags の `nearby` | 0 |
| final_candidate_tags の duplicate | 0 |
| final_candidate_tags の cardinality | 全件 1〜3（HOLD 除く） |
| 全件集計が Base total と一致 | 51 + 52 = 103 PASS |
| Existing 51 integrity scan 実施 | PASS |
| Seed ファイル差分 | 0 |
| Production code 差分 | 0 |
| Migration 差分 | 0 |

### 本 PR で変更していないもの

`shrines_seed_clean.json` / `infer_visit_style_tags()` / `backfill_goriyaku_tags.py` / `bootstrap_production_data.py` / `backend/start.sh` / Recommendation / Ranking / Serializer / API / Model / Migration / Admin / Frontend / Mobile / Production DB / Local DB / taxonomy 定義。

監査中に発見した問題（`urban` DOC_CODE_DRIFT、legacy drift 13 社、inferred の cardinality 違反）は、いずれも本書への記録のみとし、修正していない。

**Status: AUDIT COMPLETE / HOLD ITEMS REMAIN**
