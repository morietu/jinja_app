# LLM Overview

## 目的
AIコンシェルジュは「候補生成と理由付け」に限定する。

## 採用モデル
- OpenAI Responses API
- モデル: gpt-4.1-mini（理由）

## 非責務
- DB確定処理
- ルート距離計算（サーバ側で実施）

## フォールバック
- API失敗時は距離順 top3 を返す

## レート・コスト方針
- 8 req/min/user
- キャッシュTTL: 10分
