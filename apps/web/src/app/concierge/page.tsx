import { Suspense } from "react";
import ConciergeClientFull from "./ConciergeClientFull";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ConciergeClientFull />
    </Suspense>
  );
}
