import type { HistoryDatabase } from "./history";

export type UploadStorage = {
  put(key: string, value: string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ text(): Promise<string> } | null>;
  delete?(key: string): Promise<unknown>;
};

export type UploadError = { kind: string; row: number | null; message: string };

export type UploadJob = {
  id: string;
  projectId: string;
  fileKey: string;
  fileName: string;
  contentType: string;
  connector: string;
  sizeBytes: number;
  status: "queued" | "processing" | "complete" | "failed";
  processedRows: number;
  totalRows: number;
  errorCount: number;
  errors: UploadError[];
  runId: string | null;
  createdAt: string;
  updatedAt: string;
};

type UploadRow = {
  id: string;
  project_id: string;
  file_key: string;
  file_name: string;
  content_type: string;
  connector: string;
  size_bytes: number;
  status: UploadJob["status"];
  processed_rows: number;
  total_rows: number;
  error_count: number;
  error_json: string;
  run_id: string | null;
  created_at: string;
  updated_at: string;
};

type UploadMemory = { jobs: UploadJob[]; files: Map<string, string> };
const MEMORY_KEY = "__3ve4PlatformUploads";

function memoryStore(): UploadMemory {
  const root = globalThis as typeof globalThis & { [MEMORY_KEY]?: UploadMemory };
  root[MEMORY_KEY] ??= { jobs: [], files: new Map() };
  return root[MEMORY_KEY];
}

function mapJob(row: UploadRow): UploadJob {
  let errors: UploadError[] = [];
  try { errors = JSON.parse(row.error_json) as UploadError[]; } catch { errors = []; }
  return {
    id: row.id,
    projectId: row.project_id,
    fileKey: row.file_key,
    fileName: row.file_name,
    contentType: row.content_type,
    connector: row.connector,
    sizeBytes: row.size_bytes,
    status: row.status,
    processedRows: row.processed_rows,
    totalRows: row.total_rows,
    errorCount: row.error_count,
    errors,
    runId: row.run_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function safeFileName(name: string) {
  return name.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120) || "traffic-data.txt";
}

export async function createUploadJob(
  database: HistoryDatabase | undefined,
  storage: UploadStorage | undefined,
  input: { projectId: string; fileName: string; contentType: string; connector: string; source: string; sizeBytes: number },
): Promise<UploadJob> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const fileKey = `uploads/${input.projectId}/${id}/${safeFileName(input.fileName)}`;
  const job: UploadJob = {
    id,
    projectId: input.projectId,
    fileKey,
    fileName: input.fileName.trim().slice(0, 160) || "traffic-data.txt",
    contentType: input.contentType || "text/plain",
    connector: input.connector || "openrtb",
    sizeBytes: input.sizeBytes,
    status: "queued",
    processedRows: 0,
    totalRows: 0,
    errorCount: 0,
    errors: [],
    runId: null,
    createdAt: now,
    updatedAt: now,
  };

  if (storage) await storage.put(fileKey, input.source, { httpMetadata: { contentType: job.contentType } });
  else memoryStore().files.set(fileKey, input.source);

  if (!database) {
    memoryStore().jobs.unshift(job);
    return job;
  }

  await database.prepare(
    `INSERT INTO upload_jobs (
      id, project_id, file_key, file_name, content_type, connector, size_bytes, status,
      processed_rows, total_rows, error_count, error_json, run_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    job.id, job.projectId, job.fileKey, job.fileName, job.contentType, job.connector, job.sizeBytes, job.status,
    0, 0, 0, "[]", null, job.createdAt, job.updatedAt,
  ).run();
  return job;
}

export async function getUploadJob(database: HistoryDatabase | undefined, id: string): Promise<UploadJob | null> {
  if (!database) return memoryStore().jobs.find((job) => job.id === id) ?? null;
  const row = await database.prepare(
    `SELECT id, project_id, file_key, file_name, content_type, connector, size_bytes, status,
      processed_rows, total_rows, error_count, error_json, run_id, created_at, updated_at
     FROM upload_jobs WHERE id = ?`,
  ).bind(id).first<UploadRow>();
  return row ? mapJob(row) : null;
}

export async function readUploadSource(storage: UploadStorage | undefined, job: UploadJob): Promise<string> {
  if (!storage) {
    const source = memoryStore().files.get(job.fileKey);
    if (source == null) throw new Error("Uploaded file is no longer available.");
    return source;
  }
  const object = await storage.get(job.fileKey);
  if (!object) throw new Error("Uploaded file is no longer available.");
  return object.text();
}

export async function updateUploadJob(
  database: HistoryDatabase | undefined,
  id: string,
  patch: Partial<Pick<UploadJob, "status" | "processedRows" | "totalRows" | "errorCount" | "errors" | "runId">>,
): Promise<UploadJob> {
  const current = await getUploadJob(database, id);
  if (!current) throw new Error("Upload job not found.");
  const next: UploadJob = { ...current, ...patch, updatedAt: new Date().toISOString() };

  if (!database) {
    const store = memoryStore();
    const index = store.jobs.findIndex((job) => job.id === id);
    store.jobs[index] = next;
    return next;
  }

  await database.prepare(
    `UPDATE upload_jobs SET status = ?, processed_rows = ?, total_rows = ?, error_count = ?,
      error_json = ?, run_id = ?, updated_at = ? WHERE id = ?`,
  ).bind(
    next.status, next.processedRows, next.totalRows, next.errorCount, JSON.stringify(next.errors),
    next.runId, next.updatedAt, id,
  ).run();
  return next;
}
