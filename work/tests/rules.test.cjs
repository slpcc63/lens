'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const c = require('../src/core.cjs')();
const now = Date.parse('2026-10-26T12:00:00Z');
const has = attribute => ({condition:'has',attribute});
const not = attribute => ({condition:'not',attribute});

test('rule groups sanitize independently and prevent duplicates',()=>{
 const groups=c.sanitizeRuleGroups({filters:[has('comfort:pnp'),has('comfort:pnp')],top:[not('body:athletic')],bottom:[has('bad:value')]});
 assert.deepEqual(groups,{filters:[has('comfort:pnp')],top:[not('body:athletic')],bottom:[]});
});
test('legacy categorical settings migrate without changing numeric ranges',()=>{
 const config=c.sanitizeConfig({comfort:{pnp:'absent'},bodies:['athletic'],positions:['top'],activity:'10',age:[30,40]});
 assert.deepEqual(c.rulesFromConfig(config),[not('comfort:pnp'),has('body:athletic'),has('position:top'),has('activity:10')]);
 assert.deepEqual(config.age,[30,40]);
});
test('Has and Does not have evaluate known fields',()=>{
 const data={comfort:['pnp'],body:'athletic',position:'vers-top'};
 assert.equal(c.ruleMatches(data,has('comfort:pnp'),now),true);
 assert.equal(c.ruleMatches(data,not('comfort:poppers'),now),true);
 assert.equal(c.ruleMatches(data,has('position:top'),now),true);
 assert.equal(c.ruleMatches(data,not('body:athletic'),now),false);
 assert.equal(c.ruleMatches({},not('body:athletic'),now),null);
});
test('filter rules retain OR behavior for multiple values in one category',()=>{
 const rules=[has('body:athletic'),has('body:muscular'),not('comfort:pnp')];
 assert.equal(c.evaluateRuleSet({body:'athletic',comfort:[]},rules,now).hide,false);
 assert.equal(c.evaluateRuleSet({body:'average',comfort:[]},rules,now).hide,true);
 assert.equal(c.evaluateRuleSet({body:'muscular',comfort:['pnp']},rules,now).hide,true);
});
test('missing rule data follows the configured visibility policy',()=>{
 assert.equal(c.evaluateRuleSet({},[has('body:athletic')],now,'show').hide,false);
 assert.equal(c.evaluateRuleSet({},[has('body:athletic')],now,'hide').hide,true);
});
test('preference score requires strictly greater than 75 percent',()=>{
 const data={comfort:['alcohol','cannabis','tobacco','poppers','pnp','other','discuss']};
 const rules=['alcohol','cannabis','tobacco','poppers','pnp','other','discuss'].map(id=>has('comfort:'+id));
 assert.equal(c.scoreRules(data,rules.slice(0,4).map((rule,i)=>i===3?has('body:athletic'):rule),now).percentage,75);
 assert.equal(c.scoreRules(data,rules.slice(0,4).map((rule,i)=>i===3?has('body:athletic'):rule),now).qualifies,false);
 assert.equal(c.scoreRules(data,rules.slice(0,5).map((rule,i)=>i===4?has('body:athletic'):rule),now).percentage,80);
 assert.equal(c.scoreRules(data,rules.slice(0,5).map((rule,i)=>i===4?has('body:athletic'):rule),now).qualifies,true);
});
test('empty preferences never qualify and groups score independently',()=>{
 assert.equal(c.scoreRules({body:'athletic'},[],now).qualifies,false);
 assert.equal(c.scoreRules({body:'athletic'},[has('body:athletic')],now).qualifies,true);
 assert.equal(c.scoreRules({body:'athletic'},[has('body:muscular')],now).qualifies,false);
});
test('numeric preference ranges score independently and combine with categorical rules',()=>{
 const ranges={age:[30,40],height:[null,null],weight:[80,90],endowment:[null,null]};
 const numeric=c.scoreRanges({age:34,weight:82},ranges);
 assert.deepEqual(numeric,{matched:2,total:2,percentage:100,qualifies:true});
 assert.equal(c.scoreRanges({age:50,weight:82},ranges).percentage,50);
 assert.equal(c.combineScores(numeric,c.scoreRules({body:'athletic'},[has('body:athletic')],now)).qualifies,true);
 assert.equal(c.scoreRanges({},{}).qualifies,false);
});
