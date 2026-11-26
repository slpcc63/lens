export type Recipe = { site: string; version: number; fields: string[] };
type Database = { query(sql: string, parameters: any[]): Promise<{ rows: any[] }> };
export const site: string;
export function validateRecipe(input: unknown): Recipe | null;
export function voterKey(accountId: string, secret: string): string;
export function saveRecipe(db: Database, contributor: string, recipe: Recipe): Promise<void>;
export function readRecipe(db: Database): Promise<Recipe | null>;
