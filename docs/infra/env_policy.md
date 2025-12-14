# Environment & Infra Policy

## 環境変数方針
- .env は絶対にコミットしない
- .env.example のみ共有

## APIキー
- USE_GOOGLE=false がデフォルト
- 有効化時は必ず制限設定

## 本番デプロイ
- main → Render / Vercel 自動反映
