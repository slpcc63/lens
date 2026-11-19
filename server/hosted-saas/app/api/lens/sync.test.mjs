import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSnapshot, validateUpload, readSettings, writeSettings } from './schema.mjs';
import { portalScript, portalHTML } from './portal.mjs';
const id = 'a1b2c3d4-1111-4222-8333-123456789abc';
const snapshot = { schemaVersion: 1, sites: [{id, name:'Synthetic site', url:'https://example.test', preferredUsername:'synthetic-account'}] };

test('round trip preserves stable site identity and preferred account', () => {
 assert.deepEqual(validateSnapshot(snapshot), snapshot);
 const changed = structuredClone(snapshot); changed.sites[0].url = 'https://alias.example.test/path';
 assert.equal(validateSnapshot(changed).sites[0].id, id);
 assert.equal(validateSnapshot(changed).sites[0].preferredUsername, 'synthetic-account');
});
test('rejects secrets, unsafe addresses, tokens, unsupported schemas and duplicate identities', () => {
 for (const url of ['http://example.test','javascript:alert(1)','https://u:p@example.test','https://example.test?token=secret','https://example.test/#token']) {
  assert.throws(() => validateSnapshot({...snapshot,sites:[{...snapshot.sites[0],url}]}));
 }
 assert.throws(() => validateSnapshot({...snapshot,password:'secret'}));
 assert.throws(() => validateSnapshot({...snapshot,sites:[{...snapshot.sites[0],cookies:'secret'}]}));
 assert.throws(() => validateSnapshot({...snapshot, schemaVersion: 2}));
 assert.throws(() => validateSnapshot({...snapshot, sites: [snapshot.sites[0], snapshot.sites[0]]}));
 assert.throws(() => validateSnapshot({...snapshot, sites: Array(501).fill(snapshot.sites[0])}));
});
test('revision validation rejects invalid versions', () => {
 for (const expectedRevision of [-1, 0.5, '1', null, Number.MAX_SAFE_INTEGER+1]) assert.throws(() => validateUpload({expectedRevision,snapshot}));
});
test('SQL is owner scoped and stale writes never overwrite newer settings', async () => {
 const rows = new Map();
 const queries = [];
 const db = { async query(sql, args) {
  queries.push([sql,args]); const owner = args[0];
  if (sql.startsWith('SELECT')) return {rows: rows.has(owner) ? [rows.get(owner)] : []};
  if (sql.startsWith('INSERT')) {
   if (rows.has(owner)) return {rows:[]};
   rows.set(owner,{revision:1,settings:JSON.parse(args[1])}); return {rows:[{revision:1}]};
  }
  assert.match(sql, /WHERE auth_user_id = \$1 AND revision = \$2/);
  const row=rows.get(owner); if (!row || row.revision !== args[1]) return {rows:[]};
  row.revision++; row.settings=JSON.parse(args[2]); return {rows:[{revision:row.revision}]};
 }};
 assert.equal((await readSettings(db,'A')).revision, 0);
 assert.equal(await writeSettings(db,'A',{expectedRevision:0,snapshot}),1);
 const results=await Promise.all([writeSettings(db,'A',{expectedRevision:1,snapshot}),writeSettings(db,'A',{expectedRevision:1,snapshot})]);
 assert.deepEqual(results,[2,null]);
 assert.equal(await writeSettings(db,'A',{expectedRevision:0,snapshot}),null);
 assert.equal((await readSettings(db,'B')).snapshot.sites.length,0);
 assert.equal((await readSettings(db,'A')).revision,2);
 assert.ok(queries.every(([,args]) => args[0] === 'A' || args[0] === 'B'));
});
test('portal script parses and uses account-bound compare-and-swap uploads', () => {
 assert.doesNotThrow(() => new Function(portalScript()));
 assert.match(portalScript(), /accountId:expectedUser/);
 assert.match(portalScript(), /response.status === 409/);
 assert.match(portalHTML('synthetic-nonce'), /nonce="synthetic-nonce"/);
 assert.doesNotMatch(portalHTML('synthetic-nonce'), /innerHTML/);
});
