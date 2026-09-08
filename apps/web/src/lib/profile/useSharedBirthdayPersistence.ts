"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import { updateUser } from "@/lib/api/users";
import { useAuth } from "@/lib/auth/AuthProvider";
import { normalizeBirthdateInput } from "@/lib/date/normalizeBirthdateInput";
import { normalizeBirthday as normalizeProfileBirthday } from "@/lib/profile/derivedProfile";

/**
 * Concierge / Compass が共通利用する birthday の永続化境界。
 *
 * - Guest は session-only のため保存しない
 * - 有効な ISO birthday だけを保存する
 * - 保存済み値と同じ場合は PATCH しない
 * - 保存失敗は呼び出し元の Recommendation / Compass 結果を block しない
 * - raw birthday を log / analytics へ送らない
 */
export function useSharedBirthdayPersistence() {
  const { user, isLoggedIn, refreshMe } = useAuth();

  const savedBirthday = useMemo(
    () => normalizeProfileBirthday(user?.profile?.birthday),
    [user?.profile?.birthday],
  );

  const lastPersistedBirthdayRef = useRef<string | null>(savedBirthday);
  const inFlightBirthdayRef = useRef<string | null>(null);

  useEffect(() => {
    lastPersistedBirthdayRef.current = savedBirthday;
    if (inFlightBirthdayRef.current === savedBirthday) {
      inFlightBirthdayRef.current = null;
    }
  }, [savedBirthday]);

  const persistBirthday = useCallback(
    (candidate: string | null | undefined) => {
      if (!isLoggedIn) return;

      const normalized = normalizeBirthdateInput(candidate ?? "");
      if (!normalized) return;

      if (
        normalized === savedBirthday ||
        normalized === lastPersistedBirthdayRef.current ||
        normalized === inFlightBirthdayRef.current
      ) {
        return;
      }

      inFlightBirthdayRef.current = normalized;

      void updateUser({ birthday: normalized })
        .then((updated) => {
          lastPersistedBirthdayRef.current =
            normalizeProfileBirthday(updated.profile?.birthday) ?? normalized;
          if (inFlightBirthdayRef.current === normalized) {
            inFlightBirthdayRef.current = null;
          }
          return refreshMe();
        })
        .catch(() => {
          // Shared Context persistence is auxiliary. Never surface this as a
          // Recommendation / Compass failure; the current session value remains usable.
          if (inFlightBirthdayRef.current === normalized) {
            inFlightBirthdayRef.current = null;
          }
        });
    },
    [isLoggedIn, refreshMe, savedBirthday],
  );

  return {
    savedBirthday,
    isLoggedIn,
    persistBirthday,
  };
}
