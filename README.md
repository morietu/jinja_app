# Jomja Project (Django)

神社データ検索・お気に入り機能を備えた Django アプリ

## セットアップ方法

```
python -m venv .venv
. .venv/Scripts/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

## 機能
- 神社一覧・詳細表示
- ユーザーアカウント（ログイン/ログアウト、パスワードリセット）
- お気に入り機能

## 環境変数
-プロジェクトルートに .env ファイルを作成して以下を設定
# Django settings
SECRET_KEY=your_secret_key_here
DEBUG=True
ALLOWED_HOSTS=127.0.0.1,localhost

# Database
DATABASE_URL=sqlite:///db.sqlite3
# 例: PostgreSQL を使う場合
# DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DBNAME

