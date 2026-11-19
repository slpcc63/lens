export function portalScript() {
return `
let current = null;
const status = document.getElementById('status');
const post = value => {
 if (!window.webkit?.messageHandlers?.lensSync) { status.textContent = 'Open account sync from Lens to transfer settings.'; return; }
 window.webkit.messageHandlers.lensSync.postMessage(value);
};
async function load() {
 try {
  const response = await fetch('/api/lens?format=json', {cache:'no-store'});
  if (!response.ok) throw new Error('Account settings could not be loaded. Sign in again or retry.');
  current = await response.json();
  document.getElementById('account').textContent = current.email;
  document.getElementById('count').textContent = current.snapshot.sites.length + ' saved sites in this account.';
  status.textContent = 'Ready. Choose which copy you want to use.';
  document.getElementById('download').disabled = false;
  document.getElementById('upload').disabled = false;
 } catch (error) { status.textContent = error.message; }
}
document.getElementById('download').onclick = () => { if (current) post({type:'download', userId:current.userId, snapshot:current.snapshot}); };
document.getElementById('upload').onclick = () => { if (current) post({type:'requestUpload', userId:current.userId, revision:current.revision}); };
document.getElementById('refresh').onclick = load;
document.getElementById('signout').onclick = async () => {
 const response = await fetch('/api/auth/sign-out', {method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 if (response.ok) location.reload(); else status.textContent = 'Sign-out failed. Try again.';
};
window.lensUploadDevice = async (snapshot, expectedRevision, expectedUser) => {
 if (!current || expectedUser !== current.userId || expectedRevision !== current.revision) { status.textContent = 'Account changed. Refresh and review before syncing.'; return; }
 document.getElementById('upload').disabled = true;
 try {
  const response = await fetch('/api/lens', {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision,snapshot,accountId:expectedUser})});
  if (response.status === 409) { status.textContent = 'Another device changed your account settings. Refresh and review both copies before trying again.'; return; }
  if (!response.ok) throw new Error('Settings were not uploaded. Your device copy is unchanged.');
  await load(); status.textContent = 'Device settings saved to your account. Open Lens account sync on your other device to download them.';
 } catch(error) { status.textContent = error.message; }
 finally { document.getElementById('upload').disabled = false; }
};
load();`;
}
export function portalHTML(nonce) {
 return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>Lens account sync</title><style nonce="${nonce}">
body{font:17px -apple-system,BlinkMacSystemFont,sans-serif;margin:24px;line-height:1.5;max-width:48rem}button{font:inherit;min-height:44px;padding:10px 16px;margin:8px 0;display:block}#status{white-space:pre-wrap}button:focus-visible{outline:3px solid #9474ff}
</style></head><body><h1>Lens account sync</h1><p id="account"></p><p id="count"></p><p>Sync saved sites, site settings, and account-name reminders. Website passwords, cookies and browsing history stay out of sync.</p><p>Sync is manual. Review which copy to keep before replacing it.</p><button id="download" disabled>Use account settings on this device</button><button id="upload" disabled>Replace account settings with this device</button><button id="refresh">Refresh account settings</button><p id="status" role="status">Loading…</p><button id="signout">Sign out of this account</button><script nonce="${nonce}">${portalScript()}</script></body></html>`;
}
