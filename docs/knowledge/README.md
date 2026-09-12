# KAMI MUSUBI Knowledge Base

## 目的

KAMI MUSUBIが、神社の事実をどのように意味へ変換し、推薦・行動提案・振り返りへ接続するかを定義する。

本ディレクトリは、LLMや実装担当者が変わっても、KAMI MUSUBIらしい提案品質を維持するためのKnowledge Baseである。

現行仕様の判断には、本書で正本として指定する文書、関連するCore・Product文書、実装コードおよびテストを使用する。

---

## ドキュメント構成

### 正本

| ドキュメント | 責務 |
| --- | --- |
| `shrine-profile-spec.md` | 神社知識モデルと推薦可能品質を定義 |
| `shrine-knowledge-contract.md` | 神社Knowledge（deity/shrine_history等）の値の意味、出典、確認状態、信頼度、Fact利用条件およびAI生成値の制約を定義 |
| `shrine-data-guide.md` | 神社データの入力・出典・品質基準を定義 |
| `shrine-position-contract.md` | `Shrine.latitude` / `longitude` をVisitor / Navigation Anchorとして採用する意味、Source要件、競合時のHOLD/PASS判定を定義 |
| `recommendation-copy-guide.md` | 推薦理由の共通文章構造を定義 |
| `action-guide.md` | 行動提案の生成原則を定義 |
| `reflection-guide.md` | 振り返りの問いと接続方法を定義 |
| `glossary.md` | 共通用語と命名基準を定義 |

### Reference

| ドキュメント | 責務 |
| --- | --- |
| `recommendation-v4-copy-guideline.md` | Recommendation v4固有のコピー規則を補足する。共通の文章原則は`recommendation-copy-guide.md`、Input / Output契約は`docs/product/recommendation-v4-interpreter-contract.md`を正本とする |
| `evidence-foundation-shared-contract.md` | Evidence Foundation Shared Contract（PR-F1〜F4: Qualification / Taxonomy / Provenance / Assignment / EvidenceLink preparation）の責務を定義する。既存Recommendation / Rankingとは独立しており、F4時点でも未接続 |

---

## 全体接続

```text
Knowledge Base
↓
Database
↓
Meaning Layer
↓
Prompt
↓
Backend
↓
Frontend
↓
Analytics
```

Knowledge Baseは文章やデータ品質の原則を管理する。

物理的な保存、変換、API、表示および計測の正確な挙動は、対応するCore・Product・Analytics文書、実装コードおよびテストを最終的な正本とする。

---

## 依存関係

```text
神社プロフィール
↓
神社データ入力
↓
Position採用
↓
意味変換
↓
推薦文
↓
行動提案
↓
振り返り
```

各文書は上流文書の定義を前提とし、下流文書のみで上流の概念や用語を変更しない。

---

## 責務境界

StoredデータおよびMeaning変換の詳細責務は、以下を正本とする。

- `docs/product/meaning-translation-mapping.md`
  - `history_theme`の生成源、変換および接続仕様

- `docs/core/recommendation-reason-contract.md`
  - Fact / Interpretation / Action、保存、表示および互換責務

- `docs/knowledge/shrine-position-contract.md`
  - Shrine座標をVisitor / Navigation Anchorとして採用する意味、Source境界、conflicting address / coordinateの扱い

Knowledge Baseは、上記の物理契約を重複して定義せず、データ品質、文章品質および生成原則を管理する。

---

## 更新ルール

- 事実と解釈を分離する
- 宗教的・心理的な断定をしない
- 推薦理由は神社データに基づく
- 変更時は関連ドキュメントとの整合を確認する
- Database、Prompt、UIへ反映する前にKnowledge Baseを更新する
- Core・Productの実装契約をKnowledge文書内で重複定義しない
- 正本文書とReference文書の責務を混在させない
- Position採用時はvisitor-facing identityとlegal / historical addressを用途で分離し、説明不能な競合は推測で解消しない

---

## 更新順序

Knowledge Baseの正本文書は、原則として以下の順序で更新する。

1. `shrine-profile-spec.md`
2. `shrine-knowledge-contract.md`
3. `shrine-data-guide.md`
4. `shrine-position-contract.md`
5. `recommendation-copy-guide.md`
6. `action-guide.md`
7. `reflection-guide.md`
8. `glossary.md`

上流の仕様変更は、必要に応じて下流文書へ反映する。

下流文書だけを更新し、上流仕様または共通用語と矛盾する変更は禁止する。

`recommendation-v4-copy-guideline.md`は、Recommendation v4固有仕様が変更された場合にのみ更新する。

共通コピー原則を変更する場合は、先に`recommendation-copy-guide.md`へ反映し、その後にv4固有規則との整合を確認する。
