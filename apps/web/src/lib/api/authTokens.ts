// apps/web/src/lib/api/authTokens.ts
export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function setCookie(name: string, value: string, path = "/") {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=${path}`;
}

type JwtPayload = { exp?: number };

export function readJwtExp(token: string): number | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as JwtPayload;
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

export function isExpiringSoon(token: string, skewSeconds = 60): boolean {
  const exp = readJwtExp(token);
  if (!exp) return false; // exp読めないなら「判断不能」なので事前refreshしない
  const now = Math.floor(Date.now() / 1000);
  return exp - now <= skewSeconds;
}
