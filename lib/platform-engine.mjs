import { decidePlacement } from "../platform/policy.mjs";

export const SAMPLE_PLACEMENTS = [
  { id: "plc-101", name: "Display Alpha", channel: "Display", connector: "DV360", impressions: 320000, clicks: 6200, conversions: 248, spend: 1180, revenue: 2460, ivtScore: 14, postbacks: 260, duplicates: 12 },
  { id: "plc-204", name: "Video Stream 07", channel: "Video", connector: "Custom DSP", impressions: 210000, clicks: 2900, conversions: 72, spend: 930, revenue: 510, ivtScore: 67, postbacks: 78, duplicates: 6 },
  { id: "plc-311", name: "Native Feed", channel: "Native", connector: "Taboola", impressions: 180000, clicks: 5400, conversions: 189, spend: 740, revenue: 1450, ivtScore: 23, postbacks: 198, duplicates: 9 },
  { id: "plc-418", name: "Retargeting Core", channel: "Display", connector: "DV360", impressions: 120000, clicks: 3900, conversions: 152, spend: 680, revenue: 1120, ivtScore: 18, postbacks: 158, duplicates: 6 },
  { id: "plc-502", name: "Pop Traffic", channel: "Pop", connector: "Custom DSP", impressions: 410000, clicks: 8100, conversions: 45, spend: 1120, revenue: 290, ivtScore: 82, postbacks: 61, duplicates: 16 },
  { id: "plc-619", name: "Search Partner", channel: "Search", connector: "Google Ads", impressions: 95000, clicks: 2500, conversions: 81, spend: 520, revenue: 610, ivtScore: 34, postbacks: 85, duplicates: 4 },
];

function safeDivide(value, divisor) {
  return divisor > 0 ? value / divisor : 0;
}

export function analyzePlacements(placements, policy = {}) {
  return placements.map((placement) => {
    const roas = safeDivide(placement.revenue, placement.spend);
    const cpa = safeDivide(placement.spend, placement.conversions);
    const ctr = safeDivide(placement.clicks, placement.impressions) * 100;
    const cvr = safeDivide(placement.conversions, placement.clicks) * 100;

    const { decision, reason } = decidePlacement({ ivtScore: placement.ivtScore, spend: placement.spend, roas }, policy);

    return { ...placement, roas, cpa, ctr, cvr, decision, reason };
  });
}

export function summarizePlatform(placements, policy = {}) {
  const analyzed = analyzePlacements(placements, policy);
  const totals = analyzed.reduce((summary, placement) => {
    summary.impressions += placement.impressions;
    summary.clicks += placement.clicks;
    summary.conversions += placement.conversions;
    summary.spend += placement.spend;
    summary.revenue += placement.revenue;
    summary.postbacks += placement.postbacks;
    summary.duplicates += placement.duplicates;
    if (placement.decision === "PAUSE") summary.pause += 1;
    if (placement.decision === "WATCH") summary.watch += 1;
    if (placement.decision === "SCALE") summary.scale += 1;
    if (placement.decision === "PAUSE" || placement.decision === "WATCH") summary.atRiskSpend += placement.spend;
    return summary;
  }, { impressions: 0, clicks: 0, conversions: 0, spend: 0, revenue: 0, postbacks: 0, duplicates: 0, pause: 0, watch: 0, scale: 0, atRiskSpend: 0 });

  return {
    ...totals,
    acceptedPostbacks: totals.postbacks - totals.duplicates,
    roas: safeDivide(totals.revenue, totals.spend),
    cpa: safeDivide(totals.spend, totals.conversions),
    ctr: safeDivide(totals.clicks, totals.impressions) * 100,
    cvr: safeDivide(totals.conversions, totals.clicks) * 100,
  };
}

export function money(value, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}
