// apps/web/src/features/mypage/components/ProfileSection.tsx
"use client";

import Image from "next/image";
import type { UserMe } from "@/lib/api/users";

type ProfileLike = Partial<{
  nickname: string;
  is_public: boolean;
  website: string;
  icon_url: string;
  birthday: string;
  location: string;
}>;

// ==== ヘルパー ====
function calcAge(birth: Date) {
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function formatDateJp(d: Date) {
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function isHttpUrl(url?: string | null) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// ==== 本体 ====
export default function ProfileSection({ user }: { user: UserMe }) {
  if (!user) return null;

  const p = (user.profile ?? {}) as ProfileLike;

  const nickname = p.nickname || user.username || "-";
  const isPublic = !!p.is_public;
  const email = user.email || "-";
  const iconUrl = p.icon_url || "";
  const birthdayDate = p.birthday && !Number.isNaN(new Date(p.birthday).getTime()) ? new Date(p.birthday) : null;
  const age = birthdayDate ? calcAge(birthdayDate) : null;

  return (
    <section className="p-6 space-y-5">
      {/* ヘッダー部（アイコン＋名前） */}
      <div className="flex items-center gap-4">
        {iconUrl ? (
          <Image
            src={iconUrl}
            alt={nickname}
            width={48}
            height={48}
            className="rounded-full object-cover ring-1 ring-gray-200"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-700 select-none">
            {nickname.slice(0, 1).toUpperCase()}
          </div>
        )}

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg font-semibold">{nickname}</h2>
            <span
              className={
                "px-2 py-0.5 text-xs rounded-full border " +
                (isPublic ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-600 border-gray-200")
              }
              title={isPublic ? "プロフィールは公開です" : "プロフィールは非公開です"}
            >
              {isPublic ? "公開" : "非公開"}
            </span>
          </div>
          <p className="text-sm text-gray-500 truncate">{email}</p>
        </div>
      </div>

      {/* 詳細情報（ここをテストが見ている） */}
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="text-gray-500 sm:col-span-1">ユーザー名</div>
        <div className="break-words sm:col-span-2">{user.username ?? "-"}</div>

        <div className="text-gray-500 sm:col-span-1">メール</div>
        <div className="break-words sm:col-span-2">{email}</div>

        <div className="text-gray-500 sm:col-span-1">生年月日</div>
        <div className="sm:col-span-2">
          {birthdayDate ? (
            <>
              {/* テストの /1990[/-]04[/-]10/ にマッチさせるため、日付そのものを素直に表示 */}
              {formatDateJp(birthdayDate)}
              {age !== null && <span className="ml-2 text-gray-500">（{age}歳）</span>}
            </>
          ) : (
            "-"
          )}
        </div>

        <div className="text-gray-500 sm:col-span-1">地域</div>
        <div className="sm:col-span-2">{p.location || "-"}</div>

        {p.website && isHttpUrl(p.website) && (
          <>
            <div className="text-gray-500 sm:col-span-1">Web</div>
            <div className="sm:col-span-2">
              {/* テキストを URL そのものにする → getByRole("link", { name: "https://example.com" }) に一致 */}
              <a
                className="break-all text-blue-600 hover:underline"
                href={p.website}
                target="_blank"
                rel="noopener noreferrer"
              >
                {p.website}
              </a>
            </div>
          </>
        )}
      </dl>
    </section>
  );
}
