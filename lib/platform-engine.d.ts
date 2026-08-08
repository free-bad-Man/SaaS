export type Placement = {
  id: string;
  name: string;
  channel: string;
  connector: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  ivtScore: number;
  postbacks: number;
  duplicates: number;
};

export type AnalyzedPlacement = Placement & {
  roas: number;
  cpa: number;
  ctr: number;
  cvr: number;
  decision: "KEEP" | "WATCH" | "PAUSE" | "SCALE";
  reason: string;
};

export const SAMPLE_PLACEMENTS: Placement[];
export function analyzePlacements(placements: Placement[]): AnalyzedPlacement[];
export function summarizePlatform(placements: Placement[]): {
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  postbacks: number;
  duplicates: number;
  acceptedPostbacks: number;
  pause: number;
  watch: number;
  scale: number;
  atRiskSpend: number;
  roas: number;
  cpa: number;
  ctr: number;
  cvr: number;
};
export function money(value: number): string;
