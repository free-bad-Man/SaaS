export type PlatformPayload = { connector: string; events: Array<Record<string, unknown>>; postbacks: Array<Record<string, unknown>> };
export function parsePlatformInput(source: string, filename?: string): PlatformPayload;
export function createPipelineReportCsv(result: unknown): string;
