export type TurningPointType =
  | "stagnation" // 停滞
  | "decision" // 決断
  | "challenge" // 挑戦
  | "recovery" // 回復
  | "reset" // 整理
  | "transition"; // 転機

export type TurningPointMeta = {
  type: TurningPointType;
  label: string;
  shortLabel: string;
};
