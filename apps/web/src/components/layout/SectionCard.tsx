// apps/web/src/components/layout/SectionCard.tsx
import type { ReactNode } from "react";

type Props = {
  title?: string;
  description?: string;
  children: ReactNode;
};

export function SectionCard({ title, description, children }: Props) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      {(title || description) && (
        <header>
          {title && <h2 className="text-sm font-semibold text-slate-800">{title}</h2>}
          {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
        </header>
      )}
      {children}
    </section>
  );
}
