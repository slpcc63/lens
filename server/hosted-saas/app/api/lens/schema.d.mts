export type Snapshot = { schemaVersion: 1; sites: { id: string; name: string; url: string; preferredUsername?: string }[] };
export function validateSnapshot(input: unknown): Snapshot;
export function validateUpload(input: unknown): { expectedRevision: number; snapshot: Snapshot };
export function readSettings(db: { query: Function }, userId: string): Promise<{revision: number; snapshot: Snapshot}>;
export function writeSettings(db: { query: Function }, userId: string, input: unknown): Promise<number | null>;
