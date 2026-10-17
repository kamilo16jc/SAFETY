/* Regresiones del rediseño: datos ausentes, permisos y aislamiento del demo.
   Ejecutar: node tests/ui-regression.cjs */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
let writes=0;const elements=new Map();
const document={readyState:'loading',addEventListener(){},querySelector(){return null},querySelectorAll(){return []},getElementById(id){return elements.get(id)||null},body:{classList:{contains(){return true},toggle(){},remove(){}}}};
const context={console,document,location:{search:'?demo'},URLSearchParams,Date,Math,Number,String,Array,Object,JSON,Promise,Set,Map,parseInt,parseFloat,isNaN,Uint8Array,TextEncoder,clearTimeout(){},setTimeout(){return 1},setInterval(){return 1},crypto:require('crypto').webcrypto,localStorage:{getItem(){return null},setItem(){writes++},removeItem(){writes++}},innerWidth:1440,addEventListener(){},dispatchEvent(){},renderIcons(){},toast(){},esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}};
context.window=context;vm.createContext(context);
function load(file){vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});}
['js/core/data.js','js/core/modules.js','js/core/auth.js','js/core/nav.js','js/core/sidenav.js','js/modules/products.js','js/modules/capa.js','js/modules/kpi.js','js/core/nexora-ui.js','js/modules/nexora-insights.js'].forEach(load);
context.NEXORA_DESIGN_LOCAL=false;load('tools/demo-data.js');assert.equal(context.NEXORA_DEMO,undefined,'Demo must never run without local marker');
context.NEXORA_DESIGN_LOCAL=true;load('tools/demo-data.js');assert.equal(context.NEXORA_DEMO,true);assert.equal(writes,0,'Demo must not write persistent storage');
context.currentUser=context.getDB().operators[0];
const db=context.getDB();
assert.equal(db.products.length,4);assert.ok(db.weights.length>1000);
assert.ok(db.weights.every(x=>x.product.startsWith('DEMO-')));
assert.equal(context.myModules().length,6);
assert.equal(context.canSeeScreen('screen-admin',context.currentUser,'admin'),true);
const operator={id:42,name:'Test operator',role:'operator'};
assert.equal(context.canSeeScreen('screen-admin',operator,'admin'),false);
assert.equal(context.canSeeScreen('screen-weight',operator,'qa'),true);
context.currentUser=operator;
assert.equal(context.myModules().length,1);
assert.ok(context.snavSubHTML(context.moduleById('qa')).includes('screen-weight'));
assert.ok(!context.snavSubHTML(context.moduleById('qa')).includes('screen-admin'));
context.currentUser=db.operators[0];
const now=context.kpiCompPeso(context.kpiPesos(context.kpiVentana(7,0)));
assert.ok(now.pct>90&&now.pct<100);assert.ok(now.n>0);
assert.equal(context.kpiSerieDiaria(7).length,7);
assert.ok(context.nxComputeInsights().some(i=>i.title.includes('overdue CAPA')));
let next=Object.assign({},db,{weights:[],seals:[],capa:[],runs:[],temps:[]});context.saveDB(next);
assert.equal(context.kpiCompPeso([]).pct,null,'Missing data is not 0% or 100%');
assert.ok(context.kpiSerieDiaria(7).every(d=>d.peso===null&&d.sello===null));
assert.equal(context.nxComputeInsights()[0].title,'Your next insight starts with a check');
assert.equal(writes,0,'Demo edits must remain in memory');
context.saveDB(db);
context.kpiState.line='3';assert.ok(context.kpiPesos(context.kpiVentana(7,0)).every(r=>r.line===3));context.kpiState.line='all';
context.kpiState.shift='2';assert.ok(context.kpiPesos(context.kpiVentana(7,0)).every(r=>r.shift===2));context.kpiState.shift='all';
assert.equal(context.kpiDelta(99,null,true),'','No invented prior-period comparison');
// Un resultado registrado como cero debe conservarse como dato, no como ausencia.
context.saveDB(Object.assign({},db,{weights:[{date:context.kpiFecha(0),total:5,pass:0,line:1,shift:1}],capa:[]}));
assert.equal(context.kpiCompPeso(context.kpiPesos(context.kpiVentana(1,0))).pct,0);
assert.ok(context.nxComputeInsights().some(i=>i.title==='Weight compliance is below target'));
// Filtro pendiente: cambia presentación sin consultar ni aplicar el estado.
const pending={classList:{toggle(){}},setAttribute(){}};elements.set('nx-kpi-apply',pending);
const before=JSON.stringify(context.kpiState);context.nxMarkKpiDirty();assert.equal(JSON.stringify(context.kpiState),before);
console.log('PASS: demo isolation, missing/zero data, date/line/shift aggregation, role boundaries, pending filters and insight calculations.');
