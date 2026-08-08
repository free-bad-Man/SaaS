export const DEFAULT_POLICY = Object.freeze({
  attributionWindowDays: 7,
  pauseIvtScore: 60,
  watchIvtScore: 30,
  pauseRoasBelow: 0.65,
  watchRoasBelow: 1,
  scaleRoasAtLeast: 1.5,
  minSpend: 10,
  scaleBidPercent: 15,
  executionMode: "shadow",
});

function finite(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export function normalizePolicy(input = {}) {
  const policy = {
    attributionWindowDays: finite(input.attributionWindowDays, DEFAULT_POLICY.attributionWindowDays, 1, 90),
    pauseIvtScore: finite(input.pauseIvtScore, DEFAULT_POLICY.pauseIvtScore, 1, 100),
    watchIvtScore: finite(input.watchIvtScore, DEFAULT_POLICY.watchIvtScore, 0, 99),
    pauseRoasBelow: finite(input.pauseRoasBelow, DEFAULT_POLICY.pauseRoasBelow, 0, 20),
    watchRoasBelow: finite(input.watchRoasBelow, DEFAULT_POLICY.watchRoasBelow, 0, 20),
    scaleRoasAtLeast: finite(input.scaleRoasAtLeast, DEFAULT_POLICY.scaleRoasAtLeast, 0.01, 50),
    minSpend: finite(input.minSpend, DEFAULT_POLICY.minSpend, 0, 1000000),
    scaleBidPercent: finite(input.scaleBidPercent, DEFAULT_POLICY.scaleBidPercent, 1, 100),
    executionMode: input.executionMode === "approval" ? "approval" : "shadow",
  };
  if (policy.watchIvtScore >= policy.pauseIvtScore) throw new Error("WATCH IVT threshold must be below PAUSE threshold.");
  if (policy.pauseRoasBelow > policy.watchRoasBelow) throw new Error("PAUSE ROAS threshold must not exceed WATCH threshold.");
  if (policy.scaleRoasAtLeast <= policy.watchRoasBelow) throw new Error("SCALE ROAS threshold must exceed WATCH threshold.");
  return policy;
}
