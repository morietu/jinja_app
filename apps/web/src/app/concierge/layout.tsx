// apps/web/src/app/concierge/layout.tsx
import * as React from "react";

export default function ConciergeLayoutRoot({ children }: { children: React.ReactNode }) {
  // RootLayout の <main className="flex-1 min-h-0"> の“残り高”をそのまま使う
  return (
    <div className="w-full min-w-0 min-h-dvh h-dvh flex flex-col overflow-hidden bg-neutral-50">
      {children}
    </div>
  );
}
