import type { Metadata } from "next";
import RunDetail from "./RunDetail";

export const metadata: Metadata = {
  title: "Pipeline run — Verdict Platform",
  description: "Detailed Verdict processing result, diagnostics, decisions, and shadow actions.",
};

export default async function PipelineRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RunDetail runId={id} />;
}
