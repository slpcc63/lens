'use strict';
function createComfortCore() {
  const own = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);
  const normalize = value => String(value ?? '').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
  const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{6,128}$/.test(value);
  function comfortValue(record) {
    const candidates = [record?.data?.profile?.extended, record?.publicProfile?.extended, record?.profile?.extended];
    for (const extended of candidates) {
      if (!own(extended?.health, 'drugAbuse')) continue;
      const values = extended.health.drugAbuse;
      if (values === null) return null;
      if (!Array.isArray(values) || values.some(value => typeof value !== 'string')) return undefined;
      // The site's option "pnp" is displayed as "No PnP" in this field.
      return values.some(value => normalize(value) === 'pnp');
    }
    return undefined;
  }
  function recordsFrom(payload) {
    const facts = new Map();
    const stack = [{ value: payload, depth: 0 }];
    const seen = new WeakSet();
    const skip = new Set(['profile', 'publicProfile', 'health', 'images', 'photos', 'files', 'messages', 'message', 'conversations', 'conversation', 'body', 'account', 'credentials', 'options']);
    let visited = 0;
    while (stack.length && visited++ < 30000) {
      const { value, depth } = stack.pop();
      if (!value || typeof value !== 'object' || seen.has(value) || depth > 12) continue;
      seen.add(value);
      const id = value._id;
      if (validId(id)) {
        const match = comfortValue(value);
        if (match !== undefined) facts.set(id, match);
      }
      if (Array.isArray(value)) {
        for (let i = Math.min(value.length, 20000) - 1; i >= 0; i--) stack.push({ value: value[i], depth: depth + 1 });
      } else {
        for (const key of Object.keys(value)) {
          if (!skip.has(key) && value[key] && typeof value[key] === 'object') stack.push({ value: value[key], depth: depth + 1 });
        }
      }
    }
    return facts;
  }
  function parsePayload(text) {
    if (typeof text !== 'string' || text.length > 4 * 1024 * 1024) return null;
    const input = text.trim().replace(/^\d+(?=[\[{])/, '');
    if (input[0] !== '[' && input[0] !== '{') return null;
    try { return JSON.parse(input); } catch { return null; }
  }
  function isSniffiesURL(value, base = 'https://sniffies.com/') {
    try {
      const url = new URL(value, base);
      return /^(https:|wss:)$/.test(url.protocol) && (url.hostname === 'sniffies.com' || url.hostname.endsWith('.sniffies.com'));
    } catch { return false; }
  }
  return { normalize, validId, comfortValue, recordsFrom, parsePayload, isSniffiesURL };
}
module.exports = createComfortCore;
