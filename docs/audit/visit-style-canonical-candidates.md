# Visit Style Canonical Candidate Audit

Status

`AUDIT COMPLETE / HOLD ITEMS REMAIN`

## 0. Scope

PR-B1 / AUDIT ONLY。Shrine側のBase Seed正本化に向けたレビュー資料。生成値は `AUTO_CANDIDATE / NON_CANONICAL`、final_candidate_tagsもMother Ship未承認の候補でありcanonical値ではない。Seed反映はPR-B2の判断事項。

Repository: `~/Desktop/jinja_app`。監査日: 2026-09-07 JST。

## 1. Base State

開始時working treeはclean。`git fetch origin develop` 後にlocal developをfast-forwardし、同一HEADから `audit/visit-style-canonical-candidates` を作成した。

- current origin/develop: `311dea936784708ef22460552e0ea0035efb90cf`
- 依頼中の既知基点: `dd2eedca`。差分はNearbyShrineCardListClientとそのtestのみ。
- Base total: 103 / Existing tagged（key存在）: 51 / Missing（key欠落）: 52。想定との差はすべて0。
- Base全103社の `name_jp + address` は一意。52社対象の重複0。
- Seed・backfillファイル存在を確認。infer、taxonomy、visit_preference、extra_condition_tagsを現行ファイルからfresh readした。
- Production接続なし。Django設定／DATABASE_URLをロードせず、DB接続先をloopbackへ固定した。Production設定の有無を推測して安全確認したものではない。
- STOP条件に該当する件数・構造・関数・taxonomyの追加driftなし。

Seed SHA-256: `1af2e426e85c17bdddf5fa6cc3fedf7f5de7191c4ddabf4ef05f72da2d4e0288`。

## 2. Current Ownership

User `visit_preferences` / free-text由来tags → Recommendation input signal。

Shrine `visit_style_tags` → candidate property → `matched_visit_style_tags` → `score_visit_style`。

今回の対象は後者のみ。User側6タグの定義をShrine側のallowed集合として流用しない。

参照: [visit_preference.py](../../backend/temples/domain/visit_preference.py)、[ranking](../../backend/temples/services/concierge_chat_ranking.py)。

## 3. Allowed Taxonomy Contract

候補allowed: `quiet`, `less_crowded`, `nature`, `reset`, `classic`, `business`, `study`, `urban`。

`nearby` は現在地に対する相対的希望を表す `REQUEST_ONLY`。Shrine固定属性にはしない。`love` / `formal` / `tourism` はcanonical forbidden。既存値を自動置換しない。

将来contract候補は1〜3件、重複・unknown・blankなし。根拠不足はHOLD（TBD）とし、0件を完成扱いしない。quietは「常に静か」と断定せず、less_crowdedは時間・祭事依存性を確認する強いEvidence Gateを要する。resetは心理効果の保証ではなく補助matching signal。

[Product taxonomy](../product/visit-style-taxonomy.md) と照合し、新taxonomyを必要とする矛盾なし。既知urban driftは§9へ分離した。

## 4. Candidate Generation Method

Base Seedのkey欠落行のみを元順序で抽出。name_jp / goriyaku / sajin / description / addressを再現し、未定義・nullは空文字へ正規化（infer内の `or ""` と等価）。Knowledgeをinfer入力へ混入しない。

[現行infer](../../backend/temples/management/commands/backfill_goriyaku_tags.py) のFunctionDefをASTでそのまま抽出・実行し、Django import・management command・DB書込みを避けた。関数のコピー改変・再実装ではない。import_shrines_seedのsajin空文字／description nullの取扱いとも照合した。

再現用のread-only Python（repository root、標準ライブラリのみ）:

```python
import ast, json
from pathlib import Path
from types import SimpleNamespace
p = Path("backend/temples/management/commands/backfill_goriyaku_tags.py")
f = next(n for n in ast.parse(p.read_text()).body
         if isinstance(n, ast.FunctionDef) and n.name == "infer_visit_style_tags")
ns = {"Shrine": SimpleNamespace}
exec(compile(ast.Module(body=[f], type_ignores=[]), str(p), "exec"), ns)
rows = json.loads(Path("backend/temples/data/shrines_seed_clean.json").read_text())
assert (len(rows), sum("visit_style_tags" in r for r in rows)) == (103, 51)
for r in rows:
    if "visit_style_tags" not in r:
        s = SimpleNamespace(**{k: r.get(k) or "" for k in
            ("name_jp", "goriyaku", "sajin", "description", "address")})
        print(r["name_jp"], r["address"], ns["infer_visit_style_tags"](s))
```

レビューは全Knowledge seedのsemantic identity照合・History/source_keys/verification_status、Seed fields、Product contract、既存auditの順で確認。places_seedsは検索地点定義でありShrine属性根拠ではない。既存51社のtagging precedentは正しさを保証しないため、欠落根拠の穴埋めに用いなかった。外部サイトの新規照会は行わず、Knowledge内の保存済み記述を根拠とする。source_confirmedはrepositoryに保存された検証状態であり今回の外部再検証を意味しない。伝承は伝承として文化的関連のみを評価した。

住所中の文字や一般的な開運・安全から環境／仕事関連を拡張しない。根拠のあるタグのみを選ぶ保守的候補であり、タグを落としたことはその特性が存在しないとの断定ではない。

## 5. Runtime Comparison

[Desktop Development Contract](../core/desktop-development-contract.md) と [Fresh rebuild記録](fresh-local-db-rebuild.md) を照合。明示接続先 `jinja_db / admin / 127.0.0.1 / 5432`、PostgreSQL 18.0、PostGIS 3.6.0をSELECTで確認した。既存Fresh runtimeに接続し、新規作成・drop・restoreを行っていない。

`psql -X -h 127.0.0.1 -p 5432 -U admin -d jinja_db -w`、取得時 `PGOPTIONS='-c default_transaction_read_only=on'`。取得列はname_jp, address, visit_style_tagsのみ。全103行を取得し、52対象をsemantic identityで一意照合。履歴資料のFresh経路を今回再実行したものではない。

MATCHはSeed由来inferとruntimeのJSON配列が順序込みで一致する場合。canonical妥当性やfinal候補との一致を意味しない。MISMATCHは値のみ記録し原因を推測で修正しない。

Runtime MATCH: 52 / MISMATCH: 0 / NOT_CHECKED: 0 (`RUNTIME_NOT_AVAILABLE`: 0)。

## 6. 52 Shrine Review

`#` は欠落52社内のSeed順、PKではない。EvidenceのK番号は当該行のKnowledgeファイル参照。各ファイル内のshrine_refとHistory title／source_keysで追跡できる。

HOLDのchanged_from_inference=YESは、推論を採用せずTBDへ保留したことを示す。空配列への置換指示ではない。ADJUSTの影響はPR-B2で採用された場合の潜在変化。

| # | name_jp | address | seed_visit_style_tags | inferred_tags | runtime_tags | runtime_match | review_status | final_candidate_tags | changed_from_inference | evidence_basis | review_reason | recommendation_impact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 伏見稲荷大社 | 京都府京都市伏見区深草薮之内町68 | MISSING | `["business", "classic", "urban"]` | `["business", "classic", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["business", "classic"]` | YES | [K1](../../backend/temples/data/knowledge_seeds/batch_1_7_seed.json) shrine_ref一致 / History「伊奈利社ご鎮座説話（和銅4年）」: 「稲荷社神主家大西（秦）氏系図」に基づく伝承では、和銅4年(711)2月壬午の日、秦氏の祖である伊呂巨秦公の時代に稲荷山へ大神が鎮座したとされる。当時の季候不順・五穀不作に際し勅使が名山大川で祈請したところ神の教示があり、稲荷山に祀ったところ「五穀大いに稔り国は富み栄えた」と伝わる。 (source_confirmed; src-999026); Seed.goriyaku「商売繁盛・五穀豊穣」の商売繁盛・仕事運を根拠とする。ご利益の実効性を保証する意味ではない | urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 2 | 出雲大社 | 島根県出雲市大社町杵築東195 | MISSING | `["business", "classic", "urban"]` | `["business", "classic", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K2](../../backend/temples/data/knowledge_seeds/batch_1_7_seed.json) shrine_ref一致 / History「現本殿の建造」: 現在の本殿は延享元年(1744)に建てられた、大社造・檜皮葺の建築である。 (source_confirmed; src-999021) | businessは開運等の広い意味から仕事関連へ拡張できない; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 3 | 宇佐神宮 | 大分県宇佐市南宇佐2859 | MISSING | `["quiet", "reset", "urban"]` | `["quiet", "reset", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K3](../../backend/temples/data/knowledge_seeds/batch_9_seed.json) shrine_ref一致 / History「現在地での一之御殿造立」: 宇佐神宮の公式由緒は、神亀2年（725）に現在地へ一之御殿を造立し、八幡神を祀ったことを宇佐神宮の創建としている。 (source_confirmed; batch9-usa-official) | quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 4 | 日光東照宮 | 栃木県日光市山内2301 | MISSING | `["nature", "quiet", "reset", "business", "classic", "urban"]` | `["nature", "quiet", "reset", "business", "classic", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K4](../../backend/temples/data/knowledge_seeds/batch_1_7_seed.json) shrine_ref一致 / History「陽明門 国宝指定」: 寛永13年(1636)完成の陽明門は、1908年に重要文化財指定を受けた後、1951年6月9日に国宝に指定された。三間一戸楼門、入母屋造、四方軒唐破風付、銅瓦葺。 (source_confirmed; src-999028) | natureは名称・住所中の山／木／緑等の一致に留まり現環境の根拠不足; quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; businessは開運等の広い意味から仕事関連へ拡張できない; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 5 | 住吉大社 | 大阪府大阪市住吉区住吉2-9-89 | MISSING | `["quiet", "reset", "urban"]` | `["quiet", "reset", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K5](../../backend/temples/data/knowledge_seeds/batch_1_7_seed.json) shrine_ref一致 / History「住吉大社の鎮座伝承」: 『日本書紀』『古事記』の伝えとして、伊弉諾尊が禊祓を行った際に海中より出現した底筒男命・中筒男命・表筒男命の三神を祀るのが起源とされる。神功皇后摂政11年（西暦211年）、新羅遠征からの帰途、住吉大神の神託によりこの地に鎮斎されたと公式サイトが伝承として紹介している。 (source_confirmed; src-999043) | quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 6 | 石清水八幡宮 | 京都府八幡市八幡高坊30 | MISSING | `["quiet", "reset", "business", "classic", "urban"]` | `["quiet", "reset", "business", "classic", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K6](../../backend/temples/data/knowledge_seeds/batch_1_7_seed.json) shrine_ref一致 / History「石清水八幡宮の創建（行教和尚の託宣）」: 貞観元年（859年）、南都大安寺の僧・行教和尚が豊前国宇佐八幡宮で祈祷を捧げたところ、八幡大神から「都近き男山の峯に移座して国家を鎮護せん」との御託宣を受け、同年、男山の峯に御神霊を奉安したのが当宮の起源であると公式サイトが伝承として紹介している。 (source_confirmed; src-999042) | quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; businessは開運等の広い意味から仕事関連へ拡張できない; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 7 | 金刀比羅宮 | 香川県仲多度郡琴平町892-1 | MISSING | `["quiet", "reset", "business", "classic", "urban"]` | `["quiet", "reset", "business", "classic", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K7](../../backend/temples/data/knowledge_seeds/batch_1_7_seed.json) shrine_ref一致 / History「崇徳天皇合祀と金刀比羅宮への改称」: 永万元年（1165年）に相殿へ崇徳天皇を合祀し、明治元年（1868年）には神仏混淆が廃止され「琴平神社」に復した上で、同年7月に宮号を賜り「金刀比羅宮」と改称したと公式サイトに記載されている。 (source_confirmed; src-999053) | quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; businessは開運等の広い意味から仕事関連へ拡張できない; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 8 | 鹿島神宮 | 茨城県鹿嶋市宮中2306-1 | MISSING | `["quiet", "reset", "urban"]` | `["quiet", "reset", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K8](../../backend/temples/data/knowledge_seeds/batch_1_7_seed.json) shrine_ref一致 / History「神武天皇による勅祭の伝承」: 神武天皇が東征の際、武甕槌大神の神威により窮地を救われたとし、御即位の年（皇紀元年）に大神をこの地に勅祭したと公式サイトで伝えられている。史実として確定された創建年ではなく、公式サイト自身が伝承として記述している内容である。 (source_confirmed; src-999037) | quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 9 | 香取神宮 | 千葉県香取市香取1697-1 | MISSING | `["quiet", "reset", "business", "classic", "urban"]` | `["quiet", "reset", "business", "classic", "urban"]` | MATCH | HOLD | TBD | YES | [K9](../../backend/temples/data/knowledge_seeds/batch_1_7_seed.json) shrine_ref一致。祭神はあるがHistoryなし。src-999041.noteは公式由緒に創建年記載なしと記録。祭神名だけで体験属性は確定しない | quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; businessは開運等の広い意味から仕事関連へ拡張できない; classicは開運・縁結び等の推論だけでは歴史文化の根拠不足; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; HOLD: 未採用であり空配列の完成扱いではない。追加根拠またはMother Ship判断が必要 | UNKNOWN |
| 10 | 氷川神社（大宮） | 埼玉県さいたま市大宮区高鼻町1-407 | MISSING | `["quiet", "reset", "classic", "urban"]` | `["quiet", "reset", "classic", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K10](../../backend/temples/data/knowledge_seeds/batch_9_seed.json) shrine_ref一致 / History「天平神護2年の封戸寄進記録」: 氷川神社の公式由緒は、『新抄格勅符抄』に奈良時代の天平神護2年（766）、朝廷が当社へ封戸三戸を寄進した記述があるとしている。 (source_confirmed; batch9-omiya-hikawa-official) | quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 11 | 長太稲荷神社 | 日本、〒157-0065 東京都世田谷区上祖師谷１丁目３−１０ | MISSING | `["urban"]` | `["urban"]` | MATCH | HOLD | TBD | YES | [Negative pilot](recommendation-fact-integrity-negative-pilot.md#長太稲荷神社id21) は有効Source不足を記録。current Knowledge seedのsemantic identity一致0件、Seed.goriyaku空 | urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; HOLD: 未採用であり空配列の完成扱いではない。追加根拠またはMother Ship判断が必要 | UNKNOWN |
| 12 | 給田六所神社 | 日本、〒157-0064 東京都世田谷区給田１丁目３−７ | MISSING | `["urban"]` | `["urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K12](../../backend/temples/data/knowledge_seeds/batch_1_7_seed.json) shrine_ref一致 / History「神明社の合祀」: 千歳村給田八五〇番地の無格社・神明社（祭神：天照皇大神）を合祀した。 (source_confirmed; src-999012, src-999011) | urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 13 | 榛名神社 | 群馬県高崎市榛名山町849 | MISSING | `["nature", "business", "classic", "urban"]` | `["nature", "business", "classic", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["business"]` | YES | Seed.goriyaku「開運・五穀豊穣・商売繁盛」の商売繁盛・仕事運を根拠とする。ご利益の実効性を保証する意味ではない | natureは名称・住所中の山／木／緑等の一致に留まり現環境の根拠不足; classicは開運・縁結び等の推論だけでは歴史文化の根拠不足; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; businessのみをSeedの明示的商売関連から候補化。Knowledgeによる裏付け未整備は採用時の留意点 | POTENTIAL_MATCH_CHANGE |
| 14 | 筑波山神社 | 茨城県つくば市筑波1 | MISSING | `["nature", "business", "classic", "urban"]` | `["nature", "business", "classic", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K14](../../backend/temples/data/knowledge_seeds/batch_8_seed.json) shrine_ref一致 / History「筑波一族による奉仕の伝承」: 公式由緒は、崇神天皇の御代に筑波命が筑波国造に命じられ、以来、筑波一族が祭政一致で筑波山神社に奉仕したと伝えている。 (source_confirmed; batch8-tsukuba-official) | natureは名称・住所中の山／木／緑等の一致に留まり現環境の根拠不足; businessは開運等の広い意味から仕事関連へ拡張できない; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 15 | 彌彦神社 | 新潟県西蒲原郡弥彦村弥彦2887-2 | MISSING | `["business", "classic"]` | `["business", "classic"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K15](../../backend/temples/data/knowledge_seeds/batch_1_7_seed.json) shrine_ref一致 / History「天香山命による越後平定伝承」: 神武天皇即位4年（西暦紀元前657年）、天香山命が越の国平定の勅を奉じて日本海を渡り、越後の野積浜に上陸し、漁労・製塩の技術を伝え、弥彦に宮居を定めて住民を導いたと公式サイトに記載されている。 (source_confirmed; src-999058) | businessは開運等の広い意味から仕事関連へ拡張できない; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 16 | 氣多大社 | 石川県羽咋市寺家町ク1-1 | MISSING | `["business", "classic", "urban"]` | `["business", "classic", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K16](../../backend/temples/data/knowledge_seeds/batch_8_seed.json) shrine_ref一致 / History「8世紀の文献記録」: 氣多大社の公式由緒は、神護景雲2年（768）に封戸二十戸と田二町が寄進されたことを『続日本紀』に基づいて記している。 (source_confirmed; batch8-keta-official) | businessは開運等の広い意味から仕事関連へ拡張できない; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 17 | 越中一宮 高瀬神社 | 富山県南砺市高瀬291 | MISSING | `["nature", "quiet", "reset", "business", "classic", "urban"]` | `["nature", "quiet", "reset", "business", "classic", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K17](../../backend/temples/data/knowledge_seeds/batch_12_seed.json) shrine_ref一致 / History「景行天皇御代の創祀伝承」: 高瀬神社の御鎮座は遠く神代の昔、また景行天皇11年の御代とも伝えられている。社伝によれば、御祭神が北国御開拓の折にこの地へ守り神を祀り、国造りを終えた後に自らの御魂をも鎮め祀り、出雲へ帰られたとも伝えられ、後に延喜式内社・越中一宮として崇められてきた。 (source_confirmed; batch12-takase-official) | natureは名称・住所中の山／木／緑等の一致に留まり現環境の根拠不足; quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; businessは開運等の広い意味から仕事関連へ拡張できない; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 18 | 賀茂御祖神社（下鴨神社） | 京都府京都市左京区下鴨泉川町59 | MISSING | `["quiet", "reset", "classic", "urban"]` | `["quiet", "reset", "classic", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K18](../../backend/temples/data/knowledge_seeds/batch_1_7_seed.json) shrine_ref一致 / History「世界文化遺産登録（平成6年）」: 平成6年（1994年）、世界の文化財として世界文化遺産に登録されたと公式サイトに記載されている。 (source_confirmed; src-999048) | quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 19 | 賀茂別雷神社（上賀茂神社） | 京都府京都市北区上賀茂本山339 | MISSING | `["nature", "quiet", "reset", "urban"]` | `["nature", "quiet", "reset", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K19](../../backend/temples/data/knowledge_seeds/batch_1_7_seed.json) shrine_ref一致 / History「賀茂神宮の造営（天武天皇6年）」: 天武天皇6年（677年）、山背国により賀茂神宮が造営され、現在まで殆ど変容することのない御社殿の基が築かれたと公式サイトが記載している。 (source_confirmed; src-999046) | natureは名称・住所中の山／木／緑等の一致に留まり現環境の根拠不足; quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 20 | 生田神社 | 兵庫県神戸市中央区下山手通1-2-1 | MISSING | `["nature", "classic", "urban"]` | `["nature", "classic", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K20](../../backend/temples/data/knowledge_seeds/batch_1_7_seed.json) shrine_ref一致 / History「稚日女尊の神占い伝承（神功皇后元年）」: 神功皇后元年（西暦201年）、三韓外征の帰途、現在の神戸港にて船が進まなくなったため神占いを行ったところ稚日女尊が現れ、「私は活田長峡国に居りたい」と申されたため、海上五十狭茅を神主として祀られたと公式サイトが伝承として紹介している。 (source_confirmed; src-999060) | natureは名称・住所中の山／木／緑等の一致に留まり現環境の根拠不足; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 21 | 宮地嶽神社 | 福岡県福津市宮司元町7-1 | MISSING | `["quiet", "reset", "business", "classic", "urban"]` | `["quiet", "reset", "business", "classic", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["business", "classic"]` | YES | [K21](../../backend/temples/data/knowledge_seeds/batch_1_7_seed.json) shrine_ref一致 / History「神功皇后の三韓外征祈願伝承」: 神功皇后が三韓外征に赴く際、宮地嶽の山頂で天神地祇を祀り道中の平安を祈願したのが当社の起源であると公式サイトに記載されている。この祈願の功績により、後に神功皇后が勝村大神・勝頼大神とともに「宮地嶽三柱大神」として祀られた。 (source_confirmed; src-999059); Seed.goriyaku「開運・商売繁盛・交通安全」の商売繁盛・仕事運を根拠とする。ご利益の実効性を保証する意味ではない | quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 22 | 白山比咩神社 | 石川県白山市三宮町ニ105-1 | MISSING | `["nature", "quiet", "reset", "business", "classic", "urban"]` | `["nature", "quiet", "reset", "business", "classic", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K22](../../backend/temples/data/knowledge_seeds/batch_1_7_seed.json) shrine_ref一致 / History「現在地への遷座（文明12年）」: 文明12年（1480年）の大火により本殿が炎上し御神体を三宮へ奉遷、その後、末社三宮が鎮座していた現在地へ遷されたと公式サイトに記載されている。 (source_confirmed; src-999051) | natureは名称・住所中の山／木／緑等の一致に留まり現環境の根拠不足; quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; businessは開運等の広い意味から仕事関連へ拡張できない; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 23 | 水戸東照宮 | 茨城県水戸市宮町2-5-13 | MISSING | `["business", "classic", "urban"]` | `["business", "classic", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K23](../../backend/temples/data/knowledge_seeds/batch_15_seed.json) shrine_ref一致 / History「元和7年(1621)の創建」: 水戸東照宮は元和7年（1621年）4月21日に、水戸初代藩主徳川頼房公が父徳川家康公の御霊をこの地に祀ったのがはじまりであると公式サイトは記している。 (source_confirmed; batch15-mito-toshogu-official) | businessは開運等の広い意味から仕事関連へ拡張できない; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 24 | 二荒山神社 | 栃木県日光市山内2307 | MISSING | `["nature", "business", "classic", "urban"]` | `["nature", "business", "classic", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic", "nature"]` | YES | [K24](../../backend/temples/data/knowledge_seeds/batch_12_seed.json) shrine_ref一致 / History「霊峰二荒山（男体山）を神体山とする山岳信仰」: 日光二荒山神社は、古くより霊峰二荒山（ふたらさん・男体山、標高2,486メートル）を神の鎮まり給う御山として尊崇したことから、御山を御神体山と仰ぐ神社であり、日光の氏神様でもあると伝えられている。境内は日光国立公園の中枢をなす日光連山を含む3,400ヘクタールに及ぶ広大な神域で、男体山山頂の奥宮・中禅寺湖畔の中宮祠・山内（市内）の御本社の3社から成る。 (source_confirmed; batch12-futarasan-official); 同Historyが国立公園中枢の連山を含む神域と御本社を明記。山名の文字一致のみではない。奥宮・中宮祠の湖畔環境を御本社へ転用しない | businessは開運等の広い意味から仕事関連へ拡張できない; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 25 | 八坂神社 | 京都府京都市東山区祇園町北側625 | MISSING | `["nature", "quiet", "reset", "business", "classic", "urban"]` | `["nature", "quiet", "reset", "business", "classic", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K25](../../backend/temples/data/knowledge_seeds/batch_1_7_seed.json) shrine_ref一致 / History「祇園祭の初見（貞観11年）」: 貞観11年（869年）、国内に疫病が流行した際、洛中の禁苑であった神泉苑に神輿を送って祈ったことに由来するとされ、これが祇園祭の確定的な初見として公式サイトに記載されている。 (source_confirmed; src-999045) | natureは名称・住所中の山／木／緑等の一致に留まり現環境の根拠不足; quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; businessは開運等の広い意味から仕事関連へ拡張できない; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 26 | 住吉神社（博多） | 福岡県福岡市博多区住吉3-1-51 | MISSING | `["quiet", "reset", "urban"]` | `["quiet", "reset", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K26](../../backend/temples/data/knowledge_seeds/batch_12_seed.json) shrine_ref一致 / History「「住吉造」社殿と25年毎の御遷宮」: 当社の社殿は「住吉造」と呼ばれ、神社建築史上最古の特殊な様式をとる。柱・垂木・破風板は丹塗り、羽目板壁は白胡粉塗り、屋根は切妻の直線形、出入り口が直線型妻入式という特徴を持ち、国の重要文化財に指定されている。社殿を改築・修理する御遷宮が25年ごとに行われている。 (source_confirmed; batch12-sumiyoshi-hakata-official) | quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 27 | 靖國神社 | 東京都千代田区九段北3-1-1 | MISSING | `["quiet", "reset", "urban"]` | `["quiet", "reset", "urban"]` | MATCH | HOLD | TBD | YES | current Knowledge seedのsemantic identity一致0件。[既存Evidence audit](shrine-evidence-integrity-full-audit.md) のP1で根拠鎖不足を記録。Seed.goriyaku「厄除け・家内安全・勝運」のみでは今回の体験属性を裏付けない | quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; HOLD: 未採用であり空配列の完成扱いではない。追加根拠またはMother Ship判断が必要 | UNKNOWN |
| 28 | 武蔵一宮 氷川女體神社 | 埼玉県さいたま市緑区宮本2-17-1 | MISSING | `["nature", "quiet", "reset", "classic", "urban"]` | `["nature", "quiet", "reset", "classic", "urban"]` | MATCH | HOLD | TBD | YES | current Knowledge seedのsemantic identity一致0件。[既存Evidence audit](shrine-evidence-integrity-full-audit.md) のP1で根拠鎖不足を記録。Seed.goriyaku「縁結び・安産・家内安全」のみでは今回の体験属性を裏付けない | natureは名称・住所中の山／木／緑等の一致に留まり現環境の根拠不足; quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; classicは開運・縁結び等の推論だけでは歴史文化の根拠不足; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; HOLD: 未採用であり空配列の完成扱いではない。追加根拠またはMother Ship判断が必要 | UNKNOWN |
| 29 | 鷲宮神社 | 埼玉県久喜市鷲宮1-6-1 | MISSING | `["quiet", "reset", "business", "classic", "urban"]` | `["quiet", "reset", "business", "classic", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K29](../../backend/temples/data/knowledge_seeds/batch_13_seed.json) shrine_ref一致 / History「出雲族草創の伝承と関東最古の大社」: 鷲宮神社は出雲族の草創に係る関東最古といわれる大社である。神代の昔、天穂日宮とその御子武夷鳥宮とが部族を率いて神崎神社（大己貴命）を建てて奉祀したのに始まり、次いで天穂日宮の御霊徳を崇め別宮を建てて奉祀した。この別宮が現在の本殿であると伝えられている。 (source_confirmed; batch13-washinomiya-official) | quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; businessは開運等の広い意味から仕事関連へ拡張できない; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 30 | 箭弓稲荷神社 | 埼玉県東松山市箭弓町2-5-14 | MISSING | `["nature", "business", "classic", "urban"]` | `["nature", "business", "classic", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["business", "classic"]` | YES | [K30](../../backend/temples/data/knowledge_seeds/batch_15_seed.json) shrine_ref一致 / History「江戸期以降の隆盛と文化財指定」: 松山城主・川越城主をはじめ多くの人々の信仰を集め、江戸時代には江戸をはじめ四方遠近からの参拝者で社前市をなしたと伝えられる。現在も大小百あまりの講社があり、五穀豊穣・商売繁昌・家内安全等の祈願社として信仰を集めていると公式サイトは記している。 (source_confirmed; batch15-yakyu-inari-official); Seed.goriyaku「商売繁盛・開運・芸能運」の商売繁盛・仕事運を根拠とする。ご利益の実効性を保証する意味ではない | natureは名称・住所中の山／木／緑等の一致に留まり現環境の根拠不足; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 31 | 安房神社 | 千葉県館山市大神宮589 | MISSING | `["nature", "quiet", "reset", "business", "classic", "urban"]` | `["nature", "quiet", "reset", "business", "classic", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["business", "classic"]` | YES | [K31](../../backend/temples/data/knowledge_seeds/batch_12_seed.json) shrine_ref一致 / History「養老元年(717)の遷座」: 養老元年(717)、吾谷山の麓である現在の場所に安房神社が遷座され、天富命・天忍日命を祀る「下の宮」の社殿も併せて造営された。平安時代には延喜式神名帳に記載された式内社・名神大社として、安房国一之宮として崇敬を集めた。 (source_confirmed; batch12-awa-official); Seed.goriyaku「仕事運・開運・技芸上達」の商売繁盛・仕事運を根拠とする。ご利益の実効性を保証する意味ではない | natureは名称・住所中の山／木／緑等の一致に留まり現環境の根拠不足; quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 32 | 千葉神社 | 千葉県千葉市中央区院内1-16-1 | MISSING | `["quiet", "reset", "business", "classic", "urban"]` | `["quiet", "reset", "business", "classic", "urban"]` | MATCH | HOLD | TBD | YES | current Knowledge seedのsemantic identity一致0件。[既存Evidence audit](shrine-evidence-integrity-full-audit.md) のP1で根拠鎖不足を記録。Seed.goriyaku「厄除け・八方除け・開運」のみでは今回の体験属性を裏付けない | quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; businessは開運等の広い意味から仕事関連へ拡張できない; classicは開運・縁結び等の推論だけでは歴史文化の根拠不足; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; HOLD: 未採用であり空配列の完成扱いではない。追加根拠またはMother Ship判断が必要 | UNKNOWN |
| 33 | 玉前神社 | 千葉県長生郡一宮町一宮3048 | MISSING | `["quiet", "reset", "business", "classic", "urban"]` | `["quiet", "reset", "business", "classic", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K33](../../backend/temples/data/knowledge_seeds/batch_14_seed.json) shrine_ref一致 / History「延喜式内名神大社・上総国一之宮としての社格」: 玉前神社は上総国にまつられる古社であり、平安時代にまとめられた『延喜式神名帳』では名神大社としてその名を列せられ、古くから朝廷・豪族・幕府の信仰を集め、上総国一之宮の格式を保ってきたと公式サイトは記している。 (source_confirmed; batch14-tamasaki-yuisho) | quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; businessは開運等の広い意味から仕事関連へ拡張できない; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 34 | 笠間稲荷神社 | 茨城県笠間市笠間1 | MISSING | `["business", "classic", "urban"]` | `["business", "classic", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["business", "classic"]` | YES | [K34](../../backend/temples/data/knowledge_seeds/batch_13_seed.json) shrine_ref一致 / History「御本殿の国重要文化財指定」: 御本殿は江戸時代末期の安政・万延年間（1854～1860）の再建で、銅瓦葺総欅の権現造。昭和63年に国の重要文化財に指定された。 (source_confirmed; batch13-kasama-official); Seed.goriyaku「商売繁盛・五穀豊穣・開運」の商売繁盛・仕事運を根拠とする。ご利益の実効性を保証する意味ではない | urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 35 | 酒列磯前神社 | 茨城県ひたちなか市磯崎町4607-2 | MISSING | `["quiet", "reset", "business", "classic", "urban"]` | `["quiet", "reset", "business", "classic", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K35](../../backend/temples/data/knowledge_seeds/batch_1_7_seed.json) shrine_ref一致 / History「御祭神の磯への降臨（斉衡3年）」: 斉衡3年（856年）12月29日、常陸国鹿島郡大洗の海岸に御祭神・大名持命と少彦名命が御降臨になり、当地（現・ひたちなか市磯崎町）に創建されたと公式サイトに記載されている。 (source_confirmed; src-999055) | quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; businessは開運等の広い意味から仕事関連へ拡張できない; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 36 | 宇都宮二荒山神社 | 栃木県宇都宮市馬場通り1-1-1 | MISSING | `["nature", "quiet", "reset", "business", "classic", "urban"]` | `["nature", "quiet", "reset", "business", "classic", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K36](../../backend/temples/data/knowledge_seeds/batch_16_seed.json) shrine_ref一致 / History「延喜式神名帳への記載と下野国一之宮」: 延長5年（927年）に完成した延喜式・神名帳には「下野國河内郡一座大 二荒山神社 名神大」と記載があり、栃木県内唯一の名神大社として、また下野国一之宮として広く崇められてきたと公式サイトは記している。 (source_confirmed; batch16-futaarayama-official) | natureは名称・住所中の山／木／緑等の一致に留まり現環境の根拠不足; quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; businessは開運等の広い意味から仕事関連へ拡張できない; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 37 | 古峯神社 | 栃木県鹿沼市草久3027 | MISSING | `["nature", "quiet", "reset", "business", "classic", "urban"]` | `["nature", "quiet", "reset", "business", "classic", "urban"]` | MATCH | HOLD | TBD | YES | current Knowledge seedのsemantic identity一致0件。[既存Evidence audit](shrine-evidence-integrity-full-audit.md) のP1で根拠鎖不足を記録。Seed.goriyaku「火防・厄除け・開運」のみでは今回の体験属性を裏付けない | natureは名称・住所中の山／木／緑等の一致に留まり現環境の根拠不足; quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; businessは開運等の広い意味から仕事関連へ拡張できない; classicは開運・縁結び等の推論だけでは歴史文化の根拠不足; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; HOLD: 未採用であり空配列の完成扱いではない。追加根拠またはMother Ship判断が必要 | UNKNOWN |
| 38 | 冠稲荷神社 | 群馬県太田市細谷町1 | MISSING | `["quiet", "reset", "classic", "urban"]` | `["quiet", "reset", "classic", "urban"]` | MATCH | HOLD | TBD | YES | current Knowledge seedのsemantic identity一致0件。[既存Evidence audit](shrine-evidence-integrity-full-audit.md) のP1で根拠鎖不足を記録。Seed.goriyaku「縁結び・子宝・安産」のみでは今回の体験属性を裏付けない | quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; classicは開運・縁結び等の推論だけでは歴史文化の根拠不足; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; HOLD: 未採用であり空配列の完成扱いではない。追加根拠またはMother Ship判断が必要 | UNKNOWN |
| 39 | 妙義神社 | 群馬県富岡市妙義町妙義6 | MISSING | `["quiet", "reset", "business", "classic", "urban"]` | `["quiet", "reset", "business", "classic", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K39](../../backend/temples/data/knowledge_seeds/batch_1_7_seed.json) shrine_ref一致 / History「唐門の重要文化財指定」: 江戸後期(1756年)建造の唐門(桁行一間、梁間一間、平唐門、銅瓦葺)が、1981年6月5日に国指定重要文化財となった。 (source_confirmed; src-999019) | quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; businessは開運等の広い意味から仕事関連へ拡張できない; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 40 | 赤城神社 | 群馬県前橋市富士見町赤城山4-2 | MISSING | `["nature", "business", "classic", "urban"]` | `["nature", "business", "classic", "urban"]` | MATCH | HOLD | TBD | YES | current Knowledge seedのsemantic identity一致0件。[既存Evidence audit](shrine-evidence-integrity-full-audit.md) のP1で根拠鎖不足を記録。Seed.goriyaku「縁結び・開運・心願成就」のみでは今回の体験属性を裏付けない | natureは名称・住所中の山／木／緑等の一致に留まり現環境の根拠不足; businessは開運等の広い意味から仕事関連へ拡張できない; classicは開運・縁結び等の推論だけでは歴史文化の根拠不足; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; HOLD: 未採用であり空配列の完成扱いではない。追加根拠またはMother Ship判断が必要 | UNKNOWN |
| 41 | 鶴嶺八幡宮 | 神奈川県茅ヶ崎市浜之郷462 | MISSING | `["quiet", "reset", "urban"]` | `["quiet", "reset", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K41](../../backend/temples/data/knowledge_seeds/batch_14_seed.json) shrine_ref一致 / History「江戸幕府の朱印地寄進と昭和9年(1934)の郷社列格」: 江戸時代、徳川幕府は先規により高七石の朱印地を寄進した。昭和九年九月十五日（1934年）には郷社に列格したと公式サイトは記している。 (source_confirmed; batch14-tsurumine-official) | quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 42 | 報徳二宮神社 | 神奈川県小田原市城内8-10 | MISSING | `["business", "classic", "urban"]` | `["business", "classic", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["business", "classic", "study"]` | YES | [K42](../../backend/temples/data/knowledge_seeds/batch_15_seed.json) shrine_ref一致 / History「明治27年(1894)の創建」: 明治27年（1894年）4月、二宮尊徳翁の教えを慕う6カ国（伊豆・三河・遠江・駿河・甲斐・相模）の報徳社の総意により、翁を御祭神として、生誕地である小田原の小田原城二の丸小峰曲輪の一角に神社が創建されたと公式サイトは記している。 (source_confirmed; batch15-ninomiya-yuisho); Seed.goriyaku「仕事運・学業成就・開運」の商売繁盛・仕事運を根拠とする。ご利益の実効性を保証する意味ではない; Seed.goriyaku「学業成就」が学びとの明示的関連 | urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 43 | 平塚八幡宮 | 神奈川県平塚市浅間町1-6 | MISSING | `["quiet", "reset", "urban"]` | `["quiet", "reset", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K43](../../backend/temples/data/knowledge_seeds/batch_16_seed.json) shrine_ref一致 / History「関東大震災による倒壊と現社殿の竣工」: 大正12年（1923年）の関東大震災により社殿が倒壊し、現在の社殿は昭和3年（1928年）に竣工したと公式サイトは記している。 (source_confirmed; batch16-hachiman-official) | quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 44 | 忌宮神社 | 山口県下関市長府宮の内町1-18 | MISSING | `["nature", "quiet", "reset", "business", "classic", "urban"]` | `["nature", "quiet", "reset", "business", "classic", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K44](../../backend/temples/data/knowledge_seeds/batch_13_seed.json) shrine_ref一致 / History「延喜式内社・長門二宮としての社格」: 忌宮神社は『古事記』『日本書紀』にも記されている県内でも有数の歴史と伝統を誇る神社であり、延喜式内社に列せられている。社格は長門二宮・旧国幣社と公式サイトは記している。 (source_confirmed; batch13-iminomiya-official) | natureは名称・住所中の山／木／緑等の一致に留まり現環境の根拠不足; quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; businessは開運等の広い意味から仕事関連へ拡張できない; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 45 | 高良大社 | 福岡県久留米市御井町1 | MISSING | `["quiet", "reset", "business", "classic", "urban"]` | `["quiet", "reset", "business", "classic", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K45](../../backend/temples/data/knowledge_seeds/batch_13_seed.json) shrine_ref一致 / History「仁徳天皇御代の御鎮座伝承」: 高良大社の御鎮座は仁徳天皇55年（367）または78年（390）と伝えられ、履中天皇元年（400）に御社殿を建ててお祀りしたとされる。 (source_confirmed; batch13-koura-official) | quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; businessは開運等の広い意味から仕事関連へ拡張できない; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 46 | 寳登山神社 | 埼玉県秩父郡長瀞町長瀞1828 | MISSING | `["nature", "quiet", "reset", "business", "classic", "urban"]` | `["nature", "quiet", "reset", "business", "classic", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K46](../../backend/temples/data/knowledge_seeds/batch_11_seed.json) shrine_ref一致 / History「日本武尊の東征伝承に基づく創建」: 寳登山神社の公式由緒は、第12代景行天皇の皇子日本武尊が東征の帰路に秩父入りし、山頂を目指す途中で山火事に遭遇したが山犬の神助を得て宝登山山頂で神霊を祀ったことを創建の始めとしている。 (source_confirmed; batch11-hodosan-official) | natureは名称・住所中の山／木／緑等の一致に留まり現環境の根拠不足; quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; businessは開運等の広い意味から仕事関連へ拡張できない; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 47 | 枚岡神社 | 大阪府東大阪市出雲井町7-16 | MISSING | `["quiet", "reset", "business", "classic", "urban"]` | `["quiet", "reset", "business", "classic", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["business", "classic"]` | YES | [K47](../../backend/temples/data/knowledge_seeds/batch_12_seed.json) shrine_ref一致 / History「神武東征以前の創祀伝承」: 枚岡神社の創祀は皇紀前、初代天皇の神武天皇が大和の地で即位される3年前と伝えられている。神武東征の際、神武天皇の勅命を奉じた天種子命が国土平定を祈願するため、天児屋根命・比売御神の二神を霊地神津嶽に一大磐境を設けて祀ったのが創祀とされる。 (source_confirmed; batch12-hiraoka-official); Seed.goriyaku「開運・厄除け・商売繁盛」の商売繁盛・仕事運を根拠とする。ご利益の実効性を保証する意味ではない | quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 48 | 護王神社 | 京都府京都市上京区烏丸通下長者町下ル桜鶴円町385 | MISSING | `["quiet", "reset", "urban"]` | `["quiet", "reset", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K48](../../backend/temples/data/knowledge_seeds/batch_1_7_seed.json) shrine_ref一致 / History「神階授与から現在地遷座まで」: 嘉永4年（1851年）、孝明天皇が清麻呂公の歴史的功績を讃えて正一位護王大明神の神階神号を授け、明治7年（1874年）に「護王神社」と改称して別格官幣社に列せられた。明治19年（1886年）には明治天皇の勅命により、京都御所蛤御門前の現在地に社殿を造営し、神護寺境内から遷座したと公式サイトに記載されている。 (source_confirmed; src-999056) | quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 49 | 阿蘇神社 | 熊本県阿蘇市一の宮町宮地3083-1 | MISSING | `["quiet", "reset", "business", "classic", "urban"]` | `["quiet", "reset", "business", "classic", "urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K49](../../backend/temples/data/knowledge_seeds/batch_1_7_seed.json) shrine_ref一致 / History「阿蘇開拓の伝承」: 神武天皇の孫神である健磐龍命が阿蘇を開拓したと伝わる。2000年以上の歴史を有する古社とされる。 (source_confirmed; src-999035) | quietは安／厄除け等の一致で静けさを裏付けない; resetは安／厄除け等の一致で過ごし方の根拠不足; businessは開運等の広い意味から仕事関連へ拡張できない; urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 50 | 北海道神宮 | 北海道札幌市中央区宮ヶ丘474 | MISSING | `["urban"]` | `["urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K50](../../backend/temples/data/knowledge_seeds/batch_17_seed.json) shrine_ref一致 / History「昭和39年の明治天皇増祀と北海道神宮への改称」: 昭和39年に明治天皇が増祀され、同時に社名が札幌神社から北海道神宮へ改称された。 (source_confirmed; batch17-hokkaidojingu-official) | urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |
| 51 | 建部大社 | 滋賀県大津市神領1-16-1 | MISSING | `["urban"]` | `["urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K51](../../backend/temples/data/knowledge_seeds/batch_17_seed.json) shrine_ref一致 / History「源頼朝の祈願と源氏再興後の寄進伝承」: 建部大社公式は、源頼朝が平家に捕らわれた際に当社で前途を祈願し、後に源氏再興を果たして再び参拝し、神宝と神領を寄進したとする由緒を掲載している。 (source_confirmed; batch17-takebetaisha-official-about) | urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない; 遷座年のdisputed 2行は採用根拠から除外 | POTENTIAL_MATCH_CHANGE |
| 52 | 波上宮 | 沖縄県那覇市若狭1-25-11 | MISSING | `["urban"]` | `["urban"]` | MATCH | ADJUST_WITH_EVIDENCE | `["classic"]` | YES | [K52](../../backend/temples/data/knowledge_seeds/batch_17_seed.json) shrine_ref一致 / History「琉球王府と海上交通の中での崇敬」: 波上宮公式は、那覇港を往来する船が航海の平安を祈り、琉球王府も深く信仰し、琉球八社の制では第一の神社として尊崇されたと記している。 (source_confirmed; batch17-naminouegu-official) | urbanは住所中の市／区／町等の一致のみで都市型の根拠不足; classicは上記の由緒・文化史に基づく候補。伝承を確定史実へ格上げしない | POTENTIAL_MATCH_CHANGE |

## 7. Existing 51 Shrine Integrity Scan

フル再レビューは行わず、key存在51社をread-only走査。すべて配列型。違反社の重複を除いた件数は 13。

| 検査 | 該当Shrine数 |
| --- | --- |
| outside_allowed | 13 |
| nearby | 0 |
| duplicate | 0 |
| empty_array | 0 |
| four_or_more | 0 |
| non_string | 0 |
| blank_string | 0 |

## 8. Legacy Seed Drift

すべて `LEGACY_SEED_DRIFT`。配列や既存51社は変更していない。

| name_jp | address | forbidden / outside allowed | current tags | violations |
| --- | --- | --- | --- | --- |
| 浅草神社 | 東京都台東区浅草2-3-1 | `["tourism"]` | `["classic", "tourism", "less_crowded"]` | outside_allowed |
| 川越氷川神社 | 埼玉県川越市宮下町2-11-3 | `["love"]` | `["classic", "love", "nature"]` | outside_allowed |
| 日枝神社 | 東京都千代田区永田町2-10-5 | `["formal"]` | `["quiet", "formal", "classic"]` | outside_allowed |
| 東京大神宮 | 東京都千代田区富士見2-4-1 | `["love"]` | `["quiet", "urban", "love"]` | outside_allowed |
| 江島神社 | 神奈川県藤沢市江の島2-3-8 | `["love"]` | `["nature", "love", "reset"]` | outside_allowed |
| 貴船神社 | 京都府京都市左京区鞍馬貴船町180 | `["love"]` | `["nature", "quiet", "love"]` | outside_allowed |
| 赤坂氷川神社 | 東京都港区赤坂6-10-12 | `["love"]` | `["quiet", "urban", "love"]` | outside_allowed |
| 白山神社 | 東京都文京区白山5-31-26 | `["love"]` | `["quiet", "urban", "love"]` | outside_allowed |
| 多摩川浅間神社 | 東京都大田区田園調布1-55-12 | `["love"]` | `["nature", "quiet", "love"]` | outside_allowed |
| 櫻木神社 | 千葉県野田市桜台210 | `["love"]` | `["study", "love", "reset"]` | outside_allowed |
| 足利織姫神社 | 栃木県足利市西宮町3889 | `["love"]` | `["study", "love", "business"]` | outside_allowed |
| 森戸大明神 | 神奈川県三浦郡葉山町堀内1025 | `["love"]` | `["nature", "love", "reset"]` | outside_allowed |
| 九頭龍神社 新宮 | 神奈川県足柄下郡箱根町元箱根80-1 | `["love"]` | `["nature", "love", "reset"]` | outside_allowed |

| allowed外タグ名 | 出現数 |
| --- | --- |
| tourism | 1 |
| love | 11 |
| formal | 1 |

Unknown（allowed外をすべて数える定義）: 13 occurrences / 3 distinct。既知legacyのlove/formal/tourismとrequest-only nearbyを除く未分類unknownは 0。unknown=0という将来contractは現時点では満たさない。

## 9. DOC_CODE_DRIFT

CURRENT FACT: `urban = SHRINE_CANONICAL_ALLOWED = INTERNAL_ONLY = INPUT_PATH_DOC_CODE_DRIFT`。

Product taxonomyは都市型・市街地型として内部tagを定義。一方visit_preference.pyのmodule docstringはbusiness/study/urbanがlegacy free-textで到達可能と説明するが、current [extra_condition_tags.py](../../backend/temples/domain/extra_condition_tags.py) のEXTRA_TAG_META visit_style registryにもEXTRA_TAGSにもurbanがない。Structured側VISIT_PREFERENCE_TAGSにもない。今回修正しない。既知入力経路の不一致からShrine allowedを削除する判断もしない。

## 10. Recommendation Impact

本PRの実行時挙動への影響は `NONE_EXPECTED`（文書のみ）。将来候補採用時はrankingのset intersection、matched_visit_style_tags、score_visit_style=len(intersection)、重み付き寄与が変わり得る。順位変化の実測・重み再調整は行っていない。

ADJUST全行は `POTENTIAL_MATCH_CHANGE`。quiet/reset/business/urban/nature等の削除は該当希望との一致を減らし、classicやstudy追加は一致を増やし得る。具体的増減は表のinferred_tagsとfinal_candidate_tagsで追跡する。urbanは通常入力経路のdriftがあるため直ちに一致変化が出るとは断定しない。HOLDは候補未確定につき `UNKNOWN`。

## 11. Hold Items

| # | name_jp | 未解決事項 |
| --- | --- | --- |
| 9 | 香取神宮 | TBD。[K9](../../backend/temples/data/knowledge_seeds/batch_1_7_seed.json) shrine_ref一致。祭神はあるがHistoryなし。src-999041.noteは公式由緒に創建年記載なしと記録。祭神名だけで体験属性は確定しない |
| 11 | 長太稲荷神社 | TBD。[Negative pilot](recommendation-fact-integrity-negative-pilot.md#長太稲荷神社id21) は有効Source不足を記録。current Knowledge seedのsemantic identity一致0件、Seed.goriyaku空 |
| 27 | 靖國神社 | TBD。current Knowledge seedのsemantic identity一致0件。[既存Evidence audit](shrine-evidence-integrity-full-audit.md) のP1で根拠鎖不足を記録。Seed.goriyaku「厄除け・家内安全・勝運」のみでは今回の体験属性を裏付けない |
| 28 | 武蔵一宮 氷川女體神社 | TBD。current Knowledge seedのsemantic identity一致0件。[既存Evidence audit](shrine-evidence-integrity-full-audit.md) のP1で根拠鎖不足を記録。Seed.goriyaku「縁結び・安産・家内安全」のみでは今回の体験属性を裏付けない |
| 32 | 千葉神社 | TBD。current Knowledge seedのsemantic identity一致0件。[既存Evidence audit](shrine-evidence-integrity-full-audit.md) のP1で根拠鎖不足を記録。Seed.goriyaku「厄除け・八方除け・開運」のみでは今回の体験属性を裏付けない |
| 37 | 古峯神社 | TBD。current Knowledge seedのsemantic identity一致0件。[既存Evidence audit](shrine-evidence-integrity-full-audit.md) のP1で根拠鎖不足を記録。Seed.goriyaku「火防・厄除け・開運」のみでは今回の体験属性を裏付けない |
| 38 | 冠稲荷神社 | TBD。current Knowledge seedのsemantic identity一致0件。[既存Evidence audit](shrine-evidence-integrity-full-audit.md) のP1で根拠鎖不足を記録。Seed.goriyaku「縁結び・子宝・安産」のみでは今回の体験属性を裏付けない |
| 40 | 赤城神社 | TBD。current Knowledge seedのsemantic identity一致0件。[既存Evidence audit](shrine-evidence-integrity-full-audit.md) のP1で根拠鎖不足を記録。Seed.goriyaku「縁結び・開運・心願成就」のみでは今回の体験属性を裏付けない |

追加の構造化根拠または公式・公的Sourceの確認が必要。HOLDは失敗ではなくEvidence Gateの結果であり、採用しない／採用する判断はMother Shipへ残す。既存auditのmodel-risk分類だけを理由に今回の候補を禁止しているわけではない。

## 12. Mother Ship Decision Gate

Mother Ship must decide:

1. 52社のfinal_candidate_tagsをSeed canonical値として採用するか
2. ADJUST_WITH_EVIDENCEを承認するか
3. HOLD項目をどう扱うか
4. Existing 51 legacy driftを同じSeed Canonicalization PRで修正するか
5. Seed Canonicalization PR-B2へ進むか

CodexはこれらのYES/NOを決定しない。Seed由来business/studyの根拠強度、保守的に未採用とした環境タグ、urbanの入力経路driftも採用時に判断を要する。

## 13. Final Result

| 項目 | 結果 |
| --- | --- |
| Base total | 103 |
| Existing tagged | 51 |
| Missing | 52 |
| KEEP_INFERRED | 0 |
| ADJUST_WITH_EVIDENCE | 44 |
| HOLD | 8 |
| Runtime MATCH | 52 |
| Runtime MISMATCH | 0 |
| Runtime NOT_CHECKED | 0 |
| Legacy drift Shrine count | 13 |
| Unknown tag count (outside allowed occurrences) | 13 |

Validation:

- git diff --check: PASS。
- Seed差分0、Production code差分0、Migration差分0。
- tracked変更対象は本Audit文書のみ。一時処理・取得データは/tmpに置きcommitしない。
- 52社全件掲載、semantic identity重複0、51+52=103。
- Existing 51 integrity scan実施済み。HOLD以外のfinal候補はallowed内・1〜3件・重複0・nearbyなし。
- DBはSELECTのみ。bootstrap/backfill/DBを使うtestの実行および永続データ変更なし。
- push時の既存hookによるOpenAPI lint PASS、Web契約テスト171 files / 1339 tests PASS。

Seed / Backfill / Bootstrap / start.sh / Recommendation / DB schema / Productionの変更なし。taxonomy追加なし。

`AUDIT COMPLETE / HOLD ITEMS REMAIN`

STOP
