import { ingestEvents } from "./ingestion.mjs";
import { processPostbacks } from "./postbacks.mjs";
import { attributePostbacks } from "./attribution.mjs";
import { scoreTraffic } from "./ivt.mjs";
import { optimizeSpend } from "./optimizer.mjs";
import { buildActionQueue } from "./connectors.mjs";
import { normalizePolicy } from "./policy.mjs";

export function runPlatformPipeline(input) {
  const policy = normalizePolicy(input?.policy);
  const ingestion = ingestEvents(input?.events ?? []);
  const postbackHub = processPostbacks(input?.postbacks ?? []);
  const attribution = attributePostbacks(ingestion.events, postbackHub.postbacks, { ...input?.attribution, windowMs: policy.attributionWindowDays * 24 * 60 * 60 * 1000 });
  const ivt = scoreTraffic(ingestion.events);
  const decisions = optimizeSpend(ingestion.events, attribution.attributed, ivt.placements, policy);
  const actionQueue = buildActionQueue(decisions, input?.connector ?? "openrtb", policy);

  const spend = decisions.reduce((total, item) => total + item.spend, 0);
  const revenue = decisions.reduce((total, item) => total + item.revenue, 0);
  return {
    version: "3ve4.pipeline.v1",
    generatedAt: new Date().toISOString(),
    policy,
    modules: {
      ingestion: { accepted: ingestion.accepted, rejected: ingestion.rejected.length, duplicates: ingestion.duplicates.length },
      postbacks: { accepted: postbackHub.accepted, rejected: postbackHub.rejected.length, duplicates: postbackHub.duplicates.length },
      attribution: { attributed: attribution.attributed.length, unattributed: attribution.unattributed.length, matchRate: attribution.matchRate },
      ivt: { scored: ivt.events.length, riskyPlacements: ivt.placements.filter((item) => item.maxScore >= 30).length },
      optimizer: { decisions: decisions.length, actionable: actionQueue.actions.length },
      connector: { id: actionQueue.connector.id, mode: actionQueue.mode },
    },
    summary: { spend, revenue, roas: spend > 0 ? revenue / spend : 0, conversions: attribution.attributed.length },
    decisions,
    actions: actionQueue.actions,
    diagnostics: { rejectedEvents: ingestion.rejected, duplicateEvents: ingestion.duplicates, rejectedPostbacks: postbackHub.rejected, duplicatePostbacks: postbackHub.duplicates, unattributedPostbacks: attribution.unattributed },
  };
}
