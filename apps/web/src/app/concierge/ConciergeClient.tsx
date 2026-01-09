// apps/web/src/app/concierge/ConciergeClient.tsx
"use client";

import ConciergeClientEmbed from "./ConciergeClientEmbed";
import ConciergeClientFull from "./ConciergeClientFull";

type Props = {
  embedMode?: boolean;
};

export default function ConciergeClient({ embedMode = false }: Props) {
  return embedMode ? <ConciergeClientEmbed /> : <ConciergeClientFull />;
}
