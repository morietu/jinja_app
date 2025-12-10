// apps/web/src/app/users/[username]/page.tsx
import { notFound } from "next/navigation";
import { fetchPublicProfile } from "@/lib/api/publicProfile";
// import Image from "next/image"; // ちゃんとアイコンをやるならこれを使う手もあり

type Props = {
  params: {
    username: string;
  };
};

/* eslint-disable @next/next/no-img-element */

export default async function PublicProfilePage({ params }: Props) {
  const username = params.username;

  let profile: Awaited<ReturnType<typeof fetchPublicProfile>>;
  try {
    profile = await fetchPublicProfile(username);
  } catch {
    // 404 / 403 / その他 → ひとまず全部 404 扱いでOK
    notFound();
  }

  if (!profile.is_public) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <h1 className="text-xl font-bold">@{username}</h1>
        <p className="mt-3 text-sm text-gray-600">このプロフィールは非公開です。</p>
      </main>
    );
  }

  // ---- 表示用の値整形 ----
  const nickname: string = profile.nickname || profile.username || "未設定";
  const rawLocation: string | null = profile.location ?? null;
  const bio: string = profile.bio || "自己紹介はまだ設定されていません。";

  const website: string | null =
    typeof profile.website === "string" && profile.website.trim().length > 0 ? profile.website : null;

  const hasWebsite = typeof website === "string" && website.trim().length > 0 && /^https?:\/\//i.test(website.trim());

  const birthday: string | null = profile.birthday ?? null;
  const birthdayText: string | null = (() => {
    if (!birthday) return null;
    const d = new Date(birthday);
    if (Number.isNaN(d.getTime())) {
      return birthday;
    }
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
      age--;
    }
    return `${birthday}（${age}歳）`;
  })();

  return (
    <main className="mx-auto max-w-xl px-4 py-6 sm:px-6 sm:py-8">
      {/* ヘッダー：アイコン＋名前＋@username ＋ 公開バッジ */}
      <header className="flex items-center gap-4">
        {profile.icon_url ? (

          <img
            src={profile.icon_url}
            alt={`${nickname} のアイコン`}
            className="size-16 rounded-full border object-cover"
          />
        ) : (
          <div className="size-16 rounded-full bg-gray-200" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold truncate">{nickname}</h1>
            <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              公開プロフィール
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">@{profile.username}</p>
        </div>
      </header>

      {/* 詳細情報 */}
      <section className="space-y-4 text-sm text-gray-700">
        <div className="grid grid-cols-[100px,1fr] gap-y-2 gap-x-4">
          <div className="text-xs text-gray-400">地域</div>
          <div>{rawLocation || "-"}</div>

          {hasWebsite && (
            <>
              <div className="text-xs text-gray-400">Webサイト</div>
              <div>
                <a
                  href={website!}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-xs text-blue-600 underline"
                >
                  {website}
                </a>
              </div>
            </>
          )}

          <div className="text-xs text-gray-400">生年月日</div>
          <div>{birthdayText ?? "-"}</div>
        </div>

        <div>
          <div className="text-xs text-gray-400">自己紹介</div>
          <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{bio}</p>
        </div>
      </section>
    </main>
  );
}
