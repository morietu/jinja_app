# フロントエンド（Next.js/Expo）

## 技術スタック

- **React / Next.js** (App Router)
- **Expo**（モバイル展開）
- **Tailwind CSS + shadcn/ui**（和風×モダンのUIテーマ）

## ページ構成

- `/` - ホーム（検索フォーム・AIコンシェルジュ入口）
- `/shrines/[id]` - 神社詳細ページ
- `/ranking` - ランキングページ
- `/mypage` - マイページ（御朱印投稿・お気に入り表示）
- `/auth/login` - ログインページ
- `/auth/register` - 新規登録ページ

## UIコンポーネント

- **`ShrineCard`** - 神社表示
- **`GoshuinCard`** - 御朱印表示
- **`MapRoute`** - ルート表示（徒歩=青 / 車=赤）
- **`ConciergeMessage`** - AIからの案内文
