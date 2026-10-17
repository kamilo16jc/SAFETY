// Datos SINTÉTICOS. Sólo dev-server.py carga este archivo con ?demo.
// La demostración usa memoria y no escribe los registros locales del usuario.
(function(){
  if(window.NEXORA_DESIGN_LOCAL!==true || !new URLSearchParams(location.search).has('demo'))return;
  var db={operators:[{id:900001,name:'Demo Administrator',username:'demo',email:'',role:'admin',pin:'demo'}],roles:defaultRoles(),products:[],customers:{list:[],tests:[]},weights:[],seals:[],runs:[],analysis:[],holds:[],capa:[],temps:[],gmps:[],metal:[],activity:[],raw:[],grilling:[]};
  var names=['DEMO · Mozzarella','DEMO · Parmesan','DEMO · Provolone','DEMO · Cheddar'];
  names.forEach(function(name,i){db.products.push({id:910000+i,number:'DEMO-'+(101+i),name:name,unit:'lb',pkg:5,pkgLabel:'5 lbs',target:{min:4.86,max:5.14},weightUnit:'lb',bagsPerCase:4,plate:true,labSample:true,labSamples:2,customerMode:'one',customerId:'demo-customer',customerIds:['demo-customer'],labTargets:{moisture:{min:40,max:55},fat:{min:18,max:30},ph:{min:5.1,max:5.8}}});});
  db.customers.list.push({id:'demo-customer',key:'demo-customer',customerId:'DEMO',company:'DEMO · Sample customer',prefix:'DM',products:db.products.map(function(p){return p.number;}),tests:[],numbered:false});
  var serial=920000;
  for(var day=29;day>=0;day--){
    var date=kpiFecha(day);
    for(var line=1;line<=4;line++){
      var product=db.products[line-1];
      for(var shift=1;shift<=2;shift++){
        var run={id:serial++,date:date,shift:shift,line:line,time:'',product:product.number,productName:product.name,labSamples:2,labSample:true,lot:'DEMO-'+date.replace(/-/g,'')+'-'+line+shift,collected:!(day===0&&line===4),labSent:day>0||line<3,createdAt:date+'T09:00:00',createdBy:'Demo QA',notes:'Synthetic design record'};
        db.runs.push(run);
        for(var check=0;check<8;check++){
          if(day===0&&check>4)continue;
          var fail=((day*11+line*7+shift*5+check*3)%47===0)||(day===2&&line===3&&check<3);
          var pass=fail?4:5, vals=fail?[5.01,4.99,5.03,5.00,5.19]:[5.02,5.00,4.98,5.01,5.03];
          var time=(shift===1?7+check:15+check)+':00';
          db.weights.push({id:serial++,date:date+'T'+time+':00',line:line,shift:shift,product:product.number,productName:product.name,lot:run.lot,total:5,pass:pass,fail:5-pass,compliance:pass/5*100,vals:vals,avg:vals.reduce(function(a,b){return a+b;},0)/5,unit:'lb',pkg:5,pkgLabel:'5 lbs',min:4.86,max:5.14,time:time,initials:'DQ',operator:'Demo QA',comments:'Synthetic design record'});
          db.seals.push({id:serial++,date:date+'T'+time+':00',line:line,shift:shift,product:product.number,productName:product.name,lot:run.lot,checks:{Visual:'pass','Dunk Tank':(day*9+line+check)%71===0?'fail':'pass',Printing:'pass'},time:time,initials:'DQ',operator:'Demo QA'});
        }
        if(day<6){db.analysis.push({id:serial++,seq:line+shift*10+day*100,runId:run.id,date:date,product:product.number,cheese:product.name,customerId:'DEMO',customerKey:'demo-customer',customer:'DEMO · Sample customer',line:line,shift:shift,lot:run.lot,moisture:(46+line*.6).toFixed(1),fat:(21+line*.4).toFixed(1),ph:(5.3+line*.03).toFixed(2),prodDate:date,ymDate:date,yeast:day>=5?'0':'',mold:day>=5?'0':'',createdBy:'Demo QA',createdAt:date+'T10:00:00'});}
      }
    }
    [1,2].forEach(function(shift){
      [1,2,3].forEach(function(cp){if(day===0&&cp===3)return;db.temps.push({id:serial++,date:date,shift:shift,checkpoint:cp,temp:'38',humidity:'46',time:shift===1?'09:00':'17:00',operator:'Demo QA',area:'DEMO · Cold storage'});});
      db.gmps.push({id:serial++,date:date,shift:shift,items:GMP_ITEMS.map(function(){return 'yes';}),answers:{},operator:'Demo QA'});
      [1,2,3,4].forEach(function(line){var a={};MD_QUESTIONS.forEach(function(_,i){a[i]='yes';});db.metal.push({id:serial++,date:date,line:String(line),shift:shift,answers:a,startTime:'08:00',endTime:'08:10',completedBy:'Demo QA',verifiedBy:''});});
    });
  }
  ['major','moderate','minimal'].forEach(function(severity,i){db.capa.push({id:serial++,reportNumber:'DEMO-CAPA-00'+(i+1),capaDate:kpiFecha(i===0?3:0),product:db.products[i].number,lot:'DEMO-LOT-'+i,severity:severity,status:'open',problem:['Seal inspection follow-up','Packaging check review','Documentation follow-up'][i],description:'Synthetic record for interface review.',completedBy:'Demo QA',createdBy:'Demo QA',createdAt:kpiFecha(0)+'T09:00:00'});});
  ['hold','review','released'].forEach(function(status,i){var date=kpiFecha(i)+'T10:00:00';db.holds.push({id:serial++,caseNumber:'DEMO-HLD-00'+(i+1),product:db.products[i].name,lot:'DEMO-LOT-'+i,quantity:(125+i*50)+' lb',line:String(i+1),reason:['Seal verification','Label review','Checks completed'][i],status:status,initiatedBy:'Demo QA',createdAt:date,history:[{date:date,status:status,comment:'Synthetic record for design review.',by:'Demo QA'}]});});
  if(typeof _saveTimer!=='undefined'&&_saveTimer)clearTimeout(_saveTimer);
  _dirty={};_saveTimer=null;_dbCache=db;
  getDB=function(){return db;};
  saveDB=function(next){if(next)db=next;_dbCache=db;};
  saveDBNow=function(next){saveDB(next);return true;};
  // Los listeners de beforeunload originales tampoco deben persistir el demo.
  _writeNow=function(){return true;};
  window.NEXORA_DEMO=true;
  function banner(){var e=document.getElementById('nx-local-label');if(e)e.textContent='DESIGN DEMO · SYNTHETIC DATA';}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',banner);else banner();
})();
