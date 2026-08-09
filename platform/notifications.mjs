function configured(env) {
  return Boolean(env?.TELEGRAM_BOT_TOKEN?.trim() && env?.TELEGRAM_CHAT_ID?.trim());
}

export function telegramNotificationsConfigured(env) {
  return configured(env);
}

export function buildLeadTelegramMessage(lead, adminUrl = "") {
  const reviewCount = lead.watchCount + lead.blockCount;
  const reviewRate = lead.recordCount ? ((reviewCount / lead.recordCount) * 100).toFixed(1) : "0.0";
  const findings = lead.topFindings.slice(0, 3).map((item) => `• ${item.title}: ${item.count}`).join("\n") || "• No configured risk signals";
  return [
    "3VE.4 · New sample-audit lead",
    "",
    `Contact: ${lead.email}`,
    `Company: ${lead.company || "Not provided"}`,
    `Source: ${lead.sourceName}`,
    `Rows: ${lead.recordCount}`,
    `Review: ${reviewRate}% (${lead.watchCount} watch · ${lead.blockCount} block)`,
    `Average risk: ${lead.averageScore}`,
    "",
    "Top findings",
    findings,
    adminUrl ? `\nOpen lead inbox: ${adminUrl.replace(/\/$/, "")}/admin/leads` : "",
  ].filter(Boolean).join("\n");
}

export async function sendLeadTelegramNotification(env, lead, fetchImpl = fetch) {
  if (!configured(env)) return { sent: false, reason: "not_configured" };
  const token = env.TELEGRAM_BOT_TOKEN.trim();
  const chatId = env.TELEGRAM_CHAT_ID.trim();
  const response = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: buildLeadTelegramMessage(lead, env.PUBLIC_SITE_URL?.trim() ?? ""),
      disable_web_page_preview: true,
    }),
  });
  if (!response.ok) throw new Error(`Telegram notification failed with status ${response.status}.`);
  return { sent: true, reason: null };
}
