# Shrine Expansion Wave 0 History Fact Availability Audit

## Status

- Audit status: `COMPLETE`
- Recorded at: `2026-09-09`
- Scope: Wave 0 `NEW` 43 candidates
- History Fact availability only
- Production DB write: なし
- Shrine seed change: なし
- Candidate Master data write: なし
- Knowledge Fact生成: なし
- goriyaku / goriyaku_tags変更: なし
- Recommendation / Ranking / Concierge / Compass変更: なし

## 目的

Wave 0 の `NEW` 43社について、現行KAMI MUSUBIのShared Recommendation Eligibilityで利用可能になり得る `ShrineHistory` Factを、安全なSourceから取得・生成できるかを監査する。

本監査はHistory FactそのものをDBへ生成・投入する工程ではない。
Accepted Sourceに、由緒・創建・遷座・再建・改称・祭祀史・地域史・伝承等として少なくとも1件のHistory Fact候補へ分離できる記述が存在するかを確認する。

## Runtime Contract

現行Shared Recommendation Eligibilityは以下。

```text
Recommendation eligibility
= usable Deity Fact OR usable History Fact
```

`legacy goriyaku` / `history_theme` からeligibilityを推定しない。

現行Evidence Gateでは、Factと関連Sourceがfact-readyであることがusable条件となる。
Fact-ready verification statusは以下。

```text
source_confirmed
reviewed
```

History typeそのものを理由にEligibilityから除外する契約はない。
したがって `tradition` も、Source-backedかつfact-readyであればusable Historyになり得る。ただしRecommendation Reasonでは伝承であることを保持し、断定表現へ昇格させない。

## History Extraction Policy

以下を固定する。

1. Source本文に明示された出来事・由緒・伝承だけをFact候補にする。
2. 神社名・祭神・ご利益から歴史を推測しない。
3. `伝える` / `社伝` / `口碑` / `といわれる` 等の記述は事実的創建へ昇格せず `tradition` 候補として扱う。
4. Sourceが創建年代不明とする場合、年代を補完しない。
5. `event_date` はSourceに十分な日付根拠がある場合のみ候補とし、推測生成しない。
6. 年代幅・年号・時代しか確認できない場合は `period_text` を使う前提とし、日付を捏造しない。
7. 同一Sourceに伝承と確認可能な歴史イベントが混在する場合は別Factとして分離する。
8. 文化財・自治体Sourceの建築年代、再建、移転、史料伝来等は `historical_event` / `regional_context` 候補にできる。
9. Discovery rankingはHistory Fact Sourceに使用しない。
10. exact `history_type` の最終割当はFact生成Reviewで行い、本Availability Auditでは固定しない。

## Status Definition

- `PASS_HISTORY`: accepted Sourceから少なくとも1件のSource-backed History Fact候補を作成可能
- `HOLD_HISTORY_SOURCE`: shrine identity SourceはあるがHistoryを切り出せるaccepted Sourceを確保できない
- `HOLD_HISTORY_STRUCTURE`: Sourceはあるが現行 `ShrineHistory` Contractで安全に表現できない
- `UNKNOWN_HISTORY`: SourceとShrine identityの対応関係を確定できない

## Summary

| Status | Count |
|---|---:|
| PASS_HISTORY | 43 |
| HOLD_HISTORY_SOURCE | 0 |
| HOLD_HISTORY_STRUCTURE | 0 |
| UNKNOWN_HISTORY | 0 |
| **Total** | **43** |

```text
HISTORY_FACT_ACQUISITION_PATH = 43 / 43
HISTORY_HOLD = 0 / 43
```

43社すべてで、少なくとも1件のSource-backed `ShrineHistory` Factを作成できる取得経路を確認した。

これは43社がすでにRecommendation eligibleであることを意味しない。
History Fact生成、Source関連付け、verification_status設定、verified_at設定、Evidence Gate実行は後続工程である。

## Candidate Matrix

| # | candidate_name | prefecture | status | availability_note |
|---:|---|---|---|---|
| 1 | 三輪神社 | 愛知県 | PASS_HISTORY | 神社公式に由緒ページあり。元亀年間の創祀伝承や後世の地域史をSource-backed History候補へ分離可能。 |
| 2 | 大鳥大社 | 大阪府 | PASS_HISTORY | 神社公式「由緒沿革」に延喜式記載、社伝上の起源、兵火・再興・再建等を明示。伝承と確認可能な沿革を分離可能。 |
| 3 | 御岩神社 | 茨城県 | PASS_HISTORY | 神社公式に御由緒導線あり。創祀・信仰史・神仏習合等の記述からHistory候補を取得可能。伝承表現は保持する。 |
| 4 | 姫嶋神社 | 大阪府 | PASS_HISTORY | 大阪市公式が創建年代不明、旧社名、1766年の社名復帰等を明示。創建年代を補完せずHistory化可能。 |
| 5 | 烏森神社 | 東京都 | PASS_HISTORY | 神社公式に創始伝承、明暦大火、明治6年改称、昭和46年社殿造営等の記述あり。伝承とhistorical eventを分離可能。 |
| 6 | 榴岡天満宮 | 宮城県 | PASS_HISTORY | 神社公式に974年創建、複数回の遷座、江戸期社殿造営等の沿革を明示。 |
| 7 | 射水神社 | 富山県 | PASS_HISTORY | 神社公式に年表形式の沿革があり、1875年遷座、火災、再建等を明示。 |
| 8 | 別小江神社 | 愛知県 | PASS_HISTORY | 神社公式に創建伝承を明示。伝承であることを保持した `tradition` 候補として利用可能。 |
| 9 | 戸隠神社 中社 | 長野県 | PASS_HISTORY | 神社公式の戸隠史に平安期以降の信仰史、神仏分離による顕光寺から戸隠神社への転換等を明示。中社を含む戸隠全体史としてscopeを注記してFact化可能。 |
| 10 | 札幌諏訪神社 | 北海道 | PASS_HISTORY | 神社公式に1882年勧請、創立出願、社殿造営、鎮座周年等の沿革を明示。 |
| 11 | 少彦名神社 | 大阪府 | PASS_HISTORY | 神社公式に1780年の勧請、1822年コレラ流行時の出来事等を明示。 |
| 12 | 大神神社 | 奈良県 | PASS_HISTORY | 神社公式に記紀上の創祀伝承と、859年神階・中近世・明治期の沿革を明示。伝承と歴史イベントを分離可能。 |
| 13 | 北野天満宮 | 京都府 | PASS_HISTORY | 神社公式に947年創建由緒、987年勅使派遣等を明示。 |
| 14 | 宮城縣護國神社 | 宮城県 | PASS_HISTORY | 宮城県神社庁に1904年創建、1939年列格、1945年全焼、戦後改称・1957年旧社名復元等の詳細沿革あり。Deity collective HOLDとは独立してHistory Fact化可能。 |
| 15 | 平安神宮 | 京都府 | PASS_HISTORY | 神社公式に創建背景・祭神奉斎・京都近代史との関係を含む由緒・歴史ページあり。 |
| 16 | 岡田宮 | 福岡県 | PASS_HISTORY | 神社公式に古代由緒・記紀に基づく伝承・地域支配史等を明示。伝承とregional contextを分離可能。 |
| 17 | 若宮八幡社 | 愛知県 | PASS_HISTORY | 名古屋市公式Sourceに祭神・由緒・所在地の歴史記述があり、Authority-backed History候補を作成可能。 |
| 18 | 建勲神社 | 京都府 | PASS_HISTORY | 神社公式に1869年創立宣下、1870年神号宣下、1875年列格、1880年造営、1910年移建等を明示。 |
| 19 | 水堂須佐男神社 | 兵庫県 | PASS_HISTORY | 神社公式/Authority Sourceの由緒記述から創祀・地域鎮守・社殿史等をHistory候補化可能。 |
| 20 | 大阪天満宮 | 大阪府 | PASS_HISTORY | 神社公式に大将軍社650年、道真公参拝、949年天満宮創始の由緒を明示。伝承的要素はそのまま保持する。 |
| 21 | 毛谷黒龍神社 | 福井県 | PASS_HISTORY | 神社公式「由緒・沿革」に創建由緒、708年合祀、1329年奉還・改称等を明示。 |
| 22 | 富知六所浅間神社 | 静岡県 | PASS_HISTORY | 静岡県文化財Sourceと富士市博物館の地域史資料に当社を含む浅間神社の由緒・縁起・東泉院関係史料を確認可能。現在祭神のDeity HOLDとは独立してHistory Fact化可能。 |
| 23 | 居多神社 | 新潟県 | PASS_HISTORY | 上越市文化財Sourceに1351年寄進状を含む中近世文書群と社領史を明示。公式観光Sourceにも延喜式内社・一宮としての位置付けを記載。 |
| 24 | 大崎八幡宮 | 宮城県 | PASS_HISTORY | 神社公式に坂上田村麻呂による創祀伝承、大崎氏・伊達政宗による遷祀、現社殿造営の由来を明示。伝承と歴史イベントを分離可能。 |
| 25 | 鎌数伊勢大神宮 | 千葉県 | PASS_HISTORY | 神社公式に1671年創建と椿海干拓事業に伴う由緒を明示。 |
| 26 | 廣田神社 | 青森県 | PASS_HISTORY | 神社公式に996年創建由緒、1625年の青森町中心部への遷座等を明示。 |
| 27 | 石浦神社 | 石川県 | PASS_HISTORY | 神社公式に古代草創、神仏習合、江戸・明治期の改称等の沿革を明示。 |
| 28 | 洲崎神社 | 千葉県 | PASS_HISTORY | 館山市文化財Sourceに本殿造営伝承、建築年代評価、後世修理の可能性を明示。Sourceの確度表現を保持してHistory化可能。 |
| 29 | 來宮神社 | 静岡県 | PASS_HISTORY | 神社公式の神社概要・由緒Sourceから創祀伝承および沿革をHistory候補化可能。 |
| 30 | 蛇窪神社 | 東京都 | PASS_HISTORY | しながわ観光協会に1322年の創建伝承、大干ばつと勧請の由緒、昭和期境内史等を明示。`tradition`として安全に扱える。 |
| 31 | 櫻岡大神宮 | 宮城県 | PASS_HISTORY | 神社公式に1621年勧請、1683年拡張、1872年遷座、1926年現地遷座等を明示。 |
| 32 | 三嶋大社 | 静岡県 | PASS_HISTORY | 神社公式に御由緒・歴史記述があり、古代から中近世の信仰史・社殿史をHistory候補化可能。 |
| 33 | 唐澤山神社 | 栃木県 | PASS_HISTORY | 佐野市文化財Sourceに東明会・佐野常民を主体とする創建と社殿建築年代等を明示。 |
| 34 | 柏神社 | 千葉県 | PASS_HISTORY | 神社公式に1660年前後の羽黒神社勧請伝承、1661年前後の八坂神社奉斎、1880年の境内移転等を明示。 |
| 35 | 櫛田神社 | 福岡県 | PASS_HISTORY | 福岡市文化財Sourceに757年創建伝承と別系統の勧進説を併記し、後者は史料的裏付けなしと明記。確度差を保持してHistory化可能。 |
| 36 | 坪沼八幡神社 | 宮城県 | PASS_HISTORY | 宮城県神社庁に源頼義・義家に関する社伝、明治期社格等の由緒を明示。社伝部分は `tradition` として扱う。 |
| 37 | 菊田神社 | 千葉県 | PASS_HISTORY | 神社公式に弘仁年間の創建伝承と地域史を明示。伝承であることを保持してFact化可能。 |
| 38 | 伊奈波神社 | 岐阜県 | PASS_HISTORY | 神社公式に記紀に基づく祭神由緒と神社沿革を掲載。神話・伝承と神社史を分離してHistory化可能。 |
| 39 | 行田八幡神社 | 埼玉県 | PASS_HISTORY | 神社公式に創祀不詳を明記しつつ源頼義・義家の勧請伝承、天文期遷座、宝永・弘化期再建、平成元年竣工等を明示。 |
| 40 | 青島神社 | 宮崎県 | PASS_HISTORY | 神社公式に奉祀年代不詳を明記し、平安期文献記載、文亀以降の伊東家崇敬、社殿改築等を明示。 |
| 41 | 一之宮貫前神社 | 群馬県 | PASS_HISTORY | 富岡市公式Sourceに祭神・由緒・所在地の記述があり、Authority-backed History候補を作成可能。 |
| 42 | 若宮神明社 | 愛知県 | PASS_HISTORY | 神社公式に文禄年間の資料上の創建記載、戦前戦後の沿革、昭和19年改称、昭和期社格変更等を明示。推測部分と明示記録を分離可能。 |
| 43 | 西宮神社 | 兵庫県 | PASS_HISTORY | 神社公式にえびす大神奉斎の起源伝承を明示。伝承としてFact化可能であり、後続Reviewで中近世以降の沿革Factと分離する。 |

## Deity HOLD 2社のHistory側再評価

### 宮城縣護國神社

Deity Auditでは、祭神が未記名collective deityであるため `HOLD_DEITY_STRUCTURE` とした。
一方、宮城県神社庁Sourceは以下のHistory候補を明示している。

- 1904年の招魂社創建
- 1939年の指定護国神社列格
- 1945年仙台大空襲による施設全焼
- 戦後の「宮城神社」への一時改称
- 1957年の旧社名復元
- 戦後復興した社殿史

したがって、Deity表現判断を待たずとも少なくとも1件のusable History Fact生成経路がある。

```text
DEITY = HOLD_DEITY_STRUCTURE
HISTORY = PASS_HISTORY
ELIGIBILITY_PATH = AVAILABLE_VIA_HISTORY
```

### 富知六所浅間神社

Deity Auditでは、現在祭神を確定できるaccepted current Source不足により `HOLD_DEITY_SOURCE` とした。
一方、静岡県文化財Sourceおよび富士市博物館の地域史資料では、富知六所浅間神社を含む浅間神社・東泉院関係の由緒・縁起・史料群を確認できる。

現在祭神を歴史資料から逆算することはしないが、History Factは独立して作成可能である。

```text
DEITY = HOLD_DEITY_SOURCE
HISTORY = PASS_HISTORY
ELIGIBILITY_PATH = AVAILABLE_VIA_HISTORY
```

## Shared Eligibility Availability Result

Deity Availability Auditでは以下だった。

```text
DEITY_FACT_ACQUISITION_PATH = 41 / 43
```

本History Auditでは以下となった。

```text
HISTORY_FACT_ACQUISITION_PATH = 43 / 43
```

Shared Recommendation EligibilityがOR条件であるため、Availability段階では以下となる。

```text
DEITY_OR_HISTORY_ACQUISITION_PATH = 43 / 43
```

ただしこれは `Recommendation eligible = 43/43` を意味しない。
実際のEligibility確定には、各ShrineをDBへ正しく登録した後、少なくとも1件のDeityまたはHistoryについて以下を完了する必要がある。

1. Fact生成
2. accepted Source生成/再利用
3. Fact↔Source関連付け
4. `verification_status = source_confirmed` または `reviewed`
5. `verified_at` 設定
6. Evidence Gate `usable=True`
7. Shared Recommendation Eligibility通過

## Audit Decision

1. Wave 0 NEW 43社すべてでHistory Fact取得経路を確認した。
2. History Source不足を理由にWave 0候補を除外する必要はない。
3. Deity HOLDだった宮城縣護國神社・富知六所浅間神社もHistory経路を持つ。
4. Availability段階では43/43に `usable Deity OR usable History` の取得経路が存在する。
5. 伝承を事実的創建へ昇格しない。
6. 不明な日付を補完しない。
7. History Factの実生成・Source紐付け・Evidence Gate通過は別PRとする。
8. 本監査はgoriyaku / goriyaku_tagsの取得可能性を保証しない。

## Non-Goals

- Shrine DBへの追加
- History Factの実生成
- Source rowの実生成
- `event_date` の推測
- `history_type` の一括自動決定
- Deity HOLD判断の変更
- goriyaku / goriyaku_tagsの採用
- Recommendation Score / Ranking変更
- Concierge / Compass runtime変更

## Next

次工程:

```text
source-backed goriyaku availability audit
→ goriyaku_tags normalization availability audit
→ Position REVIEW_ANCHOR QA
→ Wave 0 Core Ready判定
```
