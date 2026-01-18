// apps/web/src/components/card/BaseCardProps.ts
import type React from "react";

export type BaseCardProps = {
  /** 表示名（必須） */
  title: string;

  /** 住所 */
  address?: string | null;

  /** メイン画像 */
  imageUrl?: string | null;

  /** 要約テキスト（必須） */
  description: string;

  /** 優先表示（★・余白差など） */
  isPrimary?: boolean;

  /** 上部バッジ */
  badges?: string[];

  /** CTAリンク */
  detailHref?: string | null;

  /** CTAラベル（省略時はデフォルト） */
  detailLabel?: string | null;

  /** タイトル行右側（★お気に入り等） */
  headerRight?: React.ReactNode;

  /** 折りたたみ見出し（無ければ非表示） */
  disclosureTitle?: string | null;

  /** 折りたたみ内容 */
  disclosureBody?: React.ReactNode;
};
