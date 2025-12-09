// apps/web/src/components/layout/SectionCard.tsx
import type { ReactNode } from "react";

type Props = {
  title?: string;
  description?: string;
  children: ReactNode;
};

export function SectionCard({ title, description, children }: Props) {
  return (
    <section className="rounded-2xl border border-orange-100 bg-white px-6 py-5 shadow-sm space-y-4">
      {(title || description) && (
        <header className="space-y-1">
          {title && (
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-800">
              <span className="inline-block h-5 w-1 rounded-full bg-orange-400" />
              {title}
            </h2>
          )}
          {description && <p className="text-xs text-gray-500 leading-relaxed">{description}</p>}
        </header>
      )}

      <div>{children}</div>
    </section>
  );
}
