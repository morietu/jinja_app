# バックエンド（Django/DRF）

## 技術スタック

- **Django 5 + DRF**
- **PostgreSQL + PostGIS**（位置情報対応）
- **JWT 認証**（SimpleJWT）
- **画像アップロード**（S3連携予定）

## 提供API

- `/api/shrines/` - 神社一覧・検索（ご利益・エリア対応）
- `/api/visits/` - 参拝チェックイン
- `/api/favorites/` - お気に入り登録
- `/api/ranking/` - 人気神社ランキング
- `/api/ai/concierge/` - 干支／四柱推命ベースの提案

## 管理機能

- **Django Admin** で神社・御朱印・ユーザー管理
- **集計バッチ** でランキングを生成

### 開発用ショートカット（zsh）
```zsh
jwt_login     # ログインして ACCESS/REFRESH を環境変数に
jwt_status    # 長さを確認
jwt_refresh   # ACCESS を更新
jwt_logout    # トークンをクリア

# お気に入り操作
fav_add_shrine 1
curl -s "$FAV_BASE/" -H "Authorization: Bearer $ACCESS" | jq .
