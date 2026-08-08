const cleanTraffic = {
  site_domain: "publisher.example",
  page_domain: "publisher.example",
  schain_nodes: 2,
  seller_id: "seller-101",
  user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  device_os: "Windows",
  requests_per_minute: 40,
  duplicate_rate: 0.01,
  ip_country: "US",
  declared_country: "US",
  connection_type: "residential",
};

const riskyTraffic = {
  site_domain: "declared.example",
  page_domain: "spoofed.example",
  schain_nodes: 0,
  seller_id: "",
  user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  device_os: "Windows",
  requests_per_minute: 180,
  duplicate_rate: 0.2,
  ip_country: "NL",
  declared_country: "US",
  connection_type: "datacenter",
};

export const PLATFORM_PAYLOAD = {
  connector: "openrtb",
  events: [
    { id: "evt-safe-imp", type: "impression", timestamp: "2026-08-08T10:00:00Z", campaign_id: "cmp-1", placement_id: "plc-safe", source_id: "src-a", cost: 20, ...cleanTraffic },
    { id: "evt-safe-click", type: "click", timestamp: "2026-08-08T10:01:00Z", campaign_id: "cmp-1", placement_id: "plc-safe", source_id: "src-a", click_id: "clk-safe", cost: 20, ...cleanTraffic },
    { id: "evt-risk-imp", type: "impression", timestamp: "2026-08-08T10:02:00Z", campaign_id: "cmp-1", placement_id: "plc-risk", source_id: "src-b", cost: 30, ...riskyTraffic },
    { id: "evt-risk-click", type: "click", timestamp: "2026-08-08T10:03:00Z", campaign_id: "cmp-1", placement_id: "plc-risk", source_id: "src-b", click_id: "clk-risk", cost: 30, ...riskyTraffic },
    { id: "evt-risk-click", type: "click", timestamp: "2026-08-08T10:03:00Z", campaign_id: "cmp-1", placement_id: "plc-risk", source_id: "src-b", click_id: "clk-risk", cost: 30, ...riskyTraffic },
    { id: "broken", type: "unknown" },
  ],
  postbacks: [
    { id: "pb-safe", click_id: "clk-safe", campaign_id: "cmp-1", timestamp: "2026-08-08T11:00:00Z", revenue: 100, currency: "USD" },
    { id: "pb-risk", click_id: "clk-risk", campaign_id: "cmp-1", timestamp: "2026-08-08T11:10:00Z", revenue: 10, currency: "USD" },
    { id: "pb-risk", click_id: "clk-risk", campaign_id: "cmp-1", timestamp: "2026-08-08T11:10:00Z", revenue: 10, currency: "USD" },
  ],
};
