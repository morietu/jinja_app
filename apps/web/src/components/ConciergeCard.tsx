// apps/web/src/components/ConciergeCard.tsx
"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import type { BaseCardProps } from "@/components/card/BaseCardProps";

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
    subtitle,
    isPrimary = false,
    badges = [],
    hideBadges = false,
    hideLeftMark = false,
    detailHref,
    detailLabel = "詳細を見る",
    headerRight,
    disclosureTitle = "詳細",
    disclosureBody,
  } = props;

  const [open, setOpen] = React.useState(false);
  const clampDesc = disclosureBody ? !open : !isPrimary;

  const sub = (subtitle ?? "").trim();
  const desc = (description ?? "").trim();

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl bg-white ring-1 ring-neutral-200/70",
        "shadow-sm transition",
        isPrimary && "shadow-md ring-neutral-200",
      )}
    >
      <div className="relative h-36 w-full">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 600px"
            priority={isPrimary}
            unoptimized
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-neutral-100 to-neutral-50" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-black/0 to-black/0" />
        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/5" />
      </div>

      <div className={cn("px-4", isPrimary ? "py-4" : "py-3")}>
        {!hideBadges && (badges.length > 0 || headerRight) ? (
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {badges.map((badge) => (
                <span
                  key={badge}
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-full px-2.5 py-1",
                    "text-[11px] font-semibold",
                    "bg-neutral-100/80 text-neutral-700 ring-1 ring-inset ring-neutral-200/60",
                  )}
                >
                  {badge}
                </span>
              ))}
            </div>
            {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
          </div>
        ) : null}

        <div className="flex items-start gap-3">
          {!hideLeftMark ? (
            <div
              className={cn(
                "mt-0.5 flex size-9 items-center justify-center rounded-full",
                "bg-neutral-100 ring-1 ring-inset ring-neutral-200/60",
              )}
              aria-hidden="true"
            >
              <span className={cn("text-xs font-semibold", isPrimary ? "text-neutral-800" : "text-neutral-600")}>
                {isPrimary ? "TOP" : "ALT"}
              </span>
            </div>
          ) : null}

          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold leading-snug text-neutral-900">{title}</h3>
            {address ? <p className="mt-1 truncate text-xs text-neutral-600">{address}</p> : null}

            {sub ? (
              <p className="mt-2 text-sm font-medium leading-relaxed text-neutral-800 line-clamp-1">{sub}</p>
            ) : null}

            {desc ? (
              <p
                className={cn(
                  "mt-2 text-sm leading-relaxed text-neutral-800",
                  clampDesc && "line-clamp-2 text-neutral-700",
                )}
              >
                {desc}
              </p>
            ) : null}

            {detailHref ? (
              <div className={cn("mt-4", !isPrimary && "mt-3")}>
                <Link
                  href={detailHref}
                  prefetch={false}
                  className={cn(
                    "inline-flex min-h-[44px] w-full items-center justify-center rounded-xl px-3 py-2",
                    "text-sm font-semibold",
                    "bg-neutral-900 text-white",
                    "ring-1 ring-inset ring-black/10",
                    "transition active:scale-[0.99] hover:bg-neutral-800",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400",
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
        <div className="border-t border-neutral-200/70 bg-neutral-50/30">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "flex w-full items-center justify-between px-4 py-3 text-left",
              "transition hover:bg-neutral-50",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400",
            )}
            aria-expanded={open}
          >
            <span className="text-xs font-semibold text-neutral-800">{disclosureTitle}</span>
            <Chevron open={open} />
          </button>

          {open ? (
            <div className="px-4 pb-4 pt-1 text-sm leading-relaxed text-neutral-800">{disclosureBody}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
