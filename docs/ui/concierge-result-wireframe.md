# Concierge Result Wireframe

本ドキュメントは、神社コンシェルジュの推薦結果画面の  
**情報構造 / UX演出 / コンポーネント責務**を固定するための設計書である。

この画面はアプリの**最も重要な体験部分**であり、  
Appleレベルの「静かな説得構造」を持つUIとして設計する。

---

# 1. 目的

推薦結果画面の役割は以下の3つである。

1. ユーザーの相談内容を整理して提示する
2. 最も適した神社を説得力のある形で提示する
3. 行動（参拝）へ自然に導く

この画面では **「検索結果」ではなく「コンシェルジュの提案」** を体験させる。

---

# 2. 画面の主導線

ユーザーの視線導線は以下とする。
相談整理
↓
TOP候補
↓
なぜこの神社なのか
↓
他候補
↓
行動（詳細 / 経路）

重要なのは

**TOP候補を主役にすること**

であり、  
他候補は補助情報として扱う。

---

# 3. 情報階層（5ブロック構造）

推薦結果画面は以下の5ブロックで構成する。
① 今回の相談の整理

② TOP候補（Hero Shrine）

③ なぜこの神社なのか（理由）

④ 他の候補

⑤ 行動（CTA）
---

## ① 今回の相談の整理

ユーザーの入力をコンシェルジュが整理して提示する。

例
仕事の流れを整えたい
焦りが続いている
次の判断を落ち着いて整理したい

ここは

- 相談の再定義
- 状態の言語化

を行う。

目的は

**「このアプリは自分の状況を理解している」**

と感じさせること。

---

## ② TOP候補（Hero Shrine）

推薦1位の神社を **Heroカード** として表示する。

表示要素
神社名
写真

キャッチコピー
（例）
仕事の流れを整えたい時の神社

1位理由
（rank.whyTop）
例
今回の候補の中でも
相談内容との一致が最も強く見られる神社です
---

## ③ なぜこの神社なのか

推薦理由の構造は以下。

相談整理
↓
神社の意味
↓
参拝の意味
対応データ

why.summary
why.primaryReason
why.secondaryReason
interpretation.consultationSummary
interpretation.shrineMeaning
interpretation.actionMeaning
ここで

**説得**

を行う。

---

## ④ 他の候補

2位以降の神社。

表示情報は減らす。

カード表示：
神社名
短い理由
タグ
出す情報
why.summary
why.primaryReason
出さないもの
長い解釈
rank
説明文
目的

**比較のための補助情報**

---

## ⑤ 行動（CTA）

CTAは2つに固定する。
詳細を見る
経路案内
禁止
曖昧なCTA
多すぎるCTA
---

# 4. コンポーネント構造

推薦結果画面のReact構造は以下。


ConciergeResultPage
├─ ConsultationSummary
├─ TopShrineHero
│   ├─ ShrineCardHero
│   ├─ RankReason
│   └─ PrimaryExplanation
│
├─ ShrineReasonSection
│   ├─ ConsultationInterpretation
│   ├─ ShrineMeaning
│   └─ ActionMeaning
│
├─ OtherShrinesList
│   └─ ShrineCardCompact
│
└─ ConciergeCTA
---

# 5. UX演出

AppleレベルのUXでは

**順番が演出になる**

演出順
① 相談整理表示

② TOP候補フェードイン

③ 理由表示

④ 他候補表示

演出時間
相談整理     0.2s
TOP候補       0.3s
理由           0.2s
他候補         0.2s
重要

**スクロールで理解が進む構造**

---

# 6. spacing / typography / motion

## spacing

基本間隔
section gap 24px
card padding 16px
text gap 8px
TOPカードは余白を大きくする
---

## typography

階層
神社名        text-xl
キャッチコピー text-base
理由          text-sm
補足          text-xs
---

## motion

原則
静か
短い
控えめ

禁止
強いアニメーション
バウンス
派手なトランジション
---

# 7. 捨てるもの

この画面では以下を捨てる。
ランキング数字
複雑な比較
情報量の多いカード
理由

コンシェルジュ体験は

**選択肢提示ではなく提案**

---

# 8. ConciergeSectionsRenderer 分割方針

現在
ConciergeSectionsRenderer.tsx
が肥大化しているため  
以下に分割する。


features/concierge/components/

ConciergeResultSections.tsx
ConsultationSummary.tsx
TopShrineHero.tsx
ShrineReasonSection.tsx
OtherShrinesList.tsx
ConciergeCTA.tsx
`ConciergeSectionsRenderer` は

**payload → section routing**

のみ行う。

---

# 9. デザイン原則

この画面の設計原則は3つ。
主役は1つ
説明は順番
行動はシンプル
つまり

**Appleのプロダクト説明ページと同じ構造**

---

# 10. 最終目的

この画面の最終目的は
検索結果を見せることではない
目的は
この神社に行こうと思わせることである。


