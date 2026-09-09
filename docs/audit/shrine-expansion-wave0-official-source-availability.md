# Shrine Expansion Wave 0 Official Source Availability Audit

## Status

- Audit status: `COMPLETE`
- Recorded at: `2026-09-09`
- Scope: Wave 0 `NEW` 43 candidates
- Source availability only
- Production DB write: なし
- Shrine seed change: なし
- Candidate Master data write: なし
- Knowledge Fact生成: なし
- goriyaku / goriyaku_tags採用判断: なし
- Recommendation / Concierge / Compass変更: なし

## 目的

Historical Omairi由来のWave 0候補44社のうち、Current DB Duplicate Auditで `NEW` と判定された43社について、KAMI MUSUBIのFact確認に利用可能なOfficial / Authority Sourceを現在取得できるかを確認する。

本監査はSource本文からFactを採用する工程ではない。
Sourceの存在・取得可否のみを確認し、祭神・由緒・ご利益・位置情報の最終採用は後続Reviewへ分離する。

## Source Acceptance Policy

本監査で利用可能と判定するSourceは以下。

1. `shrine_official`: 神社自身が運営する公式サイト
2. `jinja_authority`: 神社本庁 / 都道府県神社庁
3. `government`: 国・都道府県・市区町村の公式ページ
4. `cultural_property`: 文化庁・自治体文化財ページ

観光ランキング・Omairi等のDiscovery SourceはOfficial Fact Sourceとして採用しない。

## Availability Status

- `PASS_FIRST_PARTY`: 神社公式Sourceを本監査で取得できた
- `PASS_AUTHORITY`: 神社公式以外の神社庁・自治体・文化財Sourceを取得できた
- `PASS_AUTHORITY_WITH_OFFICIAL_FETCH_ISSUE`: 公式URLは確認できるが本監査環境では取得失敗。代替のAuthority Sourceを取得できた
- `HOLD`: acceptable Sourceを取得できない
- `UNKNOWN`: identityまたはSourceの対応関係が確定できない

## Summary

| Status | Count |
|---|---:|
| PASS_FIRST_PARTY | 32 |
| PASS_AUTHORITY | 9 |
| PASS_AUTHORITY_WITH_OFFICIAL_FETCH_ISSUE | 2 |
| HOLD | 0 |
| UNKNOWN | 0 |
| **Total** | **43** |

`OFFICIAL_SOURCE_AVAILABILITY = 43 / 43 (100%)`

これはFact completeness 100%を意味しない。
各Sourceから必要な `official_name / official_address / deity / history / goriyaku` がすべて取れることも意味しない。

## Candidate Matrix

| # | candidate_name | prefecture | status | source_type | source_url | availability_note |
|---:|---|---|---|---|---|---|
| 1 | 三輪神社 | 愛知県 | PASS_FIRST_PARTY | shrine_official | https://miwajinnjya.com/ | 神社公式を取得。名称・所在地・由緒等を確認可能。 |
| 2 | 大鳥大社 | 大阪府 | PASS_FIRST_PARTY | shrine_official | https://www.ootoritaisha.jp/access/ | 神社公式を取得。公式アクセス・社務情報を確認可能。 |
| 3 | 御岩神社 | 茨城県 | PASS_FIRST_PARTY | shrine_official | https://www.oiwajinja.jp/ | 神社公式を取得。所在地・由緒・祈祷等の導線あり。 |
| 4 | 姫嶋神社 | 大阪府 | PASS_AUTHORITY | jinja_authority | https://www.jinjahoncho.or.jp/sys/6909 | 神社本庁公式の対象神社ページを取得。 |
| 5 | 烏森神社 | 東京都 | PASS_FIRST_PARTY | shrine_official | https://karasumorijinja.or.jp/ | 神社公式を取得。御祭神・御神徳・所在地を確認可能。 |
| 6 | 榴岡天満宮 | 宮城県 | PASS_FIRST_PARTY | shrine_official | https://tsutsujigaokatenmangu.jp/about/ | 神社公式を取得。宮城県神社庁ページでもcorroborate可能。 |
| 7 | 射水神社 | 富山県 | PASS_FIRST_PARTY | shrine_official | https://www.imizujinjya.or.jp/ | 神社公式を取得。 |
| 8 | 別小江神社 | 愛知県 | PASS_FIRST_PARTY | shrine_official | https://www.wakeoe.com/ | 神社公式を取得。所在地・由緒・御神徳の記載あり。 |
| 9 | 戸隠神社 中社 | 長野県 | PASS_FIRST_PARTY | shrine_official | https://www.togakushi-jinja.jp/about/ | 戸隠神社公式で中社を独立セクションとして確認可能。 |
| 10 | 札幌諏訪神社 | 北海道 | PASS_FIRST_PARTY | shrine_official | https://www.sapporo-suwajinja.com/ | 神社公式を取得。由緒・所在地を確認可能。 |
| 11 | 少彦名神社 | 大阪府 | PASS_FIRST_PARTY | shrine_official | https://www.sinnosan.jp/ | 神社公式を取得。祭神・医薬信仰等を確認可能。 |
| 12 | 大神神社 | 奈良県 | PASS_FIRST_PARTY | shrine_official | https://oomiwa.or.jp/jinja/ | 神社公式を取得。御祭神・神社概要を確認可能。 |
| 13 | 北野天満宮 | 京都府 | PASS_FIRST_PARTY | shrine_official | https://kitanotenmangu.or.jp/ | 神社公式を取得。 |
| 14 | 宮城縣護國神社 | 宮城県 | PASS_FIRST_PARTY | shrine_official | https://gokokujinja.org/ | 神社公式を取得。宮城県神社庁でもcorroborate可能。 |
| 15 | 平安神宮 | 京都府 | PASS_FIRST_PARTY | shrine_official | https://www.heianjingu.or.jp/ | 神社公式を取得。由緒・参拝・所在地を確認可能。 |
| 16 | 岡田宮 | 福岡県 | PASS_FIRST_PARTY | shrine_official | https://okadagu.jp/ | 神社公式を取得。所在地・祈願導線等を確認可能。 |
| 17 | 若宮八幡社 | 愛知県 | PASS_AUTHORITY_WITH_OFFICIAL_FETCH_ISSUE | government | https://www.city.nagoya.jp/naka/miryoku/1021146/1033230/1048645.html | 名古屋市公式で祭神・由緒・所在地を取得。公式 `wakamiya.or.jp` は確認できるが本監査では502。 |
| 18 | 建勲神社 | 京都府 | PASS_FIRST_PARTY | shrine_official | https://kenkun-jinja.org/ | 神社公式を取得。京都市公式でもcorroborate可能。 |
| 19 | 水堂須佐男神社 | 兵庫県 | PASS_FIRST_PARTY | shrine_official | https://www.m-susanoo.net/ | 神社公式を取得。 |
| 20 | 大阪天満宮 | 大阪府 | PASS_FIRST_PARTY | shrine_official | https://osakatemmangu.or.jp/ | 神社公式を取得。所在地等を確認可能。 |
| 21 | 毛谷黒龍神社 | 福井県 | PASS_FIRST_PARTY | shrine_official | https://www.kurotatu-jinja.jp/about/ | 神社公式を取得。祭神・御神徳・由緒を確認可能。 |
| 22 | 富知六所浅間神社 | 静岡県 | PASS_AUTHORITY | cultural_property | https://www.pref.shizuoka.jp/kankosports/bunkageijutsu/bunkazai/1002825/1041003/1041889/1004988/1021610.html | 静岡県文化財公式で神社identity・所在地・所有者を確認可能。 |
| 23 | 居多神社 | 新潟県 | PASS_AUTHORITY | jinja_authority | https://niigata-jinjacho.jp/shrine_niigata/search.php?area=&keyword=%E5%B1%85%E5%A4%9A%E7%A5%9E%E7%A4%BE | 新潟県神社庁で名称・所在地を取得。上越市文化財Sourceも利用可能。 |
| 24 | 大崎八幡宮 | 宮城県 | PASS_AUTHORITY | jinja_authority | https://miyagi-jinjacho.or.jp/jinja-search/detail.php?code=310010033 | 宮城県神社庁で祭神・由緒・所在地を取得。宮城県文化財Sourceも利用可能。 |
| 25 | 鎌数伊勢大神宮 | 千葉県 | PASS_FIRST_PARTY | shrine_official | https://kamakazu.com/ | 神社公式を取得。 |
| 26 | 廣田神社 | 青森県 | PASS_FIRST_PARTY | shrine_official | https://hirotajinja.or.jp/ | 神社公式を取得。所在地・祈願等を確認可能。 |
| 27 | 石浦神社 | 石川県 | PASS_FIRST_PARTY | shrine_official | https://www.ishiura.jp/yuisho/index.html | 神社公式を取得。御祭神・由緒・御神徳を確認可能。 |
| 28 | 洲崎神社 | 千葉県 | PASS_AUTHORITY | government | https://www.city.tateyama.chiba.jp/syougaigaku/page100208.html | 館山市文化財公式でidentityを確認。千葉県公式宗教法人一覧・文化財Sourceも利用可能。 |
| 29 | 來宮神社 | 静岡県 | PASS_FIRST_PARTY | shrine_official | https://kinomiya.or.jp/top/overview/ | 神社公式を取得。祭神・由緒等を確認可能。 |
| 30 | 蛇窪神社 | 東京都 | PASS_AUTHORITY_WITH_OFFICIAL_FETCH_ISSUE | government | https://www.city.shinagawa.tokyo.jp/PC/shinagawaphotonews/shinagawaphotonews-2024/20240306100331.html | 品川区公式で神社identityを確認。公式 `hebikubo.jp` は確認できるが本監査環境では403。しながわ観光協会でも所在地・公式URLをcorroborate可能。 |
| 31 | 櫻岡大神宮 | 宮城県 | PASS_FIRST_PARTY | shrine_official | https://sakuragaoka6826.sakura.ne.jp/ | 神社公式を取得。所在地を確認可能。 |
| 32 | 三嶋大社 | 静岡県 | PASS_FIRST_PARTY | shrine_official | https://www.mishimataisha.or.jp/shrine | 神社公式を取得。御祭神・由緒・所在地を確認可能。 |
| 33 | 唐澤山神社 | 栃木県 | PASS_AUTHORITY | government | https://www.city.sano.lg.jp/soshikiichiran/kyouiku/bunkazaika/oshirase/22523.html | 佐野市文化財公式で祭神・創建・所在地文脈を確認。文化庁DBも利用可能。 |
| 34 | 柏神社 | 千葉県 | PASS_FIRST_PARTY | shrine_official | https://www.kashiwajinja.com/ | 神社公式を取得。宗教法人名・所在地・祭祀系統を確認可能。 |
| 35 | 櫛田神社 | 福岡県 | PASS_AUTHORITY | jinja_authority | https://fukuoka-jinjacho.or.jp/area/fukuoka/ | 福岡県神社庁で名称・所在地・連絡先を確認可能。 |
| 36 | 坪沼八幡神社 | 宮城県 | PASS_AUTHORITY | jinja_authority | https://miyagi-jinjacho.or.jp/jinja-search/detail.php?code=310010295 | 宮城県神社庁の八幡神社ページで坪沼所在地・祭神・由緒を確認。公式URLも掲載。 |
| 37 | 菊田神社 | 千葉県 | PASS_FIRST_PARTY | shrine_official | https://kikuta-jinja.jp/keidai/ | 神社公式を取得。所在地・境内社・御神徳等を確認可能。 |
| 38 | 伊奈波神社 | 岐阜県 | PASS_FIRST_PARTY | shrine_official | https://www.inabasan.com/ | 神社公式を取得。岐阜県神社庁でもcorroborate可能。 |
| 39 | 行田八幡神社 | 埼玉県 | PASS_FIRST_PARTY | shrine_official | https://www.gyodahachiman.jp/ | 神社公式を取得。埼玉県神社庁でもcorroborate可能。 |
| 40 | 青島神社 | 宮崎県 | PASS_FIRST_PARTY | shrine_official | https://aoshima-jinja.jp/ | 神社公式を取得。宮崎県・宮崎市観光公式でもcorroborate可能。 |
| 41 | 一之宮貫前神社 | 群馬県 | PASS_AUTHORITY | government | https://www.tomioka-silk.jp/_spot/sightseeing/detail/Nukisaki-shrine.html | 富岡市公式観光ページで祭神・由緒・所在地を確認可能。 |
| 42 | 若宮神明社 | 愛知県 | PASS_FIRST_PARTY | shrine_official | https://wakamiya-shinmeisha.amebaownd.com/posts/7862023/ | 神社自身の公式ホームページ開設記事と公式オンライン社務所を取得。 |
| 43 | 西宮神社 | 兵庫県 | PASS_FIRST_PARTY | shrine_official | https://nishinomiya-ebisu.com/ | 神社公式を取得。兵庫県神社庁でもcorroborate可能。 |

## Findings

### 1. Wave 0はOfficial Source不足で止まらない

43候補すべてについて、現時点でKAMI MUSUBIのFact Reviewへ進むためのacceptable Sourceを少なくとも1件取得できた。

したがってWave 0の次工程をSource Discoveryそのものから開始する必要はない。

### 2. First-party取得率は高い

43件中32件は神社公式Sourceを直接取得できた。

残る11件も神社庁・自治体・文化財等のAuthority Sourceを取得できた。

### 3. 公式サイトFetch Issueは2件

#### 若宮八幡社

公式サイトURL `http://www.wakamiya.or.jp/` は名古屋市公式ページ等から確認できるが、本監査環境ではHTTPS昇格後 `502 Bad Gateway` となった。

ただし名古屋市公式で祭神・由緒・所在地を確認できるため、Source availability自体はPASSとする。

#### 蛇窪神社

公式サイト `https://hebikubo.jp/` は本監査環境では `403 Forbidden`。

ただし品川区公式およびしながわ観光協会で神社identity・所在地・公式URLをcorroborateできるため、Source availability自体はPASSとする。

### 4. Authority Sourceだけで十分とはまだ判断しない

本監査のPASSは「Fact Reviewへ進めるSourceが存在する」という意味に限定する。

特に以下は後続Reviewで項目別Source適合性を確認する必要がある。

- `official_name`
- `official_address`
- `latitude / longitude`
- `deity`
- `shrine_history`
- `goriyaku`
- `goriyaku_tags`

例えば文化財Sourceが神社identityと所在地を裏付けても、ご利益を裏付けるとは限らない。

## Audit Decision

```text
WAVE0_NEW_CANDIDATES = 43
OFFICIAL_SOURCE_AVAILABLE = 43
OFFICIAL_SOURCE_HOLD = 0
OFFICIAL_SOURCE_UNKNOWN = 0

PASS_FIRST_PARTY = 32
PASS_AUTHORITY = 9
PASS_AUTHORITY_WITH_OFFICIAL_FETCH_ISSUE = 2
```

43社すべてを次の `OFFICIAL_IDENTITY_AND_KNOWLEDGE_FIELD_REVIEW` へ進めることが可能。

ただし本監査のみを根拠にCandidate Masterの `official_name / official_address / deity / history / goriyaku` を確定しない。

## Non-Goals

本監査では以下を行わない。

- Official Factの最終採用
- 座標確定
- deity Fact生成
- History Fact生成
- goriyaku採用
- goriyaku_tags正規化
- Candidate Masterへの43社投入
- Shrine Seed変更
- Production DB変更
- Recommendation Eligibility判定
- Concierge / Compass QA

## Next

次工程:

```text
Wave 0 43社
  -> Official Identity field review
  -> Position review
  -> Deity / History availability review
  -> Goriyaku availability review
  -> Candidate Master write
```
