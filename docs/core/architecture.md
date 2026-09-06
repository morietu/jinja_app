> **Status: Active**
>
> 本ドキュメントは、KAMI MUSUBI全体のシステム構造、レイヤー責務、依存関係および詳細正本への委譲関係を管理する最上位技術正本である。
>
> 個別Endpoint、Payload、Fieldおよび正確な物理挙動は、関連する正本文書、実装コードおよびテストを最終的な正本とする。


# KAMI MUSUBI Architecture

## 目的

本ドキュメントは、KAMI MUSUBI の主要レイヤーと責務境界を1ページで確認するための概要を定義する。

詳細仕様、API契約、実装履歴、テスト方針は各正本ドキュメントへ分離し、本書には全体構造と依存関係のみを残す。

---

## 全体フロー

```text
User Input
↓
Consultation Interpretation
↓
Meaning Translation
↓
Recommendation
↓
Explore / Detail
↓
Route / Save / Visit
↓
Reflection
```

KAMI MUSUBI は Concierge First を採用する。

主導線は神社検索ではなく、相談テーマから神社と出会い、参拝と振り返りへ進む体験とする。

---

## レイヤーと責務

| レイヤー | 責務 | 主な出力 | 責務外 |
|----------|------|----------|--------|
| Consultation Interpretation | ユーザー入力を構造化する | state_profile / need_profile / direction_profile / emotion_profile / action_intent | 推薦順位の決定、心理診断 |
| Meaning Translation | 相談状態と神社文脈を意味情報へ変換する | history_theme / action_context / reflection_question_seed | 表示文言の最終決定、順位変更 |
| Recommendation | 神社候補の選定と推薦理由生成を行う | 候補、理由、Runtime Snapshot | UI表示責務、神社マスター更新 |
| Explore | 候補の発見・比較・位置確認を行う | 一覧、地図、検索結果 | 長文推薦理由、ユーザー状態の解釈 |
| Detail | 神社固有情報を正確に表示する | 由緒、祭神、ご利益、御朱印、位置情報 | 過度な推薦ロジック |
| Action | 参拝前後の具体的な一歩へ接続する | route / save / visit 導線 | 効果保証、行動強制 |
| Reflection | 参拝後の気づきを整理する | prompt / answer / mood / next action | 診断、正解提示 |

---

## Consultation Interpretation

Consultation Interpretation Engine の正本は backend 実装とする。

frontend / mobile は入力、補助条件、表示のみを担当し、相談解釈の判定ロジックを持たない。

```text
raw_query
↓
state_profile
need_profile
direction_profile
emotion_profile
action_intent
```

### 入力の扱い

**主入力**

- 相談テーマ

**条件追加**

- 参拝スタイル
- 誕生日
- ご利益タグ

**補助シグナル**

- 占星術
- 九星気学
- 風水
- 吉方位
- 相性

need_profile を推薦の主要入力とし、誕生日、占術、方位、相性は補助シグナルに限定する。

方位計算と表示契約の正本はBackendとし、Web / mobileは`direction_reference`を再計算しない。
具体的な省略条件とレスポンス形式は`docs/core/direction-response-contract.md`へ委譲する。
出発地点の手動指定はクライアントの一時状態として扱い、明示選択後の座標だけを既存の`location`境界へ渡す。

### 禁止事項

- 心理状態、性格、運命を断定しない
- raw_query を直接スコア加点しない
- ご利益タグだけで推薦理由を完結させない
- frontend / mobile に判定ロジックを重複実装しない
- LLM出力でユーザーの原文を上書きしない

---

## Meaning Translation

Meaning Translation Layer は interpretation_profile を受け取り、translation_result を生成する。

```text
interpretation_profile
↓
translate_meaning()
↓
translation_result
↓
ShrineMeaningComposer
```

主な接続は以下とする。

```text
translation_result.history_theme
→ generated.historyContext

translation_result.action_context
→ generated.actionMeaning

translation_result.reflection_question_seed
→ generated.afterVisitReflection
```

現時点では推薦順位を変更せず、以下に限定する。

- 意味入力の構造化
- 表示文言の補助
- debug / payload上の観測
- Action / Reflection生成の材料

表示文言の最終決定は Composer が担当する。

---

## Recommendation

Recommendation は、神社側の事実・意味情報と、ユーザー側の相談解釈を結合して生成する。

```text
Shrine Fact / Meaning
+
Consultation Interpretation
↓
Recommendation Match
↓
Recommendation Reason
```

Recommendation は以下を分離して扱う。

- 候補選定
- マッチング結果
- 推薦理由
- 表示用コピー
- 行動提案

推薦生成時点の評価、理由および行動提案は、生成時点の文脈を保持するRuntime Snapshotとして扱う。

保存済みの推薦結果は、神社情報、評価ロジックまたはユーザーの行動状態が後から変化しても、暗黙に再計算または再ランキングしない。

現在のFavorite、VisitおよびReflectionは現在状態として管理し、過去の推薦結果と同一視しない。

Runtime Snapshotの具体的なField、Payload、保存形式および互換方針は、以下へ委譲する。

- `docs/core/recommendation-reason-contract.md`
- 関連するRecommendation契約
- Backend実装およびテスト

---

### Recommendation Score

Recommendation Scoreは、神社候補の評価と順位決定に利用する。

新しいScoreは既存順位へ直ちに反映せず、既存結果との差分、各Signalの寄与および行動データとの関係を観測した上で、適用可否を判断する。

FrontendおよびMobileは、Backendが返す観測用Scoreを独自に順位へ反映しない。

ScoreのSignal、Component、Weight、計算式、評価方法および適用状況は、以下を正本とする。

- `docs/analytics/recommendation-score-v3-design.md`
- 関連するBackend実装およびテスト

---

## 画面責務

```text
Top
↓
Concierge
↓
Explore
↓
Detail
↓
Route
↓
Visit
↓
Reflection
```

| 画面 | 役割 |
|------|------|
| Top | 相談開始 |
| Concierge | 「なぜこの神社か」の生成 |
| Explore | 「どこへ行くか」の探索 |
| Detail | 「どんな神社か」の理解 |
| Route | 「どう行くか」の支援 |
| Visit | 「行った事実」の保存 |
| Reflection | 行動後の意味整理 |

### 設計原則

- 検索は浅く広く
- 詳細は正確に
- コンシェルジュは深く

Explore は Recommendation Logic、Meaning Layer、Recommendation Score を持たない。

Detail は神社理解を担当し、過度なパーソナライズを行わない。

---

## データ責務

### Shrine

公開検索、ランキング、コンシェルジュ推薦で参照される神社マスター。

### ShrineSubmission

ユーザー投稿の受付・審査用データ。

pending、rejected の状態では、公開検索・ランキング・推薦対象に含めない。

```text
User
↓
ShrineSubmission（pending）
↓
Admin Review
↓
approved
↓
Shrine
```

重複判定、承認、却下、API契約は投稿フローの正本ドキュメントへ委譲する。

### Runtime Snapshot

Runtime Snapshotは、推薦生成時点の相談文脈、評価結果、推薦理由および行動提案を保持する。

Shrineに固定して保存する神社プロフィールと、相談ごとに変化するRuntime情報を混在させない。

Runtime Snapshotの具体的なField、保存先、Payloadおよび互換方針は、Recommendation関連契約、Backend実装およびテストを正本とする。

### Behavior Data

行動の意味を混在させない。

- Favorite：保存・候補化
- Visit：参拝実行
- ShrineReflection：参拝後の内省
- ShrineInteractionLog：detail view、route open、card click
- ActionEvent：Action Suggestion の開始・完了

---

## 認証アーキテクチャ

Web版の認証付き通信は、以下の経路へ統一する。

```text
Frontend
↓
Next.js BFF
↓
Django Backend
↓
Authentication
↓
request.user
```

### 基本方針

- FrontendからBackendへ認証付き通信を直接行わない
- Tokenの保持、更新およびBackendへの付与はBFFの責務とする
- 認証、権限、所有者および課金状態の最終判定はBackendが担当する
- Frontendは認証状態と認証要求時のUIを担当する
- WebとMobileのToken保存方式を同一視しない

認証入口、Cookie、JWT、BFF Helper、Token Refresh、SessionAuthenticationおよび正本実装の詳細は、`docs/core/authentication-flow.md`を正本とする。

認証要求時の画面遷移、`returnTo`および認証後の復帰導線は、`docs/core/auth-flow.md`を参照する。

---

## 正本ドキュメント

詳細仕様は責務ごとに以下へ分離する。

### Core

- Core文書の入口：`docs/core/README.md`
- ローカル開発環境：`docs/core/desktop-development-contract.md`
- Meaning Layer：`docs/core/meaning-layer.md`
- Meaning接続：`docs/core/meaning-layer-connection.md`
- Narrative原則：`docs/core/narrative-guideline.md`
- Recommendation品質：`docs/core/recommendation-readiness.md`
- Recommendation Reason：`docs/core/recommendation-reason-contract.md`
- 認証：`docs/core/authentication-flow.md`
- 認証画面遷移：`docs/core/auth-flow.md`

### Product

- Product文書の入口：`docs/product/README.md`
- Concierge First：`docs/product/concierge-first-final-spec.md`
- Concierge Modes：`docs/product/concierge-modes.md`
- Meaning Translation：`docs/product/meaning-translation-mapping.md`
- Explore：`docs/product/explore-integration-design.md`
- 神社詳細：`docs/product/shrine-detail-layer.md`
- Action：`docs/product/action_suggestion_v4.md`
- Visit / Reflection：`docs/product/visit-reflection-flow.md`
- Premium：`docs/product/premium-experience.md`
- 投稿フロー：`docs/product/shrine-submission-flow.md`

### Knowledge

- Knowledge文書の入口：`docs/knowledge/README.md`
- 神社プロフィール：`docs/knowledge/shrine-profile-spec.md`
- 神社データ品質：`docs/knowledge/shrine-data-guide.md`
- 推薦コピー：`docs/knowledge/recommendation-copy-guide.md`

### Analytics

- Analytics文書の入口：`docs/analytics/README.md`
- Recommendation Score v3：`docs/analytics/recommendation-score-v3-design.md`

### Audit

- 監査、過去判断および時点記録：`docs/audit/`

---

## 変更ルール

- 詳細仕様を本書へ再掲しない
- 実装履歴や完了チェックリストを本書へ置かない
- API schema、migration、テストケースは専用ドキュメントへ分離する
- 責務境界または全体依存関係が変わる場合のみ本書を更新する
- 実装状態の細かな変更だけでは本書を更新しない
