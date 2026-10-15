import { readFileSync } from 'node:fs';
const code = readFileSync(new URL('../code.js', import.meta.url), 'utf8');
const msgs = [];
const node = (t,name,ex={}) => Object.assign({ id: ex.id||'n1', name, type:t, visible:true,
  absoluteBoundingBox:{x:0,y:0,width:1,height:1}, relativeTransform:[[1,0,0],[0,1,0]],
  fills:[], strokes:[], effects:[], exportAsync: async()=>new Uint8Array([60,115,118,103,47,62]),
  children: [], ...ex });
const scr = node('COMPONENT','S',{ children:[ node('VECTOR','v'), node('TEXT','t',{characters:'hi',style:{fontFamily:'Inter',fontSize:12},textAutoResize:'NONE'}) ] });
const pg  = node('PAGE','P',{ children:[scr], selection:[scr] });
const figma = { root:{name:'F',children:[pg]}, currentPage:pg, showUI(){}, closePlugin(){},
  loadAllPagesAsync: async()=>{}, apiVersion:'1.0.0', editorType:'figma',
  ui:{ onmessage:null, postMessage:m=>{
      // حاكي تحقّق Figma: ارفض أي كائن يحمل Symbol أو دالة
      const bad = (o, path, seen) => {
        if (o === null || typeof o !== 'object') { if (typeof o === 'symbol' || typeof o === 'function') throw new Error('symbol/function at '+path); return; }
        if (seen.has(o)) return; seen.add(o);
        for (const k of Object.getOwnPropertySymbols(o)) throw new Error('Symbol key at '+path);
        for (const k in o) bad(o[k], path+'.'+k, seen);
      };
      bad(m, 'msg', new Set());
      msgs.push(m);
    }, resize(){} } };
new Function('figma','__html__', code)(figma, '<html></html>');
figma.ui.onmessage({ type:'dump', scope:'all', includeSvg:true });
for (let i=0;i<100 && !msgs.some(m=>m.type==='done'||m.type==='failed');i++) await new Promise(r=>setTimeout(r,20));
const done = msgs.find(m=>m.type==='done');
const failed = msgs.find(m=>m.type==='failed');
if (done) { const p=JSON.parse(done.json); console.log('✓ no symbols in any message — done:', p.meta.nodeCount,'nodes,',p.meta.svgCount,'svgs'); }
else if (failed) console.log('✗ failed:', failed.json.slice(0,200));
else console.log('? stuck:', JSON.stringify(msgs.map(m=>m.type)));
console.log('  message types sent:', msgs.map(m=>m.type).join(', '));
console.log('  all payloads are strings:', msgs.every(m=>typeof m.json === 'string' || m.type==='fatal'));
