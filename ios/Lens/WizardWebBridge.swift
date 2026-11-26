import Foundation
import WebKit

extension BrowserModel {
    func scanCurrentListing() async throws -> WizardScanResult {
        guard let expectedOrigin = origin else { throw AppIssue.message("Open a secure website listing before scanning.") }
        let value = try await webView.callAsyncJavaScript(Self.wizardScanScript,
            arguments: ["expectedOrigin": expectedOrigin], in: nil, contentWorld: .page)
        guard let json = value as? String else { throw AppIssue.message("The page did not return a readable scan.") }
        return try WizardDetector.decode(json)
    }

    func setWizardPreview(_ evaluations: [WizardEvaluation], mode: WizardPreviewMode) async throws {
        let grouped = Dictionary(grouping: evaluations, by: { $0.profile.id })
        let reasons = grouped.compactMapValues { group -> String? in
            guard group.count == 1, let evaluation = group.first, evaluation.outcome == .blocked else { return nil }
            return evaluation.reasons.joined(separator: " ")
        }
        _ = try await webView.callAsyncJavaScript(Self.wizardPreviewScript,
            arguments: ["mode": mode.rawValue, "reasons": reasons], in: nil, contentWorld: .page)
    }

    func clearWizardPreview() async {
        try? await setWizardPreview([], mode: .showAll)
    }

    // Bounded, user-initiated, main-frame DOM inspection. It reads visible text,
    // accessible labels and structure only; it does not inspect images, canvases,
    // cross-origin frames, network traffic, messages or form values.
    static let wizardScanScript = #"""
    if (window.top !== window || location.protocol !== 'https:' || location.origin !== expectedOrigin) {
      throw new Error('The page changed or is not the expected secure top-level website.');
    }
    const clean = value => String(value || '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim().slice(0, 180);
    const visible = element => {
      if (!(element instanceof Element)) return false;
      const style = getComputedStyle(element), rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0 && rect.width >= 24 && rect.height >= 18;
    };
    const fieldKey = label => clean(label).toLowerCase().replace(/[^a-z0-9🍆🍑]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'unlabeled';
    const fieldsFor = root => {
      const found = new Map();
      const add = (label, value, source) => {
        label = clean(label); value = clean(value); source = clean(source || label);
        if (!label || !value || label === value || value.length > 180 || found.size >= 50) return;
        const key = fieldKey(label);
        if (!found.has(key)) found.set(key, {key, label, value, source});
      };
      for (const dt of root.querySelectorAll('dt')) {
        const dd = dt.nextElementSibling;
        if (dd?.matches('dd')) add(dt.innerText, dd.innerText, clean(dt.innerText));
      }
      for (const node of root.querySelectorAll('[data-label]')) add(node.getAttribute('data-label'), node.getAttribute('data-value') || node.innerText, node.getAttribute('data-label'));
      for (const line of String(root.innerText || '').split(/[\n\r]+/).slice(0, 100)) {
        const match = clean(line).match(/^([^:]{1,45}):\s*(.{1,180})$/);
        if (match) add(match[1], match[2], clean(line));
      }
      for (const row of root.querySelectorAll(':scope > *, :scope > * > *')) {
        if (!visible(row) || row.children.length !== 2) continue;
        const label = clean(row.children[0].innerText || row.children[0].getAttribute('aria-label'));
        const value = clean(row.children[1].innerText || row.children[1].getAttribute('aria-label'));
        if (label.length <= 45) add(label, value, label);
      }
      const accessible = [root, ...root.querySelectorAll('[aria-label], img[alt], [title]')].slice(0, 120)
        .map(node => clean(node.getAttribute('aria-label') || node.getAttribute('alt') || node.getAttribute('title'))).filter(Boolean);
      const text = clean(String(root.innerText || '') + ' ' + accessible.join(' '));
      const symbols = [...new Set(text.match(/[🍆🍑]/gu) || [])];
      if (symbols.length) add('Position symbol', symbols.join(' '), 'Visible or accessible emoji');
      const height = text.match(/\b([4-7]'\s*(?:[0-9]|1[01])?(?:\"|”)?)/i);
      const weight = text.match(/\b(\d{2,3}(?:\.\d+)?)\s*(lb|lbs|kg)\b/i);
      const endowment = text.match(/\b(\d{1,2}(?:\.\d+)?)\s*(?:\"|”|inches?)\s*(cut|uncut)?\b/i);
      const position = text.match(/\b((?:dom(?:inant)?\s+|sub(?:missive)?\s+)?(?:vers(?:atile)?(?:\s+(?:top|bottom))?|top|bottom|side))\b/i);
      const body = text.match(/\b(athletic|slim|muscular|average|stocky|large|bear|toned)\b/i);
      const activity = text.match(/\b(online|active now|last seen\s+[^,.;]{1,40}|\d+\s+(?:minutes?|hours?)\s+ago)\b/i);
      const comfort = text.match(/\b(no alcohol|no cannabis|no tobacco|no poppers|no pnp|no other drugs|let'?s discuss|pnp|poppers)\b/i);
      if (height) add('Height', height[1], height[0]);
      if (weight) add('Weight', weight[1] + ' ' + weight[2], weight[0]);
      if (endowment) add('Endowment', endowment[1] + ' in' + (endowment[2] ? ' ' + endowment[2] : ''), endowment[0]);
      if (position) add('Position', position[1], position[0]);
      if (body) add('Body type', body[1], body[0]);
      if (activity) add('Activity', activity[1], activity[0]);
      if (comfort) add('Comfort', comfort[1], comfort[0]);
      if (height || weight || endowment || position || body) {
        const age = text.match(/(?:^|\s)([1-9]\d)\s*(?=,|·|\||years?\s+old|yo\b)/i);
        if (age) add('Age', age[1], age[0]);
      }
      return [...found.values()];
    };
    const token = value => clean(value).replace(/[?#].*$/, '').split('/').filter(Boolean).pop()?.replace(/[^a-z0-9_-]/gi, '').slice(0, 100) || '';
    const identityFor = element => {
      const nodes = [element, ...element.querySelectorAll('[data-profile-id],[data-user-id],[data-id],[id],a[href]')].slice(0, 30);
      for (const node of nodes) {
        for (const name of ['data-profile-id','data-user-id','data-id','id']) {
          const value = token(node.getAttribute?.(name));
          if (value && value.length >= 4) return 'profile-' + value;
        }
        const href = node.getAttribute?.('href');
        if (href) { try { const value = token(new URL(href, location.href).pathname); if (value.length >= 4) return 'profile-' + value; } catch {} }
      }
      return '';
    };
    const signature = element => {
      const classes = [...element.classList].filter(c => !/active|selected|hover|focus/i.test(c)).slice(0, 3).sort().join('.');
      const parent = element.parentElement;
      return `${element.tagName}.${classes}|${parent?.tagName || ''}.${[...(parent?.classList || [])].slice(0,2).sort().join('.')}`;
    };
    const readable = element => clean(element.innerText || element.getAttribute('aria-label') || element.getAttribute('title') || element.querySelector('img[alt]')?.getAttribute('alt'));
    const candidates = [...document.querySelectorAll('article, li, div[class], [role="listitem"], [data-profile], [class*="profile" i], [class*="card" i], [class*="marker" i], [data-testid*="marker" i]')]
      .filter(visible).filter(element => {
        const text = readable(element), rect = element.getBoundingClientRect();
        return (text.length >= 2 || identityFor(element)) && text.length <= 1200 && rect.width <= innerWidth * 1.2 && rect.height <= innerHeight * 1.5;
      }).slice(0, 600);
    const groups = new Map();
    for (const element of candidates) {
      const key = signature(element), group = groups.get(key) || [];
      if (!group.some(parent => parent.contains(element))) group.push(element);
      groups.set(key, group);
    }
    let cards = [...groups.values()].filter(group => group.length >= 2 && group.length <= 100)
      .sort((a,b) => b.length - a.length || readable(b[0]).length - readable(a[0]).length)[0] || [];
    cards = cards.slice(0, 80);
    let profiles = cards.map((card, index) => {
      const explicitID = token(card.getAttribute('data-profile-id') || card.getAttribute('data-user-id'));
      const id = explicitID ? 'profile-' + explicitID : identityFor(card) || `scan-${index + 1}`;
      card.setAttribute('data-lens-profile-id', id);
      return {id, title: `Visible grid entry ${index + 1}`, fields: fieldsFor(card), reliableID: Boolean(explicitID)};
    });
    const pageTitle = clean(document.title) || clean(document.querySelector('h1')?.innerText) || location.hostname;
    const limitations = ['Only the currently visible and loaded page sample was scanned.', 'Images, canvas content and cross-origin frames were not inspected.'];
    const pathID = token(location.pathname);
    const profilePath = /^\/(?:profile|profiles|user|users|member|members)\/[a-z0-9_-]+\/?$/i;
    const profileLinks = [...new Set(cards.flatMap(card => [card, ...card.querySelectorAll('a[href]')].slice(0,12).flatMap(anchor => {
      if (!anchor.matches('a[href]')) return [];
      try {
        const link = new URL(anchor.getAttribute('href'), location.href);
        return link.origin === expectedOrigin && !link.username && !link.password &&
          profilePath.test(link.pathname) ? [link.origin + link.pathname.replace(/\/$/, '')] : [];
      } catch { return []; }
    })))];
    const detailSample = detail => {
      const explicitID = token(detail.element.getAttribute('data-profile-id') || detail.element.getAttribute('data-user-id'));
      const routeID = profilePath.test(location.pathname) ? pathID : '';
      const id = 'profile-' + (explicitID || routeID || 'current');
      detail.element.setAttribute('data-lens-profile-id', id);
      return {id, title: 'Open profile', fields: detail.fields, reliableID: Boolean(explicitID || routeID)};
    };
    const collectionRoute = /^(|map|grid|browse|explore|search|home|nearby|profiles|members)$/i.test(pathID);
    const mapContext = /^(map|nearby)$/i.test(pathID) || Boolean(document.querySelector(
      '[role="application"][aria-label*="map" i], [class*="map" i] canvas, [class*="map" i] [class*="marker" i], [data-testid*="map" i]'));
    const detailCandidates = [...document.querySelectorAll('dialog,[role="dialog"],[aria-modal="true"],aside,[class*="profile" i],[data-profile],main,[role="main"]')]
      .filter(visible).slice(0, 200).map(element => ({element, fields: fieldsFor(element)}))
      .filter(item => item.fields.length >= 2).sort((a,b) => b.fields.length - a.fields.length ||
        a.element.getBoundingClientRect().width * a.element.getBoundingClientRect().height - b.element.getBoundingClientRect().width * b.element.getBoundingClientRect().height);
    const strongDetail = detailCandidates.find(item => item.element.matches('dialog,[role="dialog"],[aria-modal="true"]')) ||
      (!collectionRoute ? detailCandidates[0] : null);
    if (strongDetail) {
      const detail = strongDetail;
      profiles = [detailSample(detail)];
      return JSON.stringify({origin: location.origin, pageTitle, profiles, limitations, kind: 'detail', visibleReferenceCount: 1,
        sampleDescription: `Collected one open profile with ${detail.fields.length} readable fields on ${pageTitle} at ${location.origin}.`});
    }
    if (mapContext && profiles.length) {
      const mapObservations = profiles;
      profiles = profiles.map(profile => ({...profile, fields: []}));
      limitations.unshift('The map was treated as a reference view. Open profiles are required before setting preferences.');
      return JSON.stringify({origin: location.origin, pageTitle, profiles, mapObservations, profileLinks, limitations, kind: 'collection', visibleReferenceCount: profiles.length,
        sampleDescription: `Found ${profiles.length} visible map entries without using marker text as profile fields on ${pageTitle}.`});
    }
    if (profiles.some(profile => profile.fields.length)) {
      return JSON.stringify({origin: location.origin, pageTitle, profiles, profileLinks, limitations, kind: 'collection', visibleReferenceCount: profiles.length,
        sampleDescription: `Scanned ${profiles.length} visible loaded profile ${profiles.length === 1 ? 'card' : 'cards'} on ${pageTitle} at ${location.origin}.`});
    }
    if (detailCandidates.length) {
      const detail = detailCandidates[0];
      profiles = [detailSample(detail)];
      return JSON.stringify({origin: location.origin, pageTitle, profiles, limitations, kind: 'detail', visibleReferenceCount: 1,
        sampleDescription: `Collected one open profile with ${detail.fields.length} readable fields on ${pageTitle} at ${location.origin}.`});
    }
    if (profiles.length) limitations.unshift('Grid entries were visible, but their filter fields were not exposed on the grid.');
    else limitations.unshift('No readable profile grid or open profile was detected on this page.');
    return JSON.stringify({origin: location.origin, pageTitle, profiles, profileLinks, limitations, kind: profiles.length ? 'collection' : 'none', visibleReferenceCount: profiles.length,
      sampleDescription: profiles.length ? `Found ${profiles.length} visible grid entries without readable filter fields on ${pageTitle}.` : `No readable profiles were found on ${pageTitle}.`});
    """#

    static let wizardPreviewScript = #"""
    if (window.top !== window) return false;
    const styleID = 'lens-wizard-preview-style';
    let style = document.getElementById(styleID);
    if (!style) { style = document.createElement('style'); style.id = styleID; document.documentElement.append(style); }
    const state = window.__lensWizardPreview || {};
    state.mode = mode; state.reasons = reasons || {};
    const apply = () => {
      for (const card of document.querySelectorAll('[data-lens-profile-id]')) {
        const reason = state.mode === 'showAll' ? null : state.reasons[card.getAttribute('data-lens-profile-id')];
        card.toggleAttribute('data-lens-would-block', Boolean(reason));
        if (reason) {
          if (!card.hasAttribute('data-lens-original-title')) card.setAttribute('data-lens-original-title', card.getAttribute('title') || '');
          card.setAttribute('data-lens-block-reason', reason); card.setAttribute('title', reason);
        } else {
          card.removeAttribute('data-lens-block-reason');
          if (card.hasAttribute('data-lens-original-title')) {
            const original = card.getAttribute('data-lens-original-title');
            if (original) card.setAttribute('title', original); else card.removeAttribute('title');
            card.removeAttribute('data-lens-original-title');
          }
        }
      }
      style.textContent = state.mode === 'dim'
        ? '[data-lens-would-block]{opacity:.28!important;filter:saturate(.25)!important;outline:2px solid rgba(115,86,190,.72)!important;outline-offset:-2px!important}'
        : state.mode === 'hide' ? '[data-lens-would-block]{display:none!important}' : '';
    };
    if (!state.observer) {
      let timer;
      state.observer = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(apply, 180); });
      state.observer.observe(document.documentElement, {subtree:true, childList:true});
    }
    window.__lensWizardPreview = state; apply(); return true;
    """#
}
