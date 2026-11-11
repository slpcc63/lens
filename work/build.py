from pathlib import Path
import base64
import json
import shutil
root=Path(__file__).resolve().parent.parent
out=root; chrome=out/'chrome'
core=(root/'work/src/core.cjs').read_text().replace('module.exports = createComfortCore;','')
runtime='\n'.join((root/'work/src'/name).read_text() for name in ['runtime-head.txt','network-part.txt','position-part.txt','rules-part.txt','favorites-part.txt','runtime-tail.txt'])
icon_names=['filter','settings','help','close','pause','play','check','refresh','star','remove','add']
icon_data={name:'data:image/png;base64,'+base64.b64encode((root/f'assets/doxle-icons/32/{name}.png').read_bytes()).decode() for name in icon_names}
icon_source='const LENS_ICONS='+json.dumps(icon_data,separators=(',',':'))+';\n'
(root/'work/src/runtime.js').write_text(runtime)
code='// Lens 1.5.0 — private local filtering and preference highlighting for Sniffies\n(()=>{\n'+core+'\n'+icon_source+runtime+'\n})();\n'
(chrome/'filter.js').write_text(code)
meta='''// ==UserScript==
// @name         Lens for Sniffies
// @namespace    local.sniffies-comfort-filter
// @version      1.5.0
// @description  Privately filter profiles, save favorites, and highlight Top or Bottom preference matches.
// @match        https://sniffies.com/*
// @match        https://www.sniffies.com/*
// @run-at       document-start
// @inject-into  page
// @grant        none
// @noframes
// ==/UserScript==

'''
(out/'sniffies-comfort-filter.user.js').write_text(meta+code)
manifest={
 'manifest_version':3, 'name':'Lens — Sniffies Comfort Filter', 'short_name':'Lens', 'version':'1.5.0', 'minimum_chrome_version':'111',
 'description':'Privately filter Sniffies profiles, save favorites, and highlight preference matches.',
 'content_scripts':[{'matches':['https://sniffies.com/*','https://www.sniffies.com/*'],'js':['filter.js'],'run_at':'document_start','world':'MAIN'}],
 'action':{'default_title':'Lens for Sniffies','default_popup':'popup.html'},
 'icons':{str(n):f'icons/icon-{n}.png' for n in [16,32,48,128]}
}
(chrome/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
for size in [32,128]: shutil.copyfile(root/f'assets/doxle-icons/{size}/filter.png',chrome/f'icons/icon-{size}.png')
shutil.copyfile(root/'assets/doxle-icons/32/filter.png',chrome/'icons/icon-16.png')
shutil.copyfile(root/'assets/doxle-icons/64/filter.png',chrome/'icons/icon-48.png')
