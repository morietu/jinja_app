// apps/web/src/lib/locationBias.ts
export function buildLocationBias(
  lat?: number,
  lng?: number,
  radius = 1500
): string {
  if (typeof lat !== "number" || typeof lng !== "number") return "";
  return `circle:${radius}@${lat},${lng}`;
}
