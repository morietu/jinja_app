// apps/web/src/components/card/BaseCardProps.ts
import type React from "react";

export type BaseCardProps = {
  title: string;
  address?: string | null;
  imageUrl?: string | null;

  description: string;
  subtitle?: string | null;

  isPrimary?: boolean;

  badges?: string[];
  hideBadges?: boolean;
  hideLeftMark?: boolean;

  detailHref?: string | null;
  detailLabel?: string | null;

  headerRight?: React.ReactNode;

  disclosureTitle?: string | null;
  disclosureBody?: React.ReactNode;
};
