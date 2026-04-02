import type { NeedTag } from "@/lib/concierge/narrative/types";
import { TURNING_POINT_MAP } from "@/lib/concierge/turningPoint/turningPointMap";
import type { TurningPointMeta } from "@/lib/concierge/turningPoint/types";

type Args = {
  primaryNeed?: NeedTag | null;
  secondaryNeedTags?: NeedTag[];
};

export function resolveTurningPoint(args: Args): TurningPointMeta {
  const primary = args.primaryNeed ?? null;
  const secondary = args.secondaryNeedTags ?? [];

  if (primary === "mental" || primary === "rest") {
    return TURNING_POINT_MAP.recovery;
  }

  if (primary === "career" && secondary.includes("courage")) {
    return TURNING_POINT_MAP.decision;
  }

  if (primary === "career") {
    return TURNING_POINT_MAP.transition;
  }

  if (primary === "courage") {
    return TURNING_POINT_MAP.challenge;
  }

  if (primary === "money") {
    return secondary.includes("courage") ? TURNING_POINT_MAP.stagnation : TURNING_POINT_MAP.reset;
  }

  if (primary === "love") {
    return TURNING_POINT_MAP.reset;
  }

  if (primary === "study") {
    return TURNING_POINT_MAP.challenge;
  }

  return TURNING_POINT_MAP.reset;
}
