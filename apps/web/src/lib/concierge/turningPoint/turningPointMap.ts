import type { TurningPointMeta, TurningPointType } from "@/lib/concierge/turningPoint/types";

export const TURNING_POINT_MAP: Record<TurningPointType, TurningPointMeta> = {
  stagnation: {
    type: "stagnation",
    label: "停滞を切り替える節目",
    shortLabel: "停滞",
  },
  decision: {
    type: "decision",
    label: "方向を定める節目",
    shortLabel: "決断",
  },
  challenge: {
    type: "challenge",
    label: "前に進む挑戦の節目",
    shortLabel: "挑戦",
  },
  recovery: {
    type: "recovery",
    label: "心身を整え直す節目",
    shortLabel: "回復",
  },
  reset: {
    type: "reset",
    label: "優先順位を整える節目",
    shortLabel: "整理",
  },
  transition: {
    type: "transition",
    label: "新しい流れへ移る節目",
    shortLabel: "転機",
  },
};
