const ids = {a:'507f1f77bcf86cd799439011',b:'507f1f77bcf86cd799439012',c:'507f1f77bcf86cd799439013',me:'507f1f77bcf86cd799439099'};
const field = (id, values) => ({_id:id,data:{profile:{extended:{health:{drugAbuse:values}}}}});
const wait = () => new Promise(resolve=>setTimeout(resolve,170));
const q = selector=>document.querySelector(selector);
const controls = ()=>q('#scf-controls-v1').shadowRoot;
const hidden = id=>document.getElementById(id)?.hasAttribute('data-scf-hidden');
const check = (condition,message)=>{if(!condition)throw new Error(message);};
const map = q('#map');
map.innerHTML=Object.entries(ids).map(([name,id])=>`<div id="${id}" class="marker-container ${name==='me'?'current-visitor':'user'}" data-testid="${name==='me'?'cv-marker-container':'markerUserContainer'}">${name==='me'?'You':'Profile '+name.toUpperCase()}</div>`).join('');
q('#run').onclick = async () => {
 q('#run').disabled=true;
 q('#results').textContent='';
 let passed=0,failed=0;
 const test = async (name, fn) => {const li=document.createElement('li');try {await fn();passed++;li.className='pass';li.textContent='PASS — '+name;}catch(error){failed++;li.className='fail';li.textContent='FAIL — '+name+': '+error.message;}q('#results').append(li);};
 const socket=new WebSocket('wss://api.sniffies.com/socket');
 const xhr=new XMLHttpRequest();xhr.open('POST','https://api.sniffies.com/api/user/partials');
 await wait();
 await test('Unknown profiles stay visible',()=>check(!hidden(ids.a)&&!hidden(ids.b)&&!hidden(ids.c),'unknown marker hidden'));
 await test('WebSocket data hides only the exact comfort option',async()=>{socket.deliver({users:[field(ids.a,['pnp']),field(ids.b,['poppers'])]});await wait();check(hidden(ids.a)&&!hidden(ids.b)&&!hidden(ids.c),'wrong marker visibility');});
 await test('WebSocket constructor and constants remain usable',()=>check(socket instanceof FixtureSocket&&WebSocket.OPEN===1,'constructor changed'));
 await test('Unrelated text does not match',async()=>{xhr.respond([{_id:ids.c,blurb:'No PNP'}]);await wait();check(!hidden(ids.c),'bio was treated as comfort field');});
 await test('Partial updates preserve known comfort levels',async()=>{xhr.respond([{_id:ids.a,data:{profile:{extended:{stats:{age:35}}}}}]);await wait();check(hidden(ids.a),'partial update lost match');});
 await test('An explicit changed field restores a profile',async()=>{xhr.respond([field(ids.a,[])]);await wait();check(!hidden(ids.a),'empty field not restored');});
 await test('Text XHR responses are supported on a reused request',async()=>{xhr.open('POST','https://api.sniffies.com/api/user/partials');xhr.respond([field(ids.a,['pnp'])],'text');await wait();check(hidden(ids.a),'text response missed');});
 await test('A withdrawn field clears earlier knowledge',async()=>{xhr.respond([field(ids.a,null)]);await wait();check(!hidden(ids.a),'withdrawn field remained hidden');});
 await test('Fetch preserves original response and body',async()=>{window.fixtureFetchPayload={users:[field(ids.a,['pnp'])]};const response=await fetch('https://api.sniffies.com/api/map');check(response===window.fixtureFetchResponse,'response replaced');const payload=await response.json();check(payload.users[0]._id===ids.a,'body altered');await wait();check(hidden(ids.a),'fetch result missed');});
 await test('Other website responses are ignored',async()=>{window.fixtureFetchPayload={users:[field(ids.b,['pnp'])]};await fetch('https://sniffies.com.evil.test/api');await wait();check(!hidden(ids.b),'unrelated origin observed');});
 await test('Own marker is never hidden',async()=>{socket.deliver({users:[field(ids.me,['pnp'])]});await wait();check(!hidden(ids.me),'own marker hidden');});
 await test('New map markers inherit known filtering',async()=>{const marker=document.getElementById(ids.a);marker.remove();await wait();map.append(marker);await wait();check(hidden(ids.a),'reinserted marker not filtered');});
 await test('Recycled marker identities do not inherit a previous match',async()=>{const marker=document.getElementById(ids.a);marker.id='507f1f77bcf86cd799439014';await wait();check(!marker.hasAttribute('data-scf-hidden'),'recycled marker kept hidden');marker.id=ids.a;await wait();check(hidden(ids.a),'restored identity not filtered');});
 await test('An opened profile updates its map pin without a blocking alert',async()=>{q('#profile-area').innerHTML=`<app-profile><div id="profile-${ids.c}"><h2>Synthetic profile C</h2><profile-cruiser-stats-row><div class="profile-cruiser-stats-row-title">My Comfort Levels</div><profile-cruiser-stats-badge>No PNP</profile-cruiser-stats-badge></profile-cruiser-stats-row></div></app-profile>`;await wait();check(hidden(ids.c),'visible field not detected');check(!q('app-profile').hasAttribute('data-scf-masked'),'profile was masked');check(!controls().getElementById('notice'),'blocking alert still exists');});
 await test('Pause immediately restores map and open profile',async()=>{controls().getElementById('toggle').click();check(!hidden(ids.a)&&!hidden(ids.c),'markers not restored');check(!q('app-profile').hasAttribute('data-scf-masked'),'profile not restored');check(localStorage.getItem('sniffies-comfort-filter.enabled.v1')==='false','preference not saved');});
 await test('Turning filter on restores filtering',async()=>{controls().getElementById('toggle').click();check(hidden(ids.a)&&hidden(ids.c),'filter not reenabled');});
 await test('Navigating away removes the profile notice',async()=>{q('#profile-area').textContent='';await wait();check(!controls().getElementById('notice'),'stale notice');});
 await test('Visible nonmatching comfort field restores previous match',async()=>{q('#profile-area').innerHTML=`<app-profile><div id="profile-${ids.c}"><profile-cruiser-stats-row><div class="profile-cruiser-stats-row-title">My Comfort Levels</div><profile-cruiser-stats-badge>No Poppers</profile-cruiser-stats-badge></profile-cruiser-stats-row></div></app-profile>`;await wait();check(!hidden(ids.c),'changed visible field not restored');q('#profile-area').textContent='';});
 await test('The pause control responds to settings from another tab',async()=>{window.dispatchEvent(new StorageEvent('storage',{key:'sniffies-comfort-filter.enabled.v1',newValue:'false'}));await wait();check(!hidden(ids.a),'storage change ignored');window.dispatchEvent(new StorageEvent('storage',{key:'sniffies-comfort-filter.enabled.v1',newValue:'true'}));await wait();check(hidden(ids.a),'reenable storage change ignored');});
 await test('Coverage distinguishes unchecked profiles',()=>check(controls().getElementById('coverage').textContent.includes('checked'),'coverage unavailable'));
 const openPanel = () => {if(controls().getElementById('panel').hidden)controls().getElementById('chip').click();};
 const writeRules = groups => {localStorage.setItem('sniffies-comfort-filter.rules.v1',JSON.stringify(groups));window.dispatchEvent(new StorageEvent('storage',{key:'sniffies-comfort-filter.rules.v1',newValue:JSON.stringify(groups)}));};
 const writePreferenceRanges = groups => {localStorage.setItem('sniffies-comfort-filter.preference-ranges.v1',JSON.stringify(groups));window.dispatchEvent(new StorageEvent('storage',{key:'sniffies-comfort-filter.preference-ranges.v1',newValue:JSON.stringify(groups)}));};
 const setFilters = (values={}) => {
  openPanel(); controls().getElementById('reset').click();
  const rules=[];
  for(const [key,value] of Object.entries(values)) {
   if(key==='bodies'||key==='positions')for(const id of value)rules.push({condition:'has',attribute:`${key==='bodies'?'body':'position'}:${id}`});
   else if(key==='activity')rules.push({condition:'has',attribute:`activity:${value}`});
   else if(key==='no-pnp'&&value)rules.push({condition:'not',attribute:'comfort:pnp'});
   else if(key.startsWith('comfort-')&&value!=='any')rules.push({condition:value==='present'?'has':'not',attribute:`comfort:${key.slice(8)}`});
   else controls().getElementById(key).value=value;
  }
  writeRules({filters:rules,top:[],bottom:[]});
  controls().getElementById('apply').click();
 };
 const now=Date.now();
 const stats=(id,age,height,weight,length,body,position,connected,disconnected)=>({_id:id,data:{profile:{extended:{stats:{age,heightInCm:height,weightInKg:weight,endowment:{lengthInCm:length},body},sexuality:{attitude:position},health:{drugAbuse:[]}}},connectUpdateTime:new Date(connected).toISOString(),disconnectTime:new Date(disconnected).toISOString()}});
 socket.deliver({users:[stats(ids.a,34,175,82,18,'athletic','vers-top',now-60000,now-3600000),stats(ids.b,50,185,100,15,'average','bottom',now-26*60000,now-25*60000)]});await wait();
 await test('Age range hides profiles outside the chosen ages',async()=>{setFilters({'age-min':'30','age-max':'40'});check(!hidden(ids.a)&&hidden(ids.b)&&!hidden(ids.c),'age range incorrect');});
 await test('Feet and inches height range matches site storage',async()=>{setFilters({'height-min':'5\'8"','height-max':'5\'10"'});check(!hidden(ids.a)&&hidden(ids.b),'height range incorrect');});
 await test('Pound weight range matches site storage',async()=>{setFilters({'weight-min':'175','weight-max':'185'});check(!hidden(ids.a)&&hidden(ids.b),'weight range incorrect');});
 await test('Endowment range filters independently',async()=>{setFilters({'endowment-min':'7','endowment-max':'8'});check(!hidden(ids.a)&&hidden(ids.b),'endowment range incorrect');});
 await test('Multiple body types can be selected',async()=>{setFilters({bodies:['athletic','muscular']});check(!hidden(ids.a)&&hidden(ids.b),'body types incorrect');});
 await test('Multiple positions can be selected',async()=>{setFilters({positions:['vers-top','top']});check(!hidden(ids.a)&&hidden(ids.b),'positions incorrect');});
 await test('Several filters apply together',async()=>{setFilters({'age-min':'30','age-max':'40','weight-min':'175',bodies:['athletic'],positions:['vers-top']});check(!hidden(ids.a)&&hidden(ids.b),'combined filter incorrect');});
 await test('Strict missing-details option hides unchecked profiles',async()=>{setFilters({'age-min':'30','age-max':'40',missing:'hide'});check(!hidden(ids.a)&&hidden(ids.b)&&hidden(ids.c),'unknown policy incorrect');});
 await test('Online-now selection uses live connection status',async()=>{setFilters({activity:'now'});check(!hidden(ids.a)&&hidden(ids.b)&&!hidden(ids.c),'online now incorrect');});
 await test('10-minute selection excludes a profile last online 25 minutes ago',async()=>{setFilters({activity:'10'});check(!hidden(ids.a)&&hidden(ids.b),'10-minute filter incorrect');});
 await test('30-minute selection includes a profile last online 25 minutes ago',async()=>{setFilters({activity:'30'});check(!hidden(ids.a)&&!hidden(ids.b),'30-minute filter incorrect');});
 await test('One-hour selection includes a profile last online 55 minutes ago',async()=>{socket.deliver({users:[stats(ids.c,35,175,82,18,'athletic','vers-top',now-56*60000,now-55*60000)]});await wait();setFilters({activity:'60'});check(!hidden(ids.c),'one-hour filter incorrect');setFilters({activity:'30'});check(hidden(ids.c),'old profile passed shorter window');});
 await test('Awake events immediately restore an online profile',async()=>{setFilters({activity:'now'});check(hidden(ids.b),'setup failed');socket.deliver({eventName:'userAwake',data:ids.b});await wait();check(!hidden(ids.b),'awake event missed');});
 await test('Disconnect events remove profiles from Online now',async()=>{socket.deliver({eventName:'userDisconnected',data:ids.a});await wait();check(hidden(ids.a),'disconnect event missed');});
 await test('Delayed snapshots cannot undo a fresh disconnection',async()=>{xhr.respond({users:[stats(ids.a,34,175,82,18,'athletic','vers-top',now-60000,now-3600000)]});await wait();check(hidden(ids.a),'delayed snapshot revived disconnected profile');});
 await test('Activity windows recalculate as local time passes without fetching profiles',async()=>{setFilters({activity:'30'});check(!hidden(ids.a),'setup failed');const realNow=Date.now;try{Date.now=()=>realNow()+31*60000;document.dispatchEvent(new Event('visibilitychange'));await wait();check(hidden(ids.a)&&!hidden(ids.b),'elapsed time not applied');}finally{Date.now=realNow;document.dispatchEvent(new Event('visibilitychange'));await wait();}});
 await test('A socket loss turns online status into unknown',async()=>{setFilters({activity:'now',missing:'hide'});socket.dispatchEvent(new Event('close'));await wait();check(hidden(ids.b),'stale online status still treated as live');socket.deliver({eventName:'userAwake',data:ids.b});await wait();check(!hidden(ids.b),'fresh status not restored');});
 await test('Invalid reversed range leaves saved filters unchanged',async()=>{setFilters({'age-min':'30','age-max':'40'});const saved=localStorage.getItem('sniffies-comfort-filter.settings.v2');openPanel();controls().getElementById('age-min').value='60';controls().getElementById('apply').click();check(!controls().getElementById('error').hidden,'missing error');check(localStorage.getItem('sniffies-comfort-filter.settings.v2')===saved,'invalid settings saved');});
 await test('Reversed bounds are rejected even when both round to the same site value',async()=>{setFilters({});openPanel();controls().getElementById('endowment-min').value='7.1';controls().getElementById('endowment-max').value='7';controls().getElementById('apply').click();check(!controls().getElementById('error').hidden,'rounded reversed range accepted');});
 await test('Changing units converts existing ranges before applying',async()=>{setFilters({'height-min':'5\'9"','height-max':'6\'0"','weight-min':'180'});openPanel();const units=controls().getElementById('units');units.value='metric';units.dispatchEvent(new Event('change'));check(controls().getElementById('height-min').value==='175','height not converted: '+controls().getElementById('height-min').value);check(controls().getElementById('weight-min').value==='82','weight not converted');controls().getElementById('apply').click();const saved=JSON.parse(localStorage.getItem('sniffies-comfort-filter.settings.v2'));check(saved.units==='metric'&&saved.height[0]===175,'metric settings not saved');});
 await test('Visible labeled stats support the expanded filters',async()=>{setFilters({'age-min':'30','age-max':'40'});q('#profile-area').innerHTML=`<app-profile><div id="profile-${ids.b}"><profile-stats><span data-testid="ageStat">34</span><span data-testid="heightInCmStat">175cm</span><span data-testid="weightInKgStat">82kg</span><span data-testid="endowmentStat">18cm cut</span><span data-testid="bodyStat">Fit</span><span data-testid="attitudeStat">Vers Top</span></profile-stats></div></app-profile>`;await wait();check(!hidden(ids.b),'DOM stats not used');q('#profile-area').textContent='';});
 await test('Saved settings and categorical rules survive reopening',async()=>{setFilters({'age-min':'30','age-max':'40',bodies:['athletic'],positions:['vers-top'],activity:'30'});openPanel();check(controls().getElementById('age-min').value==='30','age lost');const saved=JSON.parse(localStorage.getItem('sniffies-comfort-filter.rules.v1'));check(saved.filters.some(r=>r.attribute==='body:athletic')&&saved.filters.some(r=>r.attribute==='position:vers-top')&&saved.filters.some(r=>r.attribute==='activity:30'),'rules lost');});
 await test('Reset clears added filters and preserves the original default rule',async()=>{controls().getElementById('reset').click();controls().getElementById('apply').click();const saved=JSON.parse(localStorage.getItem('sniffies-comfort-filter.settings.v2')),rules=JSON.parse(localStorage.getItem('sniffies-comfort-filter.rules.v1'));check(rules.filters.length===1&&rules.filters[0].condition==='not'&&rules.filters[0].attribute==='comfort:pnp'&&saved.age.every(v=>v===null),'reset incorrect');});
 await test('Minimized control is a compact accessible Lens icon',()=>{const chip=controls().getElementById('chip');check(!!chip.querySelector('img[src^="data:image/png"]'),'Lens icon missing');check(chip.getAttribute('aria-label').includes('Lens'),'accessible label missing');chip.click();check(!controls().getElementById('panel').hidden,'icon did not restore interface');controls().getElementById('close').click();});
 await test('Pause, Settings, Help, and close controls share the header',()=>{openPanel();const root=controls(),header=root.querySelector('header');check(['toggle','settings-button','help-button','close'].every(id=>header.contains(root.getElementById(id))),'header controls missing');root.getElementById('settings-button').click();check(!root.getElementById('settings-view').hidden&&root.getElementById('main-view').hidden,'Settings did not open');root.getElementById('help-button').click();check(!root.getElementById('help-view').hidden&&root.getElementById('settings-view').hidden,'Help did not open');root.getElementById('help-button').click();root.getElementById('close').click();});
 await test('Height uses select boxes and endowment preserves entered inches',()=>{setFilters({'endowment-min':'7'});openPanel();const root=controls();check(root.getElementById('height-min').tagName==='SELECT'&&root.getElementById('height-max').tagName==='SELECT','height is not selectable');check(root.getElementById('endowment-min').value==='7','endowment value changed after save');root.getElementById('close').click();});
 await test('Two-dropdown builder stores independent groups and blocks duplicates',async()=>{
  openPanel();const root=controls(),attribute=root.getElementById('rule-attribute'),condition=root.getElementById('rule-condition'),filtersBefore=JSON.stringify(JSON.parse(localStorage.getItem('sniffies-comfort-filter.rules.v1')).filters);
  root.querySelector('[data-rule-group="top"]').click();condition.value='has';attribute.value='comfort:alcohol';root.getElementById('add-rule').click();root.getElementById('add-rule').click();
  check(root.getElementById('rule-status').textContent.includes('already in'),'duplicate accepted');
  root.querySelector('[data-rule-group="bottom"]').click();condition.value='not';attribute.value='comfort:pnp';root.getElementById('add-rule').click();
  const saved=JSON.parse(localStorage.getItem('sniffies-comfort-filter.rules.v1'));
  check(saved.top.length===1&&saved.bottom.length===1&&JSON.stringify(saved.filters)===filtersBefore,'groups were not independent');
  root.querySelector('[data-rule-group="top"]').click();root.querySelector('.rule-remove').click();
  check(JSON.parse(localStorage.getItem('sniffies-comfort-filter.rules.v1')).top.length===0,'individual remove failed');root.getElementById('close').click();
 });
 await test('Role and body use dedicated choices instead of the comfort builder',()=>{openPanel();const root=controls();check(root.querySelectorAll('[data-category-rule^="position:"]').length===10&&root.querySelectorAll('[data-category-rule^="body:"]').length===7,'dedicated controls missing');check([...root.getElementById('rule-attribute').options].every(option=>option.value.startsWith('comfort:')),'non-comfort field in presence builder');root.getElementById('close').click();});
 await test('Exact 75 percent is not highlighted',async()=>{writeRules({filters:[],top:[{condition:'has',attribute:'body:athletic'},{condition:'has',attribute:'position:vers-top'},{condition:'not',attribute:'comfort:pnp'},{condition:'has',attribute:'comfort:poppers'}],bottom:[]});await wait();check(!q(`[id="${ids.a}"]`).hasAttribute('data-scf-preference'),'75 percent qualified');});
 await test('Greater than 75 percent uses blue Top highlighting',async()=>{writeRules({filters:[],top:[{condition:'has',attribute:'body:athletic'},{condition:'has',attribute:'position:vers-top'},{condition:'not',attribute:'comfort:pnp'},{condition:'has',attribute:'comfort:poppers'},{condition:'not',attribute:'comfort:tobacco'}],bottom:[]});await wait();check(q(`[id="${ids.a}"]`).getAttribute('data-scf-preference')==='top','Top highlight missing');});
 await test('Bottom and combined preference highlighting are independent',async()=>{const matches=[{condition:'has',attribute:'body:athletic'},{condition:'has',attribute:'position:vers-top'}];writeRules({filters:[],top:[],bottom:matches});await wait();check(q(`[id="${ids.a}"]`).getAttribute('data-scf-preference')==='bottom','Bottom highlight missing');writeRules({filters:[],top:matches,bottom:matches});await wait();check(q(`[id="${ids.a}"]`).getAttribute('data-scf-preference')==='both','combined highlight missing');});
 await test('Empty preferences and filtered profiles never highlight',async()=>{writeRules({filters:[],top:[],bottom:[]});await wait();check(!q(`[id="${ids.a}"]`).hasAttribute('data-scf-preference'),'empty group highlighted');writeRules({filters:[{condition:'has',attribute:'body:average'}],top:[{condition:'has',attribute:'body:athletic'}],bottom:[]});await wait();check(hidden(ids.a)&&!q(`[id="${ids.a}"]`).hasAttribute('data-scf-preference'),'hidden profile retained highlight');});
 await test('Top and Bottom numeric ranges appear, persist independently, and visibly highlight',async()=>{writeRules({filters:[],top:[],bottom:[]});writePreferenceRanges({top:{},bottom:{}});openPanel();const root=controls();root.querySelector('[data-rule-group="top"]').click();root.getElementById('age-min').value='30';root.getElementById('age-max').value='40';root.getElementById('apply').click();await wait();check(q(`[id="${ids.a}"]`).getAttribute('data-scf-preference')==='top','numeric Top match not highlighted');const topStyle=getComputedStyle(q(`[id="${ids.a}"]`));check(topStyle.outlineStyle==='solid'&&topStyle.boxShadow!=='none','Top color not visibly styled');openPanel();root.querySelector('[data-rule-group="top"]').click();check(root.getElementById('age-min').value==='30'&&root.getElementById('age-max').value==='40','Top range not restored');root.querySelector('[data-rule-group="bottom"]').click();check(root.getElementById('age-min').value===''&&root.getElementById('age-max').value==='','Bottom inherited Top range');root.getElementById('weight-min').value='175';root.getElementById('weight-max').value='200';root.getElementById('apply').click();await wait();check(q(`[id="${ids.a}"]`).getAttribute('data-scf-preference')==='both','independent numeric Bottom match not combined');check(getComputedStyle(q(`[id="${ids.a}"]`)).boxShadow!=='none','combined color not visibly styled');});
 setFilters({'no-pnp':true});

 await test('Map startup list hides a pin before any profile is opened, even without a transport hook',async()=>{
  const wrapped=q(`[id="${ids.a}"]`), outer=document.createElement('div');outer.className='maplibregl-marker';outer.tabIndex=0;wrapped.before(outer);outer.append(wrapped);
  const decoded=JSON.parse(JSON.stringify({nearbyVisitors:{visitors:[field(ids.a,['pnp']),field(ids.b,[])]},messages:[{text:'untouched'}]}));
  await wait();check(hidden(ids.a)&&!hidden(ids.b),'map list missed');check(outer.hasAttribute('data-scf-hidden')&&getComputedStyle(outer).display==='none'&&outer.inert,'whole map hit area still visible');check(!q('app-profile'),'test relied on opened profile');check(decoded.messages[0].text==='untouched'&&decoded.nearbyVisitors.visitors.length===2,'site data changed');
 });
 await test('Map lists larger than the response copy limit are read when the app decodes them',async()=>{
  JSON.parse(JSON.stringify({nearbyVisitors:{visitors:[field(ids.b,['pnp'])]},unrelatedPadding:'x'.repeat(4*1024*1024+5)}));await wait();check(hidden(ids.b),'large startup response lost');
 });
 await test('Advanced-search map lists are observed without changing JSON revivers',async()=>{
  const decoded=JSON.parse(JSON.stringify({result:{nearbyUsers:[field(ids.b,[])]},label:'before'}),(key,value)=>key==='label'?'after':value);
  await wait();check(!hidden(ids.b)&&decoded.label==='after','map list or reviver changed');let failed=false;try{JSON.parse('{bad')}catch{failed=true}check(failed,'parse errors swallowed');
 });
 await test('A carousel card and pin with the same ID both disappear',async()=>{
  const carousel=document.createElement('app-cruisers-carousel');carousel.innerHTML=`<app-cruiser-card><button data-testid="cruiserCard" id="${ids.a}">Synthetic A</button></app-cruiser-card><app-cruiser-card><button data-testid="cruiserCard" id="${ids.b}">Synthetic B</button></app-cruiser-card>`;map.append(carousel);await wait();const cards=carousel.querySelectorAll('app-cruiser-card');check(getComputedStyle(cards[0]).display==='none'&&cards[0].inert,'matching card visible');check(getComputedStyle(cards[1]).display!=='none','matching card hid neighbor');
 });
 await test('Recycled map wrappers and carousel cards restore their hit areas',async()=>{
  const nodes=[...map.querySelectorAll(`[id="${ids.a}"]`)];for(const node of nodes)node.id=ids.b;await wait();for(const node of nodes){const outer=node.closest('app-cruiser-card, .maplibregl-marker');check(!node.hasAttribute('data-scf-hidden')&&!outer.hasAttribute('data-scf-hidden')&&!outer.inert,'recycled hit area stayed hidden');node.id=ids.a;}await wait();
 });
 await test('Pause restores complete pin and card wrappers',async()=>{
  controls().getElementById('toggle').click();check(!map.querySelector('[data-scf-hidden]'),'hidden wrappers remained');check(!map.querySelector('[inert]'),'focus remained blocked');controls().getElementById('toggle').click();check(hidden(ids.a),'reenabling lost pin');
 });
 await test('Status contains only aggregate counts and version',()=>{const text=controls().getElementById('diagnostics').textContent;check(text.includes('Version: 1.5.0')&&text.includes('Map lists read:')&&!text.includes(ids.a),'status unavailable or contains profile ID');});

 await test('All seven comfort options support Does appear and Does not appear on map pins',async()=>{
  for(const option of ['alcohol','cannabis','tobacco','poppers','pnp','other','discuss']){
   setFilters({['comfort-'+option]:'present'});socket.deliver({users:[field(ids.a,[option]),field(ids.b,[])]});await wait();check(!hidden(ids.a)&&hidden(ids.b),option+' present failed');
   setFilters({['comfort-'+option]:'absent'});check(hidden(ids.a)&&!hidden(ids.b),option+' absent failed');
  }
 });
 await test('Mixed comfort choices persist and work together with age',async()=>{
  setFilters({'comfort-pnp':'absent','comfort-poppers':'present','age-min':'30','age-max':'40'});
  socket.deliver({users:[stats(ids.a,34,175,82,18,'athletic','vers-top',now-60000,now-3600000),field(ids.a,['poppers']),field(ids.b,['poppers','pnp'])]});await wait();
  check(!hidden(ids.a)&&hidden(ids.b),'mixed rules incorrect');openPanel();const saved=JSON.parse(localStorage.getItem('sniffies-comfort-filter.rules.v1'));check(saved.filters.some(r=>r.attribute==='comfort:pnp'&&r.condition==='not')&&saved.filters.some(r=>r.attribute==='comfort:poppers'&&r.condition==='has'),'choices lost');
 });
 await test('Visible comfort badges recognize Lets Discuss and No Other Drugs',async()=>{
  setFilters({'comfort-discuss':'present','comfort-other':'present'});
  q('#profile-area').innerHTML=`<app-profile><div id="profile-${ids.c}"><profile-cruiser-stats-row><div class="profile-cruiser-stats-row-title">My Comfort Levels</div><profile-cruiser-stats-badge>Let’s Discuss</profile-cruiser-stats-badge><profile-cruiser-stats-badge>No Other Drugs</profile-cruiser-stats-badge></profile-cruiser-stats-row></div></app-profile>`;
  await wait();check(!hidden(ids.c),'visible labels missed');setFilters({'comfort-discuss':'absent'});check(hidden(ids.c),'absence did not reject visible label');q('#profile-area').textContent='';
 });
 await test('All Any restores comfort-filtered pins',()=>{setFilters({});check(!hidden(ids.a)&&!hidden(ids.b)&&!hidden(ids.c),'Any left comfort filtering active');});
 // Isolate icon-only profiles: these identities never appear in network mocks.
 const iconIds=['icononly01','icononly02','icononly03','icononly04','icononly05','icononly06'];
 const iconSets=[['bottom-icon'],['bottom-icon','vers-bottom-icon'],['top-icon'],['top-icon','vers-top-icon'],['vers-icon'],['side-icon']];
 const iconMarkup=tags=>'<app-sexual-position-icon>'+tags.map(tag=>`<i data-testid="${tag}"></i>`).join('')+'</app-sexual-position-icon>';
 const iconMarkers=iconIds.map((id,i)=>{const el=document.createElement('div');el.className='marker-container user';el.id=id;el.innerHTML=iconMarkup(iconSets[i]);map.append(el);return el;});
 await wait();
 for(const [choice,visible] of [['bottom',[0,1]],['bottom-sub',[0,1]],['bottom-power',[0,1]],['vers-bottom',[1]],['top',[2,3]],['top-sub',[2,3]],['top-dom',[2,3]],['vers-top',[3]],['vers',[4]],['side',[5]]]){
  await test('Icon-only map filtering: '+choice,async()=>{setFilters({positions:[choice],missing:'hide'});await wait();iconIds.forEach((id,i)=>check(hidden(id)===!visible.includes(i),'unexpected icon '+i));});
 }
 await test('Icon attribute updates reevaluate hidden pins',async()=>{setFilters({positions:['vers-bottom'],missing:'hide'});iconMarkers[3].querySelector('[data-testid="top-icon"]').setAttribute('data-testid','bottom-icon');iconMarkers[3].querySelector('[data-testid="vers-top-icon"]').setAttribute('data-testid','vers-bottom-icon');await wait();check(!hidden(iconIds[3]),'updated icon missed');});
 await test('Removing an icon does not leave a cached position',async()=>{iconMarkers[3].textContent='Icon unavailable';await wait();check(hidden(iconIds[3]),'stale icon retained');setFilters({positions:['vers-bottom']});check(!hidden(iconIds[3]),'missing-details show ignored');});
 await test('Map icons do not fill in missing comfort details',async()=>{setFilters({positions:['bottom'],'comfort-pnp':'absent',missing:'hide'});check(hidden(iconIds[0]),'missing comfort treated as known');});
 await test('Icon info applies to both card and pin for the same person',async()=>{setFilters({positions:['top'],missing:'hide'});const carousel=document.createElement('app-cruisers-carousel');carousel.innerHTML=`<app-cruiser-card><button data-testid="cruiserCard" id="${iconIds[0]}">Card</button></app-cruiser-card>`;map.append(carousel);await wait();check(carousel.firstElementChild.hasAttribute('data-scf-hidden'),'card lost pin icon');carousel.remove();});
 await test('Emoji outside the position component cannot supply position',async()=>{const stray=document.createElement('div');stray.className='marker-container user';stray.id='strayicon01';stray.innerHTML='<span data-testid="bottom-icon">🍑</span>';map.append(stray);setFilters({positions:['bottom'],missing:'hide'});await wait();check(hidden(stray.id),'arbitrary emoji read');stray.remove();});
 const favoriteRoot=()=>controls();
 const star=()=>q('.scf-profile-star-v1')?.shadowRoot.getElementById('favorite-star');
 const storedFriends=()=>JSON.parse(localStorage.getItem('sniffies-comfort-filter.favorites.v1')||'[]');
 await test('Old favorites recover links only from verified identities',async()=>{const old=JSON.stringify([{id:ids.a,name:'Recovered'},{id:'unverified01',name:'Unverified'}]);localStorage.setItem('sniffies-comfort-filter.favorites.v1',old);window.dispatchEvent(new StorageEvent('storage',{key:'sniffies-comfort-filter.favorites.v1',newValue:old}));await wait();const recovered=storedFriends();check(recovered.find(f=>f.id===ids.a)?.url===`/profile/${ids.a}`,'verified favorite not repaired');check(!recovered.find(f=>f.id==='unverified01')?.url,'unverified URL fabricated');localStorage.setItem('sniffies-comfort-filter.favorites.v1','[]');window.dispatchEvent(new StorageEvent('storage',{key:'sniffies-comfort-filter.favorites.v1',newValue:'[]'}));await wait();});
 await test('Open profile offers a Save friend control',async()=>{setFilters({});history.pushState({},'',`/profile/friend001`);q('#profile-area').innerHTML='<app-profile><div id="profile-wrongsection"><h2>Synthetic friend</h2></div></app-profile>';await wait();check(!!star(),'star missing');star().click();check(!controls().getElementById('favorite-editor').hidden&&controls().getElementById('scroll').hidden&&controls().getElementById('footer').hidden,'editor mode incorrect');});
 await test('Empty favorite names are rejected',()=>{favoriteRoot().getElementById('save-friend').click();check(favoriteRoot().getElementById('friend-status').textContent.includes('Enter a name'),'no validation');});
 await test('Save friend persists the verified route, not a section ID',async()=>{favoriteRoot().getElementById('friend-name').value='Synthetic Alex';favoriteRoot().getElementById('save-friend').click();await wait();const friend=storedFriends().find(f=>f.id==='friend001');check(friend?.name==='Synthetic Alex'&&friend.url==='/profile/friend001','verified favorite not saved');check(!storedFriends().some(f=>f.id==='wrongsection'),'section ID saved');check(star().textContent==='★','saved star missing');});
 await test('Favorites list has a safe profile link and allows renaming',()=>{const row=[...controls().querySelectorAll('.favorite-row')].find(r=>r.querySelector('input').value==='Synthetic Alex');check(row.querySelector('a').getAttribute('href')==='/profile/friend001','wrong bookmark route');row.querySelector('input').value='Alex renamed';row.querySelector('button').click();check(storedFriends().some(f=>f.name==='Alex renamed'),'rename failed');});
 await test('Favorites survive changes to filters',()=>{setFilters({'age-min':'90',missing:'hide'});check(controls().getElementById('favorites-list').textContent.includes('Open'),'favorite list vanished');check(storedFriends().some(f=>f.id==='friend001'),'filters cleared favorites');});
 await test('Another tab updates favorites and treats names as text',async()=>{const friends=JSON.stringify([{id:'friend002',name:'<img src=x onerror=alert(1)>'}]);localStorage.setItem('sniffies-comfort-filter.favorites.v1',friends);window.dispatchEvent(new StorageEvent('storage',{key:'sniffies-comfort-filter.favorites.v1',newValue:friends}));await wait();check(!controls().getElementById('favorites-list').querySelector('img'),'name interpreted as markup');check(controls().getElementById('favorites-summary').textContent.includes('1'),'tab sync failed');});
 await test('Storage failure does not claim a favorite was saved',()=>{star().click();const proto=Storage.prototype, original=proto.setItem;try{proto.setItem=function(key,value){if(key==='sniffies-comfort-filter.favorites.v1')throw new Error('full');return original.call(this,key,value)};favoriteRoot().getElementById('friend-name').value='Unsaved';favoriteRoot().getElementById('save-friend').click();check(favoriteRoot().getElementById('friend-status').textContent.includes('Could not save'),'failure hidden');check(!storedFriends().some(f=>f.name==='Unsaved'),'failed save changed storage');}finally{proto.setItem=original;}});
 await test('Remove favorite updates the saved list',()=>{controls().getElementById('favorites-list').querySelector('button[aria-label^="Remove"]').click();check(storedFriends().length===0,'favorite not removed');});
 await test('Recycled profile sections retain the verified route identity',async()=>{q('[id="profile-wrongsection"]').id='profile-anothersection';await wait();star().click();favoriteRoot().getElementById('friend-name').value='Reload check';favoriteRoot().getElementById('save-friend').click();check(storedFriends()[0]?.id==='friend001','verified route identity lost');});
 await test('Own profile does not get a Save friend control',async()=>{history.pushState({},'',`/profile/${ids.me}/me`);await wait();check(!star(),'own profile bookmark allowed');history.pushState({},'',`/profile/friend001`);q('#profile-area').innerHTML='<app-profile><div id="profile-anothersection"><h2>Reload check</h2></div></app-profile>';await wait();});
 setFilters({});


 await test('Star and editor bypass capture-phase photo handlers',async()=>{
  let photoClicks=0;const profile=q('[id="profile-anothersection"]');profile.addEventListener('click',()=>photoClicks++,true);
  const before=profile.getBoundingClientRect().height;
  star().click();controls().getElementById('friend-name').click();
  check(photoClicks===0,'photo handler fired');check(profile.getBoundingClientRect().height===before,'star changed profile height');check(!profile.querySelector('input,.scf-profile-star-v1,.scf-favorite-controls-v1'),'controls occupy photo layout');
  check(controls().getElementById('friend-name').value==='Reload check','saved name missing');
 });
 await test('Saved friends have a nonblocking star on the map',async()=>{
  const marker=document.createElement('div');marker.className='marker-container user';marker.id='friend001';marker.style.position='absolute';marker.style.transform='translate(40px, 60px)';marker.textContent='Saved friend pin';map.append(marker);await wait();
  const badge=marker.querySelector('.scf-favorite-badge');check(badge?.textContent==='★','badge missing');check(getComputedStyle(badge).pointerEvents==='none','badge blocks pin');
  check(getComputedStyle(marker).position==='absolute','favorite badge overrode map positioning');
  marker.style.transform='translate(140px, 160px)';await wait();check(getComputedStyle(marker).transform!=='none','map movement transform was lost');
  marker.id='friend004';await wait();check(!marker.querySelector('.scf-favorite-badge'),'recycled pin retains star');marker.id='friend001';await wait();check(!!marker.querySelector('.scf-favorite-badge'),'restored favorite lost star');
 });
 await test('Remove from editor clears profile and map stars',async()=>{
  controls().getElementById('remove-friend').click();await wait();check(star().textContent==='☆','profile star still filled');check(!q('[id="friend001"]').querySelector('.scf-favorite-badge'),'map star still present');
 });
 await test('Saving in the editor fills both stars and returns to profile',async()=>{
  star().click();controls().getElementById('friend-name').value='Reload check';controls().getElementById('save-friend').click();await wait();check(star().textContent==='★'&&q('[id="friend001"]').querySelector('.scf-favorite-badge'),'saved stars missing');check(controls().getElementById('panel').hidden,'editor did not close');
 });
 await test('Filters button restores filters after favorite editor',()=>{
  star().click();controls().getElementById('chip').click();check(!controls().getElementById('scroll').hidden&&!controls().getElementById('footer').hidden&&controls().getElementById('favorite-editor').hidden,'filter view not restored');controls().getElementById('close').click();
 });

 q('#summary').textContent=`${passed} passed · ${failed} failed`;
 document.documentElement.setAttribute('data-tests',failed?'failed':'passed');
 q('#run').textContent='Checks complete';
};
