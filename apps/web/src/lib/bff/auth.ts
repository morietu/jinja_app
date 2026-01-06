// apps/web/src/lib/bff/auth.ts
import { cookies, headers } from "next/headers";

export type BffAuth = {
  authHeader?: string;
  access?: string;
  refresh?: string;
};

export async function readIncomingAuth() {
  const h = await headers();
  const c = await cookies();

  const authHeader = h.get("authorization") ?? undefined;
  const access = c.get("access_token")?.value;
  const refresh = c.get("refresh_token")?.value;

  const auth = authHeader ?? (access ? `Bearer ${access}` : undefined);

  return { authHeader, access, refresh, auth, cookieHeader: h.get("cookie") ?? "" };
}

export function buildBearer(auth: BffAuth): string | undefined {
  return auth.authHeader ?? (auth.access ? `Bearer ${auth.access}` : undefined);
}
