// apps/web/src/app/users/[username]/page.tsx
import { notFound } from "next/navigation";
import { fetchPublicProfile } from "@/lib/api/publicProfile";
// import Image from "next/image"; // ちゃんとアイコンをやるならこれを使う手もあり

type Props = {
  params: {
    username: string;
  };
};

export default async function PublicProfilePage({ params }: Props) {
  const username = params.username;

  let profile;
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

  return (
    <main className="mx-auto max-w-xl p-6 space-y-4">
      <header className="flex items-center gap-4">
        {profile.icon_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.icon_url}
            alt={`${profile.nickname} のアイコン`}
            className="size-16 rounded-full border object-cover"
          />
        ) : (
          <div className="size-16 rounded-full bg-gray-200" />
        )}

        <div>
          <h1 className="text-xl font-bold">{profile.nickname}</h1>
          <p className="text-sm text-gray-500">@{profile.username}</p>
        </div>
      </header>

      {/* TODO: Web / 地域 / 生年月日 / 自己紹介などをここに追加 */}
    </main>
  );
}
