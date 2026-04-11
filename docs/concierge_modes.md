# Concierge Modes

最終更新: 2026-03-19

## 目的

コンシェルジュの推薦を、以下の2モードに分離して説明可能にする。

- 悩みベース: 今の悩み・気分・願いごとから神社を探す
- 相性ベース: 生年月日との相性から神社を探す

本ドキュメントは、入力 / 判定軸 / 出力 / 詳細ページの説明責任を整理するためのもの。

---

## 1. モード一覧

| モード | 内部名 | ユーザー向け説明 | 主入力 |
|---|---|---|---|
| 悩みベース | `need` | 今の気持ちや願いごとから探す | `query` |
| 相性ベース | `compat` | 生年月日との相性から探す | `birthdate` |

---

## 2. 悩みベース (`need`)

### 目的
ユーザーの現在の状態や悩みに合う神社を返す。

### 主入力
- `query`
- `goriyaku_tag_ids`（任意）
- `extra_condition`（任意）
- `area` / `lat` / `lng`（任意）
- `birthdate`（任意・補助）

### 主判定軸
- `need_tags`
- `matched_need_tags`
- `astro_tags`
- `goriyaku_tag_ids`
- 距離
- 人気度

### 補助判定
- `birthdate` があれば astro の補助加点はあり得る
- ただし主軸は query

### 出力の原則
- 「今の状態に合う」ことを結論にする
- 理由文は need_tags と神社の特徴を接続する
- 足りない情報を先に言い訳しない

### 詳細ページの理由文
例:
- 不安を整えながら次の一歩を踏み出したい今の状態に合っています
- 落ち着きたい気持ちと、この神社の厄除け・浄化の特徴が重なっています

---

## 3. 相性ベース (`compat`)

### 目的
ユーザーの生年月日から見た気質や要素と、相性のよい神社を返す。

### 主入力
- `birthdate`
- `area` / `lat` / `lng`（任意）

### 主判定軸
- `birthdate -> sun_sign_and_element`
- `element_priority(user_elem, shrine.astro_elements)`
- 距離
- 人気度

### 補助判定
- `query` は任意
- `goriyaku_tag_ids` / `extra_condition` は基本的に主軸ではない
- 相性モードでは need_tags より element 判定を優先する

### 出力の原則
- 「あなたの要素と神社の要素が合う」ことを結論にする
- 理由文に `element` か `sign` を必ず含める
- query がなくても成立する

### 詳細ページの理由文
例:
- あなたの生年月日から見た「火」の要素と、この神社の前進性・厄除けの性質が噛み合っています
- 行動力や切り替えを後押しする相性として、この神社が上位に入ります

---

## 4. モード判定ルール

### 原則
- request payload に `mode` を明示で持たせる
- frontend / backend で同じモード名を使う
- `feel / filter` は UI表現であり、内部ロジック名には使わない

### 判定

#### `mode == "need"`
- query ベース推薦を実行する

#### `mode == "compat"`
- birthdate ベース推薦を実行する
- query が空でも成立させる

### フォールバック
- `mode` 未指定で `birthdate` のみある場合:
  - `compat` 扱い
- `mode` 未指定で `query` がある場合:
  - `need` 扱い

---

## 5. frontend の扱い

### 現状
- `entryMode = "feel" | "filter"`
- `birthdateToElement4()` が frontend 側に存在
- request payload では `need / compat` に寄せ始めている

### 方針
- UI文言:
  - 「今の気持ちから探す」
  - 「生年月日との相性で探す」
- 内部名:
  - `need`
  - `compat`

### 注意
`birthdateToElement4()` は UI補助用に限定し、推薦根拠の正本にしない。  
正本は backend `domain/astrology.py` とする。

---

## 6. backend の扱い

### 悩みベース
- `need_tags`
- `matched_need_tags`
- `astro_tags`
- 距離 / 人気

### 相性ベース
- `sun_sign_and_element(birthdate)`
- `element_priority(user_elem, shrine.astro_elements)`
- 距離 / 人気

### 必須修正
- `birthdate` 単独で `compat` モードに入れる
- `flow` と `mode` の意味を docs 上でも一致させる

---

## 7. 詳細ページの扱い

### 原則
詳細ページの「なぜこの神社か」は、推薦モードに依存して出し分ける。

### 悩みベース
- need_tags と神社特徴の接続

### 相性ベース
- sign / element と `astro_elements` の接続

### 禁止
- モードが違うのに同じ抽象文を出すこと
- 情報不足の言い訳を冒頭に置くこと

---

## 8. テストユーザー募集の再開条件

以下が揃うまで再開しない。

- `need / compat` の仕様が固定されている
- `birthdate` 単独で `compat` が成立する
- 詳細ページで mode 別の理由文が出る
- 運営側が「なぜこの神社か」を説明できる

---

## 9. 直近の実装順

1. backend で `birthdate` 単独 compat 分岐を確定
2. frontend entry 導線を `悩み / 相性` にリネーム
3. frontend の `birthdateToElement4()` を UI補助へ縮小
4. 詳細ページの理由文を mode 別に出し分け
5. テストユーザー募集を再開
