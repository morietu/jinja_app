# Auth Flow

## 1. concierge の基本方針
- 相談・閲覧は未ログインでも許可
- 保存系操作はログイン必須
- 認証が必要になった瞬間だけ login/register に送る

## 2. concierge 保存導線
未ログインで concierge 利用
↓
保存アクションで認証要求
↓
/auth/login?returnTo=/concierge
↓
必要なら /auth/register?returnTo=/concierge
↓
登録成功
↓
ログイン成功
↓
/concierge に復帰

## 3. mypage 保護導線
未ログインで /mypage?tab=goshuin などへ遷移
↓
login にリダイレクト
↓
/auth/login?returnTo=/mypage?tab=goshuin
↓
ログイン成功
↓
元の tab に復帰

## 4. 責務境界
- ConciergeClientFull:
  未ログイン時の導線分岐、returnTo 指定
- LoginForm:
  login 実行、returnTo 復帰
- SignupForm:
  signup -> login -> returnTo 復帰
- /api/auth/register:
  backend signup endpoint の BFF
