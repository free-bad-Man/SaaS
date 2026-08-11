import type { Metadata } from "next";
import CustomerLoginForm from "./CustomerLoginForm";
import "../account/client-auth.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Customer Sign In — 3VE.4",
  description: "Secure customer access to the 3VE.4 AdTech control plane.",
  robots: { index: false, follow: false },
};

export default function CustomerLoginPage() {
  return <CustomerLoginForm />;
}
