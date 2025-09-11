// 目的地/出発地/手段から Google マップの経路URLを生成
export type TravelMode = "walk" | "car" | "bicycle" | "transit";

export function gmapsDirUrl(opts: {
  dest: { lat: number; lng: number };
  origin?: { lat: number; lng: number };
  mode?: TravelMode;
}) {
  const travelmode =
    opts.mode === "walk" ? "walking" :
    opts.mode === "car" ? "driving" :
    opts.mode === "bicycle" ? "bicycling" :
    opts.mode === "transit" ? "transit" : "walking";

  const usp = new URLSearchParams({
    api: "1",
    destination: `${opts.dest.lat},${opts.dest.lng}`,
    travelmode,
  });
  if (opts.origin) usp.set("origin", `${opts.origin.lat},${opts.origin.lng}`);
  return `https://www.google.com/maps/dir/?${usp.toString()}`;
}
