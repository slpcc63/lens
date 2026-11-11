(() => {
  'use strict';
  if (window.top !== window.self || document.getElementById('scf-controls-v1')) return;
  if (window.__sniffiesComfortFilterV1) return;
  window.__sniffiesComfortFilterV1 = true;
  const core = createComfortCore();
  const PREF = 'sniffies-comfort-filter.enabled.v1';
  const SETTINGS = 'sniffies-comfort-filter.settings.v2';
  const MAX_BYTES = 4 * 1024 * 1024, MAX_RECORDS = 10000, MAX_AGE_MS = 2 * 60 * 60 * 1000;
  const markers = '.marker-container.user[id], [data-testid="markerUserContainer"][id], app-cruisers-carousel app-cruiser-card [data-testid="cruiserCard"][id]';
  const profileRoots = 'app-profile [id^="profile-"]';
  const diagnostics = {fetch:0, xhr:0, socket:0, tooLarge:0, mapLists:0};
  const networkIds = new Set();
  const known = new Map(); // Only selected stats and presence times, in this tab's memory.
  let enabled = true, config = core.defaults();
  let host, shadow, style, timer, observer, activityTimer;
  let panelOpen = false, networkSeen = false, displayedUnits = 'imperial';
  try { enabled = localStorage.getItem(PREF) !== 'false'; config = core.sanitizeConfig(JSON.parse(localStorage.getItem(SETTINGS))); } catch {}
  function note(id, patch) {
    if (!core.validId(id) || !patch || typeof patch !== 'object') return;
    const entry = known.get(id) || {values:{},seen:{}};
    for (const [key,value] of Object.entries(patch)) {
      // A delayed snapshot must not undo a more recent connection/disconnection event.
      if (['connectUpdateTime','disconnectTime'].includes(key) && typeof entry.values[key] === 'number' && (value === null || value < entry.values[key])) continue;
      entry.values[key] = value; entry.seen[key] = Date.now();
    }
    known.delete(id); known.set(id,entry);
    while (known.size > MAX_RECORDS) known.delete(known.keys().next().value);
  }
  function receive(payload) {
    try {
      const facts = core.recordsFrom(payload);
      if (!facts.size) return;
      networkSeen = true;
      for (const [id,patch] of facts) { note(id,patch); networkIds.add(id); }
      while (networkIds.size > MAX_RECORDS) networkIds.delete(networkIds.values().next().value);
      schedule();
    } catch {}
  }
  function invalidatePresence() {
    for (const entry of known.values()) entry.values.presenceKnown = false;
    schedule();
  }

  function receiveText(text) {
    if (typeof text === 'string' && text.length > MAX_BYTES) { diagnostics.tooLarge++; schedule(); return; }
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
    diagnostics.fetch++;
    if (Number(response.headers.get('content-length') || 0) > MAX_BYTES) { diagnostics.tooLarge++; schedule(); return; }
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
        if (size > MAX_BYTES) { diagnostics.tooLarge++; schedule(); void reader.cancel().catch(() => {}); return; }
        text += decoder.decode(value, { stream: true });
      }
      receiveText(text + decoder.decode());
    } finally { reader.releaseLock(); }
  }
  // Safari userscripts can start after the app has retained a transport method.
  // Also observe the map list when the app decodes it, regardless of that method.
  // Only the two map-list envelopes verified in Sniffies' public app code qualify.
  // Use the already-decoded list, avoiding a second copy of a large startup response.
  try {
    const originalParse = JSON.parse;
    JSON.parse = function (...args) {
      const value = Reflect.apply(originalParse, this, args);
      try {
        const list = value?.nearbyVisitors?.visitors ?? value?.result?.nearbyUsers;
        if (Array.isArray(list)) { diagnostics.mapLists++; receive(list); }
      } catch {}
      return value;
    };
  } catch {}
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
            diagnostics.xhr++; schedule();
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
            socket.addEventListener('close', invalidatePresence);
            socket.addEventListener('error', invalidatePresence);
            socket.addEventListener('message', event => {
              diagnostics.socket++; schedule();
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


  function enableMovingButton() {
    const key = 'sniffies-comfort-filter.button-position.v1';
    const chip = shadow.getElementById('chip'), panel = shadow.getElementById('panel');
    const insets = shadow.getElementById('safe-area');
    let position = null, drag = null, suppressClick = false;
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved && [saved.x,saved.y].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1)) position = saved;
    } catch {}
    const clamp = (n,min,max) => Math.max(min,Math.min(Math.max(min,max),n));
    function bounds() {
      const view = window.visualViewport;
      const safe = getComputedStyle(insets);
      const left = (view?.offsetLeft || 0) + 12 + parseFloat(safe.paddingLeft || 0);
      const top = (view?.offsetTop || 0) + 12 + parseFloat(safe.paddingTop || 0);
      const right = (view?.offsetLeft || 0) + (view?.width || window.innerWidth) - 12 - parseFloat(safe.paddingRight || 0);
      const bottom = (view?.offsetTop || 0) + (view?.height || window.innerHeight) - 12 - parseFloat(safe.paddingBottom || 0);
      return {left,top,right,bottom};
    }
    function place(left,top,b = bounds()) {
      chip.style.maxWidth = Math.max(44,b.right-b.left)+'px';
      const r = chip.getBoundingClientRect();
      const x = clamp(left,b.left,b.right-r.width), y = clamp(top,b.top,b.bottom-r.height);
      Object.assign(host.style,{left:x+'px',top:y+'px',right:'auto',bottom:'auto'});
      return {x:(x-b.left)/Math.max(1,b.right-b.left-r.width),y:(y-b.top)/Math.max(1,b.bottom-b.top-r.height)};
    }
    function placePanel(b = bounds()) {
      if (panel.hidden) return;
      panel.style.width = Math.min(360,b.right-b.left)+'px';
      const r = chip.getBoundingClientRect();
      const aboveSpace = Math.max(0,r.top-b.top-10), belowSpace = Math.max(0,b.bottom-r.bottom-10);
      const above = aboveSpace > belowSpace;
      panel.style.maxHeight = Math.max(0,above ? aboveSpace : belowSpace)+'px';
      const p = panel.getBoundingClientRect();
      panel.style.left = clamp(r.right-p.width,b.left,b.right-p.width)+'px';
      panel.style.top = (above ? r.top-p.height-10 : r.bottom+10)+'px';
    }
    function layout() {
      if (!host.isConnected || drag) return;
      const b = bounds();
      chip.style.maxWidth = Math.max(44,b.right-b.left)+'px';
      const r = chip.getBoundingClientRect();
      if (position) place(b.left+position.x*Math.max(0,b.right-b.left-r.width),b.top+position.y*Math.max(0,b.bottom-b.top-r.height),b);
      else place(b.right-r.width,b.bottom-r.height-(window.innerHeight < 500 ? 0 : 66),b);
      placePanel(b);
    }
    function save() { try { localStorage.setItem(key,JSON.stringify(position)); } catch {} }
    chip.addEventListener('pointerdown',event => {
      if (event.isPrimary === false || event.button !== 0) return;
      suppressClick = false;
      const r = chip.getBoundingClientRect();
      drag = {id:event.pointerId,startX:event.clientX,startY:event.clientY,left:r.left,top:r.top,moved:false,previous:position};
      try { chip.setPointerCapture(event.pointerId); } catch {}
      event.stopPropagation();
    });
    chip.addEventListener('pointermove',event => {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX-drag.startX, dy = event.clientY-drag.startY;
      if (!drag.moved && Math.hypot(dx,dy) < 7) return;
      drag.moved = true; suppressClick = true;
      chip.classList.add('dragging');
      position = place(drag.left+dx,drag.top+dy);
      placePanel();
      event.preventDefault(); event.stopPropagation();
    });
    function finish(event,cancelled) {
      if (!drag || event.pointerId !== drag.id) return;
      const finished = drag; drag = null;
      chip.classList.remove('dragging');
      if (cancelled) position = finished.previous;
      else if (finished.moved) save();
      try { if (chip.hasPointerCapture(event.pointerId)) chip.releasePointerCapture(event.pointerId); } catch {}
      layout(); event.stopPropagation();
    }
    chip.addEventListener('pointerup',event => finish(event,false));
    chip.addEventListener('pointercancel',event => finish(event,true));
    chip.addEventListener('lostpointercapture',event => finish(event,true));
    // A drag must not also open/close the settings. A fresh tap or keyboard click still works.
    chip.addEventListener('click',event => {
      if (suppressClick && event.detail !== 0) { event.preventDefault(); event.stopImmediatePropagation(); }
      suppressClick = false;
    },true);
    chip.addEventListener('keydown',event => {
      if (!event.altKey || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const r = chip.getBoundingClientRect();
      position = place(r.left+(event.key === 'ArrowLeft' ? -20 : event.key === 'ArrowRight' ? 20 : 0),r.top+(event.key === 'ArrowUp' ? -20 : event.key === 'ArrowDown' ? 20 : 0));
      save(); placePanel();
    });
    shadow.getElementById('reset-position').addEventListener('click',() => {
      position = null;
      try { localStorage.removeItem(key); } catch {}
      layout();
    });
    window.addEventListener('resize',layout);
    window.visualViewport?.addEventListener('resize',layout);
    window.visualViewport?.addEventListener('scroll',layout);
    // Button labels change with the hidden count; re-clamp after their width changes.
    if (window.ResizeObserver) new ResizeObserver(layout).observe(chip);
    layout();
    return layout;
  }

  const RULES = 'sniffies-comfort-filter.rules.v1';
  const PREFERENCE_RANGES = 'sniffies-comfort-filter.preference-ranges.v1';
  const groupNames = {filters:'Filters',top:'Top Preferences',bottom:'Bottom Preferences'};
  const comfortRuleAttributes = core.ruleAttributes.filter(([id]) => id.startsWith('comfort:'));
  let activeRuleGroup = 'filters', ruleGroups = core.sanitizeRuleGroups(null);
  const emptyRanges = () => Object.fromEntries(Object.keys(core.ranges).map(key => [key,[null,null]]));
  const sanitizePreferenceRanges = value => {
    const result = {top:emptyRanges(),bottom:emptyRanges()};
    for (const group of ['top','bottom']) {
      const sanitized = core.sanitizeConfig(value?.[group]);
      for (const key of Object.keys(core.ranges)) result[group][key] = sanitized[key];
    }
    return result;
  };
  let preferenceRanges = sanitizePreferenceRanges(null);
  function withoutRuleFields(value) {
    return {...value,comfort:{},bodies:[],positions:[],activity:'any'};
  }
  try {
    const savedRules = JSON.parse(localStorage.getItem(RULES));
    if (savedRules) ruleGroups = core.sanitizeRuleGroups(savedRules);
    else {
      ruleGroups.filters = core.rulesFromConfig(config);
      localStorage.setItem(RULES,JSON.stringify(ruleGroups));
    }
    config = withoutRuleFields(config);
    localStorage.setItem(SETTINGS,JSON.stringify(config));
  } catch { config = withoutRuleFields(config); }
  try { preferenceRanges = sanitizePreferenceRanges(JSON.parse(localStorage.getItem(PREFERENCE_RANGES))); } catch {}
  function savePreferenceRanges(next = preferenceRanges) {
    preferenceRanges = sanitizePreferenceRanges(next);
    try { localStorage.setItem(PREFERENCE_RANGES,JSON.stringify(preferenceRanges)); } catch {}
    schedule();
  }
  function activeFormConfig() {
    return activeRuleGroup === 'filters' ? config : {...core.defaults(),...preferenceRanges[activeRuleGroup],units:config.units,missing:config.missing};
  }
  function ruleLabel(rule) {
    const label = core.ruleAttributes.find(([id]) => id === rule.attribute)?.[1] || rule.attribute;
    return `${rule.condition === 'has' ? 'Has' : 'Doesn’t have'} · ${label}`;
  }
  function saveRuleGroups(next = ruleGroups) {
    ruleGroups = core.sanitizeRuleGroups(next);
    try { localStorage.setItem(RULES,JSON.stringify(ruleGroups)); } catch {}
    renderRuleBuilder(); schedule();
  }
  function renderRuleBuilder() {
    if (!shadow) return;
    for (const button of shadow.querySelectorAll('[data-rule-group]')) {
      const selected = button.dataset.ruleGroup === activeRuleGroup;
      button.setAttribute('aria-selected',String(selected)); button.tabIndex = selected ? 0 : -1;
    }
    const list = shadow.getElementById('rule-list');
    if (!list) return;
    list.replaceChildren();
    const rules = ruleGroups[activeRuleGroup], comfortRules = rules.filter(rule => rule.attribute.startsWith('comfort:'));
    for (const input of shadow.querySelectorAll('[data-category-rule]')) {
      const [domain,id] = input.dataset.categoryRule.split(':');
      input.checked = rules.some(rule => rule.condition === 'has' && rule.attribute === `${domain}:${id}`);
    }
    const activity = rules.find(rule => rule.condition === 'has' && rule.attribute.startsWith('activity:'))?.attribute.split(':')[1] || 'any';
    if (shadow.getElementById('activity')) shadow.getElementById('activity').value = activity;
    if (!comfortRules.length) {
      const empty = document.createElement('p'); empty.className = 'hint';
      empty.textContent = 'No comfort-level rules in this group.';
      list.append(empty);
    }
    comfortRules.forEach(rule => {
      const index = rules.indexOf(rule);
      const row = document.createElement('div'); row.className = 'rule-row';
      const text = document.createElement('span'); text.textContent = ruleLabel(rule);
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'rule-remove'; remove.textContent = '×'; remove.setAttribute('aria-label','Remove '+ruleLabel(rule));
      remove.addEventListener('click',() => { const next = structuredClone(ruleGroups); next[activeRuleGroup].splice(index,1); saveRuleGroups(next); });
      row.append(text,remove); list.append(row);
    });
  }
  function addSelectedRule() {
    const condition = shadow.getElementById('rule-condition').value;
    const attribute = shadow.getElementById('rule-attribute').value;
    const duplicate = ruleGroups[activeRuleGroup].some(rule => rule.condition === condition && rule.attribute === attribute);
    const status = shadow.getElementById('rule-status');
    if (duplicate) { status.textContent = 'That rule is already in this group.'; return; }
    const next = structuredClone(ruleGroups); next[activeRuleGroup].push({condition,attribute});
    status.textContent = 'Rule added.'; saveRuleGroups(next);
  }
  function replaceCategoryRules(domain,values) {
    const next = structuredClone(ruleGroups);
    next[activeRuleGroup] = next[activeRuleGroup].filter(rule => !rule.attribute.startsWith(domain+':'));
    for (const value of values) next[activeRuleGroup].push({condition:'has',attribute:`${domain}:${value}`});
    saveRuleGroups(next);
  }
  function ruleActivityEnabled() {
    return Object.values(ruleGroups).some(rules => rules.some(rule => rule.attribute.startsWith('activity:')));
  }

  const FAVORITES = 'sniffies-comfort-filter.favorites.v1';
  let favorites = [];
  try { favorites = core.sanitizeFavorites(JSON.parse(localStorage.getItem(FAVORITES))); } catch {}
  function writeFavorites(next, status) {
    const clean = core.sanitizeFavorites(next);
    try { localStorage.setItem(FAVORITES,JSON.stringify(clean)); }
    catch { status.textContent = 'Could not save. Browser storage may be full or unavailable.'; return false; }
    favorites = clean;
    renderFavorites(); schedule();
    return true;
  }
  function saveFriend(id, name, status, url) {
    const prior = favorites.find(friend => friend.id === id) || {};
    const clean = core.sanitizeFavorites([{...prior,id,name,url:url || prior.url,createdAt:prior.createdAt || new Date().toISOString(),updatedAt:new Date().toISOString()}])[0];
    if (!clean) { status.textContent = 'Enter a name for this friend.'; return false; }
    if (!favorites.some(friend => friend.id === id) && favorites.length >= 500) { status.textContent = 'Your list is full. Remove a friend before adding another.'; return false; }
    return writeFavorites([...favorites.filter(friend => friend.id !== id),clean],status);
  }
  function renderFavorites() {
    if (!shadow) return;
    const list = shadow.getElementById('favorites-list');
    const summary = shadow.getElementById('favorites-summary');
    if (!list) return;
    summary.textContent = `⭐ Favorites · ${favorites.length}`;
    list.replaceChildren();
    if (!favorites.length) { const hint = document.createElement('p'); hint.textContent = 'Tap ☆ in a profile’s corner to save a friend.'; list.append(hint); return; }
    for (const friend of [...favorites].sort((a,b) => a.name.localeCompare(b.name))) {
      const row = document.createElement('div'); row.className = 'favorite-row';
      const name = document.createElement('input'); name.type = 'text'; name.maxLength = 80; name.value = friend.name; name.setAttribute('aria-label','Name for '+friend.name);
      const actions = document.createElement('div'); actions.className = 'actions';
      const open = document.createElement(friend.url ? 'a' : 'span'); open.className = 'secondary'; open.textContent = friend.url ? 'Open' : 'Open unavailable';
      if (friend.url) { open.href = friend.url; open.setAttribute('aria-label','Open '+friend.name); }
      else { open.setAttribute('aria-disabled','true'); open.title = 'Open this profile and save it again to repair its link.'; }
      const save = document.createElement('button'); save.type = 'button'; save.className = 'secondary'; save.textContent = 'Save name';
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'secondary'; remove.textContent = 'Remove'; remove.setAttribute('aria-label','Remove '+friend.name);
      const status = shadow.getElementById('favorites-status');
      save.addEventListener('click',() => { if (saveFriend(friend.id,name.value,status)) status.textContent = 'Name saved.'; });
      name.addEventListener('keydown',event => { if (event.key === 'Enter') { event.preventDefault(); save.click(); } });
      remove.addEventListener('click',() => { if (writeFavorites(favorites.filter(item => item.id !== friend.id),status)) status.textContent = 'Friend removed.'; });
      actions.append(open,save,remove); row.append(name,actions); list.append(row);
    }
  }
  function repairFavoriteLinks(verifiedIds) {
    let changed = false;
    const next = favorites.map(friend => {
      if (friend.url || !verifiedIds.has(friend.id)) return friend;
      changed = true; return {...friend,url:`/profile/${friend.id}`,updatedAt:new Date().toISOString()};
    });
    if (changed) writeFavorites(next,shadow?.getElementById('favorites-status') || {textContent:''});
  }
  let openFavoriteEditor;
  const profileStars = new Map();
  function placeProfileStars() {
    const view = window.visualViewport;
    const left = view?.offsetLeft || 0, top = view?.offsetTop || 0;
    const right = left + (view?.width || innerWidth), bottom = top + (view?.height || innerHeight);
    for (const [profile,entry] of profileStars) {
      const r = profile.getBoundingClientRect();
      const x = Math.min(r.right,right)-52, y = Math.max(r.top,top)+8;
      entry.host.hidden = !profile.isConnected || r.width < 52 || r.height < 52 || x < Math.max(left,r.left) || y+44 > Math.min(bottom,r.bottom) || getComputedStyle(profile).visibility === 'hidden';
      entry.host.style.left = x+'px'; entry.host.style.top = y+'px';
    }
  }
  function syncFavoriteButtons(profileRecords, ownId, ownProfileRoute) {
    const wanted = new Set(profileRecords.filter(item => core.validId(item.id) && item.id !== ownId && !ownProfileRoute).map(item => item.profile));
    for (const [profile,entry] of profileStars) if (!wanted.has(profile)) { entry.host.remove(); profileStars.delete(profile); }
    for (const profile of wanted) {
      const record = profileRecords.find(item => item.profile === profile), id = record.id;
      let entry = profileStars.get(profile);
      if (!entry) {
        const starHost = document.createElement('div'); starHost.className = 'scf-profile-star-v1';
        Object.assign(starHost.style,{position:'fixed',width:'44px',height:'44px',zIndex:'2147483645'});
        const root = starHost.attachShadow({mode:'open'});
        root.innerHTML = `<style>button{box-sizing:border-box;width:42px;height:42px;padding:0;border:1px solid #ffb547;border-radius:14px;background:#0b1023 url("${LENS_ICONS.star}") center/27px no-repeat;font-size:0;cursor:pointer;box-shadow:0 4px 14px #0b102388;touch-action:manipulation}button:focus-visible{outline:3px solid #ffb547;outline-offset:2px}</style><button type="button" id="favorite-star" aria-label="Save profile" aria-pressed="false">☆</button>`;
        entry = {host:starHost,button:root.getElementById('favorite-star'),id}; profileStars.set(profile,entry);
        // A sibling overlay keeps even capture-phase profile/photo handlers out of the event path.
        for (const type of ['pointerdown','pointerup','mousedown','mouseup','touchstart','touchend','dblclick']) starHost.addEventListener(type,event => event.stopPropagation());
        entry.button.addEventListener('click',event => { event.preventDefault(); event.stopPropagation(); openFavoriteEditor(entry.id,entry.button,entry.url); });
        document.documentElement.append(starHost);
      }
      entry.id = id; entry.url = record.url;
      const saved = favorites.some(friend => friend.id === id), symbol = saved ? '★' : '☆';
      if (entry.button.textContent !== symbol) entry.button.textContent = symbol;
      entry.button.setAttribute('aria-pressed',String(saved));
      entry.button.setAttribute('aria-label',saved ? 'Edit saved friend' : 'Save friend');
    }
    placeProfileStars();
  }
  function syncFavoriteMarkers(mapMarkers, ownId) {
    const saved = new Set(favorites.map(friend => friend.id));
    for (const marker of mapMarkers) {
      const isFavorite = saved.has(marker.id) && marker.id !== ownId && !marker.classList.contains('current-visitor');
      let badge = marker.querySelector(':scope > .scf-favorite-badge');
      if (!isFavorite) { marker.removeAttribute('data-scf-favorite'); badge?.remove(); continue; }
      if (!marker.hasAttribute('data-scf-favorite')) marker.setAttribute('data-scf-favorite','');
      if (!badge) { badge = document.createElement('span'); badge.className = 'scf-favorite-badge'; badge.textContent = '★'; badge.setAttribute('role','img'); badge.setAttribute('aria-label','Saved friend'); badge.title = 'Saved friend'; marker.append(badge); }
    }
  }
  let starLayoutFrame = 0;
  const scheduleStarLayout = () => { if (!starLayoutFrame) starLayoutFrame = requestAnimationFrame(() => { starLayoutFrame = 0; placeProfileStars(); }); };
  window.addEventListener('scroll',scheduleStarLayout,{capture:true,passive:true});
  window.addEventListener('resize',scheduleStarLayout);
  window.visualViewport?.addEventListener('resize',scheduleStarLayout);
  window.visualViewport?.addEventListener('scroll',scheduleStarLayout);
  window.addEventListener('storage',event => {
    if (event.key !== FAVORITES && event.key !== null) return;
    try { favorites = core.sanitizeFavorites(JSON.parse(event.key === null ? null : event.newValue)); renderFavorites(); schedule(); } catch {}
  });

  function schedule() {
    if (timer || !document.body) return;
    timer = setTimeout(() => { timer = null; scan(); },70);
  }
  function scheduleClock() {
    clearTimeout(activityTimer);
    if (enabled && ruleActivityEnabled() && !document.hidden) activityTimer = setTimeout(() => { scan(); },15000);
  }
  // Hide the full map hit area or carousel item, including its focusable controls.
  const hiddenTargets = new Set();
  const previousInert = new WeakMap();
  function mark(element, hide) {
    if (hide) {
      if (!hiddenTargets.has(element)) { previousInert.set(element,element.inert); hiddenTargets.add(element); }
      if (!element.hasAttribute('data-scf-hidden')) element.setAttribute('data-scf-hidden','');
      element.inert = true;
    } else {
      element.removeAttribute('data-scf-hidden');
      if (hiddenTargets.has(element)) element.inert = previousInert.get(element) || false;
      hiddenTargets.delete(element); previousInert.delete(element);
    }
  }
  function mapTarget(marker) {
    return marker.closest('app-cruiser-card') || marker.closest('.maplibregl-marker, .mapboxgl-marker') || marker;
  }
  function visiblePatch(profile) {
    const fields = {};
    for (const [key,testId] of [['age','ageStat'],['height','heightInCmStat'],['weight','weightInKgStat'],['endowment','endowmentStat'],['body','bodyStat'],['position','attitudeStat']]) {
      const el = profile.querySelector(`profile-stats [data-testid="${testId}"]`);
      if (el) fields[key] = el.textContent;
    }
    const patch = core.displayPatch(fields);
    for (const row of profile.querySelectorAll('profile-cruiser-stats-row')) {
      if (core.normalize(row.querySelector('.profile-cruiser-stats-row-title')?.textContent) !== 'my comfort levels') continue;
      const badges = [...row.querySelectorAll('profile-cruiser-stats-badge')];
      if (badges.length) patch.comfort = core.displayComfort(badges.map(b => b.textContent));
    }
    return patch;
  }
  function currentUserId() { return document.querySelector('.marker-container.current-visitor[id]')?.id; }
  function profileIdentity(profile) {
    const routeId = core.routeProfileId(location.pathname);
    if (routeId) return {profile,id:routeId,url:`/profile/${routeId}`};
    const candidate = profile.id.startsWith('profile-') ? profile.id.slice(8) : '';
    const verified = core.validId(candidate) && (networkIds.has(candidate) || known.has(candidate) || document.querySelector(`${markers.split(',').map(selector => `${selector.trim()}[id="${CSS.escape(candidate)}"]`).join(',')}`));
    return verified ? {profile,id:candidate,url:`/profile/${candidate}`} : {profile,id:null,url:null};
  }
  function setPreference(target,value) {
    if (!target) return;
    if (value) target.setAttribute('data-scf-preference',value); else target.removeAttribute('data-scf-preference');
  }
  function scan() {
    if (!document.body) return;
    mount();
    const now = Date.now();
    for (const [id,entry] of known) {
      for (const key of Object.keys(entry.values)) if (now-entry.seen[key] > MAX_AGE_MS) { delete entry.values[key]; delete entry.seen[key]; }
      if (!Object.keys(entry.values).length) known.delete(id);
    }
    const ownId = currentUserId();
    const ownProfileRoute = /\/profiles?\/[^/]+\/me(?:\/|$)|\/profile\/me(?:\/|$)/.test(location.pathname);
    const profiles = [...document.querySelectorAll(profileRoots)];
    const profileRecords = profiles.map(profileIdentity);
    for (const {profile,id} of profileRecords) {
      if (!id || ownProfileRoute || id === ownId) continue;
      const patch = visiblePatch(profile);
      if (Object.keys(patch).length) note(id,patch);
    }
    const mapMarkers = [...document.querySelectorAll(markers)];
    const iconPositions = new Map();
    for (const marker of mapMarkers) {
      const icons = [...marker.querySelectorAll('app-sexual-position-icon [data-testid]')].map(el => el.getAttribute('data-testid'));
      const position = core.positionFromIcons(icons);
      if (!position) continue;
      if (iconPositions.has(marker.id) && iconPositions.get(marker.id) !== position) iconPositions.set(marker.id,null);
      else iconPositions.set(marker.id,position);
    }
    const verifiedIds = new Set([...networkIds,...mapMarkers.map(marker => marker.id).filter(core.validId)]);
    const routeId = core.routeProfileId(location.pathname); if (routeId) verifiedIds.add(routeId);
    repairFavoriteLinks(verifiedIds);
    syncFavoriteButtons(profileRecords,ownId,ownProfileRoute);
    syncFavoriteMarkers(mapMarkers,ownId);
    const results = new Map();
    const result = id => {
      const values = {...known.get(id)?.values};
      if (iconPositions.get(id)) values.position = iconPositions.get(id);
      if (!results.has(id)) {
        const legacy = core.evaluate(values,config,now);
        const filtered = core.evaluateRuleSet(values,ruleGroups.filters,now,config.missing);
        const top = core.combineScores(core.scoreRules(values,ruleGroups.top,now),core.scoreRanges(values,preferenceRanges.top));
        const bottom = core.combineScores(core.scoreRules(values,ruleGroups.bottom,now),core.scoreRanges(values,preferenceRanges.bottom));
        results.set(id,{hide:legacy.hide || filtered.hide,missing:[...new Set([...legacy.missing,...filtered.missing])],reasons:[...new Set([...legacy.reasons,...filtered.reasons])],top,bottom});
      }
      return results.get(id);
    };
    const desiredTargets = new Set();
    const seenIds = new Set(), hiddenIds = new Set(), checkedIds = new Set();
    let pinCount = 0, cardCount = 0, loadedCount = 0, mismatchHidden = 0, missingHidden = 0;
    for (const marker of mapMarkers) {
      const id = marker.id;
      if (!core.validId(id) || marker.classList.contains('current-visitor') || id === ownId) continue;
      if (marker.closest('app-cruiser-card')) cardCount++; else pinCount++;
      seenIds.add(id);
      const r = result(id);
      if (!r.missing.length) checkedIds.add(id);
      if (enabled && r.hide) {
        hiddenIds.add(id);
        if (r.reasons.length) mismatchHidden++;
        else if (r.missing.length) missingHidden++;
        // Mark the inner node as well as its wrapper for older layouts and recycled nodes.
        desiredTargets.add(marker); desiredTargets.add(mapTarget(marker));
      }
      const preference = enabled && !r.hide ? r.top.qualifies && r.bottom.qualifies ? 'both' : r.top.qualifies ? 'top' : r.bottom.qualifies ? 'bottom' : '' : '';
      const preferenceTarget = mapTarget(marker);
      setPreference(marker,preferenceTarget === marker ? preference : '');
      setPreference(preferenceTarget,preference);
    }
    for (const target of [...hiddenTargets]) if (!desiredTargets.has(target)) mark(target,false);
    for (const target of desiredTargets) mark(target,true);
    for (const id of seenIds) if (networkIds.has(id)) loadedCount++;
    for (const {profile,id} of profileRecords) {
      if (!id || id === ownId || ownProfileRoute) { setPreference(profile,''); continue; }
      const r = result(id), preference = enabled && !r.hide ? r.top.qualifies && r.bottom.qualifies ? 'both' : r.top.qualifies ? 'top' : r.bottom.qualifies ? 'bottom' : '' : '';
      setPreference(profile,preference);
    }
    // Opening a profile can supply missing details. Learn them for the map without covering the profile with an alert.
    updateUI({hidden:hiddenIds.size,checked:checkedIds.size,unknown:seenIds.size-checkedIds.size,pinCount,cardCount,loadedCount,mismatchHidden,missingHidden});
    scheduleClock();
  }
  function setEnabled(value) {
    enabled = value;
    try { localStorage.setItem(PREF,String(enabled)); } catch {}
    scan();
  }
  function saveConfig(value) {
    config = withoutRuleFields(core.sanitizeConfig(value));
    try { localStorage.setItem(SETTINGS,JSON.stringify(config)); } catch {}
    scan();
  }
  function showError(message) {
    const error = shadow.getElementById('error'); error.textContent = message; error.hidden = !message;
  }
  function readForm() {
    const draft = core.defaults();
    draft.comfort = {};
    draft.bodies = []; draft.positions = []; draft.activity = 'any';
    draft.units = displayedUnits;
    for (const key of Object.keys(core.ranges)) {
      try {
        const inputs = ['min','max'].map(side => shadow.getElementById(`${key}-${side}`).value);
        const exact = inputs.map(value => core.toCanonical(key,value,displayedUnits,false));
        if (exact[0] !== null && exact[1] !== null && exact[0] > exact[1]) throw new Error('Minimum cannot exceed maximum.');
        draft[key] = inputs.map(value => core.toCanonical(key,value,displayedUnits));
        if (draft[key][0] !== null && draft[key][1] !== null && draft[key][0] > draft[key][1]) throw new Error('Minimum cannot exceed maximum.');
      } catch (error) { throw new Error(key[0].toUpperCase()+key.slice(1)+': '+error.message); }
    }
    draft.missing = shadow.getElementById('missing').value;
    return draft;
  }
  function fillForm(draft = config) {
    displayedUnits = draft.units;
    shadow.getElementById('units').value = displayedUnits;
    if (shadow.getElementById('height-min')?.tagName === 'SELECT') {
      for (const [index,side] of ['min','max'].entries()) {
        const select = shadow.getElementById(`height-${side}`);
        select.replaceChildren(new Option(side === 'min' ? 'No minimum' : 'No maximum',''));
        const values = displayedUnits === 'imperial'
          ? Array.from({length:85},(_,i) => { const inches=i+24; return `${Math.floor(inches/12)}'${inches%12}"`; })
          : Array.from({length:216},(_,i) => String(i+60));
        for (const value of values) {
          select.add(new Option(displayedUnits === 'imperial' ? value : `${value} cm`,value));
        }
        if (draft.height[index] !== null) {
          const inches = Math.round(draft.height[index]/2.54);
          select.value = displayedUnits === 'imperial' ? `${Math.floor(inches/12)}'${inches%12}"` : String(draft.height[index]);
        }
      }
    }
    for (const key of Object.keys(core.ranges)) {
      for (const [index,side] of ['min','max'].entries()) shadow.getElementById(`${key}-${side}`).value = core.displayValue(key,draft[key][index],displayedUnits);
    }
    const imperial = displayedUnits === 'imperial';
    shadow.getElementById('height-label').textContent = imperial ? 'Height · feet / inches' : 'Height · centimeters';
    shadow.getElementById('weight-label').textContent = imperial ? 'Weight · lb' : 'Weight · kg';
    shadow.getElementById('endowment-label').textContent = imperial ? 'Endowment · inches' : 'Endowment · cm';
    shadow.getElementById('missing').value = draft.missing;
  }
  function mount() {
    if (!style?.isConnected) {
      style = document.createElement('style'); style.id = 'scf-page-style-v1';
      // Never change a map pin's positioning mode. MapLibre/Mapbox owns that
      // position and transform; overriding it makes badges appear detached while panning.
      style.textContent = `[data-scf-hidden],[data-scf-hidden] *{display:none!important;pointer-events:none!important}.scf-favorite-badge{position:absolute;top:-5px;right:-5px;z-index:5;width:22px;height:22px;border-radius:50%;background:#0b1023 url("${LENS_ICONS.star}") center/17px no-repeat;border:1px solid #ffb547;box-shadow:0 2px 8px #0b102399;font-size:0;pointer-events:none}[data-scf-preference="top"]{outline:3px solid #25d9ff!important;outline-offset:3px!important;box-shadow:0 0 0 5px #568bff66,0 0 15px 6px #25d9ff66!important}[data-scf-preference="bottom"]{outline:3px solid #9474ff!important;outline-offset:3px!important;box-shadow:0 0 0 5px #9474ff66,0 0 15px 6px #9474ff66!important}[data-scf-preference="both"]{outline:3px solid #568bff!important;outline-offset:3px!important;box-shadow:0 0 0 6px #9474ff,0 0 17px 8px #6e79ff88!important}`;
      (document.head || document.documentElement).append(style);
    }
    if (host?.isConnected) return;
    host = document.createElement('div'); host.id = 'scf-controls-v1';
    shadow = host.attachShadow({mode:'open'});
    const range = (key,label) => `<fieldset class="range"><legend id="${key}-label">${label}</legend><div class="pair">${key === 'height' ? `<select id="${key}-min" aria-label="Minimum ${key}"></select><span>to</span><select id="${key}-max" aria-label="Maximum ${key}"></select>` : `<input id="${key}-min" type="text" inputmode="decimal" placeholder="Minimum" aria-label="Minimum ${key}"><span>to</span><input id="${key}-max" type="text" inputmode="decimal" placeholder="Maximum" aria-label="Maximum ${key}">`}</div></fieldset>`;
    const choices = (domain,options) => options.map(([id,label]) => `<label class="choice"><input type="checkbox" data-category-rule="${domain}:${id}"><span>${label}</span></label>`).join('');
    shadow.innerHTML = `
      <style>
        :host{--navy:#0b1023;--surface:#151b33;--raised:#202947;--line:#344165;--text:#f7f8fc;--muted:#aeb8d1;--blue:#568bff;--violet:#9474ff;--amber:#ffb547;all:initial;position:fixed;right:12px;bottom:calc(72px + env(safe-area-inset-bottom,0px));z-index:2147483646;color:var(--text);font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color-scheme:dark}
        *{box-sizing:border-box}button,a,input,select{font:inherit}button{cursor:pointer}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid var(--amber);outline-offset:2px}[hidden]{display:none!important}
        #chip{position:relative;z-index:1;touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab;display:grid;place-items:center;margin-left:auto;width:48px;height:48px;padding:0;background:linear-gradient(145deg,#202947,#0b1023);border:1px solid #568bff;border-radius:16px;box-shadow:0 7px 24px #0b102399,0 0 0 3px #568bff22}#chip>img{width:31px;height:31px;object-fit:contain}#chip-count{position:absolute;right:-6px;top:-7px;min-width:21px;height:21px;padding:0 5px;display:grid;place-items:center;border-radius:11px;background:var(--amber);border:2px solid var(--navy);color:var(--navy);font-size:11px;font-weight:800}
        #chip.dragging{cursor:grabbing}#safe-area{position:absolute;visibility:hidden;pointer-events:none;width:0;height:0;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)}#panel{position:fixed;width:min(344px,calc(100vw - 20px));max-height:calc(100dvh - 132px - env(safe-area-inset-bottom,0px));background:linear-gradient(165deg,#18203b 0%,var(--navy) 72%);border:1px solid var(--line);border-radius:18px;margin-bottom:9px;box-shadow:0 18px 52px #060918c7;display:flex;flex-direction:column;overflow:hidden}
        header{display:flex;gap:5px;align-items:center;padding:7px 8px;border-bottom:1px solid var(--line);flex-shrink:0}.brand{min-width:0;margin-right:auto}.brand small{display:block;color:var(--amber);font-size:9px;font-weight:800;letter-spacing:.13em}.brand h2{font-size:17px;line-height:1.1;margin:2px 0 0}.icon-button{display:grid;place-items:center;width:36px;min-width:36px;height:36px;min-height:36px;padding:0;border:1px solid transparent;border-radius:11px;background:var(--raised);color:var(--text)}.icon-button img{width:23px;height:23px;object-fit:contain}#toggle[aria-pressed="false"]{border-color:var(--amber)}#close{background:transparent}#close img{width:20px;height:20px}
        #scroll{overflow:auto;overscroll-behavior:contain;padding:10px;-webkit-overflow-scrolling:touch}p{margin:7px 0;color:var(--muted);font-size:12px}.actions{display:flex;gap:7px}button,.secondary{min-height:40px;border:1px solid #7183b5;border-radius:10px;padding:8px 11px;background:linear-gradient(135deg,var(--blue),var(--violet));color:#fff;font-weight:700}.secondary{background:var(--raised);color:var(--text);text-decoration:none;text-align:center;flex:1}
        .status-card{padding:9px 10px;margin-bottom:9px;border:1px solid var(--line);border-radius:12px;background:#10172de6}.status-head{display:flex;align-items:center;gap:7px}.status-dot{width:8px;height:8px;border-radius:50%;background:#57d99a;box-shadow:0 0 0 3px #57d99a22}.status-dot.paused{background:var(--amber);box-shadow:0 0 0 3px #ffb54722}#status{color:var(--text);font-weight:750;margin:0}#blocking-summary{color:#d7def1;margin:4px 0 1px}#coverage{margin:1px 0;color:var(--muted)}.field-label{display:block;margin-top:11px;font-weight:700;font-size:12px}.hint{font-size:11px;color:var(--muted)}select,input[type=text]{width:100%;min-height:40px;border:1px solid #536188;border-radius:9px;background:#11182d;color:var(--text);padding:7px 8px;font-size:15px}select{margin:4px 0}input::placeholder{color:#8994af}
        fieldset{min-width:0;margin:12px 0 0;padding:0;border:0}legend{padding:0 0 5px;font-size:12px;font-weight:750}.pair{display:grid;grid-template-columns:minmax(0,1fr) 16px minmax(0,1fr);align-items:center;gap:5px}.pair span{text-align:center;color:var(--muted)}.rule-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin:0 0 9px}.rule-tabs button{min-height:36px;padding:5px 3px;font-size:11px;background:var(--raised);color:var(--text);border-color:var(--line)}.rule-tabs button[aria-selected="true"]{background:linear-gradient(135deg,var(--blue),var(--violet));border-color:#b9c7ff}.builder{display:grid;grid-template-columns:.9fr 1.4fr 40px;gap:5px;align-items:end}.builder .field-label{margin-top:0}.builder #add-rule{width:40px;padding:0;font-size:0;background:var(--raised) url("${LENS_ICONS.add}") center/25px no-repeat}.rule-row{display:flex;align-items:center;justify-content:space-between;gap:7px;padding:6px 3px;border-bottom:1px solid var(--line)}.rule-remove{min-width:40px;width:40px;padding:0;background:transparent url("${LENS_ICONS.remove}") center/24px no-repeat;font-size:0}.advanced{margin-top:12px;border-top:1px solid var(--line);padding-top:5px}.advanced summary{cursor:pointer;min-height:40px;padding:9px 0;font-weight:700}.checks{display:grid;grid-template-columns:1fr 1fr;gap:5px}.choice{display:flex;align-items:center;gap:6px;min-height:36px;padding:5px;border:1px solid var(--line);border-radius:9px}.choice input{width:17px;height:17px;accent-color:var(--violet)}.choice:has(input:checked){background:#2a3156;border-color:var(--violet)}.section-title{margin:13px 0 4px;font-weight:750;color:var(--text)}.settings-row{margin-bottom:10px}.help h3{margin:13px 0 3px;font-size:14px}
        #footer{padding:9px 10px;border-top:1px solid var(--line);flex-shrink:0;background:#10162a}#apply{flex:1}#reset{background:transparent;color:#d7def1}#error{color:#ffd9df;background:#51243a;padding:8px;border-radius:8px;font-size:12px;margin:0 0 8px}.diagnostics{margin-top:12px;border-top:1px solid var(--line);padding-top:6px}.diagnostics summary{cursor:pointer;min-height:40px;padding:9px 0}.diagnostics pre{font:11px/1.5 ui-monospace,SFMono-Regular,monospace;white-space:pre-wrap;color:var(--muted);user-select:text}
        .favorites{margin:0 0 9px;border:1px solid var(--line);border-radius:10px;padding:0 8px}.favorites summary{cursor:pointer;min-height:40px;padding:9px 0;font-weight:700}.favorite-row{padding:8px 0}.favorite-row .actions{margin-top:5px;flex-wrap:wrap}.favorite-row .secondary{font-size:12px;padding:7px}
        @media(max-height:500px){:host{bottom:10px}#panel{max-height:calc(100dvh - 68px)}}
        @media(prefers-color-scheme:light){:host{--navy:#f7f8fc;--surface:#fff;--raised:#e9edfa;--line:#cbd4eb;--text:#0b1023;--muted:#4e5a78;color-scheme:light}#panel{background:linear-gradient(165deg,#fff,#f1f4fc)}select,input[type=text],.status-card{background:#fff}.choice:has(input:checked){background:#e8e7ff}.secondary,.rule-tabs button{color:var(--text)}#footer{background:#f3f5fb}}
      </style>
      <span id="safe-area" aria-hidden="true"></span><section id="panel" hidden aria-label="Lens settings">
        <header><div class="brand"><small>DOXLE FAMILY</small><h2 id="panel-title">Lens</h2></div><button id="toggle" class="icon-button" type="button" aria-label="Pause Lens" aria-pressed="true"><img id="toggle-icon" src="${LENS_ICONS.pause}" alt=""></button><button id="settings-button" class="icon-button" type="button" aria-label="Open settings"><img src="${LENS_ICONS.settings}" alt=""></button><button id="help-button" class="icon-button" type="button" aria-label="Open help"><img src="${LENS_ICONS.help}" alt=""></button><button id="close" class="icon-button" aria-label="Close Lens"><img src="${LENS_ICONS.close}" alt=""></button></header>
        <div id="favorite-editor" hidden style="padding:16px;overflow:auto"><label class="field-label" for="friend-name">Name for this friend</label><input id="friend-name" type="text" maxlength="80" placeholder="e.g. Alex"><p id="friend-status" role="status" aria-live="polite"></p><div class="actions"><button id="save-friend" type="button">Save friend</button><button id="remove-friend" class="secondary" type="button" hidden>Remove</button></div></div>
        <div id="scroll"><div id="main-view">
          <section class="status-card" aria-label="Lens blocking status"><div class="status-head"><span id="status-dot" class="status-dot" aria-hidden="true"></span><p id="status" role="status" aria-live="polite"></p></div><p id="blocking-summary"></p><p id="coverage"></p></section>
          <details class="favorites" id="favorites-section"><summary id="favorites-summary">Saved · 0</summary><p class="hint">Saved on this device. A saved profile stays available even when Lens hides its map pin.</p><div id="favorites-list"></div><p id="favorites-status" role="status" aria-live="polite"></p></details>
          <div class="rule-tabs" role="tablist" aria-label="Rule groups">${Object.entries(groupNames).map(([id,label]) => `<button type="button" role="tab" data-rule-group="${id}" aria-selected="${id === 'filters'}">${label}</button>`).join('')}</div>
          <p class="section-title">Comfort levels</p><div class="builder"><label><span class="field-label">Condition</span><select id="rule-condition" aria-label="Condition"><option value="has">Has</option><option value="not">Doesn’t have</option></select></label><label><span class="field-label">Attribute</span><select id="rule-attribute" aria-label="Comfort level">${comfortRuleAttributes.map(([id,label]) => `<option value="${id}">${label.replace('Comfort: ','')}</option>`).join('')}</select></label><button id="add-rule" type="button" aria-label="Add comfort rule">+</button></div>
          <p id="rule-status" class="hint" role="status" aria-live="polite"></p><div id="rule-list"></div>
          <fieldset><legend>Body type</legend><div class="checks">${choices('body',core.bodies)}</div></fieldset>
          <fieldset><legend>Role / position</legend><div class="checks">${choices('position',core.positions)}</div></fieldset>
          <label class="field-label" for="activity">Activity</label><select id="activity">${core.activityOptions.map(([id,label]) => `<option value="${id}">${label}</option>`).join('')}</select>
          <details class="advanced"><summary>Ranges · age, height, weight, endowment</summary><p class="hint">Ranges apply to the selected tab. Each configured range counts as one preference when scoring Top or Bottom matches.</p>
            ${range('age','Age · years')}${range('height','Height · ft/in or total inches')}${range('weight','Weight · lb')}${range('endowment','Endowment · inches')}
          </details>
        </div><div id="settings-view" hidden><div class="settings-row"><label class="field-label" for="units">Units</label><select id="units"><option value="imperial">Feet / inches · pounds</option><option value="metric">Centimeters · kilograms</option></select></div><div class="settings-row"><label class="field-label" for="missing">When details are missing</label><select id="missing"><option value="show">Keep profiles visible</option><option value="hide">Hide until required details arrive</option></select></div><button id="reset-position" type="button" class="secondary">Reset Lens position</button><details class="diagnostics"><summary>Technical status · v1.5.0</summary><pre id="diagnostics"></pre></details></div>
        <div id="help-view" class="help" hidden><h3>What Lens blocks</h3><p>Filters hide profiles that do not match. The status card separates rule mismatches from profiles hidden while required details are still missing.</p><h3>Top and Bottom</h3><p>Electric blue marks Top matches, violet marks Bottom matches, and a dual ring marks profiles that qualify for both.</p><h3>Privacy</h3><p>Lens uses information already delivered to this browser. It makes no additional profile requests and uploads nothing.</p><h3>Moving Lens</h3><p>Drag the floating Lens button, or focus it and use Alt plus an arrow key.</p></div></div>
        <div id="footer"><p id="error" role="alert" hidden></p><div class="actions"><button id="reset" type="button">Reset</button><button id="apply" type="button">Apply filters</button></div></div>
      </section><button id="chip" title="Drag to move; tap to open Lens" type="button" aria-label="Open Lens" aria-expanded="false" aria-controls="panel"><img src="${LENS_ICONS.filter}" alt=""><span id="chip-count" hidden>0</span></button>`;
    document.documentElement.append(host);
    const positionControls = enableMovingButton();
    let editingFriend = null, returnFocus = null;
    const showView = view => {
      for (const id of ['main','settings','help']) shadow.getElementById(id+'-view').hidden = id !== view;
      shadow.getElementById('footer').hidden = view !== 'main';
      shadow.getElementById('panel-title').textContent = view === 'main' ? 'Lens' : view[0].toUpperCase()+view.slice(1);
    };
    const showPanel = (value, mode = 'filters') => {
      const editing = value && mode === 'favorite';
      shadow.getElementById('scroll').hidden = editing;
      shadow.getElementById('footer').hidden = editing;
      shadow.getElementById('favorite-editor').hidden = !editing;
      shadow.getElementById('panel-title').textContent = editing ? 'Save profile' : 'Lens';
      shadow.getElementById('panel').setAttribute('aria-label',editing ? 'Save profile' : 'Lens settings');
      if (!editing) editingFriend = null;
      panelOpen = value;
      shadow.getElementById('panel').hidden = !value;
      shadow.getElementById('chip').setAttribute('aria-expanded',String(value));
      if (value && !editing) { showView('main'); fillForm(activeFormConfig()); showError(''); shadow.getElementById('close').focus(); }
      else if (!value) { (returnFocus?.isConnected ? returnFocus : shadow.getElementById('chip')).focus(); returnFocus = null; }
      positionControls();
    };
    openFavoriteEditor = (id, trigger, url) => {
      editingFriend = id; returnFocus = trigger;
      shadow.getElementById('favorite-editor').dataset.url = url || '';
      const friend = favorites.find(item => item.id === id);
      shadow.getElementById('friend-name').value = friend?.name || '';
      shadow.getElementById('friend-status').textContent = '';
      shadow.getElementById('remove-friend').hidden = !friend;
      showPanel(true,'favorite');
      shadow.getElementById('friend-name').focus();
    };
    shadow.getElementById('save-friend').addEventListener('click',() => {
      if (editingFriend && saveFriend(editingFriend,shadow.getElementById('friend-name').value,shadow.getElementById('friend-status'),shadow.getElementById('favorite-editor').dataset.url)) { scan(); showPanel(false); }
    });
    shadow.getElementById('remove-friend').addEventListener('click',() => {
      if (editingFriend && writeFavorites(favorites.filter(item => item.id !== editingFriend),shadow.getElementById('friend-status'))) { scan(); showPanel(false); }
    });
    shadow.getElementById('friend-name').addEventListener('keydown',event => { if (event.key === 'Enter') { event.preventDefault(); shadow.getElementById('save-friend').click(); } });
    for (const type of ['pointerdown','pointerup','mousedown','mouseup','touchstart','touchend','click','dblclick']) host.addEventListener(type,event => event.stopPropagation());
    shadow.getElementById('chip').addEventListener('click',() => { returnFocus = null; showPanel(editingFriend ? true : !panelOpen); });
    shadow.getElementById('close').addEventListener('click',() => showPanel(false));
    shadow.getElementById('toggle').addEventListener('click',() => setEnabled(!enabled));
    shadow.getElementById('settings-button').addEventListener('click',() => showView(shadow.getElementById('settings-view').hidden ? 'settings' : 'main'));
    shadow.getElementById('help-button').addEventListener('click',() => showView(shadow.getElementById('help-view').hidden ? 'help' : 'main'));
    for (const tab of shadow.querySelectorAll('[data-rule-group]')) tab.addEventListener('click',() => { activeRuleGroup = tab.dataset.ruleGroup; shadow.getElementById('rule-status').textContent = ''; renderRuleBuilder(); fillForm(activeFormConfig()); });
    shadow.getElementById('add-rule').addEventListener('click',addSelectedRule);
    for (const input of shadow.querySelectorAll('[data-category-rule]')) input.addEventListener('change',() => {
      const domain = input.dataset.categoryRule.split(':')[0];
      const values = [...shadow.querySelectorAll(`[data-category-rule^="${domain}:"]:checked`)].map(item => item.dataset.categoryRule.split(':')[1]);
      replaceCategoryRules(domain,values);
    });
    shadow.getElementById('activity').addEventListener('change',event => replaceCategoryRules('activity',event.target.value === 'any' ? [] : [event.target.value]));
    shadow.getElementById('apply').addEventListener('click',() => {
      try {
        const draft = readForm();
        if (activeRuleGroup === 'filters') saveConfig(draft);
        else { const next=structuredClone(preferenceRanges); for (const key of Object.keys(core.ranges)) next[activeRuleGroup][key]=draft[key]; savePreferenceRanges(next); }
        showError(''); showPanel(false);
      } catch (error) { showError(error.message); }
    });
    shadow.getElementById('reset').addEventListener('click',() => { activeRuleGroup='filters'; savePreferenceRanges(null); fillForm(withoutRuleFields(core.defaults())); saveRuleGroups({filters:[{condition:'not',attribute:'comfort:pnp'}],top:[],bottom:[]}); showError(''); });
    shadow.getElementById('units').addEventListener('change',event => {
      try {
        const unit = event.target.value, draft = readForm();
        // A native select can briefly report no value while its options are
        // being rebuilt. Preserve the saved height in that transition.
        draft.height = draft.height.map((value,index) => value ?? config.height[index]);
        draft.units = unit; fillForm(draft);
        if (activeRuleGroup !== 'filters') { const next=structuredClone(preferenceRanges); for (const key of Object.keys(core.ranges)) next[activeRuleGroup][key]=draft[key]; savePreferenceRanges(next); }
        saveConfig({...config,units:unit}); showError('');
      }
      catch (error) { event.target.value = displayedUnits; showError(error.message); }
    });
    shadow.getElementById('missing').addEventListener('change',event => saveConfig({...config,missing:event.target.value}));
    shadow.addEventListener('keydown',event => { if (event.key === 'Escape' && panelOpen) showPanel(false); });
    fillForm();
    renderFavorites();
    renderRuleBuilder();
  }
  function updateUI({hidden,checked,unknown,pinCount,cardCount,loadedCount,mismatchHidden,missingHidden}) {
    const text = (id,value) => { const el = shadow.getElementById(id); if (el.textContent !== value) el.textContent = value; };
    shadow.getElementById('chip').setAttribute('aria-label',enabled ? `Open Lens; ${hidden} hidden` : 'Open Lens; filtering paused');
    const chipCount = shadow.getElementById('chip-count');
    text('chip-count',String(hidden)); chipCount.hidden = !enabled || hidden === 0;
    shadow.getElementById('toggle-icon').src = enabled ? LENS_ICONS.pause : LENS_ICONS.play;
    shadow.getElementById('toggle').setAttribute('aria-pressed',String(enabled));
    shadow.getElementById('toggle').setAttribute('aria-label',enabled ? 'Pause Lens' : 'Resume Lens');
    shadow.getElementById('status-dot').classList.toggle('paused',!enabled);
    text('status',enabled ? `Lens active · ${hidden} hidden` : 'Lens paused · profiles restored');
    text('blocking-summary',enabled && hidden ? `${mismatchHidden} rule mismatch${mismatchHidden === 1 ? '' : 'es'} · ${missingHidden} awaiting details` : enabled ? 'No profiles are currently blocked.' : 'Filtering and highlights are temporarily off.');
    text('coverage',checked+unknown ? `${checked} fully checked · ${unknown} still missing details` : networkSeen ? 'Waiting for profiles on the map.' : 'Waiting for profile information. Refresh Sniffies once after installation.');
    text('diagnostics',`Version: 1.5.0
Map pins found: ${pinCount}
Photo cards found: ${cardCount}
Profiles matched to loaded data: ${loadedCount}
Profiles fully checked: ${checked}
Profiles missing details: ${unknown}
Profiles hidden: ${hidden}
Map lists read: ${diagnostics.mapLists}
Data responses: ${diagnostics.fetch} fetch / ${diagnostics.xhr} XHR / ${diagnostics.socket} live
Oversized responses skipped: ${diagnostics.tooLarge}`);

  }
  function start() {
    scan();
    observer = new MutationObserver(records => { if (records.some(record => record.target !== host && !host?.contains(record.target))) schedule(); });
    observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['id','data-testid']});
  }
  window.addEventListener('storage',event => {
    if (event.key === PREF) { enabled = event.newValue !== 'false'; schedule(); }
    if (event.key === SETTINGS) { try { config = withoutRuleFields(core.sanitizeConfig(JSON.parse(event.newValue))); fillForm(); schedule(); } catch {} }
    if (event.key === RULES) { try { ruleGroups = core.sanitizeRuleGroups(JSON.parse(event.newValue)); renderRuleBuilder(); schedule(); } catch {} }
    if (event.key === PREFERENCE_RANGES) { try { preferenceRanges = sanitizePreferenceRanges(JSON.parse(event.newValue)); fillForm(activeFormConfig()); schedule(); } catch {} }
  });
  window.addEventListener('offline',invalidatePresence);
  window.addEventListener('pageshow',schedule);
  window.addEventListener('popstate',schedule);
  document.addEventListener('visibilitychange',() => { if (!document.hidden) schedule(); else clearTimeout(activityTimer); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
