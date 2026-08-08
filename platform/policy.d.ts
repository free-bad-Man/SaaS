export type DecisionPolicy = {
  attributionWindowDays: number;
  pauseIvtScore: number;
  watchIvtScore: number;
  pauseRoasBelow: number;
  watchRoasBelow: number;
  scaleRoasAtLeast: number;
  minSpend: number;
  scaleBidPercent: number;
  executionMode: "shadow" | "approval";
};
export const DEFAULT_POLICY: Readonly<DecisionPolicy>;
export function normalizePolicy(input?: Partial<DecisionPolicy>): DecisionPolicy;
