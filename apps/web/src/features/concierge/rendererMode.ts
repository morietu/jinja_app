// concierge/rendererMode.ts

export const CONCIERGE_RENDERER = process.env.NEXT_PUBLIC_CONCIERGE_RENDERER ?? "old";

export const SHOW_NEW_RENDERER = CONCIERGE_RENDERER === "new";
