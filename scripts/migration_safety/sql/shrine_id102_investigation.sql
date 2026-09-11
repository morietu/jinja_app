-- SELECT-only. Safe to run against Production.
--
-- W0-B02-T01 Production-only Shrine Investigation。
-- Reconciliation Gate が検出した唯一の PROD_ONLY 行
--   db_id=102 / name_jp='テスト確認神社 20260611' / address='東京テスト'
-- の全保存field・監査field・被参照関係を read-only で確定する。
--
-- 契約:
--   * SELECT のみ。INSERT / UPDATE / DELETE / DDL を含まない。
--   * 対象行を id ではなく id と identity の両方で確認し、id 再利用の
--     可能性を取り違えない。
--   * cleanup を行わない。判断も行わない。事実の取得のみ。
--
-- 使い方:
--   scripts/migration_safety/readonly_query.sh \
--     ~/.config/kami-musubi/production-db.env DATABASE_URL \
--     scripts/migration_safety/sql/shrine_id102_investigation.sql

-- 1. 対象行の全保存field（location は WKT ではなくテキスト表現で確認する）。
SELECT 'SECTION_1_ROW' AS section, s.*
FROM temples_shrine AS s
WHERE s.id = 102;

-- 2. identity と監査fieldだけを抜き出した確認用ビュー。
--    id=102 が本当に当該 identity の行かを取り違えないための独立確認。
SELECT 'SECTION_2_IDENTITY' AS section,
       s.id,
       s.name_jp,
       s.address,
       s.kind,
       s.created_at,
       s.updated_at,
       s.owner_id,
       s.place_ref_id,
       s.latitude,
       s.longitude,
       (s.location IS NULL) AS location_is_null,
       s.goriyaku,
       s.sajin,
       s.astro_elements,
       s.visit_style_tags,
       s.history_theme,
       s.views_30d,
       s.favorites_30d,
       s.popular_score,
       s.last_popular_calc_at
FROM temples_shrine AS s
WHERE s.name_jp = 'テスト確認神社 20260611'
   OR s.address = '東京テスト'
   OR s.id = 102;

-- 3. 被参照関係の件数（Shrine を参照する全 FK / M2M）。
--    Django の related_objects 実測に基づく網羅列挙であり、推測ではない。
SELECT 'SECTION_3_REFERENCES' AS section, relation, referencing_rows
FROM (
  SELECT 'temples_shrinedeity'             AS relation, count(*) AS referencing_rows FROM temples_shrinedeity             WHERE shrine_id = 102
  UNION ALL SELECT 'temples_shrinehistory',            count(*) FROM temples_shrinehistory            WHERE shrine_id = 102
  UNION ALL SELECT 'temples_historythemeassignment',   count(*) FROM temples_historythemeassignment   WHERE shrine_id = 102
  UNION ALL SELECT 'temples_shrinegoriyakuassignment', count(*) FROM temples_shrinegoriyakuassignment WHERE shrine_id = 102
  UNION ALL SELECT 'temples_favorite',                 count(*) FROM temples_favorite                 WHERE shrine_id = 102
  UNION ALL SELECT 'temples_conciergethread',          count(*) FROM temples_conciergethread          WHERE main_shrine_id = 102
  UNION ALL SELECT 'temples_visit',                    count(*) FROM temples_visit                    WHERE shrine_id = 102
  UNION ALL SELECT 'temples_shrinereflection',         count(*) FROM temples_shrinereflection         WHERE shrine_id = 102
  UNION ALL SELECT 'temples_shrineinteractionlog',     count(*) FROM temples_shrineinteractionlog     WHERE shrine_id = 102
  UNION ALL SELECT 'temples_actionevent',              count(*) FROM temples_actionevent              WHERE shrine_id = 102
  UNION ALL SELECT 'temples_goshuin',                  count(*) FROM temples_goshuin                  WHERE shrine_id = 102
  UNION ALL SELECT 'temples_like',                     count(*) FROM temples_like                     WHERE shrine_id = 102
  UNION ALL SELECT 'temples_rankinglog',               count(*) FROM temples_rankinglog               WHERE shrine_id = 102
  UNION ALL SELECT 'temples_conciergehistory',         count(*) FROM temples_conciergehistory         WHERE shrine_id = 102
  UNION ALL SELECT 'temples_shrine_goriyaku_tags',     count(*) FROM temples_shrine_goriyaku_tags     WHERE shrine_id = 102
) AS refs
ORDER BY referencing_rows DESC, relation;

-- 4. id 102 の前後に位置する行。連番の隣接から投入バッチを推定するための材料。
--    推定材料であって断定材料ではない。
SELECT 'SECTION_4_NEIGHBORS' AS section,
       s.id, s.name_jp, s.address, s.kind, s.created_at, s.updated_at
FROM temples_shrine AS s
WHERE s.id BETWEEN 96 AND 110
ORDER BY s.id;

-- 5. 同じ QA/テスト命名規約に該当する行の全件。
--    exclude_qa_fixture_shrines（backend/temples/services/shrine_qa_fixture_exclusion.py）
--    と同じ条件を SQL 側で再現し、id 102 が単独事象か群の一部かを確認する。
SELECT 'SECTION_5_QA_NAMED' AS section,
       s.id, s.name_jp, s.address, s.kind, s.created_at, s.updated_at
FROM temples_shrine AS s
WHERE s.name_jp LIKE 'テスト%'
   OR s.name_jp ILIKE 'test%'
   OR s.name_jp ILIKE '%承認テスト%'
   OR s.name_jp LIKE '%検証%'
   OR s.name_jp IN ('x', 'x2', 'noaddr', '住所なし神社', 'test神社',
                    'テスト候補神社', 'テスト神社', 'テスト神社2',
                    'テスト神社-1770895174')
ORDER BY s.id;

-- 6. Shrine 全体の件数と created_at の分布。
--    id 102 の created_at が既存投入バッチと同時刻かを判定する材料。
SELECT 'SECTION_6_CREATED_AT_BUCKETS' AS section,
       date_trunc('minute', s.created_at) AS created_minute,
       count(*) AS rows,
       min(s.id) AS min_id,
       max(s.id) AS max_id
FROM temples_shrine AS s
GROUP BY date_trunc('minute', s.created_at)
ORDER BY created_minute;
