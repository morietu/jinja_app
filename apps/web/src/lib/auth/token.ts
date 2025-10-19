// apps/web/src/lib/auth/token.ts
export const ACCESS_KEY = "access_token";

export const authToken = {
  get access() {
    return typeof window === "undefined" ? null : localStorage.getItem(ACCESS_KEY);
  },
  set access(v: string | null) {
    if (typeof window === "undefined") return;
    v ? localStorage.setItem(ACCESS_KEY, v) : localStorage.removeItem(ACCESS_KEY);
  },
  clear() {
    this.access = null;
  },
};
