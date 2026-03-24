"use client";

import * as React from "react";
import { buildShrineHref } from "@/lib/nav/buildShrineHref";

import ShrineCard from "@/components/shrines/ShrineConciergeCard";

type Props = React.ComponentProps<typeof ShrineCard> & {
  tid?: string | null;
};

export default function ConciergeShrineCard(props: Props) {

  const { shrineId, tid, detailHref, ...rest } = props;

  

  const qs = new URLSearchParams();
  qs.set("ctx", "concierge");
  if (tid) qs.set("tid", tid);

  const href = detailHref ?? buildShrineHref(shrineId, { ctx: "concierge", tid: tid ?? undefined });

  return (
    <ShrineCard
      shrineId={shrineId}
      detailHref={href}
      {...rest}
      // ShrineCardは元のまま。LinkでOK。prefetch問題を避けたいならここを次で対応
    />
  );
}
