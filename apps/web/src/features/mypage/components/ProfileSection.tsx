// apps/web/src/features/mypage/components/ProfileSection.tsx
"use client";

import Image from "next/image";
import Link from "next/link";

type Props = {
  user: any;
};

export default function ProfileSection({ user }: Props) {
  const profile = user?.profile ?? null;

  const nickname: string = profile?.nickname ?? user?.nickname ?? user?.username ?? "未設定";
  const email: string = user?.email ?? "未設定";

  const rawLocation: string | null = profile?.location ?? null;
  const bio: string = profile?.bio ?? "自己紹介はまだ設定されていません。";
  const isPublic: boolean = profile?.is_public ?? user?.is_public ?? false;

  const website: string | null = profile?.website ?? (user as any)?.website ?? null;
  const hasWebsite = typeof website === "string" && website.trim().length > 0 && /^https?:\/\//i.test(website.trim());

  const birthday: string | null = profile?.birthday ?? null;
  const birthdayText: string | null = (() => {
    if (!birthday) return null;
    const d = new Date(birthday);
    if (Number.isNaN(d.getTime())) return birthday;
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
      age--;
    }
    return `${birthday}（${age}歳）`;
  })();

  const username: string | undefined = user?.username;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
      {/* 左：アイコン＋バッジ＋リンク類 */}
      <div className="flex flex-col items-center gap-2 sm:w-40">
        <div className="relative h-20 w-20 overflow-hidden rounded-full bg-gray-100">
          <Image
            alt="プロフィールアイコン"
            src={user?.icon || "/images/default-avatar.png"}
            fill
            sizes="80px"
            className="object-cover"
          />
        </div>

        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
          {isPublic ? "公開" : "非公開"}
        </span>

        {/* 公開時だけ、公開プロフィールへのリンクを表示 */}
        {isPublic && username && (
          <Link href={`/users/${encodeURIComponent(username)}`} className="text-[11px] text-blue-600 underline">
            公開プロフィールを見る
          </Link>
        )}

        <Link href="/mypage/edit" className="text-[11px] text-blue-600 underline">
          プロフィールを編集する
        </Link>
      </div>

      {/* 右：プロフィール情報 */}
      <div className="flex-1 space-y-3 text-sm text-gray-700">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div>
            <div className="text-xs text-gray-400">ユーザー名</div>
            <div>{nickname}</div>
          </div>

          <div>
            <div className="text-xs text-gray-400">メール</div>
            <div>{email}</div>
          </div>

          <div>
            <div className="text-xs text-gray-400">地域</div>
            <div>{rawLocation || "-"}</div>
          </div>

          {hasWebsite && (
            <div>
              <div className="text-xs text-gray-400">Webサイト</div>
              <a href={website!} className="break-all text-xs text-blue-600 underline" target="_blank" rel="noreferrer">
                {website}
              </a>
            </div>
          )}

          <div>
            <div className="text-xs text-gray-400">生年月日</div>
            <div>{birthdayText ?? "-"}</div>
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-400">自己紹介</div>
          <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{bio}</p>
        </div>
      </div>
    </div>
  );
}
