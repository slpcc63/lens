'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const c=require('../src/core.cjs')();
const cfg=comfort=>({...c.defaults(),comfort});
const record=drugAbuse=>({_id:'507f1f77bcf86cd799439011',data:{profile:{extended:{health:{drugAbuse}}}}});
for(const [id,label] of c.comfortOptions) {
 test(label+' supports both appearance directions',()=>{
  const present=c.profilePatch(record([id])), absent=c.profilePatch(record([]));
  assert.equal(c.evaluate(present,cfg({[id]:'present'})).hide,false);
  assert.equal(c.evaluate(absent,cfg({[id]:'present'})).hide,true);
  assert.equal(c.evaluate(present,cfg({[id]:'absent'})).hide,true);
  assert.equal(c.evaluate(absent,cfg({[id]:'absent'})).hide,false);
 });
}
test('mixed comfort rules must all match',()=>{const rules=cfg({pnp:'absent',poppers:'present',discuss:'present'});assert.equal(c.evaluate({comfort:['poppers','discuss']},rules).hide,false);for(const values of [['poppers'],['discuss'],['poppers','discuss','pnp']])assert.equal(c.evaluate({comfort:values},rules).hide,true);});
test('unknown comfort is distinct from a known empty list',()=>{for(const direction of ['present','absent']){const rules=cfg({alcohol:direction});for(const data of [{},{comfort:null}]){assert.deepEqual(c.evaluate(data,rules).missing,['No Alcohol']);assert.equal(c.evaluate(data,rules).hide,false);assert.equal(c.evaluate(data,{...rules,missing:'hide'}).hide,true);}}assert.deepEqual(c.evaluate({comfort:[]},cfg({alcohol:'absent'})).missing,[]);});
test('all Any ignores comfort even with strict missing details',()=>assert.equal(c.evaluate({}, {...cfg({}),missing:'hide'}).hide,false));
test('legacy settings migrate both checkbox states and preserve other filters',()=>{const on=c.sanitizeConfig({noPnp:true,age:[30,45],activity:'10'});assert.deepEqual(on.comfort,{pnp:'absent'});assert.deepEqual(on.age,[30,45]);assert.equal(on.activity,'10');assert.deepEqual(c.sanitizeConfig({noPnp:false}).comfort,{});});
test('saved appearance rules take precedence over the old checkbox',()=>{assert.deepEqual(c.sanitizeConfig({noPnp:true,comfort:{}}).comfort,{});assert.deepEqual(c.sanitizeConfig({comfort:{pnp:'present',discuss:'absent',alcohol:'any',bad:'present',tobacco:'invalid'}}).comfort,{pnp:'present',discuss:'absent'});});
test('only the comfort field supplies options',()=>{assert.deepEqual(c.profilePatch({_id:'abcdef',data:{profile:{extended:{health:{carrying:['discuss'],practices:['pnp']}}}}}),{});assert.deepEqual(c.displayComfort(["Let’s Discuss",'No Other Drugs','No PNP']),['discuss','other','pnp']);assert.equal(c.displayComfort(['No PNP','an unknown label']),null);});
test('null or malformed updates invalidate the cached comfort field',()=>{for(const value of [null,{},true,'pnp',[{value:'pnp'}]])assert.deepEqual(c.profilePatch(record(value)),{comfort:null});assert.deepEqual(c.profilePatch({_id:'abcdef',data:{profile:{extended:{stats:{age:35}}}}}),{age:35});});
