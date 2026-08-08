const traffic = {
  site_domain: "publisher.example", page_domain: "publisher.example", schain_nodes: 2, seller_id: "seller-demo",
  user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", device_os: "Windows", requests_per_minute: 36,
  duplicate_rate: 0.01, ip_country: "US", declared_country: "US", connection_type: "residential",
};
const risky = { ...traffic, site_domain: "declared.example", page_domain: "spoofed.example", schain_nodes: 0, seller_id: "", requests_per_minute: 180, duplicate_rate: 0.2, connection_type: "datacenter" };

export const PUBLIC_DEMO_PAYLOAD = Object.freeze({
  connector: "openrtb",
  events: [
    { id: "demo-safe-imp", type: "impression", timestamp: "2026-08-08T10:00:00Z", campaign_id: "cmp-demo", placement_id: "plc-safe", source_id: "src-a", cost: 20, ...traffic },
    { id: "demo-safe-click", type: "click", timestamp: "2026-08-08T10:01:00Z", campaign_id: "cmp-demo", placement_id: "plc-safe", source_id: "src-a", click_id: "clk-safe", cost: 20, ...traffic },
    { id: "demo-risk-imp", type: "impression", timestamp: "2026-08-08T10:02:00Z", campaign_id: "cmp-demo", placement_id: "plc-risk", source_id: "src-b", cost: 30, ...risky },
    { id: "demo-risk-click", type: "click", timestamp: "2026-08-08T10:03:00Z", campaign_id: "cmp-demo", placement_id: "plc-risk", source_id: "src-b", click_id: "clk-risk", cost: 30, ...risky },
  ],
  postbacks: [
    { id: "demo-pb-safe", click_id: "clk-safe", campaign_id: "cmp-demo", timestamp: "2026-08-08T11:00:00Z", revenue: 100, currency: "USD" },
    { id: "demo-pb-risk", click_id: "clk-risk", campaign_id: "cmp-demo", timestamp: "2026-08-08T11:10:00Z", revenue: 10, currency: "USD" },
  ],
});
