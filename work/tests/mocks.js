localStorage.removeItem('sniffies-comfort-filter.enabled.v1');
localStorage.removeItem('sniffies-comfort-filter.settings.v2');
localStorage.removeItem('sniffies-comfort-filter.rules.v1');
localStorage.removeItem('sniffies-comfort-filter.preference-ranges.v1');
localStorage.removeItem('sniffies-comfort-filter.favorites.v1');
class FixtureXHR extends EventTarget {
  open(method, url) { this.responseURL = url; this.method = method; }
  send() {}
  respond(payload, type = 'json') { this.responseType = type; this.response = payload; this.responseText = JSON.stringify(payload); this.dispatchEvent(new Event('load')); }
}
class FixtureSocket extends EventTarget {
  static OPEN = 1;
  constructor(url) { super(); this.url = url; }
  send() {}
  deliver(payload) { this.dispatchEvent(new MessageEvent('message', {data:JSON.stringify(payload)})); }
}
window.XMLHttpRequest = FixtureXHR;
window.WebSocket = FixtureSocket;
window.fixtureFetchResponse = null;
window.fetch = async function(url) {
  const response = new Response(JSON.stringify(window.fixtureFetchPayload), { headers:{'content-type':'application/json'} });
  Object.defineProperty(response, 'url', {value: String(url)});
  window.fixtureFetchResponse = response;
  return response;
};
