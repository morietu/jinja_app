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
  googleDirFallbackText: _googleDirFallbackText,
  saveAction = null,
  children,
}: Props) {
  const hasActions = Boolean(googleDirHref || saveAction?.node || addGoshuinHref);

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

      {/* ✅ 操作は「何かできる」時だけ表示 */}
      {hasActions ? (
        <DetailSection title="操作">
          <div className="grid gap-2">
            {/* primary: 経路案内 */}
            {
              googleDirHref ? (
                <a
                  href={googleDirHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  {googleDirLabel}
                </a>
              ) : null /* ← fallback は出さない */
            }

            {/* secondary: 保存 */}
            {saveAction?.node ? <div>{saveAction.node}</div> : null}

            {/* tertiary: 御朱印追加 */}
            {addGoshuinHref ? (
              <Link
                href={addGoshuinHref}
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                {LABELS.addGoshuin}
              </Link>
            ) : null}
          </div>
        </DetailSection>
      ) : null}

      {children}
    </main>
  );
}
