// apps/web/src/components/shrine/ShrineDetailShell.tsx
import type { ReactNode } from "react";
import Link from "next/link";
import type { Close } from "@/lib/navigation/shrineClose";
import ShrineCloseLink from "@/components/shrine/ShrineCloseLink";
import { LABELS } from "@/lib/ui/labels";
import DetailSection from "@/components/shrine/DetailSection";


type SaveAction = {
  shrineId: number;
  nextPath: string;
  node: ReactNode; // 例: <ShrineSaveButton ... />
};

type Props = {
  title: string;
  subtitle?: string | null;
  close: Close;

  // CTA
  addGoshuinHref?: string | null;
  googleDirHref?: string | null;
  googleDirLabel?: string; // 任意で上書き可
  googleDirFallbackText?: string;

  saveAction?: SaveAction | null;

  children?: ReactNode;
};

export default function ShrineDetailShell({
  title,
  subtitle = null,
  close,
  addGoshuinHref = null,
  googleDirHref = null,
  googleDirLabel = LABELS.googleDirections,
  googleDirFallbackText = "位置情報が未登録のため、経路案内を表示できません。",
  saveAction = null,
  children,
}: Props) {
  return (
    <main className="mx-auto min-h-[calc(100vh-64px)] max-w-md space-y-4 p-4">
      {/* ✅ Close をヘッダー左固定 */}
      <header className="flex items-center justify-between">
        <div className="shrink-0">
          <ShrineCloseLink close={close} />
        </div>

        <div className="min-w-0 flex-1 px-2 text-center">
          <div className="truncate text-sm font-semibold text-slate-900">{title}</div>
          {subtitle ? <div className="truncate text-[11px] text-slate-500">{subtitle}</div> : null}
        </div>

        {/* 右側はレイアウト固定のため空 */}
        <div className="w-[64px]" />
      </header>

      
      {/* ✅ CTA（御朱印 → 経路案内 → 保存）を DetailSection トーンに統一 */}
      <DetailSection title="操作">
        <div className="grid gap-2">
          {addGoshuinHref ? (
            <Link
              href={addGoshuinHref}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700"
            >
              {LABELS.addGoshuin}
            </Link>
          ) : null}

          {googleDirHref ? (
            <a
              href={googleDirHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {googleDirLabel}
            </a>
          ) : (
            <div className="text-xs text-slate-500">{googleDirFallbackText}</div>
          )}

          {saveAction?.node ? <div>{saveAction.node}</div> : null}
        </div>
      </DetailSection>

      {/* 本文 */}
      {children}
    </main>
  );
}
