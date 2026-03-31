// 目的地/出発地/手段から Google マップの経路URLを生成
export type TravelMode = "walk" | "car" | "bicycle" | "transit";

function toGoogleTravelMode(mode?: TravelMode) {
  if (mode === "walk") return "walking";
  if (mode === "car") return "driving";
  if (mode === "bicycle") return "bicycling";
  if (mode === "transit") return "transit";
  return null;
}

export function gmapsDirUrl(opts: {
  dest: { lat: number; lng: number };
  origin?: { lat: number; lng: number };
  mode?: TravelMode;
}) {
  const usp = new URLSearchParams({
    api: "1",
    destination: `${opts.dest.lat},${opts.dest.lng}`,
  });

  const travelmode = toGoogleTravelMode(opts.mode);
  if (travelmode) usp.set("travelmode", travelmode);

  if (opts.origin) usp.set("origin", `${opts.origin.lat},${opts.origin.lng}`);

  return `https://www.google.com/maps/dir/?${usp.toString()}`;
}
