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
        let reasons = Dictionary(uniqueKeysWithValues: evaluations.filter { $0.outcome == .blocked }.map {
            ($0.profile.id, $0.reasons.joined(separator: " "))
        })
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
    const signature = element => {
      const classes = [...element.classList].filter(c => !/active|selected|hover|focus/i.test(c)).slice(0, 3).sort().join('.');
      const parent = element.parentElement;
      return `${element.tagName}.${classes}|${parent?.tagName || ''}.${[...(parent?.classList || [])].slice(0,2).sort().join('.')}`;
    };
    const candidates = [...document.querySelectorAll('article, li, [role="listitem"], [data-profile], [class*="profile" i], [class*="card" i]')]
      .filter(visible).filter(element => {
        const text = clean(element.innerText);
        const rect = element.getBoundingClientRect();
        return text.length >= 3 && text.length <= 1200 && rect.width <= innerWidth * 1.2 && rect.height <= innerHeight * 1.5;
      }).slice(0, 500);
    const groups = new Map();
    for (const element of candidates) {
      const key = signature(element), group = groups.get(key) || [];
      if (!group.some(parent => parent.contains(element))) group.push(element);
      groups.set(key, group);
    }
    let cards = [...groups.values()].filter(group => group.length >= 2)
      .sort((a,b) => b.length - a.length || clean(b[0]?.innerText).length - clean(a[0]?.innerText).length)[0] || [];
    if (!cards.length) {
      const parents = [...document.querySelectorAll('main, [role="main"], section, ul, ol, div')].filter(visible).slice(0, 300);
      const repeatedGroups = [];
      for (const parent of parents) {
        const byShape = new Map();
        for (const child of [...parent.children].filter(visible)) {
          const text = clean(child.innerText);
          if (text.length < 3 || text.length > 1200) continue;
          const classes = [...child.classList].filter(c => !/active|selected|hover|focus/i.test(c)).slice(0,3).sort().join('.');
          const key = `${child.tagName}.${classes}`;
          const group = byShape.get(key) || []; group.push(child); byShape.set(key, group);
        }
        for (const group of byShape.values()) if (group.length >= 2 && group.length <= 100) repeatedGroups.push(group);
      }
      cards = repeatedGroups.sort((a,b) => b.length - a.length || clean(b[0]?.innerText).length - clean(a[0]?.innerText).length)[0] || [];
    }
    cards = cards.slice(0, 80);
    const fieldKey = label => clean(label).toLowerCase().replace(/[^a-z0-9🍆🍑]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'unlabeled';
    const fieldsFor = card => {
      const found = new Map();
      const add = (label, value, source) => {
        label = clean(label); value = clean(value); source = clean(source || label);
        if (!label || !value || label === value || value.length > 180 || found.size >= 50) return;
        const key = fieldKey(label);
        if (!found.has(key)) found.set(key, {key, label, value, source});
      };
      for (const dt of card.querySelectorAll('dt')) {
        const dd = dt.nextElementSibling;
        if (dd?.matches('dd')) add(dt.innerText, dd.innerText, clean(dt.innerText));
      }
      for (const node of card.querySelectorAll('[data-label]')) add(node.getAttribute('data-label'), node.getAttribute('data-value') || node.innerText, node.getAttribute('data-label'));
      const text = clean(card.innerText);
      for (const line of String(card.innerText || '').split(/[\n\r]+/).slice(0, 80)) {
        const match = clean(line).match(/^([^:]{1,45}):\s*(.{1,180})$/);
        if (match) add(match[1], match[2], clean(line));
      }
      for (const row of card.querySelectorAll(':scope > *, :scope > * > *')) {
        if (!visible(row) || row.children.length !== 2) continue;
        const label = clean(row.children[0].innerText || row.children[0].getAttribute('aria-label'));
        const value = clean(row.children[1].innerText || row.children[1].getAttribute('aria-label'));
        if (label.length <= 45) add(label, value, label);
      }
      const accessible = [...card.querySelectorAll('[aria-label], img[alt], [title]')].slice(0, 80)
        .map(node => clean(node.getAttribute('aria-label') || node.getAttribute('alt') || node.getAttribute('title'))).filter(Boolean);
      const symbols = [...new Set((text + ' ' + accessible.join(' ')).match(/[🍆🍑]/gu) || [])];
      if (symbols.length) add('Position symbol', symbols.join(' '), 'Visible or accessible emoji');
      return [...found.values()];
    };
    const profiles = cards.map((card, index) => {
      const id = `scan-${index + 1}`;
      card.setAttribute('data-lens-profile-id', id);
      const titleNode = card.querySelector('h1,h2,h3,h4,[role="heading"],img[alt],[aria-label]');
      const title = clean(titleNode?.innerText || titleNode?.getAttribute('alt') || titleNode?.getAttribute('aria-label')) || `Visible profile ${index + 1}`;
      return {id, title, fields: fieldsFor(card)};
    });
    const pageTitle = clean(document.title) || clean(document.querySelector('h1')?.innerText) || location.hostname;
    const limitations = ['Only the currently visible and loaded page sample was scanned.', 'Images, canvas content and cross-origin frames were not inspected.'];
    if (!profiles.length) limitations.unshift('No repeated visible profile-card structure was detected on this page.');
    return JSON.stringify({
      origin: location.origin,
      pageTitle,
      sampleDescription: `Scanned ${profiles.length} visible loaded profile ${profiles.length === 1 ? 'card' : 'cards'} on ${pageTitle} at ${location.origin}.`,
      profiles,
      limitations
    });
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
