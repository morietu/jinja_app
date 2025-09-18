# 開発TODOリスト（最新版）

## 🟥 優先度A：LLM（OpenAI コンシェルジュ）
- [ ] 依存追加：`openai` を `requirements.txt` に追記
- [ ] 環境変数：`.env` に `OPENAI_API_KEY`, `LLM_MODEL`, `LLM_TEMPERATURE`, `LLM_MAX_TOKENS`, （任意）`LLM_BASE_URL`
- [ ] モジュール新設：`backend/temples/llm/`
  - [ ] `config.py`（env → 値の読み出し）
  - [ ] `client.py`（OpenAI クライアント生成）
  - [ ] `orchestrator.py`（候補整形＋`chat.completions` 呼び出し）
- [ ] API：`/api/concierge/chat`（POST）
  - [ ] DRF `APIView` 実装（入力 `query` と `candidates`）
  - [ ] `throttle_scope="concierge"`（8/min、settings にレート追記）
  - [ ] 例外/タイムアウト/トークン上限ガード
- [ ] スモークテスト：cURL で 200 応答・簡易ログ出力
- [ ] ドキュメント：README/architecture に LLM 構成と `.env` 例を追記
- [ ] ブランチ/PR：`api/llm-module-split` → `api/concierge-endpoint` → `develop`

## 🧭 コア機能（AI参拝ナビ）
- [x] ルート提案API（徒歩/車のMVP：ハバースイン距離＋所要時間、`/api/route/`）
- [ ] 人気神社推薦（閲覧/お気に入りスコアで30日集計）
- [ ] ユーザーによる神社登録機能
  - [ ] ピンで位置指定
  - [ ] 神社名入力
  - [ ] 逆ジオで住所自動取得
  - [ ] 重複チェック（名前＋住所／座標近接）
- [ ] 人気API仕様確定＆テスト（`/api/shrines/popular/`）

## ⭐ サポート機能
- [ ] 御朱印投稿API（画像アップ／公開切替／編集／削除）
- [x] お気に入りAPI（追加・削除・一覧）→ JWT で動作確認済み
- [ ] ランキングAPI（月間・年間TOP10）
- [ ] ユーザー認証／設定API（プロフィール編集・公開設定）

## 🗺 Places / 検索系
- [x] Text Search（神社バイアス・Shintoのみ）
- [x] Nearby Search（`q`→`keyword` 修正、MAX_Q）
- [x] Find Place API 追加（`/api/places/find_place/`）
- [x] Photo プロキシ（`/api/places/photo/`）
- [x] Text Search ページネーション（`/api/places/text_search/`）

## ⚙️ バックエンド作業
- [x] JWT 認証 `/api/token/*`
- [x] Shrine API（一覧・詳細）
- [x] Favorite API（冪等 POST/DELETE 確認済み）
- [x] Favorite：`"shrine"` エイリアス許容（`"shrine_id"` に正規化）
- [x] Favorite：条件付き一意（`user×shrine` / `user×place_id`）＋ XOR 制約
- [x] Favorite：`Index(user, created_at)` 追加
- [ ] FavoriteViewSet：`IsAuthenticated` 徹底・重複時の 400/409 を統一
- [x] モデル拡張（`goriyaku` / `sajin` / popular 指標）
- [ ] シリアライザ拡張（関連リソース）
- [ ] 管理画面拡張（神社・御朱印・ランキング）
- [ ] バッチ（30日集計パイプライン）
- [ ] DEBUG 時 `/media/` 配信（御朱印画像のローカル表示）

## 🧪 バグ修正・メンテ
- [x] `temples/models.py` の整形（Black）
- [x] PostGIS インデックス・マイグレーション整備
- [x] マイグレーション競合解消（`0021_enable_postgis`）
- [x] Bearer 認証手順整理
- [x] クエリ取得の堅牢化（`_robust_get_query_param`）
- [x] 開発端末 `.zshrc` 整理（`jwt_login/jwt_refresh`、サブシェル排除）

## 🎨 フロントエンド（Next.js）※優先度B（LLM後に着手）
- [x] `axios` 導入
- [x] 共通APIクライアント `apps/web/lib/api.ts`
- [x] お気に入りラッパ `apps/web/src/lib/api/favorites.ts`
- [ ] tokenStore / apiClient / auth 導入（自動リフレッシュ）
- [ ] `/login` ページ
- [ ] 神社カード/詳細に「お気に入り」トグル
- [ ] ホーム（検索・AIコンシェルジュ入口）
- [ ] 神社詳細（住所・ご利益・祭神・ルート）
- [ ] マイページ（お気に入り・御朱印投稿管理）
- [ ] ランキングページ
- [ ] ルートUI（距離・時間表示）

## 📱 モバイル（Expo）
- [ ] API ベース同期（`EXPO_PUBLIC_API_BASE`）
- [ ] 近隣神社リスト（expo-location）
- [ ] 御朱印画像投稿（expo-image-picker）

## 🛠 インフラ
- [x] Docker 起動・DB 接続
- [x] PostgreSQL + PostGIS 拡張確認
- [ ] CORS/CSRF 本番方針（同一オリジン＋リバプロ）
- [ ] S3 連携（御朱印画像）
- [ ] ECS/Fargate
- [ ] SSM Parameter Store
- [ ] ALB + ACM（HTTPS）
- [ ] Miniforge 初期化
- [ ] conda 環境 `jinja_app_py311`
- [ ] VS Code/Cursor の Interpreter 切替

## 📚 ドキュメント
- [ ] README：Favorites の `"shrine"` エイリアス例
- [ ] README：Nearby 検索の例と並び順・MAX_Q
- [x] TODO：最新版に更新（この変更）
- [ ] API 一覧（認証要否・レート制限）
- [ ] フロント README：JWT フローと `.env`
- [ ] LLM 設定・運用（timeouts/レート/費用）

## 🔀 ブランチ/PR運用
- [ ] `api/favorites-accept-shrine-alias`
- [ ] `api/favorites-constraints-and-index`
- [ ] **`api/llm-module-split`**
- [ ] **`api/concierge-endpoint`**
- [ ] `web/auth-login-jwt`
- [ ] `web/favorites-toggle-ui`
- [ ] レビュー & Squash / CHANGELOG 更新

## 🚀 今後の拡張
- [ ] 多言語対応（英/中）
- [ ] Push通知（参拝リマインダー）
- [ ] SNS共有
- [ ] 御朱印帳クラウド同期
- [ ] ランキング自動集計

## ⛏ 取り込み・LLM 関連（拡張案）
- [ ] `Shrine.place_id` を unique に
- [ ] `services/places_import.py` 追加（Places → Shrine 保存）
- [ ] POST `/api/shrines/import_from_place/`（idempotent）
- [ ] POST `/api/shrines/bulk_import/`（最大50件）
- [ ] web：コンシェルジュ結果カードに「☆ お気に入り」「＋ DBへ取り込む」
- [ ] web：マイページお気に入りに「未保存を一括取込」
- [ ] ops：Places Details レート制御＋短期キャッシュ
