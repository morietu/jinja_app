export type AppAction =
  | "concierge_consult"
  | "start_compat_mode"
  | "save_concierge_thread"
  | "save_profile"
  | "open_mypage"
  | "open_billing"
  | "toggle_favorite";

export function isAuthRequiredForAction(action: AppAction): boolean {
  switch (action) {
    case "concierge_consult":
    case "start_compat_mode":
      return false;

    case "save_concierge_thread":
    case "save_profile":
    case "open_mypage":
    case "open_billing":
    case "toggle_favorite":
      return true;

    default: {
      const exhaustiveCheck: never = action;
      return exhaustiveCheck;
    }
  }
}
