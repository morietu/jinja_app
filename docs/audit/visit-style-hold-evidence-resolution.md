# Visit Style HOLD Evidence Resolution Audit

Status

`AUDIT COMPLETE / HOLD 0 / MOTHER SHIP DECISION RECORDED`

## 0. Scope

PR-B1 `docs/audit/visit-style-canonical-candidates.md` で `HOLD` となった8社について、公式神社サイト・自治体・教育委員会・観光協会等の外部Evidenceを追加確認し、`Shrine.visit_style_tags` のcanonical candidateを再評価する後続監査。

本監査はAUDIT ONLY。Seed、Backfill、Bootstrap、Recommendation、DB、Productionは変更しない。

関連監査:

- `docs/audit/visit-style-canonical-candidates.md`

対象8社:

1. 香取神宮
2. 長太稲荷神社
3. 靖國神社
4. 武蔵一宮 氷川女體神社
5. 千葉神社
6. 古峯神社
7. 冠稲荷神社
8. 赤城神社

## 1. Evidence Policy

優先順位:

1. 神社公式
2. 自治体・教育委員会等の公的Source
3. 公式観光協会等の準公的Source

心理的・宗教的な効果はcanonical属性として断定しない。

`quiet` / `less_crowded` / `reset` は、単発の案内文や地域の印象だけでは固定属性に昇格させない。

`nature` は神社境内または神社と直接結びついた自然環境Evidenceを要求する。

`classic` は由緒、文化財、長期に継承された祭祀・文化的位置づけ等の確認可能なEvidenceを要求する。

`study` / `business` は学業・仕事・商売との明示的関連を要求する。

`urban` は立地属性として扱う。

## 2. Mother Ship Decision: AREA_EVIDENCE_ALLOWED

Mother Ship Decision:

`AREA_EVIDENCE_ALLOWED = YES / URBAN_ONLY`

公的な地域Evidenceを利用できるのは、神社固有の宗教的・歴史的・心理的属性ではなく、客観的な立地属性 `urban` の判定に限定する。

`urban` のEvidence Gate:

1. Shrineの住所が一意に確認できる
2. Evidence対象地域とShrine所在地が一致する
3. 自治体等の公的Sourceが住宅地・市街地・都市的土地利用等を説明している
4. 単なる住所中の「市」「区」「町」等の文字列一致ではない

AREA Evidenceだけでは `quiet` / `less_crowded` / `reset` / `classic` / `business` / `study` を付与しない。

`nature` も原則として神社境内または神社と直接結びついた環境Evidenceを必要とする。

## 3. Resolution Result

| Shrine | Previous | External Evidence | Final candidate | Resolution |
| --- | --- | --- | --- | --- |
| 香取神宮 | HOLD | 神社公式は参道を木々に囲まれ、老杉、桜、楓、杜がある境内として説明。別の公式文化財ページで国宝・重要文化財、本殿・楼門等を確認 | `["nature", "classic"]` | RESOLVED / HIGH |
| 長太稲荷神社 | HOLD | 世田谷区公式は上祖師谷1〜7丁目を含む上祖師谷地区を、農地も残る住宅街であり、マンション建設・宅地開発が進む地域と説明 | `["urban"]` | RESOLVED / AREA_EVIDENCE_ALLOWED |
| 靖國神社 | HOLD | 神社公式は1869年の招魂社創建、1879年の靖國神社への改称を明記 | `["classic"]` | RESOLVED / HIGH |
| 武蔵一宮 氷川女體神社 | HOLD | さいたま市は所在地一致の社叢を市指定天然記念物の自然林として説明。文化財資料では現社殿本殿を1667年造営の県指定有形文化財として記録 | `["nature", "classic"]` | RESOLVED / HIGH |
| 千葉神社 | HOLD | 千葉市は千葉神社を市指定史跡として記録。神社公式は千葉天神で菅原道真公を祀り、受験合格・学業向上との明示的関連を説明 | `["classic", "study"]` | RESOLVED / HIGH |
| 古峯神社 | HOLD | 鹿沼市観光公式は大芦川源流近くの深い森に囲まれた山間の鎮座、勝道上人の修行地・修験道の道場としての由緒を説明 | `["nature", "classic"]` | RESOLVED / HIGH |
| 冠稲荷神社 | HOLD | 神社公式は古墳時代から祭祀祭礼が行われてきた宮の森、1125年創建伝承を記載。境内の木瓜は群馬県指定天然記念物 | `["nature", "classic"]` | RESOLVED / HIGH |
| 赤城神社 | HOLD | 前橋観光公式はSeed住所と一致する神社を赤城山・大沼湖畔に鎮座すると説明し、古代から続くとされる納鏡の神事を紹介 | `["nature", "classic"]` | RESOLVED / HIGH |

## 4. Source Register

### 香取神宮

- 境内案内: https://katori-jingu.or.jp/guide/
- 宝物・文化財: https://katori-jingu.or.jp/about/treasure/

Evidence summary:

- 木々、老杉、桜、楓、杜など境内の直接的な自然環境記述を `nature` 根拠とする。
- 国宝、重要文化財、本殿・楼門、古文書等の文化財情報を `classic` 根拠とする。

### 長太稲荷神社

- 世田谷区 上祖師谷地区: https://www.city.setagaya.lg.jp/karasuyamachiiki/kamisoshigaya/index.html

Evidence summary:

- 長太稲荷神社所在地の上祖師谷1丁目を含む同地区について、公的Sourceが住宅街および宅地開発・マンション建設の進展を明記。
- Mother Ship Decision `AREA_EVIDENCE_ALLOWED / URBAN_ONLY` により `urban` の立地Evidenceとして採用する。
- 地域が「閑静」と説明されていても、神社自身が常時静かであることを示さないため `quiet` には昇格させない。

### 靖國神社

- 神社公式「靖國神社について」: https://www.yasukuni.or.jp/history/

Evidence summary:

- 1869年の招魂社創建、1879年の改称という明示的な沿革を `classic` 根拠とする。

### 武蔵一宮 氷川女體神社

- さいたま市「氷川女體神社社叢」: https://www.city.saitama.lg.jp/004/005/006/001/005/002/003/p000558.html
- さいたま市文化財時報 第25号: https://www.city.saitama.lg.jp/004/005/006/002/002/p005906_d/fil/jihou25.pdf

Evidence summary:

- 所在地一致の社叢が自然林として市指定天然記念物であることを `nature` 根拠とする。
- 寛文7年（1667）造営の本殿を含む社殿が県指定有形文化財であることを `classic` 根拠とする。

### 千葉神社

- 千葉市「千葉神社（市指定文化財）」: https://www.city.chiba.jp/kyoiku/shogaigakushu/bunkazai/chibajinja.html
- 千葉神社公式「境内図 / 千葉天神」: https://www.chibajinja.com/about/keidai/index.html

Evidence summary:

- 千葉市指定史跡としての記録、千葉氏との歴史を `classic` 根拠とする。
- 菅原道真公、受験合格、学業向上との明示的関連を `study` 根拠とする。

### 古峯神社

- 鹿沼市観光情報「古峯神社」: https://kanuma-kanko.jp/purpose/%E5%8F%A4%E5%B3%AF%E7%A5%9E%E7%A4%BE/

Evidence summary:

- 深い森に囲まれた山間、大芦川源流近くという所在地説明を `nature` 根拠とする。
- 勝道上人の修行地、修験道の道場としての由緒を `classic` 根拠とする。

### 冠稲荷神社

- 神社公式「ご由緒」: https://kanmuri.com/ka/jinjanituite/goyuisyo
- 神社公式「境内のご案内」: https://kanmuri.com/ka/jinjanituite/goannai

Evidence summary:

- 宮の森および群馬県指定天然記念物の木瓜を `nature` 根拠とする。
- 古墳時代からの祭祀祭礼、1125年創建伝承を `classic` 根拠とする。伝承は確定史実へ格上げしない。

### 赤城神社

- 前橋観光公式「赤城神社（富士見町）」: https://www.maebashi-cvb.com/spot/1053

Evidence summary:

- 赤城山・大沼湖畔という神社所在地に直接結びつく環境を `nature` 根拠とする。
- 古代から続くとされる納鏡神事という継承文化を `classic` 候補の根拠とする。
- 観光ページ中の宗教的効能表現はcanonical判定には使用しない。

## 5. Explicit Non-Adoption

今回の8社には、外部Evidence確認後も以下を付与しない。

- `quiet`
- `less_crowded`
- `reset`

理由:

- 時刻・季節・祭事・参拝者数で変化する状態を固定属性にしない。
- 地域の静けさと神社境内の常時静穏性を同一視しない。
- 心理的変化を事実として保証しない。

また `urban` は長太稲荷神社以外の今回7社へ自動追加しない。住所中の「市」「区」「町」等だけではEvidence Gateを満たさない。

## 6. HOLD Resolution

Before:

- HOLD = 8

After external Evidence review:

- RESOLVED / HIGH = 7
- RESOLVED / AREA_EVIDENCE_ALLOWED = 1
- HOLD = 0

Final candidates:

```text
香取神宮                  ["nature", "classic"]
長太稲荷神社              ["urban"]
靖國神社                  ["classic"]
武蔵一宮 氷川女體神社     ["nature", "classic"]
千葉神社                  ["classic", "study"]
古峯神社                  ["nature", "classic"]
冠稲荷神社                ["nature", "classic"]
赤城神社                  ["nature", "classic"]
```

## 7. Recommendation Impact

本監査自体は文書のみのためruntime impactはない。

PR-B2でfinal candidatesをSeedへ採用した場合、現在Backfill推論値とのintersectionが変わるため `matched_visit_style_tags` / `score_visit_style` / Recommendation順位に変化が生じる可能性がある。

特に今回の8社は、粗いBackfill推論から `classic` / `nature` / `study` / `urban` のEvidence付き候補へ置き換わるため、PR-B2ではRecommendation regressionを必須とする。

## 8. Remaining Mother Ship Decisions

HOLD Evidence Gateは解消した。

PR-B2前に残るMother Ship判断:

1. PR-B1の44社 `ADJUST_WITH_EVIDENCE` と本監査の8社を合わせた52社final candidatesをcanonical Seed値として承認するか
2. Existing 51社のlegacy drift 13社（`love` 11 / `formal` 1 / `tourism` 1）をPR-B2で同時に修正するか、別PRへ分離するか
3. PR-B2 Seed Canonicalizationへ進むか

## 9. Final Result

- External Evidence対象: 8社
- RESOLVED: 8
- HOLD: 0
- New taxonomy: 0
- Seed change: 0
- Backfill change: 0
- Bootstrap change: 0
- Recommendation change: 0
- Production change: 0

`AUDIT COMPLETE / HOLD 0 / MOTHER SHIP DECISION RECORDED`

STOP
