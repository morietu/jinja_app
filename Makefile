# ===== 共通（Postgres実行ショートカット） =====
PG := docker compose exec db bash -lc 'export PGPASSWORD="$$POSTGRES_PASSWORD"; psql -v ON_ERROR_STOP=1 -h localhost -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

.PHONY: help shrine-count test-unique-loc test-unique-null test-unique-clean

help:
	@echo "make shrine-count       # 神社件数"
	@echo "make test-unique-loc    # 同一(name,address,location)の重複テスト"
	@echo "make test-unique-null   # location NULL時の重複テスト"
	@echo "make test-unique-clean  # テストデータ削除"

shrine-count:
	@$(PG) -c "SELECT COUNT(*) FROM temples_shrine;"

test-unique-loc:
	@$(PG) <<'SQL'
INSERT INTO temples_shrine (name_jp,address,latitude,longitude,location,created_at,updated_at,views_30d,favorites_30d,popular_score)
VALUES ($$重複テスト神社-LOC$$,$$テスト住所$$,35.0001,135.0001,ST_SetSRID(ST_MakePoint(135.0001,35.0001),4326),now(),now(),0,0,0);
INSERT INTO temples_shrine (name_jp,address,latitude,longitude,location,created_at,updated_at,views_30d,favorites_30d,popular_score)
VALUES ($$重複テスト神社-LOC$$,$$テスト住所$$,35.0001,135.0001,ST_SetSRID(ST_MakePoint(135.0001,35.0001),4326),now(),now(),0,0,0);
SQL

test-unique-null:
	@$(PG) <<'SQL'
INSERT INTO temples_shrine (name_jp,address,created_at,updated_at,views_30d,favorites_30d,popular_score)
VALUES ($$重複テスト神社-NULL$$,$$テスト住所$$,now(),now(),0,0,0);
INSERT INTO temples_shrine (name_jp,address,created_at,updated_at,views_30d,favorites_30d,popular_score)
VALUES ($$重複テスト神社-NULL$$,$$テスト住所$$,now(),now(),0,0,0);
SQL

test-unique-clean:
	@$(PG) -c "DELETE FROM temples_shrine WHERE name_jp LIKE '重複テスト神社%';"
