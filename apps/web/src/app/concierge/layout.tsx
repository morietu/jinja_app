// apps/web/src/app/concierge/layout.tsx
import * as React from "react";

export default function ConciergeLayoutRoot({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full min-w-0 min-h-dvh h-dvh flex flex-col overflow-hidden bg-neutral-50">
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
