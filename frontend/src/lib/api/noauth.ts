const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";
export const NO_AUTH_PATTERNS: RegExp[] = [/^\/api\/token\/?$/, /^\/api\/token\/refresh\/?$/];
export function isNoAuth(url: string): boolean {
  try { return NO_AUTH_PATTERNS.some(re => re.test(new URL(url, API_BASE).pathname)); }
  catch { return false; }
}
