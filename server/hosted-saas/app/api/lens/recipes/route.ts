import { Pool } from "pg";
import { auth } from "@/lib/auth";
import { readRecipe, saveRecipe, site, validateRecipe, voterKey } from "./recipe.mjs";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
const enabled = () => process.env.VERCEL_ENV === "preview" && process.env.LENS_RECIPE_PILOT === "1";
let pool: Pool | undefined;
function database() {
  if (pool) return pool;
  const configured = process.env.LENS_RECIPE_DATABASE_URL;
  if (!configured) throw new Error("Recipe storage unavailable");
  const url = new URL(configured);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) url.searchParams.set("sslmode", "verify-full");
  pool = new Pool({ connectionString: url.toString(), max: 4, connectionTimeoutMillis: 4000 });
  return pool;
}

export async function GET(request: Request) {
  if (!enabled() || new URL(request.url).searchParams.get("site") !== site) return json({ error: "Unavailable" }, 404);
  try {
    const recipe = await readRecipe(database());
    return recipe ? json(recipe) : json({ error: "No agreed recipe" }, 404);
  } catch { return json({ error: "Recipe unavailable" }, 503); }
}

export async function POST(request: Request) {
  if (!enabled()) return json({ error: "Unavailable" }, 404);
  if (request.headers.get("origin") !== new URL(request.url).origin ||
      request.headers.get("sec-fetch-site") === "cross-site" ||
      request.headers.get("content-type")?.split(";")[0] !== "application/json")
    return json({ error: "Untrusted request" }, 403);
  const limit = 1024;
  if (Number(request.headers.get("content-length") ?? 0) > limit) return json({ error: "Too large" }, 413);
  const reader = request.body?.getReader();
  if (!reader) return json({ error: "Invalid recipe" }, 400);
  let raw = "";
  let size = 0;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); return json({ error: "Too large" }, 413); }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  } catch { return json({ error: "Invalid recipe" }, 400); }
  let candidate: unknown;
  try { candidate = JSON.parse(raw); } catch { return json({ error: "Invalid recipe" }, 400); }
  const recipe = validateRecipe(candidate);
  if (!recipe) return json({ error: "Invalid recipe" }, 400);
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) return json({ error: "Sign in required" }, 401);
    if (!session.user.emailVerified) return json({ error: "Verified Doxle account required" }, 403);
    const secret = process.env.LENS_RECIPE_VOTER_SECRET;
    if (!secret || secret.length < 32) return json({ error: "Recipe sharing unavailable" }, 503);
    await saveRecipe(database(), voterKey(session.user.id, secret), recipe);
    return json({ saved: true });
  } catch { return json({ error: "Recipe sharing unavailable" }, 503); }
}
