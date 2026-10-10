import { env } from "cloudflare:workers";
import type { Database } from "./types";
export function setting(key: string): string {
  const value = (env as unknown as Record<string, unknown>)[key];
  return typeof value === "string" ? value : (process.env[key] ?? "");
}
export function database(): Database {
  const db = (env as unknown as { DB?: Database }).DB;
  if (!db) throw new Error("Database unavailable");
  return db;
}
export function isOwner(headers: Headers): boolean {
  const owner = setting("SITE_OWNER_EMAIL").trim().toLowerCase();
  return (
    !!owner &&
    !!headers.get("oai-authenticated-user-id") &&
    headers.get("oai-authenticated-user-email")?.trim().toLowerCase() === owner
  );
}
export function originAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !!origin && origin === new URL(request.url).origin;
}
export function json(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}
export async function readBody(
  request: Request,
  max = 64000,
): Promise<unknown> {
  if (Number(request.headers.get("content-length") || 0) > max)
    throw new Error("Request too large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new Error("Request too large");
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(all));
}
