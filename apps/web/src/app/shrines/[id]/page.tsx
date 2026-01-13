// apps/web/src/app/shrines/[id]/page.tsx
import Link from "next/link";
import { getShrine, type Shrine } from "@/lib/api/shrines";
import ShrinePhotoGallery from "@/components/shrine/ShrinePhotoGallery";
import { gmapsDirUrl } from "@/lib/maps";
import { ShrineDetailToast } from "@/components/shrine/ShrineDetailToast";
import ShrineSaveButton from "@/components/shrine/ShrineSaveButton";
import ShrineDetailShell from "@/components/shrine/ShrineDetailShell";
import { buildShrineClose } from "@/lib/navigation/shrineClose";

function getBenefitLabels(shrine: Shrine): string[] {
  if (Array.isArray(shrine.goriyaku_tags) && shrine.goriyaku_tags.length > 0) {
    return shrine.goriyaku_tags.map((t) => t?.name?.trim()).filter((name): name is string => Boolean(name));
  }
  if (typeof shrine.goriyaku === "string" && shrine.goriyaku.trim().length > 0) {
    return shrine.goriyaku
      .split(/[、,／/]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ ctx?: string; tid?: string }>;
};

export default async function Page({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const close = buildShrineClose({ ctx: (sp.ctx ?? null) as any, tid: sp.tid ?? null }); // ctx型を厳密にするなら normalizeCtx を噛ませてOK

  const numericId = Number(id);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    return (
      <main className="mx-auto max-w-md space-y-6 p-4">
        <div className="rounded-xl border bg-white p-4 text-center text-sm">不正な神社IDです。</div>
        <Link href="/map" className="inline-flex items-center text-sm text-emerald-700 hover:underline">
          ← 地図に戻る
        </Link>
      </main>
    );
  }

  const addGoshuinHref = `/mypage?tab=goshuin&shrine=${numericId}#goshuin-upload`;

  let shrine: Shrine | null = null;
  try {
    shrine = await getShrine(numericId);
  } catch {
    shrine = null;
  }

  if (!shrine) {
    return (
      <ShrineDetailShell
        title="神社の詳細"
        subtitle={null}
        close={close}
        addGoshuinHref={null}
        saveAction={null}
        googleDirHref={null}
        googleDirFallbackText="神社情報が見つからなかったため、経路案内を表示できません。"
      >
        <div className="rounded-2xl border bg-white p-4 text-sm text-slate-700">
          神社の詳細情報が見つかりませんでした。
        </div>
      </ShrineDetailShell>
    );
  }

  // ✅ ここで non-null に確定（TSが理解できる形にする）
  const s = shrine;

  const latNum = Number(s.lat ?? s.latitude ?? NaN);
  const lngNum = Number(s.lng ?? s.longitude ?? NaN);
  const hasLocation =
    Number.isFinite(latNum) &&
    Number.isFinite(lngNum) &&
    latNum >= -90 &&
    latNum <= 90 &&
    lngNum >= -180 &&
    lngNum <= 180;

  const googleDirHref = hasLocation ? gmapsDirUrl({ dest: { lat: latNum, lng: lngNum }, mode: "walk" }) : null;
  const benefitLabels = getBenefitLabels(s);

  return (
    <>
      <ShrineDetailToast shrineId={numericId} />

      <ShrineDetailShell
        title={s.name_jp}
        subtitle={null}
        close={close}
        addGoshuinHref={addGoshuinHref}
        saveAction={{
          shrineId: numericId,
          nextPath: `/shrines/${numericId}`,
          node: <ShrineSaveButton shrineId={numericId} nextPath={`/shrines/${numericId}`} />,
        }}
        googleDirHref={googleDirHref}
        googleDirLabel="Googleマップで経路案内"
      >
        <article className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <ShrinePhotoGallery shrine={s} />

          <div className="space-y-4 p-4">
            <section>
              <h2 className="text-xs font-semibold text-gray-500">住所</h2>
              <p className="text-sm">{s.address}</p>
            </section>

            <section className="space-y-1 text-sm">
              <h2 className="text-xs font-semibold text-gray-500">ご利益</h2>
              {benefitLabels.length === 0 ? (
                <p className="text-xs text-gray-400">ご利益情報は準備中です。</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {benefitLabels.map((label) => (
                    <span
                      key={label}
                      className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </section>
          </div>
        </article>
      </ShrineDetailShell>
    </>
  );
}
