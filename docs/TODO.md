# 開発TODOリスト（最新版）

## 🧭 コア機能（AI参拝ナビ）
- [x] ルート提案API（徒歩/車の経路算出・MVP：ハバースイン距離＋所要時間、`/api/route/`）
- [ ] 人気神社推薦（閲覧/お気に入りスコアで30日集計）
- [ ] ユーザーによる神社登録機能
  - [ ] ピンを立てて位置指定
  - [ ] 神社名入力
  - [ ] 緯度経度から逆ジオコーディングで住所自動取得
  - [ ] 重複チェック（名前＋住所一致／緯度経度近接）
- [ ] 人気APIの仕様固め＆テスト（`/api/shrines/popular/` を確定・30日集計反映）

## ⭐ サポート機能
- [ ] 御朱印投稿API（画像アップロード／公開切替／編集／削除）
- [x] お気に入りAPI（追加・削除・一覧取得） → JWT 認証で動作確認済み
- [ ] ランキングAPI（月間・年間TOP10）
- [ ] ユーザー認証／設定API（プロフィール編集・公開設定）

## 🗺 Places / 検索系
- [x] Text Search（神社バイアス・Shintoのみ抽出）
- [x] Nearby Search（変数名バグ修正 `q`→`keyword`、MAX_Q 適用）
- [x] Find Place API 追加（`/api/places/find_place/`、locationbias対応）
- [x] Photo プロキシ（キャッシュ付、`/api/places/photo/`）
- [x] Text Search ページネーションAPI（`/api/places/text_search/`、pagetoken対応）

## ⚙️ バックエンド作業
- [x] JWT 認証エンドポイント `/api/token/*` 実装・確認済み
- [x] Shrine API（一覧・詳細JSON、`/api/shrines/`）
- [x] Favorite API（`/api/favorites/`、冪等POST・DELETE動作確認済み）
- [x] Favorite 作成で `"shrine"` エイリアスを許容（`"shrine_id"` に正規化）
- [x] モデル拡張（ご利益 `goriyaku`・祭神 `sajin`・ポピュラリティ指標）
- [ ] シリアライザ更新（詳細情報／関連リソース拡張）
- [ ] 管理画面拡張（神社・御朱印・ランキング管理UI）
- [ ] バッチ処理（人気/ランキングの30日集計パイプライン）
- [ ] DEBUG時の `/media/` 配信追加（御朱印画像のローカル表示）

## 🧪 バグ修正・メンテ
- [x] `temples/models.py` のインデント崩れ修正（Black 通過）
- [x] PostGIS 用インデックス・マイグレーション整備
- [x] マイグレーション競合解消（`0021_enable_postgis` 適用）
- [x] Bearer 認証エラー切り分け＆トークン取得手順の整理
- [x] モジバケ対策：クエリ取得を堅牢化（`_robust_get_query_param` 等）

## 🎨 フロントエンド（Web / Next.js）
- [x] `axios` 導入（`apps/web`）
- [x] 共通APIクライアント `apps/web/lib/api.ts`
- [x] お気に入りラッパ `apps/web/src/lib/api/favorites.ts`（add/list/remove）
- [ ] 神社カード/詳細に「お気に入り」トグルボタン設置
- [ ] ホームページ（検索フォーム・AIコンシェルジュ入口）
- [ ] 神社詳細ページ（住所・ご利益・祭神・ルート表示）
- [ ] マイページ（お気に入り・御朱印投稿管理）
- [ ] ランキングページ（月間・年間TOP10表示）
- [ ] コンポーネント追加（MapRoute・ConciergeMessage）
- [ ] ルートAPI連携UI（所要時間・距離の表示）

## 📱 モバイル（Expo）
- [ ] APIクライアント同期（`EXPO_PUBLIC_API_BASE`）
- [ ] 近隣神社リスト（expo-location）
- [ ] 御朱印画像投稿（expo-image-picker）

## 🛠 インフラ作業
- [x] Docker 環境起動・DB 接続確認済み
- [x] PostgreSQL + PostGIS 拡張確認（`0021_enable_postgis` 適用）
- [ ] CORS/CSRF の本番方針整理（同一オリジン + リバプロで最小化）
- [ ] AWS S3 連携（御朱印画像保存先）
- [ ] AWS ECS/Fargate デプロイ設定
- [ ] SSM Parameter Store（秘密情報管理）
- [ ] ALB + ACM（HTTPS化）
- [ ] Miniforge インストール＆初期化（powershell / bash）
- [ ] conda 環境 `jinja_app_py311` 構築（gdal/pyproj/shapely…）
- [ ] VS Code/Cursor の Python Interpreter 切替

## 📚 ドキュメント
- [ ] README：Favorites で `shrine` エイリアスの例を追記
- [ ] README：Nearby 検索の例と並び順・MAX_Q の説明を追記
- [x] TODO：本リストを最新版に更新（この変更）
- [ ] API エンドポイント一覧の刷新（認証要否・レート制限含む）

## 🔀 ブランチ/PR運用
- [ ] PR作成：`api/favorites-accept-shrine-alias`（説明・スモーク手順を記載）
- [ ] レビュー & Squash merge
- [ ] CHANGELOG/Releaseノート更新

## 🚀 今後の拡張
- [ ] 多言語対応（英語／中国語）
- [ ] Push通知（参拝リマインダー）
- [ ] SNS共有（Instagram/TikTok）
- [ ] 御朱印帳クラウド同期
- [ ] ランキング自動集計バッチ処理
