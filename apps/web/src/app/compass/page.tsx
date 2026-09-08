import { Suspense } from "react";
import CompassSharedBirthdayClient from "@/features/compass/CompassSharedBirthdayClient";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CompassSharedBirthdayClient />
    </Suspense>
  );
}
