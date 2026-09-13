"use client";

// Weekly Theme（今週のテーマ）。
//
// weekly_theme はBackendのPresentation Copyであり、この componentは表示
// するだけで生成も書き換えもしない。`key` は識別子であってコピーではない
// ため、ユーザーへは表示しない。
//
// 月の方向表示（CompassDirectionVisual を含むDetailSection）の直後に置く、
// 薄いSection component。既存 DetailSection をそのまま再利用する。
import DetailSection from "@/components/shrine/DetailSection";
import type { CompassWeeklyTheme } from "../types";

export type WeeklyThemeSectionProps = {
  theme: CompassWeeklyTheme | null;
};

export default function WeeklyThemeSection({ theme }: WeeklyThemeSectionProps) {
  // Weeklyは補助Presentation。Themeが無い週は何も出さない（代替コピーを
  // Frontendで作らない）。
  if (!theme) return null;

  return (
    <DetailSection title="今週のテーマ" variant="secondary">
      <div className="space-y-1.5">
        <p className="text-sm font-semibold leading-6 text-[var(--kt-color-text-primary)]">{theme.title}</p>
        <p className="text-sm leading-6 text-[var(--kt-color-text-secondary)]">{theme.message}</p>
      </div>
    </DetailSection>
  );
}
