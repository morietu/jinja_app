// apps/web/src/components/ShortcutCardGrid.tsx
import { ReactNode } from "react";

type ShortcutCardGridProps = {
  children: ReactNode;
};

export function ShortcutCardGrid({ children }: ShortcutCardGridProps) {
  return <section className="mx-auto mt-6 grid max-w-5xl gap-4 px-4 md:grid-cols-3">{children}</section>;
}
