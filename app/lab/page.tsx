import type { Metadata } from "next";
import AuditLab from "./AuditLab";
import "./lab.css";

export const metadata: Metadata = {
  title: "IVT Guard Lab — live traffic audit demo",
  description: "Local analysis of a synthetic OpenRTB log with transparent IVT Guard rules.",
};

export default function LabPage() {
  return <AuditLab />;
}
