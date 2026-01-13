// apps/web/src/lib/navigation/shrineClose.ts
export type Close = { kind: "link"; href: string; label: string } | { kind: "back"; href: null; label: string };

type Input = {
  ctx?: string | null;
  tid?: string | null;
};

export function buildShrineClose({ ctx, tid }: Input): Close {
  if (ctx === "concierge") {
    const q = new URLSearchParams();
    if (tid) q.set("tid", tid);
    const href = q.toString() ? `/concierge?${q.toString()}` : "/concierge";
    return { kind: "link", href, label: "閉じる" };
  }

  if (ctx === "map") {
    return { kind: "link", href: "/map", label: "閉じる" };
  }

  // ctx が無い/未知のときは「戻る」（history.back）
  return { kind: "back", href: null, label: "戻る" };
}
