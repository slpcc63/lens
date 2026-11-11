const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../src/core.cjs')();
test('Favorites save only valid IDs and user labels',()=>{
 assert.deepEqual(core.sanitizeFavorites([{id:'friend01',name:'  Alex  ',photos:['private']},{id:'../bad',name:'Bad'},null,{id:'friend02',name:' '}]),[{id:'friend01',name:'Alex'}]);
});
test('Favorites tolerate corrupt storage and deduplicate identities',()=>{
 for (const value of [null,{},'bad',42]) assert.deepEqual(core.sanitizeFavorites(value),[]);
 assert.deepEqual(core.sanitizeFavorites([{id:'friend01',name:'First'},{id:'friend01',name:'Second'}]),[{id:'friend01',name:'Second'}]);
});
test('Favorite names and list are bounded',()=>{
 assert.equal(core.sanitizeFavorites([{id:'friend01',name:'x'.repeat(100)}])[0].name.length,80);
 assert.equal(core.sanitizeFavorites(Array.from({length:600},(_,i)=>({id:'friend'+i,name:'Alex'}))).length,500);
});
test('Favorites retain only verified same-profile URLs and timestamps',()=>{
 assert.deepEqual(core.sanitizeFavorites([{id:'friend01',name:'Alex',url:'/profile/friend01',createdAt:'2026-10-26T00:00:00Z',updatedAt:'2026-10-26T01:00:00Z'}]),[{id:'friend01',name:'Alex',url:'/profile/friend01',createdAt:'2026-10-26T00:00:00Z',updatedAt:'2026-10-26T01:00:00Z'}]);
 for (const url of ['/profile/someoneelse','https://evil.test/profile/friend01','/profile/friend01/chat']) assert.equal(core.sanitizeFavorites([{id:'friend01',name:'Alex',url}])[0].url,undefined);
});
test('Profile routes yield stable IDs only on profile pages',()=>{
 assert.equal(core.routeProfileId('/profile/friend01'),'friend01');
 assert.equal(core.routeProfileId('/profile/friend01/chat'),'friend01');
 assert.equal(core.routeProfileId('/map'),null);
 assert.equal(core.profilePath('/profile/friend01','friend01'),'/profile/friend01');
});
