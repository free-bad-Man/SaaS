const DAY = 24 * 60 * 60 * 1000;

export function attributePostbacks(events, postbacks, options = {}) {
  const windowMs = Number(options.windowMs ?? 7 * DAY);
  const clicksById = new Map();
  for (const event of events) {
    if (event.type !== "click" || !event.clickId) continue;
    const clicks = clicksById.get(event.clickId) ?? [];
    clicks.push(event);
    clicksById.set(event.clickId, clicks);
  }
  for (const clicks of clicksById.values()) clicks.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

  const attributed = [];
  const unattributed = [];
  for (const postback of postbacks) {
    const conversionTime = Date.parse(postback.timestamp);
    const click = (clicksById.get(postback.clickId) ?? []).find((candidate) => {
      const delta = conversionTime - Date.parse(candidate.timestamp);
      return delta >= 0 && delta <= windowMs && candidate.campaignId === postback.campaignId;
    });
    if (!click) {
      unattributed.push(postback);
      continue;
    }
    attributed.push({
      postbackId: postback.id,
      clickId: postback.clickId,
      campaignId: click.campaignId,
      placementId: click.placementId,
      sourceId: click.sourceId,
      clickEventId: click.id,
      clickTimestamp: click.timestamp,
      conversionTimestamp: postback.timestamp,
      revenue: postback.revenue,
      currency: postback.currency,
    });
  }
  return { attributed, unattributed, matchRate: postbacks.length ? attributed.length / postbacks.length : 0 };
}
