"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import type { BaseCardProps } from "@/components/card/BaseCardProps";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function stopLinkNav(e: React.SyntheticEvent) {
  e.preventDefault();
  e.stopPropagation();
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={cn("size-4 text-neutral-500 transition-transform duration-200", open ? "rotate-180" : "rotate-0")}
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
    disclosureTitle,
    disclosureBody,
    variant = "list",
  } = props;

  const [open, setOpen] = React.useState(false);

  const isHero = variant === "hero";
  const sub = (subtitle ?? "").trim();
  const desc = (description ?? "").trim();

  const CardInner = (
    <div
      className={cn(
        "overflow-hidden rounded-2xl bg-white ring-1 ring-neutral-200/70",
        "shadow-sm transition",
        isPrimary && "shadow-md ring-neutral-200",
        detailHref && "cursor-pointer hover:shadow-md",
        isHero && "ring-2 ring-emerald-200 shadow-lg",
      )}
    >
      <div className={cn("relative w-full", isHero ? "h-40" : "h-36")}>
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
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {badges.map((badge) => (
                <span
                  key={badge}
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-full px-2.5 py-1",
                    "text-[11px] font-medium",
                    isHero
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                      : "bg-neutral-100/80 text-neutral-500 ring-1 ring-inset ring-neutral-200/60",
                  )}
                >
                  {badge}
                </span>
              ))}
            </div>

            {headerRight ? (
              <div className="shrink-0" onClick={stopLinkNav} onMouseDown={stopLinkNav}>
                {headerRight}
              </div>
            ) : null}
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
            {isHero && sub ? <p className="mb-1 text-[18px] font-bold leading-8 text-neutral-950">{sub}</p> : null}

            <h3
              className={cn(
                "font-semibold leading-snug",
                isHero ? "text-[14px] text-neutral-700" : "text-[15px] text-neutral-900",
              )}
            >
              {title}
            </h3>

            {address ? <p className="mt-1 truncate text-xs text-neutral-500">{address}</p> : null}

            {!isHero && sub ? (
              <p className="mt-2 text-[15px] font-semibold leading-6 text-neutral-900 line-clamp-2">{sub}</p>
            ) : null}

            {desc ? (
              <p
                className={cn(
                  "mt-2 leading-6",
                  isHero ? "text-[13px] text-neutral-700" : "text-[13px] text-neutral-600 line-clamp-2",
                )}
              >
                {desc}
              </p>
            ) : null}

            {detailHref ? (
              <Link
                href={detailHref}
                prefetch={false}
                className={cn(
                  "mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl px-3 py-2",
                  "text-sm font-semibold bg-neutral-900 text-white",
                  "ring-1 ring-inset ring-black/10 transition active:scale-[0.99] hover:bg-neutral-800",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400",
                )}
                onClick={(e) => e.stopPropagation()}
              >
                {detailLabel}
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {disclosureBody && disclosureTitle ? (
        <div
          className="border-t border-neutral-200/70 bg-neutral-50/30"
          onClick={stopLinkNav}
          onMouseDown={stopLinkNav}
        >
          <button
            type="button"
            onClick={(e) => {
              stopLinkNav(e);
              setOpen((v) => !v);
            }}
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

  return CardInner;
}
