// apps/web/src/lib/shrine/tags/shrineMeaningOverrides.ts

import type { ShrineMeaningOverride } from "./types";

export const shrineMeaningOverrides: ShrineMeaningOverride[] = [
  {
    shrineId: 101, // 三峯神社
    symbols: ["dragon", "mountain"],
    psychological: ["stagnation_break", "resolve"],
    turningPoints: ["decision_point", "restart"],
    primarySymbol: "dragon",
    primaryPsychological: "stagnation_break",
    primaryTurningPoint: "decision_point",
    rankReasonHint: "停滞を断ち切って次の一歩を決める意味が強い",
    supplementaryNote: "流れを切り替えたい時の節目として重ねやすい",
  },
  {
    shrineId: 102, // 伊勢神宮（内宮）
    symbols: ["sun", "water"],
    psychological: ["grounding", "recovery"],
    turningPoints: ["life_milestone", "restart"],
    primarySymbol: "sun",
    primaryPsychological: "grounding",
    primaryTurningPoint: "life_milestone",
    rankReasonHint: "勢いよりも、原点に戻って整え直す意味が強い",
    supplementaryNote: "焦りを静めて巡りを整えたい時に向きやすい",
  },
  {
    shrineId: 4, // 出雲大社
    symbols: ["knot", "water"],
    psychological: ["relationship_reset", "grounding"],
    turningPoints: ["relationship_shift", "life_milestone"],
    primarySymbol: "knot",
    primaryPsychological: "relationship_reset",
    primaryTurningPoint: "relationship_shift",
    rankReasonHint: "縁や関係性を結び直す意味が他候補より強い",
    supplementaryNote: "関係の流れを整えたい時の象徴として扱いやすい",
  },
  {
    shrineId: 103, // 乃木神社
    symbols: ["mountain", "sun"],
    psychological: ["resolve", "grounding"],
    turningPoints: ["goal_commitment", "decision_point"],
    primarySymbol: "mountain",
    primaryPsychological: "resolve",
    primaryTurningPoint: "goal_commitment",
    rankReasonHint: "気持ちを引き締めて目標を定める意味が強い",
    supplementaryNote: "迷いを減らして集中を作りたい時に重ねやすい",
  },
];
