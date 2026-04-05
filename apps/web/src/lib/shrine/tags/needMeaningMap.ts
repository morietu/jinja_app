import type { NeedMeaningMap } from "./types";

export const needMeaningMap: NeedMeaningMap = {
  courage: {
    psychological: ["stagnation_break", "resolve"],
    symbols: ["dragon", "mountain"],
    turningPoints: ["decision_point", "restart"],
  },
  career: {
    psychological: ["resolve", "grounding"],
    symbols: ["mountain", "sun", "dragon"],
    turningPoints: ["goal_commitment", "decision_point", "restart"],
  },
  mental: {
    psychological: ["grounding", "recovery"],
    symbols: ["water", "sun"],
    turningPoints: ["life_milestone", "restart"],
  },
  recovery: {
    psychological: ["recovery", "grounding"],
    symbols: ["water", "sun"],
    turningPoints: ["restart"],
  },
  money: {
    psychological: ["stagnation_break", "grounding"],
    symbols: ["dragon", "water"],
    turningPoints: ["decision_point", "restart"],
  },
  love: {
    psychological: ["relationship_reset", "grounding"],
    symbols: ["knot", "water"],
    turningPoints: ["relationship_shift", "life_milestone"],
  },
  relationship: {
    psychological: ["relationship_reset", "grounding"],
    symbols: ["knot", "water"],
    turningPoints: ["relationship_shift"],
  },
  family: {
    psychological: ["relationship_reset", "grounding"],
    symbols: ["knot", "sun"],
    turningPoints: ["relationship_shift", "life_milestone"],
  },
  study: {
    psychological: ["resolve", "grounding"],
    symbols: ["mountain", "sun"],
    turningPoints: ["goal_commitment", "decision_point"],
  },
  life: {
    psychological: ["grounding", "recovery"],
    symbols: ["sun", "water"],
    turningPoints: ["life_milestone", "restart"],
  },
  health: {
    psychological: ["recovery", "grounding"],
    symbols: ["water", "sun"],
    turningPoints: ["restart"],
  },
};
