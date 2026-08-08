import { HISTORY_SCHEMA_STATEMENTS } from "../db/schema";

type D1Result<T> = { results?: T[] };
type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  all<T>(): Promise<D1Result<T>>;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
};

export type HistoryDatabase = {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown[]>;
};

export type ProjectRecord = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type PipelineRunSummary = {
  id: string;
  projectId: string;
  sourceName: string;
  connector: string;
  status: string;
  eventCount: number;
  postbackCount: number;
  acceptedEvents: number;
  attributedConversions: number;
  shadowActions: number;
  createdAt: string;
};

export type PipelineRunRecord = PipelineRunSummary & { result: unknown };

type ProjectRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type RunRow = {
  id: string;
  project_id: string;
  source_name: string;
  connector: string;
  status: string;
  event_count: number;
  postback_count: number;
  accepted_events: number;
  attributed_conversions: number;
  shadow_actions: number;
  result_json?: string;
  created_at: string;
};

type MemoryStore = { projects: ProjectRecord[]; runs: PipelineRunRecord[] };
const MEMORY_KEY = Symbol.for("3ve4.platform.history");

function memoryStore(): MemoryStore {
  const root = globalThis as typeof globalThis & { [MEMORY_KEY]?: MemoryStore };
  root[MEMORY_KEY] ??= { projects: [], runs: [] };
  return root[MEMORY_KEY];
}

function mapProject(row: ProjectRow): ProjectRecord {
  return { id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at };
}

function mapRun(row: RunRow): PipelineRunSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    sourceName: row.source_name,
    connector: row.connector,
    status: row.status,
    eventCount: row.event_count,
    postbackCount: row.postback_count,
    acceptedEvents: row.accepted_events,
    attributedConversions: row.attributed_conversions,
    shadowActions: row.shadow_actions,
    createdAt: row.created_at,
  };
}

function summarizeRun(run: PipelineRunRecord): PipelineRunSummary {
  return {
    id: run.id,
    projectId: run.projectId,
    sourceName: run.sourceName,
    connector: run.connector,
    status: run.status,
    eventCount: run.eventCount,
    postbackCount: run.postbackCount,
    acceptedEvents: run.acceptedEvents,
    attributedConversions: run.attributedConversions,
    shadowActions: run.shadowActions,
    createdAt: run.createdAt,
  };
}

async function ensureSchema(database?: HistoryDatabase) {
  if (!database) return;
  await database.batch(HISTORY_SCHEMA_STATEMENTS.map((sql) => database.prepare(sql)));
  await database.prepare("PRAGMA optimize").run();
}

export async function createProject(database: HistoryDatabase | undefined, name: string): Promise<ProjectRecord> {
  const cleanName = name.trim();
  if (!cleanName) throw new Error("Project name is required.");
  if (cleanName.length > 80) throw new Error("Project name must be 80 characters or fewer.");
  const now = new Date().toISOString();
  const project = { id: crypto.randomUUID(), name: cleanName, createdAt: now, updatedAt: now };

  if (!database) {
    memoryStore().projects.unshift(project);
    return project;
  }

  await ensureSchema(database);
  await database.prepare(
    "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
  ).bind(project.id, project.name, project.createdAt, project.updatedAt).run();
  return project;
}

export async function listProjects(database?: HistoryDatabase): Promise<ProjectRecord[]> {
  if (!database) {
    const store = memoryStore();
    if (store.projects.length === 0) await createProject(undefined, "Demo workspace");
    return [...store.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  await ensureSchema(database);
  let rows = (await database.prepare(
    "SELECT id, name, created_at, updated_at FROM projects ORDER BY updated_at DESC",
  ).all<ProjectRow>()).results ?? [];
  if (rows.length === 0) {
    await createProject(database, "Demo workspace");
    rows = (await database.prepare(
      "SELECT id, name, created_at, updated_at FROM projects ORDER BY updated_at DESC",
    ).all<ProjectRow>()).results ?? [];
  }
  return rows.map(mapProject);
}

export async function savePipelineRun(
  database: HistoryDatabase | undefined,
  input: {
    projectId: string;
    sourceName: string;
    connector: string;
    eventCount: number;
    postbackCount: number;
    result: Record<string, unknown>;
  },
): Promise<PipelineRunRecord> {
  const modules = (input.result.modules ?? {}) as Record<string, Record<string, unknown>>;
  const actions = Array.isArray(input.result.actions) ? input.result.actions.length : 0;
  const now = new Date().toISOString();
  const run: PipelineRunRecord = {
    id: crypto.randomUUID(),
    projectId: input.projectId,
    sourceName: input.sourceName.trim().slice(0, 160) || "API payload",
    connector: input.connector,
    status: "complete",
    eventCount: input.eventCount,
    postbackCount: input.postbackCount,
    acceptedEvents: Number(modules.ingestion?.accepted ?? 0),
    attributedConversions: Number(modules.attribution?.attributed ?? 0),
    shadowActions: actions,
    result: input.result,
    createdAt: now,
  };

  if (!database) {
    const store = memoryStore();
    const project = store.projects.find((item) => item.id === input.projectId);
    if (!project) throw new Error("Project not found.");
    project.updatedAt = now;
    store.runs.unshift(run);
    return run;
  }

  await ensureSchema(database);
  const project = await database.prepare("SELECT id FROM projects WHERE id = ?").bind(input.projectId).first<{ id: string }>();
  if (!project) throw new Error("Project not found.");
  await database.batch([
    database.prepare(
      `INSERT INTO pipeline_runs (
        id, project_id, source_name, connector, status, event_count, postback_count,
        accepted_events, attributed_conversions, shadow_actions, result_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      run.id, run.projectId, run.sourceName, run.connector, run.status, run.eventCount, run.postbackCount,
      run.acceptedEvents, run.attributedConversions, run.shadowActions, JSON.stringify(run.result), run.createdAt,
    ),
    database.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").bind(now, input.projectId),
  ]);
  return run;
}

export async function listPipelineRuns(database: HistoryDatabase | undefined, projectId: string): Promise<PipelineRunSummary[]> {
  if (!projectId) throw new Error("projectId is required.");
  if (!database) {
    return memoryStore().runs.filter((run) => run.projectId === projectId).slice(0, 25).map(summarizeRun);
  }

  await ensureSchema(database);
  const rows = (await database.prepare(
    `SELECT id, project_id, source_name, connector, status, event_count, postback_count,
      accepted_events, attributed_conversions, shadow_actions, created_at
     FROM pipeline_runs WHERE project_id = ? ORDER BY created_at DESC LIMIT 25`,
  ).bind(projectId).all<RunRow>()).results ?? [];
  return rows.map(mapRun);
}

export async function getPipelineRun(database: HistoryDatabase | undefined, id: string): Promise<PipelineRunRecord | null> {
  if (!database) return memoryStore().runs.find((run) => run.id === id) ?? null;
  await ensureSchema(database);
  const row = await database.prepare(
    `SELECT id, project_id, source_name, connector, status, event_count, postback_count,
      accepted_events, attributed_conversions, shadow_actions, result_json, created_at
     FROM pipeline_runs WHERE id = ?`,
  ).bind(id).first<RunRow>();
  if (!row) return null;
  return { ...mapRun(row), result: JSON.parse(row.result_json ?? "{}") };
}
