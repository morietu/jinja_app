type Place = {
  place_id: string;
  name: string;
  address?: string | null;
  rating?: number | null;
  user_ratings_total?: number | null;
  icon?: string | null;
};

export default function PlaceCard({ p }: { p: Place }) {
  const gm = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    p.name
  )}&query_place_id=${encodeURIComponent(p.place_id)}`;

  return (
    <div className="border rounded p-3 flex gap-3 items-start">
      {p.icon ? (
        <img src={p.icon} alt="" width={24} height={24} className="mt-1" />
      ) : (
        <div className="w-6 h-6 mt-1 rounded bg-gray-200" />
      )}
      <div className="flex-1">
        <div className="font-semibold">{p.name}</div>
        <div className="text-sm text-gray-600">{p.address ?? "-"}</div>
        <div className="text-xs text-gray-500 mt-1">
          {p.rating ? `★ ${p.rating.toFixed(1)}` : "評価なし"}
          {typeof p.user_ratings_total === "number" ? `（${p.user_ratings_total}件）` : ""}
        </div>
        <div className="mt-2">
          <a href={gm} target="_blank" rel="noreferrer" className="text-blue-600 underline text-sm">
            Googleマップで見る
          </a>
        </div>
      </div>
    </div>
  );
}
