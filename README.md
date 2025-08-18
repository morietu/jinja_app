神社データ検索・お気に入り機能を備えた Django アプリ

## セットアップ方法
```bash
python -m venv .venv
. .venv/Scripts/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
機能

神社一覧・詳細表示

ユーザーアカウント（ログイン/ログアウト、パスワードリセット）

お気に入り機能
