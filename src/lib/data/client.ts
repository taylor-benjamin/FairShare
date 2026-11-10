// Data layer entry point — the ONLY file that reaches the D1 binding.
// Services call the repository functions in this folder; nothing above the data layer imports this file.
import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export function db(): D1Database {
  const { env } = getCloudflareContext();
  if (!env.DB) throw new Error("D1 binding 'DB' is missing. Check wrangler.jsonc.");
  return env.DB;
}

export function now(): string {
  return new Date().toISOString();
}

export async function all<T>(sql: string, ...params: unknown[]): Promise<T[]> {
  const res = await db().prepare(sql).bind(...params).all<T>();
  return res.results ?? [];
}

export async function first<T>(sql: string, ...params: unknown[]): Promise<T | null> {
  return (await db().prepare(sql).bind(...params).first<T>()) ?? null;
}

/** Runs one write and returns the new row id (for INSERTs). */
export async function run(sql: string, ...params: unknown[]): Promise<number> {
  const res = await db().prepare(sql).bind(...params).run();
  return Number(res.meta.last_row_id ?? 0);
}

/** Runs several writes atomically (D1 batches are a single transaction). */
export async function batch(statements: { sql: string; params: unknown[] }[]): Promise<void> {
  if (statements.length === 0) return;
  const d = db();
  await d.batch(statements.map((s) => d.prepare(s.sql).bind(...s.params)));
}

export function stmt(sql: string, ...params: unknown[]) {
  return { sql, params };
}
