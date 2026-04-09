export type ConciergeMode = "need" | "compat";

export type PendingAction =
  | { type: "none" }
  | { type: "save_concierge_thread"; returnTo: "/concierge" }
  | { type: "save_profile_from_concierge"; returnTo: "/concierge" }
  | { type: "open_billing"; returnTo: "/billing" }
  | { type: "toggle_favorite"; returnTo: `/shrines/${number}` };

export type ConciergeSessionState = {
  mode: ConciergeMode;
  sessionNickname: string | null;
  temporaryBirthdate: string | null;
  pendingAction: PendingAction;
};

export const initialConciergeSessionState: ConciergeSessionState = {
  mode: "need",
  sessionNickname: null,
  temporaryBirthdate: null,
  pendingAction: { type: "none" },
};
