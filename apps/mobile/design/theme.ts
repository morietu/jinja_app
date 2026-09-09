// Mobile Color正本 (docs/design/design-token.md Migration方針 5)
// - colors: Light基調の初期パレット。2026-07時点では利用範囲が限定的。
// - kamimusubiDarkSemanticTheme: 共通Buttonを通じて主要画面から参照される。
// - kamimusubiDark: 現行Mobile全画面が実際に参照するDark基調の正本Primitive。
// - kamimusubiDark: 現行Mobile全画面が実際に参照するDark基調の正本Primitive。
//   Color Primitiveの実質的な正本はこちら。
export const colors = {
  paper: "#F6F3EE",
  primary: "#E24E33",
  accent: "#F2C94C",
  text: "#111",
  muted: "#555",
  border: "#e6e6e6",
  surfaceLight: "#fff",
  surfaceMuted: "#F4F4F5",
  textDark: "#111",
  textGray: "#666",
  textMuted: "#777",
  borderLight: "#eee",
  error: "#b00020",
  errorBackground: "#fff3f3",
  link: "#2f6ee5",
  favorite: "#E24E33",
} as const;

export const kamimusubiDark = {
  // Visual Direction: Dark Forest (森影) — 近黒緑からモスチャコールへ至る基盤。
  // 旧Navy基調 (#07101F 系) からの改訂。狙いは「静かな鎮守の杜の参道」であり、
  // ホラー/ゴシック、および黒×金のラグジュアリー表現は明確に対象外とする。
  // 奥行きは装飾やエフェクトではなく、背景・面・浮き面の明度差 (大気遠近) で作る。

  // ---- Foundation: near-black green -> deep moss charcoal ----
  // 明度は background < surfaceSoft < surface < surfaceRaised の単調増加。
  // 旧実装では surfaceSoft(#0B1424) が surface(#101827) より暗いまま
  // surface.elevated に割り当てられ、「浮き面ほど明るい」順序が逆転していた
  // (tokens.css の該当コメントが自認)。本改訂で surfaceRaised を追加し、
  // 背景 / カード面 / 浮き面の分離を明度順に回復させる。
  background: "#0A0F0C",
  surfaceSoft: "#0E1410",
  surface: "#131A15",
  surfaceRaised: "#1A231C",

  // ---- Border: muted olive-gray ----
  // 線は主張させない。面の境界は第一に明度差で示し、borderは補助に留める。
  borderSoft: "#1C241E",
  borderHeader: "#222B24",
  borderMuted: "#28322A",
  border: "#333D31",
  // border.strong 用。旧実装は border.strong に borderHeader(#1E2A3A) を
  // 割り当てており、border.default(#384154) より暗く「強い線ほど目立つ」
  // 関係が逆転していた。default より明るい段階をここで用意する。
  borderStrong: "#465043",
  // 金枠は「褪せた鎮守の金具」。彩度を落とし、装飾ではなく格式の記号として扱う。
  borderGold: "#7A6438",
  borderGoldDark: "#5C4B2A",

  // ---- Accent: restrained shrine-gold ----
  // 旧 gold(#E0B963) は彩度が高くラグジュアリー寄りだったため落ち着かせる。
  // goldは「重要なアクションにのみ差す光」であり、面や装飾には広げない。
  gold: "#C9A96A",
  goldSoft: "#DCC28A",
  // Premium は同じ世界の「より深く、より静かで、わずかに発光する」層。
  // action.primary と同値にせず (旧実装の値衝突を再発させない)、明度のみ上げる。
  premiumAccent: "#E4C88F",

  // ---- Support: soft cedar-green ----
  // 杉と苔の支援色。成功など「静かな肯定」に用い、goldとは責務を分ける。
  cedar: "#8FAE84",
  cedarDeep: "#3E5142",
  cedarDim: "#222E25",

  // ---- Text: warm mist-ivory -> sage ----
  // 主文字は霧を含んだ暖かい生成り。副次はセージ寄りに寄せ、森の空気に馴染ませる。
  text: "#F3EEE3",
  mutedSoft: "#C6C8B8",
  muted: "#A7AC9B",
  mutedDark: "#7C8375",
  navMuted: "#5F6B5D",

  // ---- Status ----
  // warning は gold と混同されないよう、より橙寄り・高彩度に振る。
  // error は警告色を保ちつつ、森の世界観に合わせ赤土寄りの落ち着いた色味とする。
  warning: "#D99A4E",
  error: "#E0918A",

  // ---- Outside ----
  // 幅広画面で本文カラム(max-width 430)の外側に出る余白色。
  // 旧値は明るいアイボリー(#F4EFE3)で、暗い本文と強く衝突していた。
  // background より一段深くし、本文カラムが木漏れ日で浮かぶ構図にする。
  outside: "#070A08",
} as const;

export type AppColorKey = keyof typeof colors;
export type KamimusubiDarkColorKey = keyof typeof kamimusubiDark;

// Design Token v1 定義基盤: Mobile Platform Theme (Semantic Color実値)
// 正本: docs/design/design-token.md
// 既存の colors / kamimusubiDark (上記) は変更せず、kamimusubiDark の値を
// 再利用してSemantic Color Token (semanticColorTokens.ts) の実値を割り当てる。
// PlatformColorTheme型により、SEMANTIC_COLOR_KEYSの全キーを満たすことを
// tscレベルで強制する (1つでも欠けるとコンパイルエラーになる)。
import type { PlatformColorTheme } from "./semanticColorTokens";

// Mobile Semantic Color Token契約の正本実値 (キー一覧・型は design/semanticColorTokens.ts)。
// 2026-07時点でこのオブジェクトを参照するのは本ファイル (型契約の充足) のみで、
// 共通Buttonを通じてLogin、Birthday、Premium、AuthPromptなどから消費される。 (design-token.md Migration方針 PR6
// 共通Buttonを通じてLogin、Birthday、Premium、AuthPromptなどから消費される。
export const kamimusubiDarkSemanticTheme: PlatformColorTheme = {
  "background.base": kamimusubiDark.background,
  "background.subtle": kamimusubiDark.surfaceSoft,
  "surface.default": kamimusubiDark.surface,
  // 旧実装は surfaceSoft (surface より暗い) を elevated に割り当てていた。
  // 背景 / カード面 / 浮き面の分離を保つため surfaceRaised を割り当てる。
  "surface.elevated": kamimusubiDark.surfaceRaised,
  "text.primary": kamimusubiDark.text,
  "text.secondary": kamimusubiDark.muted,
  "text.muted": kamimusubiDark.mutedSoft,
  "text.inverse": kamimusubiDark.background,
  "border.default": kamimusubiDark.border,
  // 旧実装の borderHeader は border.default より暗く強弱が逆転していたため、
  // default より明るい borderStrong を割り当てる。
  "border.strong": kamimusubiDark.borderStrong,
  "border.focus": kamimusubiDark.gold,
  // Primary Action は「重要な操作にだけ差す光」としての shrine-gold。
  "action.primary": kamimusubiDark.gold,
  "action.primaryHover": kamimusubiDark.goldSoft,
  "action.primaryText": kamimusubiDark.background,
  "action.disabled": kamimusubiDark.mutedDark,
  // Status: 旧実装は success / warning / premium / action がいずれも gold 系で、
  // 責務が値レベルで衝突していた。本改訂では
  //   action  = gold (shrine-gold)
  //   success = cedar (静かな肯定)
  //   warning = 橙寄りの高彩度 (goldと混同させない)
  //   premium = gold より明度の高い premiumAccent
  // として、色相・明度の双方で分離する。
  "status.success": kamimusubiDark.cedar,
  "status.successText": kamimusubiDark.cedar,
  "status.successSurface": kamimusubiDark.cedarDim,
  "status.successBorder": kamimusubiDark.cedarDeep,
  "status.warning": kamimusubiDark.warning,
  // 旧実装は login.tsx 由来の直書き値 (#FCA5A5) だった。Primitive へ昇格させる。
  "status.error": kamimusubiDark.error,
  "status.info": kamimusubiDark.muted,
  // Premium は同じ森の「より深く、より静かで、わずかに発光する」層。
  "premium.accent": kamimusubiDark.premiumAccent,
  "premium.surface": kamimusubiDark.surfaceRaised,
  "premium.border": kamimusubiDark.borderGold,
  // overlay は背景 (#0A0F0C) に合わせた森影。旧値は Navy 由来 (7,16,31)。
  "overlay.default": "rgba(6, 10, 8, 0.82)",
};
