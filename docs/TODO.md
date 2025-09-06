# 開発TODOリスト（最新版）

## 🧭 コア機能（AI参拝ナビ）
- [ ] ルート提案API（徒歩/車の経路算出）
- [ ] 人気神社推薦（閲覧/お気に入りスコアで30日集計）

## ⭐ サポート機能
- [ ] 御朱印投稿API（画像アップロード／公開切替／編集／削除）
- [x] お気に入りAPI（追加・削除・一覧取得） → JWT 認証で動作確認済み
- [ ] ランキングAPI（月間・年間TOP10）
- [ ] ユーザー認証／設定API（プロフィール編集・公開設定）

## ⚙️ バックエンド作業
- [x] JWT 認証エンドポイント `/api/token/*` 実装・確認済み
- [x] Shrine API（一覧・詳細JSON、`/api/shrines/`）
- [x] Favorite API（`/api/favorites/`、冪等POST、DELETE動作確認済み）
- [ ] モデル追加（ご利益・祭神フィールドなど拡張）
- [ ] シリアライザ更新（詳細情報／関連リソース拡張）
- [ ] 管理画面拡張（神社・御朱印・ランキング管理UI）
- [ ] バッチ処理（ランキング集計）

## 🎨 フロントエンド（Web / Next.js）
- [x] `axios` 導入（`apps/web`）
- [ ] 共通APIクライアント `apps/web/lib/api.ts` 実装（Baseはルート、呼び出しは `/api/...`）
- [ ] お気に入りラッパ `apps/web/lib/favorites.ts` 実装（add/list/remove）
- [ ] 神社カード/詳細に「お気に入り」トグルボタン設置
- [ ] ホームページ（検索フォーム・AIコンシェルジュ入口）
- [ ] 神社詳細ページ（住所・ご利益・祭神・ルート表示）
- [ ] マイページ（お気に入り・御朱印投稿管理）
- [ ] ランキングページ（月間・年間TOP10表示）
- [ ] コンポーネント追加（MapRoute・ConciergeMessage）

## 📱 モバイル（Expo）
- [ ] APIクライアント同期（`EXPO_PUBLIC_API_BASE`）
- [ ] 近隣神社リスト（expo-location）
- [ ] 御朱印画像投稿（expo-image-picker）

## 🛠 インフラ作業
- [x] Docker 環境起動・DB 接続確認済み
- [ ] CORS/CSRF の本番方針整理（同一オリジン + リバプロで最小化）
- [ ] PostgreSQL + PostGIS 拡張確認
- [ ] AWS S3 連携（御朱印画像保存先）
- [ ] AWS ECS/Fargate デプロイ設定
- [ ] SSM Parameter Store（秘密情報管理）
- [ ] ALB + ACM（HTTPS化）
- [ ] Miniforge インストール＆初期化（powershell / bash）
- [ ] conda 環境 `jinja_app_py311` 作成（python=3.11, gdal/pyproj/shapely/fiona/geopandas/rtree）
- [ ] VS Code/Cursor の Python Interpreter を切替

## 🚀 今後の拡張
- [ ] 多言語対応（英語／中国語）
- [ ] Push通知（参拝リマインダー）
- [ ] SNS共有（Instagram/TikTok）
- [ ] 御朱印帳クラウド同期
- [ ] ランキング自動集計バッチ処理
