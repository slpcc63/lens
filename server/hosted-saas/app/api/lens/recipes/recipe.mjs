import { createHmac } from "node:crypto";

export const site = "sniffies";
const version = 1;
const allowed = new Set(["map", "profile"].flatMap(scope =>
  ["age", "height", "weight", "position"].map(field => scope + ":" + field)));

export function validateRecipe(input) {
  if (!input || typeof input !== "object" || Object.keys(input).length !== 3 ||
      input.site !== site || input.version !== version || !Array.isArray(input.fields) ||
      input.fields.length < 1 || input.fields.length > allowed.size ||
      !input.fields.every(field => allowed.has(field)) ||
      new Set(input.fields).size !== input.fields.length) return null;
  return { site, version, fields: [...input.fields].sort() };
}

export function voterKey(accountId, secret) {
  return createHmac("sha256", secret).update("lens-recipes-v1\0").update(accountId).digest("hex");
}

export async function saveRecipe(db, contributor, recipe) {
  await db.query(
    `INSERT INTO lens_recipe_votes (site, version, contributor, fields)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (site, version, contributor) DO UPDATE
     SET fields = EXCLUDED.fields, updated_at = now()`,
    [recipe.site, recipe.version, contributor, recipe.fields]);
}

export async function readRecipe(db) {
  const { rows } = await db.query(
    `SELECT fields, count(*)::int AS votes
       FROM lens_recipe_votes
      WHERE site = $1 AND version = $2 AND updated_at >= now() - interval '90 days'
      GROUP BY fields ORDER BY votes DESC, fields LIMIT 2`, [site, version]);
  const [winner, runnerUp] = rows;
  if (!winner || winner.votes < 2 || (runnerUp && runnerUp.votes >= winner.votes)) return null;
  return validateRecipe({ site, version, fields: winner.fields });
}
