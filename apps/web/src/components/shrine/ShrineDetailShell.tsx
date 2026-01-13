// apps/web/src/components/shrine/ShrineDetailShell.tsx
import Link from "next/link";
import type { ReactNode } from "react";
import type { Close } from "@/lib/navigation/shrineClose";
import ShrineCloseLink from "@/components/shrine/ShrineCloseLink";

type SaveAction = {
  shrineId: number;
  nextPath: string;
  node: ReactNode;
};

type Props = {
  title: string;
  subtitle: string | null;
  close: Close;

  addGoshuinHref: string | null;
  saveAction: SaveAction | null;

  googleDirHref: string | null;
  googleDirLabel?: string;
  googleDirFallbackText?: string;

  children: ReactNode;
};

export default function ShrineDetailShell({
  title,
  subtitle,
  close,
  addGoshuinHref,
  saveAction,
  googleDirHref,
  googleDirLabel = "Googleマップで経路案内",
  googleDirFallbackText = "位置情報が未登録のため、経路案内を表示できません。",
  children,
}: Props) {
  return (
    <main className="mx-auto max-w-md space-y-6 p-4">
      <header className="space-y-1">
        <h1 className="text-lg font-bold">{title}</h1>
        {subtitle ? <p className="text-sm text-slate-600">{subtitle}</p> : null}
      </header>

      {/* CTA群 */}
      <div className="space-y-2">
        {addGoshuinHref ? (
          <Link
            href={addGoshuinHref}
            className="inline-flex w-full items-center justify-center rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700"
          >
            この神社で御朱印を追加
          </Link>
        ) : null}

        {saveAction ? saveAction.node : null}

        {googleDirHref ? (
          <a
            href={googleDirHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            {googleDirLabel}
          </a>
        ) : (
          <div className="rounded-xl border bg-white p-3 text-xs text-slate-500">{googleDirFallbackText}</div>
        )}
      </div>

      {children}

      {/* ✅ Close は Shell が一箇所で責務を持つ */}
      <ShrineCloseLink close={close} />
    </main>
  );
}
