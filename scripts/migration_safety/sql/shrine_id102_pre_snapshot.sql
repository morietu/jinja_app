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
       s.created_at, s.updated_at,
       -- psql の session TimeZone に依存しない絶対値。reverse の静的値は
       -- こちらを正本にする（表示用の created_at 列は参考）。
       to_char(s.created_at  AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at_utc_iso,
       to_char(s.updated_at  AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS updated_at_utc_iso,
       to_char(s.last_popular_calc_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS last_popular_calc_at_utc_iso,
       (extract(epoch FROM s.created_at) * 1000000)::bigint AS created_at_epoch_us,
       (extract(epoch FROM s.updated_at) * 1000000)::bigint AS updated_at_epoch_us
FROM temples_shrine AS s
WHERE s.id = 102;

-- A2. 対象2 tableの列定義。reverse の型変換（特に location が legacy text か
--     PostGIS geometry か、timestamp が with/without time zone か）を推測しない
--     ために取得する。
SELECT 'A2_COLUMN_TYPES' AS section,
       c.table_name, c.ordinal_position, c.column_name,
       c.data_type, c.udt_name, c.is_nullable, c.column_default
FROM information_schema.columns AS c
WHERE c.table_schema = 'public'
  AND c.table_name IN ('temples_shrine', 'temples_shrineinteractionlog')
ORDER BY c.table_name, c.ordinal_position;

-- A3. Shrine pk=102 の全24保存列を JSON で出力する（NULL semantics 正本）。
--
--    psql の aligned 表示では nullable text 列の SQL NULL と空文字 '' が
--    どちらも空白として描画され区別できない。reverse が復元すべき値を
--    一意に固定するため、行全体を to_jsonb で 1 値として出力する。
--
--      SQL NULL  -> JSON null
--      空文字 ''  -> JSON ""
--
--    to_jsonb は行の全列を必ず含むため、列の取りこぼしが起きない。
--    jsonb 列（astro_elements / visit_style_tags / metadata）は入れ子の
--    JSON として、text 列（Production の location）は JSON 文字列として
--    出力されるので、A2 の physical type と併せれば reverse serialization
--    を推測なしに決定できる。
--
--    timestamp の exact instant は引き続き A の
--    *_utc_iso / *_epoch_us を正本とする（JSON 側の描画は session
--    TimeZone に依存するため参考値）。
SELECT 'A3_SHRINE_JSON' AS section,
       to_jsonb(s)::text AS shrine_row_json
FROM temples_shrine AS s
WHERE s.id = 102;

-- A4. A3 を列ごとに分解し、NULL / 空文字 / 値 を明示分類する。
--     JSON を目視でパースせずに NULL semantics を確認できるようにする。
--     列名は hardcode せず to_jsonb の全キーを走査するため、列の
--     取りこぼしが構造的に起きない。
SELECT 'A4_NULL_SEMANTICS' AS section,
       e.key AS column_name,
       jsonb_typeof(e.value) AS json_type,
       CASE
         WHEN e.value = 'null'::jsonb                  THEN 'SQL_NULL'
         WHEN jsonb_typeof(e.value) = 'string'
              AND (e.value #>> '{}') = ''              THEN 'EMPTY_STRING'
         ELSE                                               'VALUE'
       END AS semantics,
       e.value::text AS json_value
FROM temples_shrine AS s
CROSS JOIN LATERAL jsonb_each(to_jsonb(s)) AS e
WHERE s.id = 102
ORDER BY e.key;

-- B. ShrineInteractionLog の全行（pk を絞らず shrine_id で取得する）。
--    「exactly 2 rows / pk が 3,6」という PRE をここで検証するため、
--    pk で先に絞り込まない。3件目が存在すれば必ずここに現れる。
SELECT 'B_INTERACTION_LOGS' AS section,
       il.id, il.user_id, il.shrine_id, il.action_type, il.source,
       il.thread_id, il.metadata::text AS metadata_text, il.created_at,
       to_char(il.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at_utc_iso,
       (extract(epoch FROM il.created_at) * 1000000)::bigint AS created_at_epoch_us,
       pg_typeof(il.metadata)::text AS metadata_pg_type
FROM temples_shrineinteractionlog AS il
WHERE il.shrine_id = 102
ORDER BY il.id;

-- B2. ShrineInteractionLog の対象行を JSON で出力する（NULL semantics 正本）。
--     A3 と同じ理由。thread_id の SQL NULL と、source の空文字を区別する。
--     pk で絞らず shrine_id で取得するため、3件目が存在すればここにも現れる。
SELECT 'B2_INTERACTION_LOG_JSON' AS section,
       il.id,
       to_jsonb(il)::text AS interaction_log_row_json
FROM temples_shrineinteractionlog AS il
WHERE il.shrine_id = 102
ORDER BY il.id;

-- B3. B2 を列ごとに分解し、NULL / 空文字 / 値 を明示分類する。
SELECT 'B3_NULL_SEMANTICS' AS section,
       il.id AS interaction_log_id,
       e.key AS column_name,
       jsonb_typeof(e.value) AS json_type,
       CASE
         WHEN e.value = 'null'::jsonb                  THEN 'SQL_NULL'
         WHEN jsonb_typeof(e.value) = 'string'
              AND (e.value #>> '{}') = ''              THEN 'EMPTY_STRING'
         ELSE                                               'VALUE'
       END AS semantics,
       e.value::text AS json_value
FROM temples_shrineinteractionlog AS il
CROSS JOIN LATERAL jsonb_each(to_jsonb(il)) AS e
WHERE il.shrine_id = 102
ORDER BY il.id, e.key;

-- C. ShrineInteractionLog の件数（PRE: exactly 2）。
SELECT 'C_INTERACTION_LOG_COUNT' AS section,
       count(*) AS total_rows,
       count(*) FILTER (WHERE il.id IN (3, 6)) AS rows_with_expected_pks,
       count(*) FILTER (WHERE il.id NOT IN (3, 6)) AS rows_with_unexpected_pks
FROM temples_shrineinteractionlog AS il
WHERE il.shrine_id = 102;

-- D. Shrine を参照する全 relation の存在有無と参照件数。
--
--    【重要 / 実装上の制約】
--    PostgreSQL は文全体を実行前に parse するため、同じ SELECT の中で
--    `to_regclass(...) IS NOT NULL` を書いても、兄弟の
--    `(SELECT count(*) FROM <存在しない table>)` は保護されない。
--    Production では temples_conciergehistory / temples_like /
--    temples_rankinglog が NOT_DEPLOYED であり、静的に table 名を書くと
--    `ERROR: relation "temples_like" does not exist` で query 全体が
--    中断する（ローカルで当該3 tableを落として実測確認済み）。
--
--    そこで、存在する relation だけを `existing` CTE（MATERIALIZED で
--    評価順序を固定）へ絞り込み、その行に対してのみ `query_to_xml` で
--    count を取得する。実行される文字列は
--        SELECT count(*) AS c FROM public.<ident> WHERE <ident> = 102
--    のみで、識別子はすべて下の VALUES に literal で列挙されている。
--    外部入力は無い。read-only であり、DB を一切変更しない。
--
--    inventory は Django introspection 実測の15 relation を常に全件保持し、
--    11 へ縮小しない。NOT_DEPLOYED の relation は referencing_rows = NULL
--    として区別できるようにし、0 と混同しない。
WITH inventory(relation, column_name) AS (
  VALUES
    ('temples_shrinedeity',             'shrine_id'),
    ('temples_shrinehistory',           'shrine_id'),
    ('temples_historythemeassignment',  'shrine_id'),
    ('temples_shrinegoriyakuassignment','shrine_id'),
    ('temples_favorite',                'shrine_id'),
    ('temples_conciergethread',         'main_shrine_id'),
    ('temples_visit',                   'shrine_id'),
    ('temples_shrinereflection',        'shrine_id'),
    ('temples_actionevent',             'shrine_id'),
    ('temples_goshuin',                 'shrine_id'),
    ('temples_shrine_goriyaku_tags',    'shrine_id'),
    ('temples_conciergehistory',        'shrine_id'),
    ('temples_like',                    'shrine_id'),
    ('temples_rankinglog',              'shrine_id'),
    ('temples_shrineinteractionlog',    'shrine_id')
),
existing AS MATERIALIZED (
  SELECT relation, column_name
  FROM inventory
  WHERE to_regclass('public.' || relation) IS NOT NULL
),
counted AS (
  SELECT e.relation,
         (xpath(
            '/row/c/text()',
            query_to_xml(
              format('SELECT count(*) AS c FROM public.%I WHERE %I = 102',
                     e.relation, e.column_name),
              false, true, '')
          ))[1]::text::bigint AS referencing_rows
  FROM existing AS e
)
SELECT 'D_RELATIONS' AS section,
       i.relation,
       i.column_name,
       to_regclass('public.' || i.relation) IS NOT NULL AS table_exists,
       c.referencing_rows,
       CASE
         WHEN to_regclass('public.' || i.relation) IS NULL THEN 'NOT_DEPLOYED'
         WHEN c.referencing_rows = 0                       THEN 'DEPLOYED_ZERO'
         ELSE                                                   'DEPLOYED_NONZERO'
       END AS state
FROM inventory AS i
LEFT JOIN counted AS c ON c.relation = i.relation
ORDER BY (c.referencing_rows IS NULL), c.referencing_rows DESC, i.relation;

-- D2. relation inventory契約の3値。ShrineInteractionLog は削除対象なので
--     分母から外し、NON_INTERACTION_RELATION_TOTAL は常に14になる。
--     DEPLOYED_NONZERO が 0 でなければ fail closed の対象。
WITH inventory(relation, column_name) AS (
  VALUES
    ('temples_shrinedeity',             'shrine_id'),
    ('temples_shrinehistory',           'shrine_id'),
    ('temples_historythemeassignment',  'shrine_id'),
    ('temples_shrinegoriyakuassignment','shrine_id'),
    ('temples_favorite',                'shrine_id'),
    ('temples_conciergethread',         'main_shrine_id'),
    ('temples_visit',                   'shrine_id'),
    ('temples_shrinereflection',        'shrine_id'),
    ('temples_actionevent',             'shrine_id'),
    ('temples_goshuin',                 'shrine_id'),
    ('temples_shrine_goriyaku_tags',    'shrine_id'),
    ('temples_conciergehistory',        'shrine_id'),
    ('temples_like',                    'shrine_id'),
    ('temples_rankinglog',              'shrine_id')
),
existing AS MATERIALIZED (
  SELECT relation, column_name
  FROM inventory
  WHERE to_regclass('public.' || relation) IS NOT NULL
),
counted AS (
  SELECT e.relation,
         (xpath(
            '/row/c/text()',
            query_to_xml(
              format('SELECT count(*) AS c FROM public.%I WHERE %I = 102',
                     e.relation, e.column_name),
              false, true, '')
          ))[1]::text::bigint AS referencing_rows
  FROM existing AS e
)
SELECT 'D2_RELATION_CONTRACT' AS section,
       (SELECT count(*) FROM inventory)                                AS non_interaction_relation_total,
       count(*) FILTER (WHERE c.referencing_rows = 0)                  AS deployed_zero,
       count(*) FILTER (WHERE c.referencing_rows > 0)                  AS deployed_nonzero,
       (SELECT count(*) FROM inventory) - count(*)                     AS not_deployed
FROM counted AS c;

-- D3. NOT_DEPLOYED と申告された3 relationの存在状態と、存在する場合の
--     実測件数。存在したこと自体はFAILにしない。1件以上でSTOP。
WITH target(relation, column_name) AS (
  VALUES ('temples_conciergehistory', 'shrine_id'),
         ('temples_like',             'shrine_id'),
         ('temples_rankinglog',       'shrine_id')
),
existing AS MATERIALIZED (
  SELECT relation, column_name
  FROM target
  WHERE to_regclass('public.' || relation) IS NOT NULL
),
counted AS (
  SELECT e.relation,
         (xpath(
            '/row/c/text()',
            query_to_xml(
              format('SELECT count(*) AS c FROM public.%I WHERE %I = 102',
                     e.relation, e.column_name),
              false, true, '')
          ))[1]::text::bigint AS referencing_rows
  FROM existing AS e
)
SELECT 'D3_NOT_DEPLOYED_CHECK' AS section,
       t.relation,
       to_regclass('public.' || t.relation) IS NOT NULL AS table_exists,
       c.referencing_rows,
       CASE
         WHEN to_regclass('public.' || t.relation) IS NULL THEN 'NOT_DEPLOYED'
         WHEN c.referencing_rows = 0                       THEN 'DEPLOYED_ZERO_OK'
         ELSE                                                   'DEPLOYED_NONZERO_STOP'
       END AS verdict
FROM target AS t
LEFT JOIN counted AS c ON c.relation = t.relation
ORDER BY t.relation;

-- E. ORM-less legacy M2M `temples_shrine_deities` の別Gate。
--
--    このtableはDjango modelに対応が無く（Shrine._meta.related_objects に
--    現れない）、introspection由来の15 relation inventoryには入らない。
--    そのため独立したGateとして必ず確認する。
--
--    D と同じく、存在しない場合に query 全体が中断しないよう
--    existing CTE で絞り込んでから query_to_xml で数える。
--    存在自体はFAILにしない。参照1件以上でSTOP。
WITH target(relation, column_name) AS (
  VALUES ('temples_shrine_deities', 'shrine_id')
),
existing AS MATERIALIZED (
  SELECT relation, column_name
  FROM target
  WHERE to_regclass('public.' || relation) IS NOT NULL
),
counted AS (
  SELECT e.relation,
         (xpath(
            '/row/c/text()',
            query_to_xml(
              format('SELECT count(*) AS c FROM public.%I WHERE %I = 102',
                     e.relation, e.column_name),
              false, true, '')
          ))[1]::text::bigint AS referencing_rows
  FROM existing AS e
)
SELECT 'E_LEGACY_M2M_GATE' AS section,
       t.relation,
       t.column_name,
       to_regclass('public.' || t.relation) IS NOT NULL AS table_exists,
       c.referencing_rows,
       CASE
         WHEN to_regclass('public.' || t.relation) IS NULL THEN 'NOT_DEPLOYED'
         WHEN c.referencing_rows = 0                       THEN 'DEPLOYED_ZERO_OK'
         ELSE                                                   'DEPLOYED_NONZERO_STOP'
       END AS verdict
FROM target AS t
LEFT JOIN counted AS c ON c.relation = t.relation;

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
