import type { Metadata } from "next";
import CustomerLoginForm from "./CustomerLoginForm";
import "../account/client-auth.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Customer Sign In — Verdict",
  description: "Secure customer access to the Verdict AdTech control plane.",
  robots: { index: false, follow: false },
};

export default function CustomerLoginPage() {
  return <CustomerLoginForm />;
}
