# 開発TODO（整合済み・現状反映版）

## 🧠 LLM（意図抽出のみ・JSON固定）

### ✅ 方針（固定仕様）

- [x]  自由チャットは行わない
- [x]  LLMは意図抽出（1回呼び・JSON固定）のみ
- [x]  神社選定・距離・フォールバックはBackend責任
- [x]  会話履歴を使用しない設計

## 🧩 実装（Backend）

- [x]  backend/temples/llm/ ディレクトリ作成
- [x]  [config.py](http://config.py) 実装
- [x]  [client.py](http://client.py) 実装（Dummy安全化済み）
- [x]  intent_extractor.py 実装
- [x]  POST /api/concierge/chat 実装
- [x]  JSONパース失敗時フォールバック実装
- [x]  LLM無効時に外部通信しない構造（CONCIERGE_USE_LLM）
- [x]  TESTING時は必ずDummyを使用
- [x]  タイムアウト／max_tokens制御あり
- [x]  LLM disabledでもテストが落ちない設計

## 🔒 安全保証（重要）

- [x]  OPENAI_API_KEY未設定でもアプリが動作する
- [x]  openai SDK未導入でも落ちない
- [x]  LLM無効時にvalidateで例外を出さない設計
- [x]  LLM有効時のみAPIキー必須であることをREADMEに明記
- [ ]  レート制限（例: 8/min）を明示的に設定

## ⚙ 有効化手順（オプション）

**※ LLMを本番有効にする場合のみ**

## ⚙ LLM有効化（任意・未使用がデフォルト）

- [ ] pip install openai>=1,<2
- [ ] .env に CONCIERGE_USE_LLM=1
- [ ] OPENAI_API_KEY を設定
- [x]  .env に LLM_MODEL
- [x]  .env に LLM_MAX_TOKENS
- [x]  （任意）.env に LLM_BASE_URL
- [x]  最小JSONプロンプトを確定

## 🗑 ランキング（実装しない）

- [x]  ランキングAPIを作らない
- [x]  集計バッチを作らない
- [x]  ランキングUIを作らない
- [x]  管理画面にランキングを作らない
- [x]  READMEに「ランキングなし」と明記

## 🗑 個人プロフィール（実装しない）

- [x]  プロフィール編集機能を作らない
- [x]  公開プロフィールページを作らない
- [x]  プロフィール更新APIを作らない
- [x]  プロフィール用UIを作らない
- [x]  READMEに「プロフィールなし」と明記

## 🧧 御朱印（最小構成）

### 実装済み

- [x]  御朱印機能を残す
- [x]  公開 / 非公開のみ
- [x]  SNS連携なし

### 確認・残タスク

- [ ]  御朱印画像アップロード最終確認
- [ ]  自分の御朱印一覧UI確認
- [ ]  is_public トグル確認
- [ ]  自分は全件閲覧可能確認
- [ ]  他人はpublicのみ閲覧可能確認
- [ ]  管理画面は御朱印のみ確認

## 🔐 認証・基盤

- [x]  Next.js /api キャッチオールプロキシ
- [x]  Cookie → Authorization Bearer 自動付与
- [x]  JWT refresh を HttpOnly Cookie で処理
- [x]  /api/users/me/ が 200 を返す
- [ ]  FavoriteViewSet の IsAuthenticated 最終確認

## 🎨 フロントエンド整理

### 方針確定済み

- [x]  axios / API ラッパ導入
- [x]  serverFetch / apiFetch 撤去
- [x]  チャットUIを使わない
- [x]  相談フォームUIにする

### 実装残り

- [ ]  相談フォームUI実装
- [ ]  神社3件の結果表示
- [ ]  距離表示
- [ ]  条件変更で再検索
- [ ]  マイページを御朱印管理のみに整理
- [ ]  プロフィールUI削除
- [ ]  ランキング導線削除

## 🎯 今のあなたにとっての「本当に重要な未完了」

**優先順位で並べる**

1. レート制限の明示化
2. README整備（LLMは意図抽出のみ）
3. フロント相談フォーム完成
4. 御朱印UI最終確認
