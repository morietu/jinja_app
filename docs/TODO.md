# ✅ 開発TODOリスト（到達状況付き・Markdown対応）

## 🟥 優先度A：LLM（OpenAI コンシェルジュ)
- [ ] 依存追加：`openai` を `requirements.txt` に追記  
- [ ] 環境変数：`.env` に `OPENAI_API_KEY`, `LLM_MODEL`, `LLM_TEMPERATURE`, `LLM_MAX_TOKENS`, (任意) `LLM_BASE_URL`  
- [ ] モジュール新設：`backend/temples/llm/`（`config.py` / `client.py` / `orchestrator.py`）  
- [ ] API：`POST /api/concierge/chat`（APIView・8/min スロットリング）  
- [ ] 例外 / タイムアウト / トークン上限ガード  
- [ ] スモークテスト（cURL）  
- [ ] ドキュメント（LLM構成と `.env` 例）  
- [ ] ブランチ / PR：`api/llm-module-split → api/concierge-endpoint → develop`  

---

## 🔐 認証 / プロキシ
- [x] Next `/api` キャッチオール・プロキシ  
- [x] Cookie `access_token` → `Authorization: Bearer` 自動付与  
- [x] JWT create/refresh 応答から HttpOnly Cookie 設定  
- [x] 個別ルート削除 → catch-all 集約  
- [x] `/api/users/me/` で 200 確認  
- [ ] FavoriteViewSet 等の `IsAuthenticated` 最終チェック  
- [ ] （任意）プロキシのデバッグルートを dev 限定  

---

## 🎨 フロントエンド（Next.js）
- [x] `axios` 導入（`/api` / `withCredentials:true`）  
- [x] `apiGet` / `apiPost` / `apiPatch` / `apiDelete` / `isAuthError` ラッパ  
- [x] 旧 `serverFetch` / `apiFetch` 撤去  
- [ ] 401 自動リフレッシュ（1回だけ再試行）  
- [ ] `/login` ページ  
- [ ] 神社カード / 詳細に「お気に入り」トグル  
- [ ] ホーム（検索・AI コンシェルジュ入口）  
- [ ] 神社詳細（住所・ご利益・祭神・ルート）  
- [ ] マイページ（お気に入り・御朱印投稿管理）  
- [ ] ランキングページ  
- [ ] ルートUI（距離・時間表示）  
- [ ] 旧 `apps/web/lib/http.ts` の掃除  

---

## 🧭 コア機能（AI参拝ナビ）
- [x] ルート提案API（徒歩 / 車MVP：ハバースイン距離＋所要時間 `/api/route/`）  
- [ ] 人気神社推薦（30日集計）  
- [ ] ユーザー神社登録（ピン / 名称 / 逆ジオ / 重複チェック）  
- [ ] 人気API仕様 & テスト（`/api/shrines/popular/`）  

---

## ⭐ サポート機能
- [ ] 御朱印投稿API（画像アップ / 公開切替 / 編集 / 削除）  
- [x] お気に入りAPI（冪等 POST / DELETE 確認済み）  
- [ ] ランキングAPI（月間・年間TOP10）  
- [ ] ユーザー認証 / 設定API（プロフィール編集・公開設定）  

---

## 🗺 Places / 検索系
- [x] Text Search（Shintoバイアス）  
- [x] Nearby Search（`q→keyword` / MAX_Q）  
- [x] Find Place（`/api/places/find_place/`）  
- [x] Photo プロキシ（`/api/places/photo/`）  
- [x] Text Search ページネーション  
- [ ] **GET `/api/places/find/?input=...` 実装**（`{ results: PlaceLite[] }`）  
- [ ] Frontend：`/search/places` が上記スキーマで 200 / 一致  

---

## ⚙️ バックエンド作業
- [x] JWT 認証 `/api/token/*`  
- [x] Shrine API（一覧・詳細）  
- [x] Favorite API（冪等・エイリアス許容・制約・Index）  
- [ ] FavoriteViewSet：`IsAuthenticated` 徹底 / 重複 400/409 統一  
- [x] モデル拡張（`goriyaku` / `sajin` / `popular` 指標）  
- [ ] シリアライザ拡張（関連リソース）  
- [ ] 管理画面拡張（神社・御朱印・ランキング）  
- [ ] バッチ（30日集計）  
- [ ] DEBUG 時 `/media/` 配信（ローカル画像）  

---

## 🧪 バグ修正・メンテ
- [x] `temples/models.py` 整形（Black）  
- [x] PostGIS インデックス・マイグレーション整備  
- [x] マイグレーション競合解消（`0021_enable_postgis`）  
- [x] Bearer 認証手順整理  
- [x] クエリ取得の堅牢化（`_robust_get_query_param`）  
- [x] 開発端末 `.zshrc` 整理（jwt_login / jwt_refresh など）  

---

## 📱 モバイル（Expo）
- [ ] API ベース同期（`EXPO_PUBLIC_API_BASE`）  
- [ ] 近隣神社リスト（`expo-location`）  
- [ ] 御朱印画像投稿（`expo-image-picker`）  

---

## 🛠 インフラ
- [x] Docker 起動・DB 接続  
- [x] PostgreSQL + PostGIS 拡張確認  
- [ ] CORS / CSRF 本番方針（同一オリジン＋リバプロ）  
- [ ] S3 連携（御朱印画像）  
- [ ] ECS / Fargate  
- [ ] SSM Parameter Store  
- [ ] ALB + ACM（HTTPS）  
- [ ] Miniforge 初期化  
- [ ] conda 環境 `jinja_app_py311`  
- [ ] VS Code / Cursor の Interpreter 切替  

---

## 📚 ドキュメント
- [ ] README：Favorites の `"shrine"` エイリアス例  
- [ ] README：Nearby 検索の例・並び順・`radius` 追記  
- [x] TODO：最新版に更新（この変更）  
- [ ] API 一覧（認証要否・レート制限）  
- [ ] フロント README：JWT フローと `.env`  
- [ ] LLM 設定 / 運用（timeouts / レート / 費用）  

---

## 🔀 ブランチ / PR運用
- [ ] `api/places-find-lite`  
- [ ] `web/search-places-wire`  
- [ ] `feat/llm-module-split`  
- [ ] `api/concierge-endpoint`  
- [ ] `web/auth-login-jwt`  
- [ ] `web/favorites-toggle-ui`  
- [ ] レビュー & Squash / CHANGELOG 更新  

---

## ✅ 直近の完了（参考）
- [x] `/api/shrines/nearest/`：ベンダ安全（PostGIS / Spatialite / NoGIS）  
  - JSON配列  
  - `radius` 対応  
  - シリアライザ距離 / 位置  
  - CIグリーン  
