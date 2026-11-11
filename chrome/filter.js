// Lens 1.5.0 — private local filtering and preference highlighting for Sniffies
(()=>{
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


const LENS_ICONS={"filter":"data:image/png;base64,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","settings":"data:image/png;base64,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","help":"data:image/png;base64,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","close":"data:image/png;base64,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","pause":"data:image/png;base64,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","play":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAFX0lEQVR4nMVXXWgcVRQ+5947uxuMUioI/jw0aMX2TYqKFkwLgqj4JCmKCFZoS0VREIpV2mVVLD4UfOlLH6og+JAgtQ/WEmrCYk2pCIpKFSyoIBVik2aT3dmZ+3fk3JnJbjJpTWuru1zm3js/33e+79wzdwAu9yPC0P7zHxGOEMn+qZHRpePrCg4FKFFlmGhN30msE4lrCYclcER66NRfN+qhNQ2Z4pNilgZVG39XXTg0+Zj6KBAbJTk2Ap6vvXYEKESOm85DTTj3mSC5xfzsQS14qICCKgJI4ydU7PYdf6EytUhkG7prQmB4klRzK9q7ftCvDA5E74sfTRdiilQXUBkgZYGiWiWqgLMR4sHYtg6c3LW2NTJCcuNGoEYD/b9VQACiXzeRHh90lUfVBeNUB6TQBNIBKA+ABpwkEIODFSm8Oyc87Tn6cnQ0BFCfVM3GFgdwZbZgr8sWIK371Ezd5NSDck5bmYIQFjICFkAwCYckPblqpVKpRgDCuU9EavePvVk7y09hRcbGVm+LKM1YADAh2tBHbgbDHGgAMoSkQZkFbbsz2oKRTwlUZ55+R+/dtJMiBg9LdpX1Q5RmDCC4HnggYwlCTK4gEeYFGRDxRW26LX+DoOjdDXf408+9bR4JiYlIq6kdYvmEt4AMEpRgEuwqA+cKMAl0BGRzIpakN+TbM1qbWGyCBMe37zeHnn2jfWsgQoT1+qVrh1jRghyYPQ++53ZAyIFMDVYFWJmgBiEZUkkrsfGc8ejUiwNY+2bnftrOSvAK4dz4BwIYslcYL4qoA4mi7ylELzwCL7iiUbALs2sJ+F7szKbatOk2ZeHI7j22ueM1fR/nxkpKiOUTxB4vSg2AOrfAIwMEIgW44D7x2IcW1OJqYEnpjnHt2UR7LR+ukjj10qvJHlZiOQlR0sQLz/6Co+A78TGAFi2PnslQpggTY/CCNB/JAtqUVDLf1XHLSGmq7+1+Ph1ZbodYjo/OC/aaZS18D9m/CNAjE3IkKJATCjb5xWv4fq9JudS5ZB582kl2MAZXzgJPlQkIlCHZcpkL8AIg77MqvXlcJIDFuVwhLgYi9DyYJC0FrEoWWB9uynzPPA7Zz2AlcMrygo991hTgEjwbbsF5pZ0VSZocYYizZ3sVWJWSsJC88DOM8zzgt3URWQDNIhb8PB4Dn8+uk0SeyCFRtZp02t1uMrPv2MmhjwHqor9Ui5ICJChEEEAL/zNJGSRLwixiHmeK9JThPZwgbwVJpRMr51ozozML0/cfOzl0MFsBDX95CwACgcxbn4FDH1C+EoItTACBwBPymDw58hA5H8l2e/a7WMd7x79Yf4IfypnfaJRfUqqEnssfPM2jzipgDuixR4Qt8cTTvHgRfS3qdC5eMLp74Jdffzp07tzjad9+YcU3pConYU4iLy5FxL1k7BsTUAYeRUncBpO0P4xb043mmXt/W+2rWZUUKLK9SMActLcS8jpAnN1Y8VbJbvvi11rr1ycmhib5GcPDk6rZ3OJWsy8QpQnnRaj/SxIvLyzOc3PkHIGrVOJ258+FuendJ04c3szgWYWri2Zzq13tzkgt3xGhAQ2e/2xBL2rwLDZ54VWkOx3vzPzhpJU0pqY2nM/kHr2inVBJgeE6hPqMsW7yvPRg0JNHCs2iRQlaRsn83Fdx3B6e+HxoF4Oz3Hzf2Ni2q9od41IFAO5+ZuFmWdNfrh1Ye48ybZAOQZoI0rkLf5g0rZ8ev/MDvjhLsGwxXg3wCgR6Nqx/4tvba4O3vDVA9IAwzqDx452Z8we/P715Onwd1QGvdhu+ih/1kRpd+n14iV3NdeBA2A+W9f+Pr+QM9LoC/w19163salD/zQAAAABJRU5ErkJggg==","check":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAE00lEQVR4nO2XTWxUVRTHz7nv3ikdWvArgEoH0KhRISYiUaOmRUqo4UM0aXfuXBgXRjdqUNMOgTa6IHFBXLglLoDoxiYgaUqRlEKIJoiGSNAARQvzRacz7737ecx9MGUqjVRCYaFnMS/vvo/f/5zzP/dlAP6P/0AgdQMjArztZKJuNuV8d2dwR+DhT6+25A5vap7uPpwV+GArx9VDJvp+TVuqKfWZjfVjzJgyVcyuwyPBJ209Q9aTEYDYbMHVSPtzogH7mayugmqlicJoMW+GD19YHr2PCAS7O9ktr4DvMXbtsXK4fUXA4DuQ8UIXagUAHBxYAS4wZX2an5q/ArNDhgCQ3Wo4Hd+QCQTuC1S8yEXGoGMCFCFqx0A6dBWVAshNctm0L6Nu5ktJ1BnMZHz8mCXwA+3zjYm+DnT8gK4ohRYCsA7QEZByFoxmckIPY/YXRbsh8B7g08ERsw4A3BRA9tr53+HQA5Rbu6nZ8vBb7vRKU4olEgoyHu4AjLVC6YZKPjpbrsKWJKkeIP/8dQI8XJ3YvBJArkJtc6Nl2Y+rh+I6YXVir1THm8qMRF8FwryoxyKJRJwMAVoA0sYKZUQ1Xx3Nj7uOZdmz58lcS4glL6rtVoOtXP64cWcA6rgg8wXndm+Gw6Fw7/NLPLx+I0ngezoZIjh7ZO2XAZoN5lIo0YEgDQjaASlthdQiKkZjhSLz8FNJ6euqyfzPwcHWZFGKOe+k0vZtWygrU6hIfTGUDMyq1DwaoG+eaUn6XBNxsDUxnR5u38mEftPkK5IUCQ8GYwG0TeBhMSzkCnrDkm1nfh7sBo5dYKdUHGrZIIAZaDvKhXlaR9YCIU+6ZI0WadZgFZ64nLMv3ffGsTKd7Ezh8j1KHX75IyH0NpMLJVkUaAnAOCDjLNdWhPlqLl+IO5b2/vmDh6/Ogrmu5ZS0EIiI0PQ/e4Kn6AmjvG+RAXldDoisFo28wUoYCMI5m7FrqGKG174XMLnD5KsKjHc7oTcdWHJCGx6W4suFS3Jdpnf0GPnMp4EnLUjgfoYRyY3HQ+CIkTQWtAawFpKCORR6QsmgEda4xnAXHV33VmDlDlOomgRuHPrMQVvHY82jUlQqXopfuRF8agsA4OLnyxc0N9nB9Dz+uCGUyDknYEhAgL4o4ByfIwQ0NoApx5Y0+YeTS6StC2LDo2JULlX1upbshZEbwSdNmOzNPYCL3j15cSwvO8KSPM2tayBpbZKZHyfLkGwQmKrWJl/RpAivZW4cV4bHl6OJ4ni8cabwyQrUIhmRLrBn+x556N67cWBuOrVUEyoQAfcq8UrDvGGuzu7VzI0N4rKsFgpqfWb76KGZwq8TUC/iTO+yRxc08wNNc1MZw0Ahg8Ax7g0L5C3qb3bkmLJBNC7jUjFe39J3YfDfwCdbMEVRF1g/Mg9v+f3XfEl1VEL5B3eQIgUWtAXSV/Z2p6zD2ASyLGWxJF+7Gfi0FahFbW5/61v61IJ0sD/dkFqoGSjGMABCi9ryuBzr4oTZnNk+uu9m4P8ooF7Eua2LV9yVFvub56Xu1wZAIEE4rlSxpF9v+fRC/83CZxRehD+e/rjlyVLvkoPjfZmx0tbMkfMfPNjm1z0cZjvIf3KvxrnuxfdMt35bRFDt83u74fVxR/5g/B8wi/EXfv4kiMSKfngAAAAASUVORK5CYII=","refresh":"data:image/png;base64,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","star":"data:image/png;base64,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","remove":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAACnklEQVR4nO1Uu4pUQRA9p7uvs6Li6ytcMRBBxEBF8Atk/AHBXIw02RVBTBQTwW/QWAMTFUzMZMEFEzNdYVyRdZy9j64qqZ5Rd10RETHxHihudVH0qTpVt4EePXr0+N/BLREznnyC+HQEwxD2Lb748wsWfoNkeRmcnwcXFyEkv9+5BWZbC/rr2MyRNpGTdnw02tVg9wX5gBNhjAoKhMZCaBCRaaGGRgWrDCYNljrV1IEQhEEHDsSAFowGVAajQNiiGXRYQlvfvnODq9MipkpwY+dH3n7an+vtj2KdDud3QGyAkL0AIAkQ3e8AdtN4MiC2QHKzaU4lQPBcNwUqb0CBuQjopHlZNd3pm3d3jswAH0dRYAiE+6SMX3RXBpION6/aSaiR0IEUgJlANlAIPxc/AyaAZYMpYEqI+zItRsXNCkkEUJvlnWnuYDvJlwFeXDz12LlzcjmcHGahfpjPhDVoGLMKrUUn5owMM2JklCI8FsRKly63+yWmU3HLVwgEX2QrIrctFB2OedNXn56SzTtwH8w1DDXIz8ZC9NU6K7J7DGrl8o1Gm6rj0tML8QJcYiUIKxZUGSMoomHjEoZS7z2LOEeRVXtuAnKdLdepnJjCbd2UtSobUbaq7FSjW1YNM6OohplF8bMVv8SzajR0ScF2Ui+XsQ+dGzMFXhaZOF75dCtVcnZPmtvLxrv12RpUtHRWOvSfRX3Ivrwzub2TsnyGBEOFUHKCGnz+RSEMqtWP71fWx6PrzjU/P31j+ONvuO/82wO74o5Lg649FCRvC0ahwoIZ/cIKgUk0lNkDjGqsXGzPUS+A5QyRMobkxTAAWZbWJm+uPXh29PXG3/CfP0T+NPw6Y8EChhbBr3n8wf4Mw6HFBSxsWsAePXr06OEKfAFhapcmz4DrvAAAAABJRU5ErkJggg==","add":"data:image/png;base64,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"};
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

})();
