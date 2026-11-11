'use strict';
function createComfortCore() {
  const own = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);
  const normalize = value => String(value ?? '').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
  const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{6,128}$/.test(value);
  const comfortOptions = [['alcohol','No Alcohol'],['cannabis','No Cannabis'],['tobacco','No Tobacco'],['poppers','No Poppers'],['pnp','No PNP'],['other','No Other Drugs'],['discuss',"Let's Discuss"]];
  const bodies = [['slim','Slim'],['athletic','Fit / athletic'],['muscular','Muscular'],['average','Average'],['stocky','Stocky'],['chubby','Chubby'],['large','Large']];
  const positions = [['side','Side'],['bottom-sub','Submissive bottom'],['bottom','Bottom'],['bottom-power','Power bottom'],['vers-bottom','Vers bottom'],['vers','Vers'],['vers-top','Vers top'],['top-sub','Passive top'],['top','Top'],['top-dom','Dom top']];
  const activityOptions = [['now','Online now'],['10','Online within 10 minutes'],['30','Online within 30 minutes'],['60','Online within the last hour']];
  const ruleAttributes = [
    ...comfortOptions.map(([id,label]) => [`comfort:${id}`,label]),
    ...bodies.map(([id,label]) => [`body:${id}`,`Body: ${label}`]),
    ...positions.map(([id,label]) => [`position:${id}`,`Position: ${label}`]),
    ...activityOptions.map(([id,label]) => [`activity:${id}`,label])
  ];
  const ranges = { age:[18,120], height:[60,275], weight:[20,500], endowment:[1,50] };
  function defaults() {
    return { comfort:{pnp:'absent'}, units:'imperial', age:[null,null], height:[null,null], weight:[null,null], endowment:[null,null], bodies:[], positions:[], activity:'any', missing:'show' };
  }
  function sanitizeConfig(value) {
    const config = defaults();
    if (!value || typeof value !== 'object') return config;
    // Migrate the original checkbox while retaining all other saved preferences.
    if (value.comfort && typeof value.comfort === 'object' && !Array.isArray(value.comfort)) {
      config.comfort = {};
      for (const [id] of comfortOptions) if (['present','absent'].includes(value.comfort[id])) config.comfort[id] = value.comfort[id];
    } else if (value.noPnp === false) config.comfort = {};
    if (value.units === 'metric') config.units = 'metric';
    if (['any','now','10','30','60'].includes(value.activity)) config.activity = value.activity;
    if (value.missing === 'hide') config.missing = 'hide';
    for (const key of Object.keys(ranges)) {
      if (!Array.isArray(value[key]) || value[key].length !== 2) continue;
      const pair = value[key].map(n => typeof n === 'number' && Number.isFinite(n) && n >= ranges[key][0] && n <= ranges[key][1] ? n : null);
      if (pair[0] !== null && pair[1] !== null && pair[0] > pair[1]) continue;
      config[key] = pair;
    }
    for (const [key, options] of [['bodies', bodies], ['positions', positions]]) {
      if (Array.isArray(value[key])) config[key] = [...new Set(value[key].filter(v => options.some(([id]) => id === v)))];
    }
    return config;
  }
  function extended(record) {
    return record?.data?.profile?.extended ?? record?.publicProfile?.extended ?? record?.profile?.extended;
  }
  function comfortValues(record) {
    const e = extended(record);
    if (!own(e?.health, 'drugAbuse')) return undefined;
    const values = e.health.drugAbuse;
    if (values === null) return null;
    if (!Array.isArray(values) || values.some(value => typeof value !== 'string')) return null;
    return [...new Set(values.map(normalize))];
  }
  // Retained as a helper for the original field-specific adapter checks.
  function comfortValue(record) {
    const values = comfortValues(record);
    if (values === null && extended(record)?.health?.drugAbuse !== null) return undefined;
    return Array.isArray(values) ? values.includes('pnp') : values;
  }
  function displayComfort(labels) {
    const normalized = value => normalize(value).replace(/[’‘]/g,"'");
    const values = labels.map(label => comfortOptions.find(([,text]) => normalized(text) === normalized(label))?.[0]);
    return values.some(value => !value) ? null : [...new Set(values)];
  }
  function timestamp(value) {
    if (value === null || value === '' || value === undefined || typeof value === 'boolean') return null;
    const n = typeof value === 'number' ? (value < 1e11 ? value * 1000 : value) : typeof value === 'string' ? Date.parse(value) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  function profilePatch(record) {
    const patch = {}, e = extended(record);
    const rawProfiles = [record?.data?.profile, record?.publicProfile, record?.profile];
    if (rawProfiles.some(p => p && own(p,'extended') && p.extended === null)) {
      for (const key of ['comfort','age','height','weight','endowment','body','position']) patch[key] = null;
    }
    const comfort = comfortValues(record);
    if (comfort !== undefined) patch.comfort = comfort;
    for (const [field,key] of [['age','age'],['height','heightInCm'],['weight','weightInKg']]) {
      if (own(e?.stats,key)) {
        const n = e.stats[key];
        patch[field] = typeof n === 'number' && Number.isFinite(n) && n >= ranges[field][0] && n <= ranges[field][1] ? n : null;
      }
    }
    if (own(e?.stats,'endowment')) {
      const n = e.stats.endowment?.lengthInCm;
      if (e.stats.endowment === null || own(e.stats.endowment,'lengthInCm')) patch.endowment = typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 50 ? n : null;
    }
    if (own(e?.stats,'body')) patch.body = bodies.some(([id]) => id === e.stats.body) ? e.stats.body : null;
    if (own(e?.sexuality,'attitude')) patch.position = positions.some(([id]) => id === e.sexuality.attitude) ? e.sexuality.attitude : null;
    for (const key of ['connectUpdateTime','disconnectTime']) {
      const source = own(record?.data,key) ? record.data : record;
      if (own(source,key)) { patch[key] = timestamp(source[key]); patch.presenceKnown = true; }
    }
    return patch;
  }
  function recordsFrom(payload, now = Date.now()) {
    const facts = new Map(), stack = [{value:payload,depth:0}], seen = new WeakSet();
    const skip = new Set(['profile','publicProfile','health','images','photos','files','messages','message','conversations','conversation','body','account','credentials','options']);
    let visited = 0;
    while (stack.length && visited++ < 30000) {
      const {value,depth} = stack.pop();
      if (!value || typeof value !== 'object' || seen.has(value) || depth > 12) continue;
      seen.add(value);
      if (validId(value._id)) {
        const patch = profilePatch(value);
        if (Object.keys(patch).length) facts.set(value._id, {...facts.get(value._id), ...patch});
      }
      if (Array.isArray(value)) {
        for (let i = Math.min(value.length,20000)-1; i >= 0; i--) stack.push({value:value[i],depth:depth+1});
      } else for (const key of Object.keys(value)) if (!skip.has(key) && value[key] && typeof value[key] === 'object') stack.push({value:value[key],depth:depth+1});
    }
    // Actual Sniffies event envelope: { eventName, data }. The app stamps these events on arrival.
    if (['userAwake','userJoined','userDisconnected'].includes(payload?.eventName)) {
      const id = typeof payload.data === 'string' ? payload.data : payload.data?._id;
      if (validId(id)) {
        const patch = {connectUpdateTime:now, presenceKnown:true};
        if (payload.eventName === 'userDisconnected') patch.disconnectTime = now;
        facts.set(id, {...facts.get(id), ...patch});
      }
    }
    return facts;
  }
  function presence(data, now) {
    const sane = value => typeof value === 'number' && Number.isFinite(value) && value <= now + 60000 && value > 0 ? value : null;
    const connect = sane(data.connectUpdateTime), disconnect = sane(data.disconnectTime);
    const lastSeen = Math.max(connect || 0, disconnect || 0) || null;
    const future = [data.connectUpdateTime,data.disconnectTime].some(v => typeof v === 'number' && v > now + 60000);
    const online = future || data.presenceKnown === false || !lastSeen ? null : connect !== null && connect > (disconnect || 0);
    return {online,lastSeen};
  }
  function evaluate(data = {}, config = defaults(), now = Date.now()) {
    const missing = [], reasons = [];
    const test = (name,value,passes) => { if (value === null || value === undefined) missing.push(name); else if (!passes(value)) reasons.push(name); };
    for (const [id,label] of comfortOptions) {
      const rule = config.comfort?.[id];
      if (!['present','absent'].includes(rule)) continue;
      const selected = Array.isArray(data.comfort) ? data.comfort.includes(id) : null;
      test(label,selected,value => rule === 'present' ? value : !value);
    }
    for (const key of Object.keys(ranges)) {
      const [min,max] = config[key];
      if (min !== null || max !== null) test(key,data[key],v => (min === null || v >= min) && (max === null || v <= max));
    }
    if (config.bodies.length) test('body type',data.body,v => config.bodies.includes(v));
    if (config.positions.length) test('position',data.position,v => config.positions.some(selected => matchesPosition(selected,v)));
    if (config.activity !== 'any') {
      const {online,lastSeen} = presence(data,now);
      let passes = online;
      if (config.activity !== 'now' && online !== true) {
        if (lastSeen !== null && Math.max(0,now-lastSeen) <= Number(config.activity)*60000) passes = true;
        else if (online !== false) passes = null;
      }
      test('activity',passes,Boolean);
    }
    return { hide:reasons.length > 0 || (config.missing === 'hide' && missing.length > 0), missing, reasons };
  }
  function matchesPosition(selected, actual) {
    if (!positions.some(([id]) => id === actual)) return false;
    if (['bottom','bottom-sub','bottom-power'].includes(selected)) return ['bottom','bottom-sub','bottom-power','vers-bottom'].includes(actual);
    if (['top','top-sub','top-dom'].includes(selected)) return ['top','top-sub','top-dom','vers-top'].includes(actual);
    return selected === actual;
  }
  // Read only the site's dedicated icon labels, never emoji in names or bios.
  function positionFromIcons(labels) {
    const tags = new Set(labels);
    const groups = [];
    if (tags.has('bottom-icon')) groups.push(tags.has('vers-bottom-icon') ? 'vers-bottom' : 'bottom');
    if (tags.has('top-icon')) groups.push(tags.has('vers-top-icon') ? 'vers-top' : 'top');
    if (tags.has('vers-icon')) groups.push('vers');
    if (tags.has('side-icon')) groups.push('side');
    if (tags.has('vers-bottom-icon') && !tags.has('bottom-icon') || tags.has('vers-top-icon') && !tags.has('top-icon')) return null;
    return groups.length === 1 ? groups[0] : null;
  }
  function sanitizeFavorites(value) {
    if (!Array.isArray(value)) return [];
    const result = new Map();
    for (const item of value.slice(0,500)) {
      if (!validId(item?.id) || typeof item.name !== 'string') continue;
      const name = item.name.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,80);
      if (!name) continue;
      const favorite = {id:item.id,name};
      if (typeof item.url === 'string' && profilePath(item.url,item.id)) favorite.url = profilePath(item.url,item.id);
      for (const key of ['createdAt','updatedAt']) if (typeof item[key] === 'string' && item[key].length <= 40) favorite[key] = item[key];
      result.set(item.id,favorite);
    }
    return [...result.values()];
  }
  function profilePath(value, expectedId) {
    if (typeof value !== 'string') return null;
    try {
      const url = new URL(value,'https://sniffies.com/');
      if (url.origin !== 'https://sniffies.com') return null;
      const match = url.pathname.match(/^\/profile\/([a-zA-Z0-9_-]{6,128})\/?$/);
      if (!match || expectedId && match[1] !== expectedId) return null;
      return `/profile/${match[1]}`;
    } catch { return null; }
  }
  function routeProfileId(pathname) {
    const match = String(pathname || '').match(/^\/profile\/([a-zA-Z0-9_-]{6,128})(?:\/|$)/);
    return match && match[1] !== 'me' ? match[1] : null;
  }
  function sanitizeRuleGroups(value) {
    const valid = new Set(ruleAttributes.map(([id]) => id));
    const groups = {filters:[],top:[],bottom:[]};
    if (!value || typeof value !== 'object') return groups;
    for (const key of Object.keys(groups)) {
      if (!Array.isArray(value[key])) continue;
      const seen = new Set();
      for (const item of value[key].slice(0,100)) {
        if (!item || !['has','not'].includes(item.condition) || !valid.has(item.attribute)) continue;
        const id = `${item.condition}:${item.attribute}`;
        if (!seen.has(id)) { seen.add(id); groups[key].push({condition:item.condition,attribute:item.attribute}); }
      }
    }
    return groups;
  }
  function rulesFromConfig(config) {
    const rules = [];
    for (const [id] of comfortOptions) if (['present','absent'].includes(config.comfort?.[id])) rules.push({condition:config.comfort[id] === 'present' ? 'has' : 'not',attribute:`comfort:${id}`});
    for (const id of config.bodies || []) rules.push({condition:'has',attribute:`body:${id}`});
    for (const id of config.positions || []) rules.push({condition:'has',attribute:`position:${id}`});
    if (config.activity && config.activity !== 'any') rules.push({condition:'has',attribute:`activity:${config.activity}`});
    return sanitizeRuleGroups({filters:rules}).filters;
  }
  function ruleDomain(attribute) {
    const [kind,id] = String(attribute).split(':');
    return kind === 'comfort' ? `${kind}:${id}` : kind;
  }
  function ruleValue(data, attribute, now = Date.now()) {
    const [kind,id] = String(attribute).split(':');
    if (kind === 'comfort') return Array.isArray(data?.comfort) ? data.comfort.includes(id) : null;
    if (kind === 'body') return data?.body == null ? null : data.body === id;
    if (kind === 'position') return data?.position == null ? null : matchesPosition(id,data.position);
    if (kind === 'activity') {
      const {online,lastSeen} = presence(data || {},now);
      if (id === 'now') return online;
      if (!['10','30','60'].includes(id)) return null;
      if (online === true) return true;
      if (lastSeen !== null) return Math.max(0,now-lastSeen) <= Number(id)*60000;
      return null;
    }
    return null;
  }
  function ruleMatches(data,rule,now = Date.now()) {
    const value = ruleValue(data,rule.attribute,now);
    return value === null ? null : rule.condition === 'has' ? value : !value;
  }
  function evaluateRuleSet(data,rules,now = Date.now(),missingPolicy = 'show') {
    const groups = new Map();
    for (const rule of rules || []) {
      const domain = ruleDomain(rule.attribute), group = groups.get(domain) || {has:[],not:[]};
      group[rule.condition].push(ruleMatches(data,rule,now)); groups.set(domain,group);
    }
    const missing = [], reasons = [];
    for (const [domain,group] of groups) {
      if (group.has.length) {
        if (group.has.some(Boolean)) {}
        else if (group.has.some(value => value === null)) missing.push(domain);
        else reasons.push(domain);
      }
      if (group.not.length) {
        if (group.not.some(value => value === false)) reasons.push(domain);
        else if (group.not.some(value => value === null)) missing.push(domain);
      }
    }
    return {hide:reasons.length > 0 || missingPolicy === 'hide' && missing.length > 0,missing:[...new Set(missing)],reasons:[...new Set(reasons)]};
  }
  function scoreRules(data,rules,now = Date.now()) {
    const total = rules?.length || 0;
    let matched = 0;
    for (const rule of rules || []) if (ruleMatches(data,rule,now) === true) matched++;
    const percentage = total ? matched/total*100 : 0;
    return {matched,total,percentage,qualifies:total > 0 && percentage > 75};
  }
  function scoreRanges(data,config) {
    let matched = 0, total = 0;
    for (const field of Object.keys(ranges)) {
      const range = config?.[field] || [null,null];
      if (range[0] === null && range[1] === null) continue;
      total++;
      const value = data?.[field];
      if (value != null && (range[0] === null || value >= range[0]) && (range[1] === null || value <= range[1])) matched++;
    }
    const percentage = total ? matched/total*100 : 0;
    return {matched,total,percentage,qualifies:total > 0 && percentage > 75};
  }
  function combineScores(...scores) {
    const matched = scores.reduce((sum,score) => sum+(score?.matched || 0),0);
    const total = scores.reduce((sum,score) => sum+(score?.total || 0),0);
    const percentage = total ? matched/total*100 : 0;
    return {matched,total,percentage,qualifies:total > 0 && percentage > 75};
  }
  function toCanonical(field, value, units, quantize = true) {
    const text = normalize(value);
    if (!text) return null;
    let n;
    if (field === 'height' && units === 'imperial') {
      const feet = text.match(/^(\d+)\s*(?:'|′|ft|:)\s*(\d+(?:\.\d+)?)?\s*(?:"|″|in)?$/);
      if (feet) {
        const inches = Number(feet[2] || 0);
        if (inches >= 12) throw new Error('Use inches from 0 to less than 12 after feet.');
        n = Number(feet[1])*12 + inches;
      } else {
        const inches = text.match(/^(\d+(?:\.\d+)?)\s*(?:in|"|″)?$/);
        if (!inches) throw new Error('Enter height as 5\'9" or total inches, such as 69.');
        n = Number(inches[1]);
      }
    } else {
      if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error('Enter a positive number or leave the box blank.');
      n = Number(text);
    }
    if (field === 'age' && !Number.isInteger(n)) throw new Error('Enter age in whole years.');
    // Sniffies stores imperial selections rounded to whole cm / kg.
    if (units === 'imperial' && field !== 'age') {
      n *= field === 'weight' ? 0.45359237 : 2.54;
      // Height and weight mirror Sniffies' whole-unit storage. Keep endowment
      // precise so an entered inch value does not visibly change after saving.
      if (quantize && field !== 'endowment') n = Math.round(n);
    }
    const [lo,hi] = ranges[field];
    if (!Number.isFinite(n) || n < lo || n > hi) throw new Error(field === 'age' ? 'Age must be between 18 and 120.' : 'That value is outside the supported range.');
    return n;
  }
  function displayValue(field, n, units) {
    if (n === null || n === undefined) return '';
    if (units === 'metric' || field === 'age') return String(n);
    const value = n / (field === 'weight' ? 0.45359237 : 2.54);
    if (field === 'height') {
      const feet = Math.floor(value/12), inches = Math.round((value-feet*12)*100)/100;
      return inches >= 12 ? `${feet+1}'0"` : `${feet}'${inches}"`;
    }
    return String(Math.round(value*100)/100);
  }
  function displayPatch(fields) {
    const patch = {};
    const set = (field, n) => { if (Number.isFinite(n) && n >= ranges[field][0] && n <= ranges[field][1]) patch[field] = n; };
    const age = normalize(fields.age).match(/^(\d+)\s*\+?$/);
    if (age) set('age',Number(age[1]));
    const height = normalize(fields.height).replace(/\s*\+$/,'');
    const cm = height.match(/^(\d+(?:\.\d+)?)\s*cm$/);
    if (cm) set('height',Number(cm[1]));
    else if (height && /['′]|ft/.test(height)) { try { set('height',toCanonical('height',height,'imperial')); } catch {} }
    const weight = normalize(fields.weight).match(/^(\d+(?:\.\d+)?)\s*(kg|lbs?)\s*\+?$/);
    if (weight) set('weight',weight[2] === 'kg' ? Number(weight[1]) : Math.round(Number(weight[1])*0.45359237));
    const endowment = normalize(fields.endowment).match(/^(\d+(?:\.\d+)?)\s*(cm|in|"|″)(?:\s*\+)?(?:\s+(?:un)?cut)?$/);
    if (endowment) set('endowment',endowment[2] === 'cm' ? Number(endowment[1]) : Math.round(Number(endowment[1])*2.54));
    const body = normalize(fields.body);
    const bodyValue = body === 'fit' || body === 'athletic' ? 'athletic' : bodies.find(([id,label]) => normalize(label) === body)?.[0];
    if (bodyValue) patch.body = bodyValue;
    const position = normalize(fields.position);
    const positionValue = position === 'dom top (breeder)' ? 'top-dom' : positions.find(([id,label]) => normalize(label) === position)?.[0];
    if (positionValue) patch.position = positionValue;
    return patch;
  }
  function parsePayload(text) {
    if (typeof text !== 'string' || text.length > 4*1024*1024) return null;
    const input = text.trim().replace(/^\d+(?=[\[{])/,'');
    if (input[0] !== '[' && input[0] !== '{') return null;
    try { return JSON.parse(input); } catch { return null; }
  }
  function isSniffiesURL(value, base = 'https://sniffies.com/') {
    try { const url = new URL(value,base);return /^(https:|wss:)$/.test(url.protocol) && (url.hostname === 'sniffies.com' || url.hostname.endsWith('.sniffies.com')); } catch { return false; }
  }
  return {normalize,validId,comfortOptions,comfortValues,displayComfort,bodies,positions,activityOptions,ruleAttributes,ranges,defaults,sanitizeConfig,sanitizeFavorites,profilePath,routeProfileId,sanitizeRuleGroups,rulesFromConfig,ruleValue,ruleMatches,evaluateRuleSet,scoreRules,scoreRanges,combineScores,comfortValue,profilePatch,recordsFrom,presence,evaluate,matchesPosition,positionFromIcons,toCanonical,displayValue,displayPatch,parsePayload,isSniffiesURL};
}
module.exports = createComfortCore;
