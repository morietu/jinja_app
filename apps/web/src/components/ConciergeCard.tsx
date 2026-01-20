// apps/web/src/components/ConciergeCard.tsx
"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";

export type BaseCardProps = {
  title: string;
  address?: string | null;
  imageUrl?: string | null;

  description: string;
  isPrimary?: boolean;

  badges?: string[];

  detailHref?: string;
  detailLabel?: string;

  headerRight?: React.ReactNode;

  disclosureTitle?: string;
  disclosureBody?: React.ReactNode;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={cn("size-4 text-neutral-500 transition-transform duration-200", open && "rotate-180")}
    >
      <path
        d="M5.5 7.5 10 12l4.5-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ConciergeCard(props: BaseCardProps) {
  const {
    title,
    address,
    imageUrl,
    description,
    isPrimary = false,
    badges = [],
    detailHref,
    detailLabel = "詳細を見る",
    headerRight,
    disclosureTitle = "詳細",
    disclosureBody,
  } = props;

  const [open, setOpen] = React.useState(false);

  // disclosureBody があるカードは「閉=clamp」, 「開=clamp解除」
  // disclosureBody が無いカードは「isPrimary ならclampしない / それ以外clamp」
  const clampDesc = disclosureBody ? !open : !isPrimary;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      {imageUrl ? (
        <div className="relative h-36 w-full">
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="rounded-t-xl object-cover"
            sizes="(max-width: 768px) 100vw, 600px"
            priority={isPrimary}
          />
        </div>
      ) : null}

      <div className={cn("px-3", isPrimary ? "py-3" : "py-2")}>
        {(badges.length > 0 || headerRight) && (
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {badges.map((badge) => (
                <span
                  key={badge}
                  className="inline-flex shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-700"
                >
                  {badge}
                </span>
              ))}
            </div>
            {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
          </div>
        )}

        <div className="flex items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-neutral-100">
            <span className="text-sm text-neutral-500">{isPrimary ? "★" : "◎"}</span>
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold leading-snug text-neutral-900">{title}</h3>
            {address ? <p className="mt-0.5 truncate text-xs text-neutral-600">{address}</p> : null}

            <p
              className={cn(
                "mt-2 text-sm leading-relaxed text-neutral-800",
                clampDesc && "line-clamp-1 text-neutral-700",
              )}
            >
              {description}
            </p>

            {!isPrimary ? <span className="mt-1 inline-block text-[10px] text-neutral-500">候補</span> : null}

            {detailHref ? (
              <div className={cn("mt-3", !isPrimary && "mt-2")}>
                <Link
                  href={detailHref}
                  className={cn(
                    "inline-flex min-h-[44px] w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition",
                    "bg-neutral-900 text-white hover:bg-neutral-800",
                  )}
                >
                  {detailLabel}
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {disclosureBody ? (
        <div className="border-t border-neutral-200">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-neutral-50"
            aria-expanded={open}
          >
            <span className="text-xs font-semibold text-neutral-800">{disclosureTitle}</span>
            <Chevron open={open} />
          </button>

          {open ? (
            <div className="px-3 pb-3 pt-1 text-sm leading-relaxed text-neutral-800">{disclosureBody}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
