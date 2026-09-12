> **Status: Reference**
>
> 本ドキュメントは Concierge Filter の画面構成とUI責務を補足する Reference 文書である。
>
> Concierge First全体の責務は `docs/product/concierge-first-final-spec.md`、参拝スタイルの分類・表示文言は
> `docs/product/visit-style-taxonomy.md` を正本とする。

# Concierge Filter Area Design

## 目的

Concierge Firstの主導線を維持したまま、相談内容へ必要な補助条件を追加するための画面構成とUI責務を定義する。

Concierge Filterは検索フォームではなく、ユーザーの相談内容を補完するための補助条件エリアとして扱う。

---

## 基本原則

- 相談本文を主入力として扱う
- 補助条件は相談本文を上書きしない
- 条件入力を推薦体験の主役にしない
- 条件数と推薦精度の向上を直接結び付けない
- 占術・診断・宗教的効果を断定しない
- Backendの推薦判定を正本とする

---

## 補助条件

Concierge Filterは、以下の補助条件を扱う。

| 条件                 | 役割                                               |
| -------------------- | -------------------------------------------------- |
| 誕生日               | 相性や傾向を補足する                               |
| ご利益タグ           | ユーザーの願いや関心を補足する                     |
| 参拝スタイル         | 望む参拝体験を補足する                             |
| 参拝予定日・出発地点 | 今回の参拝に必要なRecommendation Contextを補足する |
| 自由補足             | その他の条件や希望を補足する                       |

補助条件は相談内容を補完するために使用し、相談テーマや自由入力より優先しない。

---

## 画面構成

```text
Concierge Filter
├─ 参拝スタイル
├─ 相性の参考
│  └─ 誕生日
├─ 願いごと・ご利益
├─ 参拝の詳細（参拝予定日・出発地点）
└─ 操作
    └─ Apply
```

### Editor責務

Personalizeは、閉じた状態と開いた状態で責務を分ける。

- **CLOSED Personalize（outer）**: title、説明、条件を開く入口、設定済み条件のsummary、条件をクリアする操作を担当する。
- **OPEN Personalize**: `ConciergeFilterPanel`がEditor全体を担当する。outer側でEditorのtitleやCloseを重複表示しない。
- `ConciergeSectionsRenderer`はsectionsのorchestrationとaction
  bridgeのみを担当し、Filter内容からEditorの可否を独自判定しない。

Open Editorの正本順序は以下とする。

1. Level 2 参拝の希望
2. Level 3-A 誕生日
3. Level 3-B ご利益
4. Level 3-C 参拝の詳細
5. Apply

### Close / Apply contract

CloseはEditorを閉じ、入力済み値を保持する。CloseだけではRecommendationを実行しない。Cancel buttonは存在せず、draft /
rollback stateも持たない。

Applyの表示と可否は以下のとおりとする。

| Context | Label                |
| ------- | -------------------- |
| Entry   | この条件で提案を見る |
| Result  | この条件で提案を更新 |

Apply可能条件は、ClientFullが`buildConciergePayload().query`から作るexecutable
queryの有無とbusy状態を正本とする。RendererやFilterPanelがfilter内容から再計算しない。

- executable queryがあり、busyではない場合のみApply可
- queryなし + 条件あり → Apply不可
- queryあり + 条件なし → Apply可
- queryあり + 条件あり → Apply可
- queryあり + busy → Apply不可

### Level 3-C Recommendation Context

参拝予定日と出発地点は、ユーザー属性や候補のhard filterではなく、今回のRecommendation
Contextとして扱う。入力UIは`ConciergeFilterPanel`内に配置し、 `locationError`はbusiness FilterStateではなくUI
stateとする。

---

## 閉じた状態

条件が設定されていない場合は、補助条件を追加できることだけを表示する。

```text
必要なときだけ条件を添える

[条件を追加する]
```

条件が設定されている場合は、設定内容の概要とクリア操作を表示する。

```text
追加済みの条件

- 誕生日あり
- ご利益を選択済み
- 参拝スタイルを設定済み
- 参拝予定日あり
- 出発地点あり
- 自由補足あり

[クリア]
```

詳細な条件値を過度に並べず、設定済みであることを簡潔に示す。

---

## 誕生日

誕生日は、相性や傾向を補足する任意情報として扱う。

### ルール

- 必須入力にしない
- 診断として表示しない
- 性格・運命・未来を断定しない
- 相談内容より優先しない
- 推薦理由の主文脈にしない

---

## ご利益タグ

ご利益タグは、ユーザーの願いや関心を補足する条件として扱う。

### ルール

- ご利益だけで推薦を決定しない
- 相談内容との関係を優先する
- 結果や効果を保証しない
- 初期表示する選択肢を増やしすぎない

---

## 参拝スタイル

参拝スタイルは、ユーザーが望む過ごし方や実用条件を補足するために使用する。

分類、表示文言、内部値は `docs/product/visit-style-taxonomy.md` を正本とする。

### ルール

- 本書で選択肢一覧を重複管理しない
- 検索条件のように強く見せない
- 相談テーマを上書きしない
- 神社との相性や効果を断定しない

---

## 自由補足

自由補足は、定型条件で表現できない希望を追加するために使用する。

### ルール

- 任意入力とする
- 長文入力を前提にしない
- 相談本文とは分離して保持する
- 推薦入力へ渡す際は補助条件として扱う

---

## データ接続

参拝スタイルと自由補足は、既存の補助条件入力へ接続する。

```text
Concierge Filter
↓
extraCondition
↓
Recommendation Input
```

`extraCondition` は補助入力として扱い、相談本文や`need_tags`を上書きしない。

---

## Concierge Entryとの責務境界

| Concierge Entry      | Concierge Filter     |
| -------------------- | -------------------- |
| 相談テーマ           | 誕生日               |
| 自由入力             | ご利益タグ           |
| 相談内容の確認・修正 | 参拝スタイル         |
| 推薦生成CTA          | 自由補足             |
| 条件追加導線         | 補助条件の適用・解除 |

Concierge Entryは相談の主入力を扱い、Concierge Filterは推薦を補完する条件を扱う。

---

## Backendとの責務境界

### Frontend

- 補助条件を入力する
- 選択状態を表示する
- 入力内容をPayloadへ渡す
- 条件の追加・解除操作を提供する

### Backend

- 補助条件を解釈する
- 推薦入力へ反映する
- 推薦順位や推薦理由への影響を判定する
- 業務ロジックの正本を保持する

Frontendは補助条件の判定ロジックを重複実装しない。

---

## 関連ドキュメント

- `docs/product/README.md`
- `docs/product/concierge-first-final-spec.md`
- `docs/product/concierge-entry-final-wireframe.md`
- `docs/product/concierge-modes.md`
- `docs/product/visit-style-taxonomy.md`
- `docs/product/meaning-translation-mapping.md`

---

## 更新ルール

- 本書はConcierge Filterの画面構成とUI責務のみを管理する。
- 参拝スタイルの分類・表示文言・内部値は本書で重複管理しない。
- 推薦ロジック、API契約、Taxonomyの詳細は各正本ドキュメントで管理する。
- Concierge Filterの画面構成またはUI責務が変更された場合のみ更新する。
- TODO、PR計画、実装進捗、作業履歴は本書へ記載しない。
