import assert from "node:assert/strict";
import test from "node:test";
import { readRecipe, saveRecipe, validateRecipe, voterKey } from "./recipe.mjs";

const recipe = { site: "sniffies", version: 1, fields: ["map:age", "profile:height"] };
const storage = rows => ({ query: async () => ({ rows }) });

test("recipes are canonical, site-scoped, and contain only known field tags", () => {
  assert.deepEqual(validateRecipe({ ...recipe, fields: [...recipe.fields].reverse() }), recipe);
  for (const change of [
    { profiles: [] }, { accountId: "fixture" }, { site: "private.example" }, { version: 2 },
    { fields: [] }, { fields: ["map:age", "map:age"] }, { fields: ["profile:34"] },
    { fields: ["profile:someone@example.test"] }, { fields: ["map:position:top"] }
  ]) assert.equal(validateRecipe({ ...recipe, ...change }), null);
});

test("the keyed contributor reference is stable, separate, and never the account ID", () => {
  const key = voterKey("account-1", "fixture-secret");
  assert.match(key, /^[a-f0-9]{64}$/);
  assert.equal(key, voterKey("account-1", "fixture-secret"));
  assert.notEqual(key, voterKey("account-2", "fixture-secret"));
  assert.notEqual(key, voterKey("account-1", "another-fixture-secret"));
});

test("upsert replaces an account's vote and passes only field tags to storage", async () => {
  const contributor = voterKey("account-1", "fixture-secret");
  await saveRecipe({ query: async (sql, args) => {
    assert.match(sql, /ON CONFLICT \(site, version, contributor\) DO UPDATE/);
    assert.deepEqual(args, ["sniffies", 1, contributor, recipe.fields]);
  } }, contributor, recipe);
});

test("publish only a unique winner with at least two matching accounts", async () => {
  const votes = (votes, fields = recipe.fields) => ({ votes, fields });
  assert.equal(await readRecipe(storage([])), null);
  assert.equal(await readRecipe(storage([votes(1)])), null);
  assert.equal(await readRecipe(storage([votes(1), votes(1, ["map:weight"])])), null);
  assert.deepEqual(await readRecipe(storage([votes(2)])), recipe);
  assert.deepEqual(await readRecipe(storage([votes(2), votes(1, ["map:weight"])])), recipe);
  assert.equal(await readRecipe(storage([votes(2), votes(2, ["map:weight"])])), null);
  assert.equal(await readRecipe(storage([votes(2, ["map:full name"])])), null);
});
