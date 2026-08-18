import type { Metadata } from "next";
import LeadInbox from "./LeadInbox";
import "./admin.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lead Inbox — Verdict",
  description: "Private sample-audit lead inbox.",
  robots: { index: false, follow: false },
};

export default function LeadInboxPage() {
  return <LeadInbox />;
}
