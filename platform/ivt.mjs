import { analyzeRecord } from "../lib/audit-engine.mjs";

export function scoreTraffic(events) {
  const scored = events.map((event, index) => ({ eventId: event.id, placementId: event.placementId, ...analyzeRecord({ id: event.id, ...event.traffic }, index) }));
  const byPlacement = new Map();
  for (const result of scored) {
    const current = byPlacement.get(result.placementId) ?? { placementId: result.placementId, requests: 0, blocked: 0, maxScore: 0, totalScore: 0, reasonCodes: new Set() };
    current.requests += 1;
    current.blocked += result.decision === "BLOCK" ? 1 : 0;
    current.maxScore = Math.max(current.maxScore, result.score);
    current.totalScore += result.score;
    result.reasons.forEach((reason) => current.reasonCodes.add(reason.code));
    byPlacement.set(result.placementId, current);
  }
  return {
    events: scored,
    placements: [...byPlacement.values()].map((item) => ({ ...item, averageScore: Math.round(item.totalScore / item.requests), reasonCodes: [...item.reasonCodes] })),
  };
}
