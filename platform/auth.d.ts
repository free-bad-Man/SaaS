export type AdminSession = { username: string; email: string; expiresAt: string };
export function createPasswordHash(password: string, salt?: Uint8Array): Promise<string>;
export function getAdminSession(request: Request, env?: Record<string, unknown>): Promise<AdminSession | null>;
export function handleAuthApi(request: Request, env?: Record<string, unknown>): Promise<Response | null>;

