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
