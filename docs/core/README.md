# KAMI MUSUBI Core Documents

> **Status: Active**
>
> `docs/core/`配下の現行文書について、読む順番、Active / Reference分類、責務および委譲関係を管理する入口文書である。

## 目的

Core文書は、KAMI MUSUBI全体へ横断的に適用されるシステム構造、技術責務、品質基準、接続契約および生成原則を管理する。

本書はCore文書の詳細仕様を再掲せず、どの文書を、どの目的で読むかを示す。

## 読む順番

```text
architecture.md
↓
desktop-development-contract.md
↓
roadmap.md
↓
authentication-flow.md
↓
runtime-security-baseline.md
↓
concierge-spec.md
↓
meaning-layer.md
↓
meaning-layer-connection.md
↓
narrative-guideline.md
↓
recommendation-architecture.md
↓
recommendation-readiness.md
↓
recommendation-reason-contract.md
↓
openapi-contract-governance.md
```

認証後の画面復帰や`returnTo`を確認する場合は、Reference文書の`auth-flow.md`を参照する。

## Active

### 全体構造

| 文書 | 責務 |
| --- | --- |
| `architecture.md` | システム全体構造、レイヤー、技術責務および依存関係 |
| `desktop-development-contract.md` | active local Repository、local DB、再生成経路および開発環境の正本契約 |
| `roadmap.md` | 開発フェーズ、実装順序、ゴールおよび完了条件 |

### 認証

| 文書 | 責務 |
| --- | --- |
| `authentication-flow.md` | Web認証アーキテクチャ、Frontend・BFF・Backend責務、JWT・Cookie方針 |

### Security

| 文書 | 責務 |
| --- | --- |
| `runtime-security-baseline.md` | 現在有効なruntime/security contract、trust boundary、logging/public response/CI security方針 |

### Concierge

| 文書 | 責務 |
| --- | --- |
| `concierge-spec.md` | Concierge入力、LLM利用、API基本契約および運用上の保護条件 |

### Meaning

| 文書 | 責務 |
| --- | --- |
| `meaning-layer.md` | Meaning Layerの思想、目的、非断定原則および意味ある移動体験 |
| `meaning-layer-connection.md` | Meaning LayerとInterpretation、Translation、Composer、Recommendationの接続 |
| `narrative-guideline.md` | 全Narrative共通の非断定、可能性表現、自律尊重および行動接続原則 |

### Recommendation

| 文書 | 責務 |
| --- | --- |
| `recommendation-architecture.md` | Recommendation全体（相談入力から知識還元まで）のEnd-to-Endフロー、各段階の責務・正本データおよび引き渡し契約 |
| `recommendation-readiness.md` | 神社Knowledge CoverageのGovernance観測（Runtime candidate除外には接続しない） |
| `recommendation-reason-contract.md` | Recommendation ReasonのInput / Output / 保存 / 表示 / 互換責務 |

### API契約

| 文書 | 責務 |
| --- | --- |
| `openapi-contract-governance.md` | API実装上の正本、OpenAPI関連ファイルの分類、機械的schema生成経路およびCI検証責務 |

## Reference

| 文書 | 責務 |
| --- | --- |
| `auth-flow.md` | 認証要求時の画面遷移、`returnTo`および認証後復帰導線 |

## 責務境界

Coreは以下を管理する。

- システム全体の構造
- 横断的な技術責務
- 品質基準
- コンポーネント間の接続契約
- 全機能へ適用する生成・表現原則

詳細は以下へ委譲する。

- Product：画面、体験、機能単位の契約
- Knowledge：神社データ、意味定義、コピー生成原則
- Analytics：Event、Payload、KPI、Funnel、集計責務
- Audit：監査結果、過去判断、実装計画および時点記録
- 実装・テスト：正確な物理挙動

## 文書正本と実装正本

Core文書は、目的、責務、境界、入出力の意味、禁止事項、委譲関係、互換方針および更新条件を管理する。

実装とテストは、Endpoint、Route、Field、Payload、保存処理、判定処理、Fallbackおよび実際のResponseを管理する。

文書、実装およびテストが食い違う場合は、いずれか一つを自動的に正しいものとして扱わず、意図した仕様を確認する。

## 関連ドキュメント

- `docs/README.md`
- `docs/product/README.md`
- `docs/knowledge/README.md`
- `docs/analytics/README.md`
- `docs/audit/core-document-responsibility-audit.md`

## 更新ルール

- Core文書を追加、削除または分類変更した場合は本書を同じPRで更新する
- 詳細仕様、TODO、実装履歴およびPR情報を本書へ記載しない
- Active / Reference分類は監査結果と一致させる
- 正確な物理挙動は関連する実装コードとテストを確認する
