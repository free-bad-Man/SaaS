import type { HistoryDatabase } from "./history";
import type { UploadStorage } from "./uploads";

export function getPostgresDatabase(connectionString: string): Promise<HistoryDatabase>;
export function getLocalUploadStorage(root: string): UploadStorage;
