// apps/web/src/app/shrines/from-place/[placeId]/place-from-place-client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Props = { placeId: string };

type PublicGoshuin = {
  id: number;
  shrine: number;
  shrine_name?: string | null;
  title?: string | null;
  is_public: boolean;
  likes: number;
  created_at: string;
  image_url?: string | null;
};

export default function PlaceFromPlaceClient({ placeId }: Props) {
  const [shrineId, setShrineId] = useState<number | null>(null);
  const [resolveState, setResolveState] = useState<"idle" | "loading" | "ok" | "unauth" | "error">("idle");

  const [publicGoshuins, setPublicGoshuins] = useState<PublicGoshuin[]>([]);
  const [loadingGoshuins, setLoadingGoshuins] = useState(false);

  // --- 外部導線（ログイン不要で出せる） ---
  const gmapsOpenLink = useMemo(() => {
    // “place_id:” クエリは比較的通りやすい（ダメでも Google検索に近い動き）
    const q = `place_id:${placeId}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }, [placeId]);

  const gmapsRouteLink = useMemo(() => {
    // destination_place_id が効く場合は強い（効かない環境でも検索にフォールバックしやすい）
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent("place_id:" + placeId)}&destination_place_id=${encodeURIComponent(
      placeId,
    )}`;
  }, [placeId]);

  const internalMapHref = useMemo(() => `/map?place_id=${encodeURIComponent(placeId)}`, [placeId]);

  // --- 1) place_id -> shrine_id（ログインしていれば解決） ---
  useEffect(() => {
    let alive = true;

    (async () => {
      setResolveState("loading");
      try {
        const r = await fetch("/api/shrines/from-place", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ place_id: placeId }),
        });

        if (!alive) return;

        if (r.status === 401 || r.status === 403) {
          setResolveState("unauth");
          setShrineId(null);
          return;
        }
        if (!r.ok) {
          setResolveState("error");
          setShrineId(null);
          return;
        }

        const data = (await r.json()) as { shrine_id: number };
        const sid = typeof data?.shrine_id === "number" ? data.shrine_id : Number(data?.shrine_id ?? NaN);
        if (!Number.isFinite(sid)) {
          setResolveState("error");
          setShrineId(null);
          return;
        }

        setShrineId(sid);
        setResolveState("ok");
      } catch {
        if (!alive) return;
        setResolveState("error");
        setShrineId(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [placeId]);

  // --- 2) shrine_id が取れたら public goshuins を引いて一致分だけ表示 ---
  useEffect(() => {
    if (!shrineId) return;

    let alive = true;

    const run = async () => {
      if (!alive) return;
      setLoadingGoshuins(true);

      try {
        const r = await fetch(`/api/public/goshuins?limit=50&offset=0`, {
          cache: "no-store",
        });
        if (!r.ok) throw new Error("public goshuins failed");

        const json = await r.json();
        const results = (Array.isArray(json) ? json : (json?.results ?? [])) as PublicGoshuin[];

        if (!alive) return;
        setPublicGoshuins(results);
      } catch {
        if (!alive) return;
        setPublicGoshuins([]);
      }

      // finally 相当をここに集約
      if (!alive) return;
      setLoadingGoshuins(false);
    };

    run();

    return () => {
      alive = false;
    };
  }, [shrineId]);

  const matched = useMemo(() => {
    if (!shrineId) return [];
    return publicGoshuins.filter((g) => g?.shrine === shrineId);
  }, [publicGoshuins, shrineId]);

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 px-4 py-5">
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <h1 className="text-base font-semibold">神社の詳細</h1>
        <p className="mt-1 text-xs text-slate-500">place_id: {placeId}</p>

        <div className="mt-3 flex flex-col gap-2">
          <a
            href={gmapsRouteLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Googleマップでルートを見る
          </a>

          <a
            href={gmapsOpenLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
          >
            Googleマップで開く
          </a>

          <Link
            href={internalMapHref}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
          >
            アプリ内マップで周辺を見る
          </Link>
        </div>

        <div className="mt-3 rounded-xl border bg-slate-50 p-3 text-xs text-slate-600">
          {resolveState === "loading" && "御朱印との紐づけ（shrine_id）を確認中…"}
          {resolveState === "ok" && shrineId != null && (
            <>
              shrine_id: <span className="font-semibold">{shrineId}</span>（ログイン中のため解決できました）
            </>
          )}
          {resolveState === "unauth" && (
            <>ログインしていないため shrine_id を解決できませんでした。御朱印の表示・追加はログイン後に利用できます。</>
          )}
          {resolveState === "error" && "shrine_id の解決に失敗しました（通信 or サーバー側）。"}
        </div>

        {shrineId != null && (
          <div className="mt-3">
            <Link
              href={`/mypage?tab=goshuin&shrine=${shrineId}#goshuin-upload`}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              この神社で御朱印を追加
            </Link>
          </div>
        )}
      </div>

      {/* --- 御朱印一覧（shrine_id がある時だけ） --- */}
      {shrineId != null && (
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">御朱印一覧</h2>

          {loadingGoshuins ? (
            <div className="mt-2 text-xs text-slate-500">読み込み中…</div>
          ) : matched.length === 0 ? (
            <div className="mt-2 text-xs text-slate-500">
              この神社に紐づく公開御朱印はまだありません。（正常：いまはテスト神社しか無い想定）
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {matched.map((g) => (
                <div key={g.id} className="rounded-xl border p-3">
                  <div className="text-xs text-slate-500">
                    #{g.id} / {g.created_at}
                  </div>
                  <div className="mt-1 text-sm font-semibold">{g.title?.trim() || "（タイトルなし）"}</div>

                  {!!g.image_url && (
                    // next/image に寄せてもいいが、既存警告があるので一旦素直に表示
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.image_url} alt={g.title ?? "goshuin"} className="mt-2 w-full rounded-lg border" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
