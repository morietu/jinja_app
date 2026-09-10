-- SELECT-only. Safe to run against Production.
--
-- W0-B02 Production Shrine Reconciliation Gate の Production 側入力。
-- Base Shrine Seed（backend/temples/data/shrines_seed_clean.json）と
-- exact (name_jp, address) 単位で突合するための read-only snapshot を
-- 1行1列のJSONとして出力する。
--
-- 出力は scripts/reconcile_production_shrine_identity.py が
-- --production-snapshot として読む。
--
-- 契約:
--   * SELECT 1文のみ。DB へ一切書き込まない。
--   * identity normalization を行わない。name_jp / address は
--     格納されている値をそのまま出力する。
--   * kind による絞り込みを行わない。Shrine table 全体が
--     「Production Shrine母集団」である。temple kind の行が存在する場合は
--     PROD_ONLY として表面化させ、Gate 側で黙って隠さない。
--
-- 使い方:
--   scripts/migration_safety/readonly_query.sh \
--     ~/.config/kami-musubi/production-db.env DATABASE_URL \
--     scripts/migration_safety/sql/shrine_identity_reconciliation.sql \
--     > /path/outside/repo/production-shrine-snapshot.txt
SELECT COALESCE(
         json_agg(
           json_build_object(
             'id', s.id,
             'name_jp', s.name_jp,
             'address', s.address,
             'kind', s.kind
           )
           ORDER BY s.id
         )::text,
         '[]'
       ) AS production_shrine_snapshot_json
FROM temples_shrine AS s;
