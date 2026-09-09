export type AuthStatus = "unknown" | "authenticated" | "guest";

// Mirrors the live `GET /api/users/me/` response
// (backend/users/api/serializers.py::UserMeSerializer). Nickname and the
// birth profile fields live under `profile` only -- the serializer has no
// top-level `nickname` / `birthday`, and neither the BFF route
// (app/api/users/me/route.ts) nor AuthProvider.fetchMe() flattens them.
export type AuthUser = {
  id: number;
  email?: string | null;
  username?: string | null;
  profile?: {
    nickname?: string | null;
    is_public?: boolean | null;
    birthday?: string | null;
    birth_time?: string | null;
    birth_place?: string | null;
  } | null;
};

export type AuthState = {
  status: AuthStatus;
  user: AuthUser | null;
  isHydrating: boolean;
};
