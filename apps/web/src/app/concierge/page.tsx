// apps/web/src/app/concierge/page.tsx

import ConciergeClientFull from "./ConciergeClientFull";

type SP = Promise<Record<string, string | string[] | undefined>>;

function pickFirst(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export default function Page() {
  return (
    <div className="h-full min-h-0">
      <ConciergeClientFull />
    </div>
  );
}
