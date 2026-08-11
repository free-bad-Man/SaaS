import type { Metadata } from "next";
import CustomerSecurity from "./CustomerSecurity";
import "../client-auth.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account Security — 3VE.4",
  description: "Secure your 3VE.4 customer workspace.",
  robots: { index: false, follow: false },
};

export default function CustomerSecurityPage() {
  return <CustomerSecurity />;
}
