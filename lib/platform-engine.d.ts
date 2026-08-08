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
  currency?: string;
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
export function analyzePlacements(placements: Placement[], policy?: Record<string, unknown>): AnalyzedPlacement[];
export function summarizePlatform(placements: Placement[], policy?: Record<string, unknown>): {
  currency?: string;
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
export function money(value: number, currency?: string): string;
