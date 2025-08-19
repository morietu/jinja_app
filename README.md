# jomja_app (Django + PostgreSQL + Docker)

神社データ検索・お気に入り機能・ユーザー認証（ログイン/登録/ログアウト）を備えた Django アプリです。  
バックエンドDBは PostgreSQL を使用し、Docker 環境で動作します。

---

## セットアップ

### 1. 仮想環境の作成
```bash
python -m venv .venv
. .venv/Scripts/activate   # Windows
pip install -r requirements.txt
```

### 2. Dockerでデータベース起動
```bash
docker compose up -d db pgadmin
```

- **db(PostgreSQL)** → ポート `5433`
- **pgAdmin** → [http://localhost:8080](http://localhost:8080)

### 3. Django マイグレーション
```bash
python manage.py migrate
```

### 4. サーバー起動
```bash
python manage.py runserver
```
ブラウザで [http://127.0.0.1:8000](http://127.0.0.1:8000) を開きます。

---

## データベース管理

### よく使うコマンド
```bash
docker compose ps          # 稼働中サービス確認
docker compose logs db     # DBログ確認
docker compose down        # 停止
docker volume rm jinja_app_postgres_data  # データリセット（注意）
```

### pgAdmin
- URL: http://localhost:8080  
- 初期ログイン: `admin@jomja.com / admin_password`

---

## サンプルデータ投入

Django シェルから投入する例:
```bash
python manage.py shell
```

```python
from temples.models import Shrine

rows = [
  dict(name='明治神宮', prefecture='東京都', city='渋谷区',
       address='東京都渋谷区代々木神園町1-1',
       enshrined_kami='明治天皇・昭憲皇太后', benefits='厄除け・家内安全・勝運'),
  dict(name='伏見稲荷大社', prefecture='京都府', city='京都市伏見区',
       address='京都府京都市伏見区深草藪之内町68',
       enshrined_kami='稲荷大神', benefits='商売繁盛・五穀豊穣・家内安全'),
  dict(name='出雲大社', prefecture='島根県', city='出雲市',
       address='島根県出雲市大社町杵築東195',
       enshrined_kami='大国主大神', benefits='縁結び・厄除け・開運'),
]
for r in rows:
    Shrine.objects.get_or_create(name=r['name'], defaults=r)
print("OK")
```

SQLで直接投入する例:
```bash
PGPASSWORD=jdb50515 psql -h 127.0.0.1 -p 5433 -U admin -d jinja_db <<'SQL'
INSERT INTO temples_shrine (name, prefecture, city, address, enshrined_kami, benefits)
VALUES
  ('明治神宮', '東京都', '渋谷区', '東京都渋谷区代々木神園町1-1', '明治天皇・昭憲皇太后', '厄除け・家内安全・勝運'),
  ('伏見稲荷大社', '京都府', '京都市伏見区', '京都府京都市伏見区深草藪之内町68', '稲荷大神', '商売繁盛・五穀豊穣・家内安全'),
  ('出雲大社', '島根県', '出雲市', '島根県出雲市大社町杵築東195', '大国主大神', '縁結び・厄除け・開運');
SQL
```

---

## 機能
- 神社一覧・詳細表示
- ユーザーアカウント（ログイン/登録/ログアウト）
- お気に入り機能
- マイページ

---

## 環境変数（`.env`）
```plaintext
POSTGRES_DB=jinja_db
POSTGRES_USER=admin
POSTGRES_PASSWORD=jdb50515
DB_HOST=127.0.0.1
DB_PORT=5433
SECRET_KEY=your_secret_key
DEBUG=True
```
