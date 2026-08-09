import assert from "node:assert/strict";
import test from "node:test";
import { buildLeadTelegramMessage, sendLeadTelegramNotification } from "../platform/notifications.mjs";

const lead = {
  id: "audit-1",
  email: "buyer@example.com",
  company: "Example Media",
  sourceName: "traffic.json",
  sourceFingerprint: "abc",
  recordCount: 100,
  allowCount: 60,
  watchCount: 15,
  blockCount: 25,
  averageScore: 44,
  topFindings: [{ code: "DOMAIN_MISMATCH", title: "Domain mismatch", count: 12 }],
  createdAt: "2026-08-09T10:00:00.000Z",
};

test("builds a concise Telegram lead notification without raw traffic data", () => {
  const message = buildLeadTelegramMessage(lead, "https://3ve4.example");
  assert.match(message, /buyer@example\.com/);
  assert.match(message, /Review: 40\.0%/);
  assert.match(message, /Domain mismatch: 12/);
  assert.match(message, /https:\/\/3ve4\.example\/admin\/leads/);
  assert.doesNotMatch(message, /sourceFingerprint|raw/i);
});

test("sends Telegram notifications only when credentials are configured", async () => {
  assert.deepEqual(await sendLeadTelegramNotification({}, lead, async () => { throw new Error("must not fetch"); }), { sent: false, reason: "not_configured" });
  let request;
  const result = await sendLeadTelegramNotification(
    { TELEGRAM_BOT_TOKEN: "123:token", TELEGRAM_CHAT_ID: "456", PUBLIC_SITE_URL: "https://3ve4.example" },
    lead,
    async (url, init) => { request = { url, init }; return new Response(JSON.stringify({ ok: true }), { status: 200 }); },
  );
  assert.equal(result.sent, true);
  assert.equal(request.url, "https://api.telegram.org/bot123:token/sendMessage");
  const body = JSON.parse(request.init.body);
  assert.equal(body.chat_id, "456");
  assert.match(body.text, /New sample-audit lead/);
});
