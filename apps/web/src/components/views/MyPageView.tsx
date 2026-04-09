// apps/web/src/components/views/MyPageView.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { updateUser, type UserMe } from "@/lib/api/users";
import { useAuth as useAuthContext } from "@/lib/auth/AuthProvider";
import type { Favorite } from "@/lib/api/favorites";
import MyPageScreen from "@/features/mypage/components/MyPageScreen";
import FavoritesSection from "@/features/mypage/components/FavoritesSection";
import Link from "next/link";

type Props = { initialFavorites: Favorite[] };

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`rounded px-3 py-2 text-sm ${active ? "bg-slate-900 text-white" : "bg-slate-100"}`}>
      {children}
    </Link>
  );
}

export default function MyPageView({ initialFavorites }: Props) {
  const sp = useSearchParams();
  const tab = sp.get("tab") ?? "profile";
  const { user: authUser, loading } = useAuthContext();

  const [user, setUser] = useState<UserMe | null>(null);
  const [form, setForm] = useState({ nickname: "", is_public: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authUser) {
      setUser(null);
      return;
    }

    const me = authUser as UserMe;
    setUser(me);
    setForm({
      nickname: (me.profile?.nickname ?? "").trim(),
      is_public: !!me.profile?.is_public,
    });
  }, [authUser]);

  useEffect(() => {
    if (tab !== "goshuin") return;
    const hash = window.location.hash;
    if (hash !== "#goshuin-upload") return;
    requestAnimationFrame(() => {
      document.querySelector(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [tab]);

  const dirty = useMemo(() => {
    if (!user) return false;
    const nick0 = (user.profile?.nickname ?? "").trim();
    const nick1 = (form.nickname ?? "").trim();
    return nick1 !== nick0 || Boolean(form.is_public) !== Boolean(user.profile?.is_public);
  }, [user, form.nickname, form.is_public]);

  const handleSave = async () => {
    if (!user || !dirty || saving) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      const nick0 = (user.profile?.nickname ?? "").trim();
      const nick1 = (form.nickname ?? "").trim();
      if (nick1 !== nick0) payload.nickname = nick1;
      if (Boolean(form.is_public) !== Boolean(user.profile?.is_public)) payload.is_public = form.is_public;

      const updated = await updateUser(payload);
      setUser(updated);
      setForm({
        nickname: (updated.profile?.nickname ?? "").trim(),
        is_public: !!updated.profile?.is_public,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!user) return;
    setForm({ nickname: user.profile?.nickname ?? "", is_public: !!user.profile?.is_public });
  };

  if (loading) {
    return (
      <div className="p-4 text-sm text-gray-500" role="status" aria-busy="true">
        読み込み中...
      </div>
    );
  }

  if (!user) {
    const next = tab === "goshuin" ? "/mypage?tab=goshuin" : "/mypage?tab=profile";
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="mb-4 text-xl font-bold">マイページ</h1>
        <div className="rounded-lg border bg-white p-6">
          <p className="mb-3">利用するにはログインしてください。</p>
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            ログインへ
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <TabLink href="/mypage?tab=profile" active={tab === "profile"}>
          プロフィール
        </TabLink>

        <TabLink href="/mypage?tab=goshuin" active={tab === "goshuin"}>
          御朱印
        </TabLink>

        <TabLink href="/mypage?tab=favorites" active={tab === "favorites"}>
          保存した神社
        </TabLink>
      </div>

      {tab === "goshuin" ? (
        <MyPageScreen />
      ) : tab === "favorites" ? (
        <FavoritesSection initialFavorites={initialFavorites} />
      ) : (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-1">ニックネーム</label>
            <input
              type="text"
              value={form.nickname}
              onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))}
              disabled={saving}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.is_public}
              onChange={(e) => setForm((f) => ({ ...f, is_public: e.target.checked }))}
              disabled={saving}
            />
            <span>プロフィールを公開</span>
          </label>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={!dirty || saving}
              className="px-4 py-2 rounded border"
            >
              変更を破棄
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
