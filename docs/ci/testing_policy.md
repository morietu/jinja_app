# Testing Policy

## テスト種別
- Unit: ロジック保証
- Integration: API契約
- Contract: Web↔Backend整合

## 外部API
- 原則モック
- 実コールは禁止（コスト事故防止）

## CI失敗時の判断
- lint/format → 必ず直す
- flaky test → 原因記録して再実行可

## 現フェーズで E2E テストを導入していない理由
- 本プロジェクトは MVP フェーズのため、UI/UX と仕様変更の頻度が高い
- E2E はコスト（実装・保守・CI時間）が高く、変更耐性が低い
- そのため現時点では以下を重視する
  - API Contract Test（schema / status / payload）
  - Unit / Integration Test（ビジネスロジック）
