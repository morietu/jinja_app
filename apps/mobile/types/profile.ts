export type UserProfile = {
  birthday?: string;
  birthTime?: string;
  birthPlace?: string;
};

export type DerivedProfile = {
  kyusei?: string;
  gogyo?: string;
  lifePath?: string;
};

export type DirectionProfile = {
  luckyDirection?: string;
  luckyDirections?: string[];
  targetYear?: number;
  calculationMethod?: "annual_kyusei_v1";
  excludedDirections?: string[];
  source?: "placeholder" | "calculated";
};
