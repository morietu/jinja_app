-- SELECT-only. Safe to run against Production.
--
-- W0-B02-T02 PRE snapshot capture。
-- Shrine pk=102 と ShrineInteractionLog pk=3,6 を削除する可逆migrationを
-- 書くために必要な「reverseが復元する静的スナップショット値」を取得する。
--
-- このSQLは判断も削除も行わない。migrationのPRE定数を確定するための
-- 事実取得のみ。
--
-- 使い方:
--   scripts/migration_safety/readonly_query.sh \
--     ~/.config/kami-musubi/production-db.env DATABASE_URL \
--     scripts/migration_safety/sql/shrine_id102_pre_snapshot.sql

-- A. Shrine pk=102 の全field（reverseが復元する値）。
--    location は legacy text 列の可能性があるため text へ明示castする。
SELECT 'A_SHRINE_SNAPSHOT' AS section,
       s.id, s.kind, s.name_jp, s.name_romaji, s.address,
       s.latitude, s.longitude, s.location::text AS location_text,
       s.goriyaku, s.sajin, s.description, s.element, s.kyusei,
       s.astro_elements, s.visit_style_tags, s.history_theme,
       s.views_30d, s.favorites_30d, s.popular_score, s.last_popular_calc_at,
       s.place_ref_id, s.owner_id,
       s.created_at, s.updated_at
FROM temples_shrine AS s
WHERE s.id = 102;

-- B. ShrineInteractionLog の全行（pk を絞らず shrine_id で取得する）。
--    「exactly 2 rows / pk が 3,6」という PRE をここで検証するため、
--    pk で先に絞り込まない。3件目が存在すれば必ずここに現れる。
SELECT 'B_INTERACTION_LOGS' AS section,
       il.id, il.user_id, il.shrine_id, il.action_type, il.source,
       il.thread_id, il.metadata::text AS metadata_text, il.created_at
FROM temples_shrineinteractionlog AS il
WHERE il.shrine_id = 102
ORDER BY il.id;

-- C. ShrineInteractionLog の件数（PRE: exactly 2）。
SELECT 'C_INTERACTION_LOG_COUNT' AS section,
       count(*) AS total_rows,
       count(*) FILTER (WHERE il.id IN (3, 6)) AS rows_with_expected_pks,
       count(*) FILTER (WHERE il.id NOT IN (3, 6)) AS rows_with_unexpected_pks
FROM temples_shrineinteractionlog AS il
WHERE il.shrine_id = 102;

-- D. Shrine を参照する全 relation の件数と、その table が現環境に存在するか。
--    「その他 N relation が 0」の N を推測せず、存在する table のみを
--    実測して数える。
SELECT 'D_RELATIONS' AS section, relation, column_name, table_exists, referencing_rows
FROM (
  SELECT 'temples_shrinedeity' AS relation, 'shrine_id' AS column_name,
         to_regclass('public.temples_shrinedeity') IS NOT NULL AS table_exists,
         (SELECT count(*) FROM temples_shrinedeity WHERE shrine_id = 102) AS referencing_rows
  UNION ALL SELECT 'temples_shrinehistory', 'shrine_id',
         to_regclass('public.temples_shrinehistory') IS NOT NULL,
         (SELECT count(*) FROM temples_shrinehistory WHERE shrine_id = 102)
  UNION ALL SELECT 'temples_historythemeassignment', 'shrine_id',
         to_regclass('public.temples_historythemeassignment') IS NOT NULL,
         (SELECT count(*) FROM temples_historythemeassignment WHERE shrine_id = 102)
  UNION ALL SELECT 'temples_shrinegoriyakuassignment', 'shrine_id',
         to_regclass('public.temples_shrinegoriyakuassignment') IS NOT NULL,
         (SELECT count(*) FROM temples_shrinegoriyakuassignment WHERE shrine_id = 102)
  UNION ALL SELECT 'temples_favorite', 'shrine_id',
         to_regclass('public.temples_favorite') IS NOT NULL,
         (SELECT count(*) FROM temples_favorite WHERE shrine_id = 102)
  UNION ALL SELECT 'temples_conciergethread', 'main_shrine_id',
         to_regclass('public.temples_conciergethread') IS NOT NULL,
         (SELECT count(*) FROM temples_conciergethread WHERE main_shrine_id = 102)
  UNION ALL SELECT 'temples_visit', 'shrine_id',
         to_regclass('public.temples_visit') IS NOT NULL,
         (SELECT count(*) FROM temples_visit WHERE shrine_id = 102)
  UNION ALL SELECT 'temples_shrinereflection', 'shrine_id',
         to_regclass('public.temples_shrinereflection') IS NOT NULL,
         (SELECT count(*) FROM temples_shrinereflection WHERE shrine_id = 102)
  UNION ALL SELECT 'temples_actionevent', 'shrine_id',
         to_regclass('public.temples_actionevent') IS NOT NULL,
         (SELECT count(*) FROM temples_actionevent WHERE shrine_id = 102)
  UNION ALL SELECT 'temples_goshuin', 'shrine_id',
         to_regclass('public.temples_goshuin') IS NOT NULL,
         (SELECT count(*) FROM temples_goshuin WHERE shrine_id = 102)
  UNION ALL SELECT 'temples_like', 'shrine_id',
         to_regclass('public.temples_like') IS NOT NULL,
         (SELECT count(*) FROM temples_like WHERE shrine_id = 102)
  UNION ALL SELECT 'temples_rankinglog', 'shrine_id',
         to_regclass('public.temples_rankinglog') IS NOT NULL,
         (SELECT count(*) FROM temples_rankinglog WHERE shrine_id = 102)
  UNION ALL SELECT 'temples_conciergehistory', 'shrine_id',
         to_regclass('public.temples_conciergehistory') IS NOT NULL,
         (SELECT count(*) FROM temples_conciergehistory WHERE shrine_id = 102)
  UNION ALL SELECT 'temples_shrine_goriyaku_tags', 'shrine_id',
         to_regclass('public.temples_shrine_goriyaku_tags') IS NOT NULL,
         (SELECT count(*) FROM temples_shrine_goriyaku_tags WHERE shrine_id = 102)
  UNION ALL SELECT 'temples_shrine_deities', 'shrine_id',
         to_regclass('public.temples_shrine_deities') IS NOT NULL,
         0
  UNION ALL SELECT 'temples_shrineinteractionlog', 'shrine_id',
         to_regclass('public.temples_shrineinteractionlog') IS NOT NULL,
         (SELECT count(*) FROM temples_shrineinteractionlog WHERE shrine_id = 102)
) AS refs
ORDER BY referencing_rows DESC, relation;

-- E. legacy M2M table `temples_shrine_deities` が存在する場合のみの件数。
--    D では存在確認だけを行い 0 を仮置きしているため、ここで実測する。
--    table が存在しない場合、この SELECT は 0 行を返す。
SELECT 'E_LEGACY_M2M' AS section, c.relname AS table_present
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'temples_shrine_deities';

-- F. migration ledger の現在位置（0104 まで適用済みかの確認）。
SELECT 'F_MIGRATION_STATE' AS section, m.app, m.name, m.applied
FROM django_migrations AS m
WHERE m.app = 'temples'
ORDER BY m.id DESC
LIMIT 8;

-- G. user_id=1 の同定（PRE: owner_id=1 / user_id=1 が監査済み操作者であること）。
SELECT 'G_OPERATOR' AS section, u.id, u.username, u.is_superuser, u.is_staff, u.date_joined
FROM auth_user AS u
WHERE u.id = 1;
