// apps/web/src/features/mypage/components/GoshuinDetailModal.tsx
"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Image from "next/image";
import type { Goshuin } from "@/lib/api/goshuin";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goshuin: Goshuin | null;
};

export default function GoshuinDetailModal({ open, onOpenChange, goshuin }: Props) {
  if (!goshuin) return null;

  const title = goshuin.shrine_name ?? "御朱印";
  const dateLabel = goshuin.created_at != null ? new Date(goshuin.created_at).toLocaleDateString("ja-JP") : null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content
          className="
            fixed inset-0 z-50 flex items-center justify-center
            p-4
          "
        >
          <div
            className="
              relative w-full max-w-md rounded-2xl bg-white p-4
              shadow-lg
            "
          >
            <Dialog.Close
              className="
                absolute right-2 top-2 rounded-full bg-white/80 px-2
                text-xs text-gray-600 shadow hover:bg-gray-100
              "
            >
              ×
            </Dialog.Close>

            <Dialog.Title className="mb-2 text-sm font-semibold">{title}</Dialog.Title>

            {dateLabel && <p className="mb-3 text-xs text-gray-500">登録日: {dateLabel}</p>}

            <div className="relative mb-3 aspect-[3/4] overflow-hidden rounded-lg bg-gray-50">
              {goshuin.image_url ? (
                <Image
                  src={goshuin.image_url}
                  alt={title}
                  fill
                  sizes="(max-width: 640px) 90vw, 400px"
                  className="object-contain"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">画像なし</div>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
