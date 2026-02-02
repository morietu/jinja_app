// apps/web/src/components/card/BaseCardProps.ts
import type React from "react";

export type BaseCardProps = {
  /** 表示名（必須） */
  title: string;

  /** 住所（未取得なら null でもOK） */
  address?: string | null;

  /** メイン画像（未取得なら null でもOK） */
  imageUrl?: string | null;

  /** 要約テキスト（必須） */
  description: string;

  /** サブタイトル（未設定なら null でもOK） */
  subtitle?: string | null;

  /** 優先表示（★・余白差など） */
  isPrimary?: boolean;

  /** 上部バッジ */
  badges?: string[];

  /** バッジ非表示 */
  hideBadges?: boolean;

  /** 左マーク非表示 */
  hideLeftMark?: boolean;

  /** CTAリンク（あるとCTA表示） */
  detailHref?: string;

  /** CTAラベル（省略時はUI側でデフォルト） */
  detailLabel?: string;

  /** タイトル行右側（★お気に入り等） */
  headerRight?: React.ReactNode;

  /** 折りたたみ見出し（disclosureBody がある時のみ意味がある） */
  disclosureTitle?: string;

  /** 折りたたみ内容 */
  disclosureBody?: React.ReactNode;

  /**
   * CTAクリック時の挙動を差し替えたい場合に使う
   * 例: router.push / resolve回避 / 計測 など
   */
  onNavigate?: () => void;
};
