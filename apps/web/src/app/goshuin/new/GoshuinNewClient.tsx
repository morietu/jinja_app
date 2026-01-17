"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

function safeDecode(v: string) {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

export default function GoshuinNewClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const [busy, setBusy] = useState(false);

  const from = useMemo(() => sp.get("from"), [sp]);
  const shrine = useMemo(() => sp.get("shrine"), [sp]);

  const goNext = () => {
    if (from) {
      router.push(safeDecode(from));
      return;
    }
    if (shrine && Number.isFinite(Number(shrine))) {
      router.push(`/shrines/${Number(shrine)}#goshuins`);
      return;
    }
    router.push("/mypage?tab=goshuin");
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setBusy(true);
      // await api.post("/goshuin/", payload);
      goNext();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="p-4 space-y-3">
      <button className="px-4 py-2 bg-blue-600 text-white rounded" disabled={busy}>
        {busy ? "登録中…" : "登録する"}
      </button>
    </form>
  );
}
