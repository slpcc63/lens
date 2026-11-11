const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../src/core.cjs')();
for (const [actual,icons] of [['bottom',['bottom-icon']],['vers-bottom',['bottom-icon','vers-bottom-icon']],['top',['top-icon']],['vers-top',['top-icon','vers-top-icon']],['vers',['vers-icon']],['side',['side-icon']]]) {
 test('Reads map position '+actual,()=>assert.equal(core.positionFromIcons(icons),actual));
}
test('Unknown, incomplete and conflicting icons remain unknown',()=>{
 for (const icons of [[],['peach'],['vers-bottom-icon'],['vers-top-icon'],['top-icon','bottom-icon'],['vers-icon','top-icon']]) assert.equal(core.positionFromIcons(icons),null);
});
test('Every ordinary bottom preference includes all peach positions',()=>{
 for (const selected of ['bottom','bottom-sub','bottom-power']) for (const [actual] of core.positions) assert.equal(core.matchesPosition(selected,actual),['bottom','bottom-sub','bottom-power','vers-bottom'].includes(actual));
});
test('Every ordinary top preference includes all eggplant positions',()=>{
 for (const selected of ['top','top-sub','top-dom']) for (const [actual] of core.positions) assert.equal(core.matchesPosition(selected,actual),['top','top-sub','top-dom','vers-top'].includes(actual));
});
test('Vers variants, Vers and Side only match themselves',()=>{
 for (const selected of ['vers-bottom','vers-top','vers','side']) for (const [actual] of core.positions) assert.equal(core.matchesPosition(selected,actual),selected===actual);
});
test('Icon-derived position still combines with other filters',()=>{
 const config=core.sanitizeConfig({comfort:{pnp:'absent'},positions:['bottom'],age:[30,40],missing:'hide'});
 assert.equal(core.evaluate({position:core.positionFromIcons(['bottom-icon','vers-bottom-icon']),comfort:[],age:35},config).hide,false);
 assert.equal(core.evaluate({position:'bottom',comfort:['pnp'],age:35},config).hide,true);
 assert.equal(core.evaluate({position:'bottom'},config).hide,true);
});
