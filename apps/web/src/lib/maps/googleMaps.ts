// apps/web/src/lib/maps/googleMaps.ts

function enc(v: string) {
  return encodeURIComponent(v);
}

export function buildGoogleMapsSearchUrl(name: string, address?: string) {
  const q = address ? `${name} ${address}` : name;
  return `https://www.google.com/maps/search/?api=1&query=${enc(q)}`;
}

export function buildGoogleMapsDirUrl(dest: { lat?: number; lng?: number; address?: string; fallbackName?: string }) {
  if (typeof dest.lat === "number" && typeof dest.lng === "number") {
    return `https://www.google.com/maps/dir/?api=1&destination=${enc(`${dest.lat},${dest.lng}`)}`;
  }
  if (dest.address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${enc(dest.address)}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${enc(dest.fallbackName ?? "東京駅")}`;
}
