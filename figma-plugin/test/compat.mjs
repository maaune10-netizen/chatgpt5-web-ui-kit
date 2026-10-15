import { readFileSync } from 'node:fs';
const code = readFileSync(new URL('../code.js', import.meta.url),'utf8');

async function tryCase(label, mutate) {
  const msgs = [];
  const node = (t,name,ex={}) => Object.assign({ id: ex.id||('n'+Math.random().toString(36).slice(2,7)), name, type:t, visible:true,
    absoluteBoundingBox:{x:0,y:0,width:10,height:10}, relativeTransform:[[1,0,0],[0,1,0]],
    fills:[{type:'SOLID',color:{r:0,g:0,b:0},visible:true}], strokes:[], effects:[],
    exportAsync: async()=>new TextEncoder().encode('<svg/>'), ...ex });
  const vec = node('VECTOR','icon');
  const scr = node('COMPONENT','Screen',{children:[vec], layoutMode:'VERTICAL', itemSpacing:4, paddingTop:1,paddingRight:2,paddingBottom:3,paddingLeft:4, cornerRadius:8});
  const pg  = node('PAGE','P',{children:[scr], selection:[scr]});
  const figma = { root:{name:'F',children:[pg]}, currentPage:pg, showUI(){}, closePlugin(){},
    loadAllPagesAsync: async()=>{}, ui:{ onmessage:null, postMessage:m=>msgs.push(m), resize(){} } };
  mutate(figma);
  new Function('figma','__html__', code)(figma, '<html></html>');
  figma.ui.onmessage({type:'dump', scope:'all', includeSvg:true});
  for (let i=0;i<80 && !msgs.some(m=>m.type==='done'||m.type==='error');i++) await new Promise(r=>setTimeout(r,20));
  const err = msgs.find(m=>m.type==='error');
  const done = msgs.find(m=>m.type==='done');
  if (err) console.log('✗', label, '->', err.message);
  else if (done) console.log('✓', label, '->', done.payload.meta.nodeCount, 'nodes,', done.payload.meta.svgCount, 'svgs');
  else console.log('?', label, '-> stuck:', JSON.stringify(msgs.map(m=>m.type)).slice(0,120));
}

await tryCase('modern (has loadAllPagesAsync)', () => {});
await tryCase('old Figma (no loadAllPagesAsync)', (f) => { delete f.loadAllPagesAsync; });
await tryCase('no apiVersion/editorType', (f) => { f.apiVersion = undefined; f.editorType = undefined; });
await tryCase('selection undefined', (f) => { f.currentPage.selection = undefined; });
