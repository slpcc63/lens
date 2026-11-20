// Integration candidate for the existing slpcc63/hosted-saas app, NOT a new auth service.
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { auth } from "@/lib/auth";
import { readSettings, writeSettings } from "./schema.mjs";
import { portalHTML } from "./portal.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
let pool: Pool | undefined;
function database() {
  if (pool) return pool;
  const connectionString = process.env.LENS_DATABASE_URL;
  if (!connectionString) throw new Error("Lens settings database not configured");
  const url = new URL(connectionString);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) url.searchParams.set("sslmode", "verify-full");
  pool = new Pool({ connectionString: url.toString() });
  return pool;
}
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const url = new URL(request.url);
  if (!session?.user) {
    if (url.searchParams.get("format") === "json") return json({ error: "Sign in required" }, 401);
    return new Response(null, { status: 303, headers: { ...headers, Location: "/sign-in?next=%2Fapi%2Flens" } });
  }
  if (url.searchParams.get("format") === "json") {
    try { return json({ userId: session.user.id, email: session.user.email, ...await readSettings(database(), session.user.id) }); }
    catch { return json({ error: "Account sync is unavailable" }, 503); }
  }
  const nonce = randomBytes(24).toString("base64");
  return new Response(portalHTML(nonce), { headers: { ...headers, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'` } });
}

export async function PUT(request: Request) {
  const url = new URL(request.url);
  if (request.headers.get("origin") !== url.origin || request.headers.get("sec-fetch-site") === "cross-site" || request.headers.get("content-type")?.split(";")[0] !== "application/json") return json({ error: "Untrusted request" }, 403);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return json({ error: "Sign in required" }, 401);
  if (Number(request.headers.get("content-length") ?? 0) > 1048576) return json({ error: "Settings too large" }, 413);
  let body: unknown;
  try { const raw = await request.text(); if (Buffer.byteLength(raw) > 1048576) return json({ error: "Settings too large" }, 413); body = JSON.parse(raw); }
  catch { return json({ error: "Invalid settings" }, 400); }
  try {
    if (!body || typeof body !== "object" || !("accountId" in body) || body.accountId !== session.user.id) return json({ error: "Account changed; review again" }, 409);
    const { accountId: _accountId, ...upload } = body as Record<string, unknown>;
    const revision = await writeSettings(database(), session.user.id, upload);
    return revision == null ? json({ error: "Settings changed on another device" }, 409) : json({ revision });
  } catch(error) {
    if (error instanceof Error && /Invalid|Unsafe|Duplicate/.test(error.message)) return json({ error: "Invalid settings" }, 400);
    return json({ error: "Account sync is unavailable" }, 503);
  }
}
