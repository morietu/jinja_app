# 開発TODOリスト（最新版）

## 🟥 優先度A：LLM（OpenAI コンシェルジュ)

- [ ] 依存追加：openai を requirements.txt に追記
- [ ] 環境変数：.env に OPENAI_API_KEY, LLM_MODEL, LLM_TEMPERATURE, LLM_MAX_TOKENS, （任意）LLM_BASE_URL
- [ ] モジュール新設：backend/temples/llm/
  - [ ] config.py（env → 値の読み出し）
  - [ ] client.py（OpenAI クライアント生成）
  - [ ] orchestrator.py（候補整形＋chat.completions 呼び出し）
- [ ] API：/api/concierge/chat（POST）
  - [ ] DRF APIView 実装（入力 query と candidates）
  - [ ] throttle_scope="concierge"（8/min、settings にレート追記）
  - [ ] 例外/タイムアウト/トークン上限ガード
- [ ] スモークテスト：cURL で 200 応答・簡易ログ出力
- [ ] ドキュメント：README/architecture に LLM 構成と .env 例を追記
- [ ] ブランチ/PR：api/llm-module-split → api/concierge-endpoint → develop

---

## 🔐 認証 / プロキシ（今回の変更点）

- [x] Next /api キャッチオール・プロキシ実装（apps/web/src/app/api/[[...path]]/route.ts）
- [x] Cookie access_token → Authorization: Bearer 自動付与（プロキシ）
- [x] POST /api/auth/jwt/(create|refresh)/ レスポンスから HttpOnly Cookie を設定（プロキシ）
- [x] 個別ルート（probe / debug / logout）削除 → catch-all に集約
- [x] cURL & ブラウザで ログイン → /api/users/me/ が 200 を確認
- [ ] FavoriteViewSet 等で IsAuthenticated 適用漏れ 最終チェック
- [ ] （任意）プロキシのデバッグルートを dev のみ有効（本番は 404）

---

## 🎨 フロントエンド（Next.js）※優先度B（LLM後）

- [x] axios 導入（apps/web/src/lib/api/client.ts / baseURL="/api" / withCredentials:true）
- [x] axios ラッパ追加：apps/web/src/lib/api/http.ts（apiGet/apiPost/apiPatch/apiDelete/isAuthError）
- [x] 旧 serverFetch/apiFetch 系の撤去・呼び出し差し替え
- [ ] 401 自動リフレッシュ（axios レスポンスインターセプタ → /auth/jwt/refresh/ を 1回だけ再試行）
- [ ] /login ページ
- [ ] 神社カード/詳細に「お気に入り」トグル
- [ ] ホーム（検索・AI コンシェルジュ入口）
- [ ] 神社詳細（住所・ご利益・祭神・ルート）
- [ ] マイページ（お気に入り・御朱印投稿管理）
- [ ] ランキングページ
- [ ] ルートUI（距離・時間表示）
- [ ] 旧ファイル掃除：apps/web/lib/http.ts（未使用なら削除）

---

## 🧭 コア機能（AI参拝ナビ）

- [x] ルート提案API（徒歩/車のMVP：ハバースイン距離＋所要時間、/api/route/）
- [ ] 人気神社推薦（閲覧/お気に入りスコアで30日集計）
- [ ] ユーザーによる神社登録機能
  - [ ] ピンで位置指定
  - [ ] 神社名入力
  - [ ] 逆ジオで住所自動取得
  - [ ] 重複チェック（名前＋住所／座標近接）
- [ ] 人気API仕様確定＆テスト（/api/shrines/popular/）

---

## ⭐ サポート機能

- [ ] 御朱印投稿API（画像アップ／公開切替／編集／削除）
- [x] お気に入りAPI（追加・削除・一覧）→ JWT で動作確認済み
- [ ] ランキングAPI（月間・年間TOP10）
- [ ] ユーザー認証／設定API（プロフィール編集・公開設定）

---

## 🗺 Places / 検索系

- [x] Text Search（神社バイアス・Shintoのみ）
- [x] Nearby Search（q→keyword 修正、MAX_Q）
- [x] Find Place API 追加（/api/places/find_place/）
- [x] Photo プロキシ（/api/places/photo/）
- [x] Text Search ページネーション（/api/places/text_search/）
- [ ] Find（ブロッカー）：GET /api/places/find/?input=... を実装し { results: PlaceLite[] } を返す ⛔
- [ ] Frontend：/search/places が上記 API で 200 / スキーマ一致を確認 🟡

---

## ⚙️ バックエンド作業

- [x] JWT 認証 /api/token/*
- [x] Shrine API（一覧・詳細）
- [x] Favorite API（冪等 POST/DELETE 確認済み）
- [x] Favorite："shrine" エイリアス許容（"shrine_id" に正規化）
- [x] Favorite：条件付き一意（user×shrine / user×place_id）＋ XOR 制約
- [x] Favorite：Index(user, created_at) 追加
- [ ] FavoriteViewSet：IsAuthenticated 徹底・重複時の 400/409 を統一
- [x] モデル拡張（goriyaku / sajin / popular 指標）
- [ ] シリアライザ拡張（関連リソース）
- [ ] 管理画面拡張（神社・御朱印・ランキング）
- [ ] バッチ（30日集計パイプライン）
- [ ] DEBUG 時 /media/ 配信（御朱印画像のローカル表示）

---

## 🧪 バグ修正・メンテ

- [x] temples/models.py の整形（Black）
- [x] PostGIS インデックス・マイグレーション整備
- [x] マイグレーション競合解消（0021_enable_postgis）
- [x] Bearer 認証手順整理
- [x] クエリ取得の堅牢化（_robust_get_query_param）
- [x] 開発端末 .zshrc 整理（jwt_login/jwt_refresh、サブシェル排除）

---

## 📱 モバイル（Expo）

- [ ] API ベース同期（EXPO_PUBLIC_API_BASE）
- [ ] 近隣神社リスト（expo-location）
- [ ] 御朱印画像投稿（expo-image-picker）

---

## 🛠 インフラ

- [x] Docker 起動・DB 接続
- [x] PostgreSQL + PostGIS 拡張確認
- [ ] CORS/CSRF 本番方針（同一オリジン＋リバプロ）
- [ ] S3 連携（御朱印画像）
- [ ] ECS/Fargate
- [ ] SSM Parameter Store
- [ ] ALB + ACM（HTTPS）
- [ ] Miniforge 初期化
- [ ] conda 環境 jinja_app_py311
- [ ] VS Code/Cursor の Interpreter 切替

---

## 📚 ドキュメント

- [ ] README：Favorites の "shrine" エイリアス例
- [ ] README：Nearby 検索の例と並び順・MAX_Q
- [x] TODO：最新版に更新（この変更）
- [ ] API 一覧（認証要否・レート制限）
- [ ] フロント README：JWT フローと .env
- [ ] LLM 設定・運用（timeouts/レート/費用）

---

## 🔀 ブランチ/PR運用

- [ ] api/favorites-accept-shrine-alias
- [ ] api/favorites-constraints-and-index
- [ ] api/llm-module-split
- [ ] api/concierge-endpoint
- [ ] web/auth-login-jwt
- [ ] web/favorites-toggle-ui
- [ ] レビュー & Squash / CHANGELOG 更新

---

## 🚀 今後の拡張

- [ ] 多言語対応（英/中）
- [ ] Push通知（参拝リマインダー）
- [ ] SNS共有
- [ ] 御朱印帳クラウド同期
- [ ] ランキング自動集計

---

## ⛏ 取り込み・LLM 関連（拡張案）

- [ ] Shrine.place_id を unique に
- [ ] services/places_import.py 追加（Places → Shrine 保存）
- [ ] POST /api/shrines/import_from_place/（idempotent）
- [ ] POST /api/shrines/bulk_import/（最大50件）
- [ ] web：コンシェルジュ結果カードに「☆ お気に入り」「＋ DBへ取り込む」
- [ ] web：マイページお気に入りに「未保存を一括取込」
- [ ] ops：Places Details レート制御＋短期キャッシュ

---

## 🧭 ブロッカー & 準優先（抜粋）

- [ ] ⛔ Backend: GET /api/places/find/?input=... をサポート（返却 { results: PlaceLite[] }）
- [ ] 🟡 Frontend: apps/web/src/app/search/places/page.tsx が上記スキーマで動作するか最終確認
- [ ] 旧ファイルの掃除：apps/web/lib/http.ts（未参照確認後に削除）
- [ ] useFavorite / Favorites API の最終接続確認（トグル、一覧、削除）

## 作業確認
- [ ] README: JWTフロー（create/verify/refresh/blacklist）の手順と注意点を追記
- [ ] Frontend: 401(expired)ハンドリング → refresh → 1回だけ再試行の実装
- [ ] Frontend: refreshは毎回ローテされるため、最新refreshをストアに上書き保存する
- [ ] （任意）運用Tips: トークン全削除スクリプトとトラブルシュートをREADMEに記載
