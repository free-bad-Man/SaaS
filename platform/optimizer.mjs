import { assertSingleCurrency } from "./currency.mjs";
import { decidePlacement, normalizePolicy } from "./policy.mjs";

export function optimizeSpend(events, attributions, ivtPlacements, policyInput = {}) {
  const policy = normalizePolicy(policyInput);
  const currency = assertSingleCurrency(events, attributions);
  const risk = new Map(ivtPlacements.map((item) => [item.placementId, item]));
  const groups = new Map();
  for (const event of events) {
    const group = groups.get(event.placementId) ?? { placementId: event.placementId, campaignId: event.campaignId, sourceId: event.sourceId, currency, impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 };
    group.impressions += event.type === "impression" ? 1 : 0;
    group.clicks += event.type === "click" ? 1 : 0;
    group.spend += event.cost;
    groups.set(event.placementId, group);
  }
  for (const attribution of attributions) {
    const group = groups.get(attribution.placementId);
    if (!group) continue;
    group.conversions += 1;
    group.revenue += attribution.revenue;
  }

  return [...groups.values()].map((group) => {
    const ivt = risk.get(group.placementId) ?? { maxScore: 0, averageScore: 0, reasonCodes: [] };
    const roas = group.spend > 0 ? group.revenue / group.spend : 0;
    const cpa = group.conversions > 0 ? group.spend / group.conversions : null;
    const { decision, reason } = decidePlacement({ ivtScore: ivt.maxScore, spend: group.spend, roas }, policy);
    return { ...group, roas, cpa, ivtScore: ivt.maxScore, ivtReasons: ivt.reasonCodes, decision, reason };
  });
}
