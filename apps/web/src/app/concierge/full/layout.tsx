// apps/web/src/app/concierge/full/layout.tsx
import * as React from "react";
import ConciergeLayoutRoot from "../layout";
import { AuthProvider } from "@/lib/auth/AuthProvider";

export default function ConciergeFullLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConciergeLayoutRoot>
      <AuthProvider>{children}</AuthProvider>
    </ConciergeLayoutRoot>
  );
}
