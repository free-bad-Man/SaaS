import type { Metadata } from "next";
import PlatformConsole from "./PlatformConsole";

export const metadata: Metadata = {
  title: "3VE.4 Platform Console — unified AdTech operations demo",
  description: "A working synthetic demo of traffic ingestion, postbacks, attribution, IVT control, CPA/ROAS analytics, optimization, and DSP connectors.",
};

export default function PlatformPage() {
  return <PlatformConsole />;
}
