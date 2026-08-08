export const CONNECTORS = [
  { id: "dv360", name: "DV360", capabilities: ["reporting", "budget", "placement_status"] },
  { id: "google_ads", name: "Google Ads", capabilities: ["reporting", "conversions", "campaign_status"] },
  { id: "taboola", name: "Taboola", capabilities: ["reporting", "bid", "campaign_status"] },
  { id: "openrtb", name: "Custom OpenRTB DSP", capabilities: ["logs", "reporting", "decision_export"] },
];

export function buildActionQueue(decisions, connectorId = "openrtb", policy = {}) {
  const connector = CONNECTORS.find((item) => item.id === connectorId);
  if (!connector) throw new Error(`Unsupported connector: ${connectorId}.`);
  const actions = decisions.filter((decision) => decision.decision !== "KEEP").map((decision) => ({
    id: `${connector.id}:${decision.campaignId}:${decision.placementId}:${decision.decision.toLowerCase()}`,
    connector: connector.id,
    campaignId: decision.campaignId,
    placementId: decision.placementId,
    action: decision.decision === "PAUSE" ? "pause_placement" : decision.decision === "SCALE" ? "increase_bid" : "review_placement",
    value: decision.decision === "SCALE" ? Number(policy.scaleBidPercent ?? 15) / 100 : null,
    mode: policy.executionMode === "approval" ? "approval" : "shadow",
    reason: decision.reason,
    evidence: { roas: decision.roas, ivtScore: decision.ivtScore, spend: decision.spend, revenue: decision.revenue },
  }));
  return { connector, mode: policy.executionMode === "approval" ? "approval" : "shadow", actions };
}
