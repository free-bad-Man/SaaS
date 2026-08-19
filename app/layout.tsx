import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./cursor-theme.css";
import "./platform/platform.css";
import "./ambient-background.css";

const title = "Verdict — unified AdTech control plane";
const description = "Traffic ingestion, postbacks, IVT control, attribution, CPA/ROAS analytics, spend optimization, and DSP connectors in one explainable AdTech platform.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "en_US",
      images: [{ url: imageUrl, width: 1536, height: 1024, alt: "Verdict — one control plane for AdTech" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
