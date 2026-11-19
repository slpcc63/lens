// Product-owned settings only. No cookies, website sessions, passwords or tokens.
export function validateSnapshot(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(k => !['schemaVersion', 'sites'].includes(k)) ||
      input.schemaVersion !== 1 || !Array.isArray(input.sites) || input.sites.length > 500) throw new Error('Invalid settings document');
  const ids = new Set(), urls = new Set();
  const sites = input.sites.map(site => {
    if (!site || typeof site !== 'object' || Array.isArray(site) ||
        Object.keys(site).some(k => !['id', 'name', 'url', 'preferredUsername'].includes(k)) ||
        typeof site.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(site.id) ||
        typeof site.name !== 'string' || !site.name.trim() || site.name.length > 200 ||
        typeof site.url !== 'string' || site.url.length > 4096 ||
        (site.preferredUsername != null && (typeof site.preferredUsername !== 'string' || site.preferredUsername.length > 320))) throw new Error('Invalid site settings');
    const url = new URL(site.url);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search || url.hash) throw new Error('Unsafe saved URL');
    const id = site.id.toLowerCase();
    if (ids.has(id) || urls.has(url.href)) throw new Error('Duplicate site');
    ids.add(id); urls.add(url.href);
    return { id: site.id, name: site.name, url: site.url, ...(site.preferredUsername == null ? {} : { preferredUsername: site.preferredUsername }) };
  });
  return { schemaVersion: 1, sites };
}

export function validateUpload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(k => !['expectedRevision', 'snapshot'].includes(k)) ||
      !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) throw new Error('Invalid revision');
  return { expectedRevision: body.expectedRevision, snapshot: validateSnapshot(body.snapshot) };
}

export async function readSettings(db, userId) {
  const result = await db.query('SELECT revision, settings FROM lens_settings WHERE auth_user_id = $1', [userId]);
  if (!result.rows.length) return { revision: 0, snapshot: { schemaVersion: 1, sites: [] } };
  return { revision: Number(result.rows[0].revision), snapshot: validateSnapshot(result.rows[0].settings) };
}

export async function writeSettings(db, userId, input) {
  const { expectedRevision, snapshot } = validateUpload(input);
  const result = expectedRevision === 0
    ? await db.query('INSERT INTO lens_settings (auth_user_id, revision, settings) VALUES ($1, 1, $2::jsonb) ON CONFLICT (auth_user_id) DO NOTHING RETURNING revision', [userId, JSON.stringify(snapshot)])
    : await db.query('UPDATE lens_settings SET revision = revision + 1, settings = $3::jsonb, updated_at = NOW() WHERE auth_user_id = $1 AND revision = $2 RETURNING revision', [userId, expectedRevision, JSON.stringify(snapshot)]);
  return result.rows.length ? Number(result.rows[0].revision) : null;
}
