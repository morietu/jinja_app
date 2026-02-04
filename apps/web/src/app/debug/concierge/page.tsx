// apps/web/src/app/debug/concierge/page.tsx
import { notFound } from "next/navigation";
import ConciergeDebugClient from "./ConciergeDebugClient";

export default function Page() {
  // ✅ env がONのときだけルート自体を生かす
  if (process.env.NEXT_PUBLIC_ENABLE_DEBUG_PAGES !== "1") notFound();
  return <ConciergeDebugClient />;
}
