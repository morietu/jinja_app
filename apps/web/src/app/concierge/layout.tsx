import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function ConciergeRouteLayout({ children }: Props) {
  return (
    <div
      data-app-frame="concierge"
      className="min-h-full w-full bg-[var(--kt-color-background-base)]"
    >
      {children}
    </div>
  );
}
