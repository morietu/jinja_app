// apps/web/src/app/page.tsx
import { Suspense } from "react";
import HomePage from "@/features/home/HomePage";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <HomePage />
    </Suspense>
  );
}
