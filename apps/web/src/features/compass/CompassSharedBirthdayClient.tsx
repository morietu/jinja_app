"use client";

import CompassClient from "@/features/compass/CompassClient";
import { useSharedBirthdayPersistence } from "@/lib/profile/useSharedBirthdayPersistence";

export default function CompassSharedBirthdayClient() {
  const { savedBirthday, isLoggedIn, persistBirthday } = useSharedBirthdayPersistence();

  return (
    <CompassClient
      savedBirthday={savedBirthday}
      isLoggedIn={isLoggedIn}
      onPersistBirthday={persistBirthday}
    />
  );
}
