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
    <div
      className={cn(
        // いまどきの「薄い境界 + 影 + 角丸」
        "overflow-hidden rounded-2xl bg-white ring-1 ring-neutral-200/70",
        "shadow-sm",
        "transition",
        // primaryはちょい“主役感”
        isPrimary && "shadow-md ring-neutral-200",
      )}
    >
      {/* media */}
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

        {/* 画像上の薄いレイヤーで「のっぺり」回避 */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-black/0 to-black/0" />

        {/* 上部の内側リング */}
        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/5" />
      </div>

      <div className={cn("px-4", isPrimary ? "py-4" : "py-3")}>
        {(badges.length > 0 || headerRight) && (
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
        )}

        <div className="flex items-start gap-3">
          {/* 左の丸アイコン（チープな記号感を少し抑える） */}
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

          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold leading-snug text-neutral-900">{title}</h3>
            {address ? <p className="mt-1 truncate text-xs text-neutral-600">{address}</p> : null}

            <p
              className={cn(
                "mt-2 text-sm leading-relaxed text-neutral-800",
                clampDesc && "line-clamp-2 text-neutral-700",
              )}
            >
              {description}
            </p>

            {!isPrimary ? (
              <span className="mt-2 inline-flex items-center rounded-full bg-neutral-50 px-2 py-0.5 text-[10px] text-neutral-600 ring-1 ring-inset ring-neutral-200/60">
                候補
              </span>
            ) : null}

            {detailHref ? (
              <div className={cn("mt-4", !isPrimary && "mt-3")}>
                <Link
                  href={detailHref}
                  className={cn(
                    "inline-flex min-h-[44px] w-full items-center justify-center rounded-xl px-3 py-2",
                    "text-sm font-semibold",
                    "bg-neutral-900 text-white",
                    "ring-1 ring-inset ring-black/10",
                    "transition active:scale-[0.99]",
                    "hover:bg-neutral-800",
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
