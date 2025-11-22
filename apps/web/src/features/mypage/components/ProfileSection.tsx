// apps/web/src/features/mypage/components/ProfileSection.tsx
"use client";

import Link from "next/link";
import type { UserMe } from "@/lib/api/users";

type ProfileLike = Partial<{
  nickname: string;
  bio: string;
}>;

type Props = {
  user: UserMe;
};

export default function ProfileSection({ user }: Props) {
  if (!user) return null;

  const p = (user.profile ?? {}) as ProfileLike;

  // 表示名と一言
  const displayName = p.nickname || user.username || "ゲスト";
  const bio = p.bio || "プロフィール未設定です。";

  const initial = displayName.charAt(0).toUpperCase() || "G";

  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-700">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{displayName}</p>
          <p className="mt-1 text-xs text-gray-500 line-clamp-2">{bio}</p>
        </div>
        <Link href="/mypage/edit" className="rounded-full border px-3 py-1 text-xs text-gray-700">
          編集
        </Link>
      </div>
    </section>
  );
}
