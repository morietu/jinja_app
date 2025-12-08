// apps/web/src/features/mypage/components/ProfileSection.tsx
import React from "react";
import Image from "next/image";
import { UserIcon } from "@heroicons/react/24/solid";

function initialsFrom(user: any) {
  return user?.profile?.nickname?.trim()?.[0] || user?.username?.trim()?.[0] || null;
}

type Profile = {
  nickname?: string | null;
  is_public?: boolean;
  bio?: string | null;
  website?: string | null;
  birthday?: string | null; // "YYYY-MM-DD"
  location?: string | null;
};

type User = {
  id: number;
  username: string;
  email?: string | null;
  nickname?: string | null;
  is_public?: boolean;
  icon?: string | null;
  profile?: Profile | null;
};

type Props = {
  user: User;
};

function calcAge(birthdayStr?: string | null): number | null {
  if (!birthdayStr) return null;
  const d = new Date(birthdayStr);
  if (Number.isNaN(d.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
    age -= 1;
  }
  return age;
}

export default function ProfileSection({ user }: Props) {
  const profile = user.profile ?? {};
  const nickname = profile.nickname || user.nickname || user.username;
  const isPublic = profile.is_public ?? user.is_public ?? false;
  const website = profile.website;
  const birthday = profile.birthday;
  const age = calcAge(birthday);
  const location = profile.location;
  const bio = profile.bio;

  // const initialSource = nickname || user.username || "?";
  const iconUrl = user.icon ?? null;
  const initial = initialsFrom(user);

  return (
    <div className="space-y-6 text-sm text-gray-700">
      {/* ヘッダー：アイコン＋基本情報 */}
      <div className="flex items-center gap-4">
        {/* アイコン */}
        <div className="flex size-14 items-center justify-center rounded-full bg-orange-50 text-lg font-semibold text-orange-500">
          {iconUrl ? (
            <Image
              src={iconUrl}
              alt={nickname || user.username || "ユーザーアイコン"}
              width={56}
              height={56}
              className="h-14 w-14 rounded-full object-cover"
            />
          ) : initial ? (
            <span className="text-xl font-semibold">{initial}</span>
          ) : (
            <UserIcon className="h-8 w-8 text-gray-500" />
          )}
        </div>

        {/* 名前＋公開状態 */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <p className="text-base font-semibold text-gray-900">{nickname || "-"}</p>
            <span
              className={
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] " +
                (isPublic
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-gray-200 bg-gray-50 text-gray-500")
              }
            >
              {isPublic ? "公開" : "非公開"}
            </span>
          </div>
          <p className="text-xs text-gray-500">@{user.username}</p>
        </div>
      </div>

      {/* 詳細情報：2カラムの情報ブロック */}
      <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-gray-400">ユーザー名</dt>
          <dd className="text-sm text-gray-800">{user.username || "-"}</dd>
        </div>

        <div>
          <dt className="text-xs text-gray-400">メール</dt>
          <dd className="text-sm text-gray-800">{user.email || "-"}</dd>
        </div>

        <div>
          <dt className="text-xs text-gray-400">生年月日</dt>
          <dd className="text-sm text-gray-800">{birthday || "-"}</dd>
        </div>

        <div>
          <dt className="text-xs text-gray-400">年齢</dt>
          <dd className="text-sm text-gray-800">{age != null ? `${age}歳` : "-"}</dd>
        </div>

        <div>
          <dt className="text-xs text-gray-400">地域</dt>
          <dd className="text-sm text-gray-800">{location || "-"}</dd>
        </div>

        {website && (
          <div>
            <dt className="text-xs text-gray-400">Web</dt>
            <dd className="text-sm">
              <a
                href={website}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
              >
                {website}
              </a>
            </dd>
          </div>
        )}
      </dl>

      {/* 自己紹介 */}
      <div>
        <h3 className="mb-1 text-xs font-semibold text-gray-500">自己紹介</h3>
        <p className="whitespace-pre-wrap rounded-md bg-orange-50/40 px-3 py-2 text-sm text-gray-700">
          {bio && bio.trim().length > 0 ? bio : "自己紹介はまだ設定されていません。"}
        </p>
      </div>
    </div>
  );
}
