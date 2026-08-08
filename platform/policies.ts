import type { HistoryDatabase } from "./history";
import { DEFAULT_POLICY, normalizePolicy } from "./policy.mjs";

type DecisionPolicy = {
  attributionWindowDays: number;
  pauseIvtScore: number;
  watchIvtScore: number;
  pauseRoasBelow: number;
  watchRoasBelow: number;
  scaleRoasAtLeast: number;
  minSpend: number;
  scaleBidPercent: number;
  executionMode: "shadow" | "approval";
};

const MEMORY_KEY = "__3ve4ProjectPolicies";

function memoryStore() {
  const root = globalThis as typeof globalThis & { [MEMORY_KEY]?: Map<string, DecisionPolicy> };
  root[MEMORY_KEY] ??= new Map();
  return root[MEMORY_KEY];
}

export async function getProjectPolicy(database: HistoryDatabase | undefined, projectId: string): Promise<DecisionPolicy> {
  if (!projectId) throw new Error("projectId is required.");
  if (!database) return memoryStore().get(projectId) ?? DEFAULT_POLICY as DecisionPolicy;
  const row = await database.prepare("SELECT configuration_json FROM project_policies WHERE project_id = ?").bind(projectId).first<{ configuration_json: string }>();
  if (!row) return DEFAULT_POLICY as DecisionPolicy;
  try { return normalizePolicy(JSON.parse(row.configuration_json) as Partial<DecisionPolicy>) as DecisionPolicy; }
  catch { return DEFAULT_POLICY as DecisionPolicy; }
}

export async function saveProjectPolicy(database: HistoryDatabase | undefined, projectId: string, input: Partial<DecisionPolicy>): Promise<DecisionPolicy> {
  const policy = normalizePolicy(input) as DecisionPolicy;
  if (!database) {
    memoryStore().set(projectId, policy);
    return policy;
  }
  const project = await database.prepare("SELECT id FROM projects WHERE id = ?").bind(projectId).first<{ id: string }>();
  if (!project) throw new Error("Project not found.");
  await database.prepare(
    `INSERT INTO project_policies (project_id, configuration_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(project_id) DO UPDATE SET configuration_json = excluded.configuration_json, updated_at = excluded.updated_at`,
  ).bind(projectId, JSON.stringify(policy), new Date().toISOString()).run();
  return policy;
}
