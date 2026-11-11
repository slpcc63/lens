(() => {
  'use strict';
  if (window.top !== window.self || document.getElementById('scf-controls-v1')) return;
  if (window.__sniffiesComfortFilterV1) return;
  window.__sniffiesComfortFilterV1 = true;
  const core = createComfortCore();
  const PREF = 'sniffies-comfort-filter.enabled.v1';
  const MAX_BYTES = 4 * 1024 * 1024;
  const MAX_RECORDS = 10000;
  const MAX_AGE_MS = 2 * 60 * 60 * 1000;
  const markers = '.marker-container.user[id], [data-testid="markerUserContainer"][id]';
  const profileRoots = 'app-profile [id^="profile-"]';
  const known = new Map(); // Profile IDs and a match flag only; never persisted or sent anywhere.
  let enabled = true;
  let host, shadow, style, timer, observer;
  let networkSeen = false;
  let panelOpen = false;
  let lastProfileNotice = false;
  try { enabled = localStorage.getItem(PREF) !== 'false'; } catch {}

  function note(id, match) {
    if (!core.validId(id)) return;
    if (match === null) { known.delete(id); return; }
    if (typeof match !== 'boolean') return;
    known.delete(id);
    known.set(id, { match, time: Date.now() });
    while (known.size > MAX_RECORDS) known.delete(known.keys().next().value);
  }
  function receive(payload) {
    try {
      const facts = core.recordsFrom(payload);
      if (!facts.size) return;
      networkSeen = true;
      for (const [id, match] of facts) note(id, match);
      schedule();
    } catch { /* A changing site response must never break the page. */ }
  }
  function receiveText(text) {
    const payload = core.parsePayload(text);
    if (payload) receive(payload);
  }
  function relevantURL(url) {
    if (!core.isSniffiesURL(url, location.href)) return false;
    try {
      return !/\/(?:auth(?:entication)?|account|password|chat|messages?|conversations?|payments?|billing|verification)(?:\/|$)/i.test(new URL(url, location.href).pathname);
    } catch { return false; }
  }
  async function readResponse(response) {
    if (!/json/i.test(response.headers.get('content-type') || '')) return;
    if (Number(response.headers.get('content-length') || 0) > MAX_BYTES) return;
    const copy = response.clone();
    if (!copy.body?.getReader) return;
    const reader = copy.body.getReader();
    const decoder = new TextDecoder();
    let text = '', size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) { void reader.cancel().catch(() => {}); return; }
        text += decoder.decode(value, { stream: true });
      }
      receiveText(text + decoder.decode());
    } finally { reader.releaseLock(); }
  }
  // Observe data the page already receives. No extra profile requests or response rewriting.
  try {
    const originalFetch = window.fetch;
    if (typeof originalFetch === 'function') {
      window.fetch = function (...args) {
        return Reflect.apply(originalFetch, this, args).then(response => {
          if (relevantURL(response.url)) void readResponse(response).catch(() => {});
          return response;
        });
      };
    }
  } catch {}
  try {
    const originalOpen = XMLHttpRequest.prototype.open;
    const attached = new WeakSet();
    XMLHttpRequest.prototype.open = function (...args) {
      const result = Reflect.apply(originalOpen, this, args);
      if (!attached.has(this)) {
        attached.add(this);
        this.addEventListener('load', () => {
          try {
            if (!relevantURL(this.responseURL)) return;
            if (this.responseType === 'json') receive(this.response);
            else if (!this.responseType || this.responseType === 'text') receiveText(this.responseText);
          } catch {}
        });
      }
      return result;
    };
  } catch {}
  try {
    const OriginalSocket = window.WebSocket;
    if (OriginalSocket) {
      window.WebSocket = new Proxy(OriginalSocket, {
        construct(target, args, newTarget) {
          const socket = Reflect.construct(target, args, newTarget);
          if (relevantURL(String(args[0]))) {
            socket.addEventListener('message', event => {
              try {
                if (typeof event.data === 'string') receiveText(event.data);
                else if (event.data instanceof Blob && event.data.size <= MAX_BYTES) void event.data.text().then(receiveText).catch(() => {});
                else if (event.data instanceof ArrayBuffer && event.data.byteLength <= MAX_BYTES) receiveText(new TextDecoder().decode(event.data));
              } catch {}
            });
          }
          return socket;
        }
      });
    }
  } catch {}

  function schedule() {
    if (timer || !document.body) return;
    timer = setTimeout(() => { timer = null; scan(); }, 70);
  }
  function mark(element, kind, hide) {
    const attribute = kind === 'profile' ? 'data-scf-masked' : 'data-scf-hidden';
    if (hide && !element.hasAttribute(attribute)) element.setAttribute(attribute, '');
    else if (!hide && element.hasAttribute(attribute)) element.removeAttribute(attribute);
  }
  function labelMatch(profile) {
    for (const row of profile.querySelectorAll('profile-cruiser-stats-row')) {
      const label = row.querySelector('.profile-cruiser-stats-row-title');
      if (core.normalize(label?.textContent) !== 'my comfort levels') continue;
      const badges = [...row.querySelectorAll('profile-cruiser-stats-badge')];
      if (!badges.length) return undefined;
      return badges.some(badge => core.normalize(badge.textContent) === 'no pnp');
    }
    return undefined;
  }
  function currentUserId() {
    return document.querySelector('.marker-container.current-visitor[id]')?.id;
  }
  function scan() {
    if (!document.body) return;
    mount();
    const now = Date.now();
    for (const [id, record] of known) if (now - record.time > MAX_AGE_MS) known.delete(id);
    const ownId = currentUserId();
    const ownProfileRoute = /\/profiles?\/[^/]+\/me(?:\/|$)|\/profile\/me(?:\/|$)/.test(location.pathname);
    const profiles = [...document.querySelectorAll(profileRoots)];
    for (const profile of profiles) {
      const id = profile.id.slice('profile-'.length);
      if (ownProfileRoute || id === ownId) continue;
      const match = labelMatch(profile);
      if (match !== undefined) note(id, match);
    }
    // Reconcile every marked element, including reused or detached/reinserted profile views.
    for (const element of document.querySelectorAll('[data-scf-hidden]')) {
      if (!element.matches(markers) || !enabled || !known.get(element.id)?.match || element.id === ownId) mark(element, 'marker', false);
    }
    for (const element of document.querySelectorAll('[data-scf-masked]')) {
      const profile = profiles.find(p => (p.closest('app-profile') || p) === element);
      if (!profile || !enabled || ownProfileRoute || profile.id.slice(8) === ownId || !known.get(profile.id.slice(8))?.match) mark(element, 'profile', false);
    }
    const seenIds = new Set(), hiddenIds = new Set(), checkedIds = new Set();
    for (const marker of document.querySelectorAll(markers)) {
      const id = marker.id;
      if (!core.validId(id) || marker.classList.contains('current-visitor') || id === ownId) continue;
      seenIds.add(id);
      if (known.has(id)) checkedIds.add(id);
      const hide = enabled && known.get(id)?.match === true;
      mark(marker, 'marker', hide);
      if (hide) hiddenIds.add(id);
    }
    let maskedProfile = false;
    for (const profile of profiles) {
      const id = profile.id.slice(8);
      const hide = enabled && !ownProfileRoute && id !== ownId && known.get(id)?.match === true;
      mark(profile.closest('app-profile') || profile, 'profile', hide);
      if (hide) maskedProfile = true;
    }
    updateUI({ hidden: hiddenIds.size, checked: checkedIds.size, unknown: seenIds.size - checkedIds.size, maskedProfile });
  }
  function setEnabled(value) {
    enabled = value;
    try { localStorage.setItem(PREF, String(enabled)); } catch {}
    scan();
  }
  function mount() {
    if (!style?.isConnected) {
      style = document.createElement('style');
      style.id = 'scf-page-style-v1';
      style.textContent = '[data-scf-hidden]{display:none!important;pointer-events:none!important}[data-scf-masked]{visibility:hidden!important;pointer-events:none!important}[data-scf-masked] *{visibility:hidden!important;pointer-events:none!important}';
      (document.head || document.documentElement).append(style);
    }
    if (host?.isConnected) return;
    host = document.createElement('div');
    host.id = 'scf-controls-v1';
    // The shadow root keeps site styling out and prevents our labels being detected as profile data.
    shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host{all:initial;position:fixed;right:12px;bottom:calc(78px + env(safe-area-inset-bottom,0px));z-index:2147483646;color:#f4f4f6;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color-scheme:dark}
        *{box-sizing:border-box}button,a{font:inherit}button{cursor:pointer}button:focus-visible,a:focus-visible{outline:3px solid #b9a1ff;outline-offset:3px}
        #chip{display:block;margin-left:auto;min-height:44px;padding:10px 15px;background:#24202e;color:#fff;border:1px solid #746585;border-radius:24px;box-shadow:0 4px 20px #0005;font-weight:600}
        #panel{width:min(320px,calc(100vw - 24px));background:#17151d;border:1px solid #494151;border-radius:18px;padding:18px;margin-bottom:10px;box-shadow:0 12px 40px #0007}
        #panel[hidden],#notice[hidden]{display:none}header{display:flex;gap:10px;align-items:center;justify-content:space-between}h2{font-size:17px;line-height:1.3;margin:0}#close{border:0;background:transparent;color:#ddd;min-height:44px;min-width:44px;font-size:25px}
        p{margin:10px 0;color:#c7c2d0;font-size:13px}.rule{color:#fff;font-size:15px;margin:14px 0}.actions{display:flex;gap:10px}#toggle,.secondary{min-height:44px;border:1px solid #736189;border-radius:12px;padding:9px 13px;background:#aa89e9;color:#18101f;font-weight:600}#toggle{width:100%}.secondary{background:#302737;color:#fff;text-decoration:none;text-align:center;flex:1}
        #status{color:#d9c9f5;font-weight:600}#notice{position:fixed;top:35vh;left:50vw;transform:translateX(-50%);width:min(330px,calc(100vw - 32px));padding:22px;border-radius:18px;background:#201a29;border:1px solid #76618d;box-shadow:0 15px 60px #0008;text-align:center}#notice h2{margin-bottom:8px}#notice .actions{margin-top:18px}
        small{color:#aaa2b6;font-size:12px}a{color:#d9c9f5}
      </style>
      <section id="notice" hidden aria-label="Filtered profile">
        <h2>Profile filtered</h2><p>“No PNP” is selected in My Comfort Levels.</p>
        <div class="actions"><a class="secondary" href="/">Back to map</a><button class="secondary" id="pause-notice">Pause filter</button></div>
      </section>
      <section id="panel" hidden aria-label="Comfort filter settings">
        <header><h2>Comfort filter</h2><button id="close" aria-label="Close filter settings">×</button></header>
        <p class="rule">Hide profiles with <strong>“No PNP”</strong><br>in <strong>My Comfort Levels</strong>.</p>
        <button id="toggle" type="button" aria-pressed="true">Filter on · Tap to pause</button>
        <p id="status" role="status" aria-live="polite"></p>
        <p id="coverage"></p>
        <p>Checks information Sniffies loads as you browse. Profiles stay visible until their comfort levels are available.</p>
        <small>Local display filter. No profile requests, account blocks, or data uploads. Matches are remembered only in this tab.</small>
      </section>
      <button id="chip" type="button" aria-expanded="false" aria-controls="panel">Filter on · 0 hidden</button>`;
    document.documentElement.append(host);
    const showPanel = value => {
      panelOpen = value;
      shadow.getElementById('panel').hidden = !value;
      shadow.getElementById('chip').setAttribute('aria-expanded', String(value));
      if (value) shadow.getElementById('close').focus();
      else shadow.getElementById('chip').focus();
    };
    shadow.getElementById('chip').addEventListener('click', () => showPanel(!panelOpen));
    shadow.getElementById('close').addEventListener('click', () => showPanel(false));
    shadow.getElementById('toggle').addEventListener('click', () => setEnabled(!enabled));
    shadow.getElementById('pause-notice').addEventListener('click', () => setEnabled(false));
    shadow.addEventListener('keydown', event => { if (event.key === 'Escape' && panelOpen) showPanel(false); });
  }
  function updateUI({ hidden, checked, unknown, maskedProfile }) {
    const text = (id, value) => { const el = shadow.getElementById(id); if (el.textContent !== value) el.textContent = value; };
    text('chip', enabled ? `Filter on · ${hidden} hidden` : 'Filter paused');
    text('toggle', enabled ? 'Filter on · Tap to pause' : 'Filter paused · Tap to turn on');
    shadow.getElementById('toggle').setAttribute('aria-pressed', String(enabled));
    text('status', enabled ? `${hidden} map profile${hidden === 1 ? '' : 's'} hidden` : 'Filter paused — profiles restored');
    text('coverage', checked + unknown ? `${checked} checked · ${unknown} awaiting comfort levels on this map.` : networkSeen ? 'Waiting for profiles on the map.' : 'Waiting for profile information. Refresh Sniffies once after installation.');
    shadow.getElementById('notice').hidden = !maskedProfile;
    if (maskedProfile && !lastProfileNotice) shadow.getElementById('pause-notice').focus();
    lastProfileNotice = maskedProfile;
  }
  function start() {
    scan();
    observer = new MutationObserver(records => {
      if (records.some(record => record.target !== host && !host?.contains(record.target))) schedule();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['id', 'data-testid'] });
  }
  window.addEventListener('storage', event => { if (event.key === PREF) { enabled = event.newValue !== 'false'; schedule(); } });
  window.addEventListener('pageshow', schedule);
  window.addEventListener('popstate', schedule);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
