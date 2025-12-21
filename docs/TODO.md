# 開発TODOリスト（最終版・進捗管理用）

## 優先度A：LLM（意図抽出のみ・JSON固定）

- [x] 自由チャットは行わない
- [x] LLMは意図抽出（1回呼び・JSON固定）のみ
- [x] 神社選定・距離・フォールバックはBackend責任

- [ ] openai を requirements.txt に追加
- [ ] .env に OPENAI_API_KEY を設定
- [ ] .env に LLM_MODEL を設定
- [ ] .env に LLM_MAX_TOKENS を設定
- [ ] （任意）.env に LLM_BASE_URL を設定
- [ ] JSON Schema を固定（goriyaku / tone / atmosphere / avoid / summary）
- [ ] 最小プロンプト作成（JSONのみ出力）
- [ ] backend/temples/llm/ を作成
- [ ] config.py を作成
- [ ] client.py を作成
- [ ] intent_extractor.py を作成
- [ ] POST /api/concierge/chat を実装
- [ ] 会話履歴を使わないことを保証
- [ ] JSONパース失敗時のフォールバック実装
- [ ] レート制限（例：8/min）を設定
- [ ] タイムアウト・トークン上限ガードを実装
- [ ] cURL スモークテスト
- [ ] README に「LLMは意図抽出のみ」と明記
- [ ] feat/intent-extraction-json ブランチ作成
- [ ] develop にマージ

## ランキング（実装しない）

- [x] ランキングAPIを作らない
- [x] 集計バッチを作らない
- [x] ランキングUIを作らない
- [x] 管理画面にランキングを作らない
- [x] README/TODO に「ランキングなし」と明記

## 個人プロフィール（実装しない）

- [x] プロフィール編集機能を作らない
- [x] 公開プロフィールページを作らない
- [x] プロフィール更新APIを作らない
- [x] プロフィール用UIを作らない
- [x] README/TODO に「プロフィールなし」と明記

## 御朱印（最小構成）

- [x] 御朱印機能は残す
- [x] 公開 / 非公開のみとする
- [x] SNS・プロフィール連携は行わない

- [ ] 御朱印画像アップロード
- [ ] 自分の御朱印一覧表示
- [ ] is_public トグルを実装
- [ ] 自分は全件閲覧可能
- [ ] 他人は public のみ閲覧可能
- [ ] 管理画面は御朱印のみ

## 認証・基盤

- [x] Next.js /api キャッチオールプロキシ
- [x] Cookie → Authorization Bearer 自動付与
- [x] JWT refresh を HttpOnly Cookie で処理
- [x] /api/users/me/ が 200 を返す
- [ ] FavoriteViewSet の IsAuthenticated 最終確認

## フロントエンド（整理後）

- [x] axios / API ラッパ導入
- [x] serverFetch / apiFetch 撤去
- [x] チャットUIを使わない方針確定
- [x] 相談フォームUIにする方針確定

- [ ] 相談フォームUI実装
- [ ] 神社3件の結果表示
- [ ] 距離表示
- [ ] 条件を変えて再検索ボタン
- [ ] マイページは御朱印管理のみにする
- [ ] プロフィールUIを削除
- [ ] ランキング導線を削除
