type ResolveDisplayNameInput = {
  sessionNickname?: string | null;
  profileNickname?: string | null;
};

function normalizeName(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function resolveDisplayName({ sessionNickname, profileNickname }: ResolveDisplayNameInput): string | null {
  return normalizeName(sessionNickname) ?? normalizeName(profileNickname) ?? null;
}

export function resolveDisplayLabel(input: ResolveDisplayNameInput): string {
  return resolveDisplayName(input) ?? "あなた";
}
