import { describe, expect, it } from "vitest";

import type { AuthUser } from "@/lib/auth/types";
import { resolveDisplayLabel, resolveDisplayName } from "@/lib/profile/resolveDisplayName";

// Contract guard for the live `GET /api/users/me/` response
// (backend/users/api/serializers.py::UserMeSerializer -> top-level
// id/username/email/first_name/last_name/profile). Nickname and the birth
// profile fields exist ONLY under `profile`; nothing between Django and
// AuthProvider.fetchMe() flattens them onto the top level, so `AuthUser`
// must not declare them there.

// Shaped exactly like a real /api/users/me/ payload: no top-level nickname,
// no top-level birthday.
const backendMeResponse: AuthUser = {
  id: 1,
  username: "tarou",
  email: "tarou@example.com",
  profile: {
    nickname: "太郎",
    is_public: true,
    birthday: "1984-05-15",
    birth_time: "05:25:00",
    birth_place: "東京都",
  },
};

describe("AuthUser contract", () => {
  it("accepts a live /api/users/me/ payload that has no top-level nickname or birthday", () => {
    expect(backendMeResponse.profile?.nickname).toBe("太郎");
    expect(backendMeResponse.profile?.birthday).toBe("1984-05-15");
    expect(backendMeResponse.profile?.birth_time).toBe("05:25:00");
    expect(backendMeResponse.profile?.birth_place).toBe("東京都");
    expect(backendMeResponse.profile?.is_public).toBe(true);
  });

  // worship_style は永続Profile schema / APIから退役済み（UserProfileSerializer・
  // UserProfileUpdateSerializerのいずれにも存在しない）。AuthUserへ再導入されると
  // ここが `pnpm typecheck` で落ちる。
  it("does not declare the retired worship_style on the profile", () => {
    // @ts-expect-error worship_style is retired from the live profile contract
    const worshipStyle = backendMeResponse.profile?.worship_style;

    expect(worshipStyle).toBeUndefined();
  });

  // These only bite under `pnpm typecheck` (vitest strips types without
  // checking them), which is where a reintroduced top-level field would be
  // caught -- reading `user.nickname` anywhere becomes a compile error again.
  it("does not declare nickname or birthday at the top level", () => {
    // @ts-expect-error top-level `nickname` is not part of the live contract
    const nickname = backendMeResponse.nickname;
    // @ts-expect-error top-level `birthday` is not part of the live contract
    const birthday = backendMeResponse.birthday;

    expect(nickname).toBeUndefined();
    expect(birthday).toBeUndefined();
  });
});

// Mirrors what ConciergeClientFull passes into resolveDisplayName /
// resolveDisplayLabel for the ConciergeEntryCard greeting. The precedence
// itself is resolveDisplayName's contract and is unchanged here -- what is
// pinned is which field of AuthUser supplies `profileNickname`.
function greetingInput(user: AuthUser | null, sessionNickname: string | null) {
  return {
    sessionNickname,
    profileNickname: user?.profile?.nickname ?? null,
  };
}

describe("Concierge greeting nickname source", () => {
  it("keeps sessionNickname ahead of the saved profile nickname", () => {
    const input = greetingInput(backendMeResponse, "エツコ");

    expect(resolveDisplayName(input)).toBe("エツコ");
    expect(resolveDisplayLabel(input)).toBe("エツコ");
  });

  it("falls back to the saved profile nickname when there is no sessionNickname", () => {
    const input = greetingInput(backendMeResponse, null);

    expect(resolveDisplayName(input)).toBe("太郎");
    expect(resolveDisplayLabel(input)).toBe("太郎");
  });

  it("keeps the existing fallback when neither nickname is present", () => {
    const noNickname: AuthUser = { ...backendMeResponse, profile: { nickname: null } };

    expect(resolveDisplayName(greetingInput(noNickname, null))).toBeNull();
    expect(resolveDisplayLabel(greetingInput(noNickname, null))).toBe("あなた");
    expect(resolveDisplayName(greetingInput(null, null))).toBeNull();
    expect(resolveDisplayLabel(greetingInput(null, null))).toBe("あなた");
  });
});
