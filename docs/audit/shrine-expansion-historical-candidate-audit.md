# Shrine Expansion Historical Candidate Audit

## Status

- Audit status: `CLOSED_PARTIAL_RECOVERY`
- Recorded at: `2026-09-09`
- Scope: 過去に実施した Omairi 全国神社人気ランキング由来の「未登録50社」候補の復元可否確認
- Backend変更: なし
- DB変更: なし
- Recommendation Score変更: なし
- Rankingロジック変更: なし

## 目的

過去の神社拡充調査で「Omairi 全国神社人気ランキング TOP100 と当時のDBを照合し、未登録50社を抽出した」と記録されていた。

しかし、その50社の完全なCandidate Masterと取得時点のランキングスナップショットは現行リポジトリおよび現行DBに保存されていない。

本監査では、過去値を推測で補完せず、復元可能な範囲と復元不能な範囲を分離し、今後の神社500社拡充で同じ履歴欠損を起こさないための扱いを固定する。

## Historical Claim

過去の会話記録上、以下の値が存在する。

```text
historical_claimed_missing_count = 50
```

この `50` は過去の調査時点での集計値であり、現時点で完全な構成員一覧を再現できる証拠は保存されていない。

したがって、`50` を現在のCandidate Masterの正本件数として扱わない。

## Recovery Result

現時点で、過去調査およびOmairiランキング断片から名前を再確認できた未登録候補は44社である。

```text
historical_claimed_missing_count = 50
verified_recovered_candidates = 44
unrecovered_count = 6
recovery_status = UNRECOVERABLE
```

44社については、新しいCandidate Masterへ再投入可能な「復元候補」として扱う。

残り6社については、件数合わせのための推測・補完を行わない。

## 復元不能と判断した理由

### 1. Omairiランキング断片が同一取得時点ではない

復元作業時に確認できたランキングページは、同一日時のTOP100スナップショットではなかった。

確認できた断片には以下の取得・更新日の差が存在した。

```text
1-25位   : 2026-09-07時点の断片
26-50位  : 2026-09-06時点の断片
51-75位  : 2026-08-27時点の断片
76-100位 : 2026-09-03時点の断片
```

Omairiランキングは変動するため、異なる日時のページを単純結合しても、過去調査時点の単一TOP100を再現できない。

### 2. 異なる断片間で同一神社の順位重複が確認された

復元時の代表例として、札幌諏訪神社は異なる日時の断片で複数順位に出現した。

```text
2026-09-06側断片: 34位 札幌諏訪神社
2026-08-27側断片: 51位 札幌諏訪神社
```

したがって、取得日の異なるランキングページを100件として連結すると、重複を含む可能性がある。

### 3. 現行DBは過去監査時点から更新されている

過去監査後も神社追加・座標監査・Canonical確認が継続しており、現在DBと過去監査時点のDBは一致しない。

そのため、現在DBとの再照合結果をそのまま過去の「未登録50社」へ置き換えることはできない。

### 4. 現行DBにCandidate Discovery Provenanceが保存されていない

現行の神社管理データには、神社名・住所・緯度経度・公式Source・確認日・座標監査情報等は存在するが、候補をどこから発見したかを復元するための以下の情報が保存されていない。

```text
discovery_source
discovery_source_url
discovery_rank
captured_at
candidate_batch
candidate_reason
```

そのため、現在登録済みの神社が過去Omairi候補から追加されたのか、別のCoverage監査・Source Pilot・手動選定から追加されたのかを完全には逆算できない。

## Audit Decision

以下を本監査の結論とする。

1. 過去の `50社` は Historical Claim として保存する。
2. 完全復元できた事実として扱わない。
3. 名前を再確認できた44社のみを `verified_recovered_candidates` として扱う。
4. 残り6社は `UNRECOVERABLE` とする。
5. 残り6社を推測で補完しない。
6. 44社は新Candidate Master作成時に再度、現DB重複・Identity・Source・Knowledgeを確認してから採用判定する。
7. Popularity RankingはCandidate Discovery Signalであり、神社の事実SourceまたはRecommendationの根拠Sourceとして扱わない。

## 500社拡充への引き継ぎ

今後のCandidate Masterでは、Candidate発見時点で最低限以下を保存する。

```text
candidate_name
prefecture
discovery_source
discovery_source_url
discovery_rank
captured_at
candidate_reason
```

さらにDB投入前に、別途以下を確認する。

```text
official_name
official_address
official_source_type
official_source_url
verified_at
latitude
longitude
duplicate_status
goriyaku
goriyaku_tags
```

Discovery情報とOfficial Fact Sourceは混在させない。

- Ranking / Popularity Source: 候補を見つけるための情報
- Official / 神社庁 / 自治体等Source: 神社の事実を確定するための情報

## Non-Goals

本監査では以下を行わない。

- 残り6社の推測補完
- 神社DBへの追加
- 既存神社データの変更
- Recommendation Scoreの変更
- Compassロジックの変更
- Conciergeロジックの変更
- PopularityをRecommendation Scoreへ導入する判断

## Close Condition

以下を満たしたため、本Historical Recovery Auditは終了する。

- 過去50社という値の扱いを明示した
- 44社と未復元6社を分離した
- 未復元理由を記録した
- 推測補完を禁止した
- 今後必要なDiscovery Provenance項目を定義した

次工程は、500社拡充用Candidate Masterの新規生成とする。
