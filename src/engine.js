/* Grim DPS Lab — independent analytical model, not DPYes or GrimTools source. */
(function(root){
'use strict';
const TYPES=['physical','pierce','fire','cold','lightning','acid','vitality','aether','chaos'];
const LABELS={physical:'물리',pierce:'관통',fire:'화염',cold:'냉기',lightning:'번개',acid:'산성',vitality:'생명력',aether:'에테르',chaos:'카오스',bleed:'출혈'};
const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,n(x)));
const vec=()=>Object.fromEntries(TYPES.map(t=>[t,0]));
const copy=x=>JSON.parse(JSON.stringify(x));
function sumStats(rows){ const out={}; for(const r of rows||[]) for(const [k,v] of Object.entries(r||{})) if(Number.isFinite(Number(v))) out[k]=n(out[k])+n(v); return out; }
function flat(s){const r=vec(); for(const t of TYPES)r[t]=Math.max(0,n(s?.['flat_'+t])); for(const t of ['fire','cold','lightning'])r[t]+=Math.max(0,n(s?.flat_elemental))/3;return r;}
function add(a,b,m=1){const r=vec();for(const t of TYPES)r[t]=n(a?.[t])+n(b?.[t])*m;return r;}
function scale(a,m){const r=vec();for(const t of TYPES)r[t]=n(a?.[t])*m;return r;}
function pth(oa,da){oa=Math.max(1,n(oa));da=Math.max(0,n(da));return Math.max(55,90*oa/(oa+da/3.5)+.02275*(oa-da)+20);}
/* Continuous intervals: endpoints have zero probability. PTH>100 uses PTH as the roll range. */
function critProfile(oa,da,bonus=0){
 const p=pth(oa,da),den=Math.max(100,p),bins=[];
 if(p<100)bins.push({p:(100-p)/100,m:0,kind:'miss'});
 bins.push({p:Math.min(90,p)/den,m:p<70?p/70:1,kind:'normal'});
 const cuts=[90,105,120,130,135,Infinity];
 for(let i=0;i<5;i++){const len=Math.max(0,Math.min(p,cuts[i+1])-cuts[i]);if(len)bins.push({p:len/den,m:1.1+i*.1+Math.max(0,n(bonus))/100,kind:'critical'});}
 return {pth:p,bins,hit:1-(bins.find(b=>b.kind==='miss')?.p||0),crit:bins.filter(b=>b.kind==='critical').reduce((s,b)=>s+b.p,0),mean:bins.reduce((s,b)=>s+b.p*b.m,0)};
}
/* Only conversions INTO pierce are represented. A source packet may be converted only once. */
function convert(input,global,local,armorPiercing=0){
 const out=vec();out.pierce=n(input?.pierce);
 for(const t of TYPES.filter(t=>t!=='pierce')){
  const amount=n(input?.[t]); const l=clamp(n(local?.['conv_'+t])+(['fire','cold','lightning'].includes(t)?n(local?.conv_elemental):0),0,100)/100;
  const g=clamp(n(global?.['conv_'+t])+(['fire','cold','lightning'].includes(t)?n(global?.conv_elemental):0),0,100)/100;
  const toPierce=amount*l+amount*(1-l)*g;
  const remaining=amount*(1-l)*(1-g);
  const ap=t==='physical'?clamp(armorPiercing,0,100)/100:0;
  out.pierce+=toPierce+remaining*ap; out[t]+=remaining*(1-ap);
 }
 return out;
}
function rrValue(target,type){
 if(target?.resistMode==='final')return n(target.resists?.[type]);
 const rows=(target?.rr||[]).filter(x=>x.enabled!==false&&(x.type==='all'||x.type===type));
 const stack={};let flatRR=0;
 for(const r of rows){const value=Math.max(0,n(r.value));if(r.kind==='flat')flatRR=Math.max(flatRR,value);else stack[String(r.group||r.id||r.name)]=Math.max(n(stack[String(r.group||r.id||r.name)]),value);}
 return n(target?.resists?.[type])-Object.values(stack).reduce((a,b)=>a+b,0)-flatRR;
}
function aggregate(state){
 const rows=[state.base||{}];const local={main:{},off:{}};const warnings=[];const itemMods=[];let unsupported=0,missingParts=0;let confirmed=0,named=0;
 for(const [slot,e] of Object.entries(state.equipment||{})){
  if(e.enabled===false)continue;
  for(const p of Object.values(e.parts||{})){if(p.enabled!==false&&p.name&&!p.db&&!Object.keys(p.stats||{}).length)missingParts++;if(p.enabled!==false&&p.db){itemMods.push(...(p.db.modifiers||[]));unsupported+=(p.db.unapplied||[]).length;if(p.db.boosts?.length)unsupported++;if(p.db.set)unsupported++;}}
  if(e.parts?.item?.name){named++;if(e.reviewed)confirmed++;}
  const s=sumStats(Object.values(e.parts||{}).filter(p=>p.enabled!==false).map(p=>p.stats||{}));
  if(slot==='main'||slot==='off'){
   local[slot]=s;const rest={...s};for(const k of Object.keys(rest))if(k.startsWith('flat_')||k==='armorPiercing')delete rest[k];rows.push(rest);
  }else rows.push(s);
 }
 for(const b of state.buffs||[])if(b.enabled)rows.push(b.stats||{});
 const g=sumStats(rows);
 if(named>confirmed)warnings.push(`장비 ${named-confirmed}개가 수치 확인 전입니다. 비어 있는 옵션은 0으로 처리됩니다.`);
 const speed=clamp(100+n(g.attackSpeed),1,n(state.combat?.speedCap,200));
 const oa=Math.max(1,n(g.oa)*(1+n(g.oaPct)/100));
 const hp=Math.max(0,n(g.hp)*(1+n(g.hpPct)/100));
 const da=Math.max(0,n(g.da)*(1+n(g.daPct)/100));
 const hands={};
 for(const h of ['main','off'])hands[h]=flat(sumStats([g,local[h]]));
 if(missingParts)warnings.push(`${missingParts}개 본체/부품/접사의 이름만 있고 옵션은 비어 있습니다. 검색 DB에서 항목을 선택하세요.`);
 if(unsupported)warnings.push(`장비의 스킬·세트·발동 등 ${unsupported}개 묶음/항목은 표시만 하며 자동 합산하지 않습니다. DB 검색과 완전한 게임 시뮬레이션은 다릅니다.`);
 if(n(g.physique)||n(g.cunning)||n(g.spirit)||n(g.physiquePct)||n(g.cunningPct)||n(g.spiritPct))warnings.push('장비의 체격·교활·정신으로 파생되는 효과는 자동 계산하지 않습니다. 장비 외 합계에서 별도로 보정하세요.');
 return {g,local,hands,speed,oa,hp,da,warnings,confirmed,named,itemMods};
}
function pool(rows){
 const enabled=(rows||[]).filter(r=>r.enabled!==false),sum=enabled.reduce((s,r)=>s+Math.max(0,n(r.chance)),0),den=Math.max(100,sum);
 return {sum,rows:enabled.map(r=>({...r,p:Math.max(0,n(r.chance))/den})),basic:Math.max(0,1-sum/100)};
}
function packetBefore(state,a,row,hand){
 const c=state.combat||{},g=a.g;
 const relevant=(a.itemMods||[]).filter(m=>m.scope==='dar'||m.scope===row.id);
 const localConv=sumStats([c.skillConversion||{},row.conversion||{},...relevant.filter(m=>m.kind==='conversion').map(m=>({[m.key]:m.value}))]);
 const ap=clamp(n(a.local[hand].armorPiercing)*(1+n(g.armorPiercingPct)/100),0,100);
 const wd=Math.max(0,n(c.darWD,100)+n(g.darWD))/100;
 const rowWD=Math.max(0,n(row.wd,100)+n(g['wd_'+row.id]))/100;
 let v=scale(convert(a.hands[hand],g,localConv,ap),wd*rowWD);
 const sf=flat(sumStats([c.darFlat||{},...relevant.filter(m=>m.scope==='dar'&&m.kind==='flat').map(m=>({[m.key]:m.value}))])),wf=flat(sumStats([row.flat||{},...relevant.filter(m=>m.scope===row.id&&m.kind==='flat').map(m=>({[m.key]:m.value}))]));
 v=add(v,convert(sf,g,localConv,ap));v=add(v,convert(wf,g,localConv,ap));
 for(const t of TYPES)v[t]*=Math.max(0,1+(n(g.incAll)+n(g['inc_'+t])+(['fire','cold','lightning'].includes(t)?n(g.incElemental):0))/100);
 return scale(v,Math.max(0,1+n(c.totalDamageModifier)/100));
}
function mitigate(v,state,m=1){
 const t=state.target||{},out=vec();const evade=1-clamp(t.avoidance,0,100)/100;
 for(const type of TYPES){
  let d=Math.max(0,n(v[type])*m)*Math.max(0,1-rrValue(t,type)/100);
  if(type==='physical')d-=Math.min(d,Math.max(0,n(t.armor)))*clamp(t.armorAbsorption,0,100)/100;
  out[type]=Math.max(0,d)*(1-clamp(t.absorption,0,100)/100);
 }
 const total=Object.values(out).reduce((x,y)=>x+y,0),fac=total>0?Math.max(0,total-Math.max(0,n(t.flatAbsorption)))/total:0;
 return scale(out,fac*evade);
}
function expectedPacket(v,state,profile){let out=vec();for(const b of profile.bins)if(b.m>0)out=add(out,mitigate(v,state,b.m),b.p);return out;}
function calculate(state){
 const a=aggregate(state),c=state.combat||{},target=state.target||{};
 const prof=critProfile(a.oa,Math.max(0,n(target.da)-n(target.daReduction)),n(a.g.crit));
 const p=pool((state.wps||[]).map(r=>({...r,chance:Math.max(0,n(r.chance)+n(a.g["chance_"+r.id]))}))),dual=c.dual!==false;
 const rows=p.rows.map(r=>({...r,p:r.p}));
 if(p.basic>0)rows.push({id:'basic',name:'일반 맹공격',p:p.basic,wd:100,hitsMain:dual?.75:1,hitsOff:dual?.75:0,cycleMs:n(c.basicCycleMs,333),flat:{}});
 let mean=0,time=0;const damageByType=vec();
 const computed=rows.map(r=>{
  const countM=Math.max(0,n(r.hitsMain)),countO=dual?Math.max(0,n(r.hitsOff)):0;
  const vm=packetBefore(state,a,r,'main'),vo=packetBefore(state,a,r,'off');
  const em=expectedPacket(vm,state,prof),eo=expectedPacket(vo,state,prof);
  const types=add(scale(em,countM),eo,countO);const damage=Object.values(types).reduce((x,y)=>x+y,0);
  const seconds=Math.max(.02,n(r.cycleMs,400)/1000)*(Math.max(1,n(c.referenceSpeed,200))/a.speed);
  mean+=r.p*damage;time+=r.p*seconds;for(const t of TYPES)damageByType[t]+=r.p*types[t];
  return {...r,damage,seconds,types,rawMain:vm,rawOff:vo};
 });
 const aps=c.timingMode==='measured'?clamp(c.measuredAPS,0,100):time>0?1/time:0;
 const uptime=clamp(c.uptime,0,100)/100;
 const direct=mean*aps*uptime;
 for(const t of TYPES)damageByType[t]*=aps*uptime;
 const extraGroups={};
 for(const x of state.extras||[]){
  if(x.enabled===false)continue;
  const amount=Math.max(0,n(x.rate))*(clamp(x.uptime,0,100)/100)*(x.afterMitigation?1:Math.max(0,1-rrValue(target,x.type)/100)*(1-clamp(target.absorption,0,100)/100));
  const key=x.kind==='dot'?`${x.type}:${x.group||x.name}`:x.id;
  if(!extraGroups[key]||extraGroups[key].dps<amount)extraGroups[key]={...x,dps:amount};
 }
 const extras=Object.values(extraGroups),extra=extras.reduce((s,x)=>s+x.dps,0),total=direct+extra;
 for(const r of computed)r.dps=r.p*r.damage*aps*uptime;
 const warnings=[...a.warnings];
 if(c.timingMode==='measured')warnings.push('공격 빈도 고정 모드: 장비의 공격 속도를 바꿔도 빈도는 자동 변하지 않습니다.');
 if(state.meta?.demo)warnings.unshift('작동 예제입니다. 실제 서약운반자 장비 롤이나 실측값이 아닙니다.');
 if(n(target.flatAbsorption)>0&&extras.length)warnings.push('추가 피해의 타격당 고정 흡수는 모델링하지 않습니다. 경감 후 입력을 권장합니다.');
 if((state.extras||[]).filter(x=>x.enabled!==false).length!==extras.length)warnings.push('동일 지속 피해 출처는 합산하지 않고 가장 높은 유지 DPS만 적용합니다.');
 if(Object.values(a.hands.main).every(x=>!x))warnings.push('주무기·전역 기본 피해를 입력하세요.');
 if(p.sum>100)warnings.push(`발동 확률 ${p.sum.toFixed(1)}%: 실제 선택 비중을 100%로 정규화했습니다.`);
 return {a,profile:prof,pool:p,rows:computed,aps,meanCycle:time,meanDamage:mean,direct,extra,total,types:damageByType,extras,warnings,uptime};
}
function rng(seed){let a=(n(seed,7)|0)||7;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function choose(rows,random,field='p'){let u=random();for(const r of rows){u-=r[field];if(u<=0)return r;}return rows[rows.length-1];}
/* Visual renewal-process sample, not an emulation of GD's engine scheduling. */
function simulate(state,duration=60,seed=37){
 const result=calculate(state),rand=rng(seed),events=[];let t=0;const up=result.uptime;
 if(up>0&&result.rows.length){
  for(let guard=0;t<duration&&guard<50000;guard++){
   const row=choose(result.rows,rand);const cycle=state.combat.timingMode==='measured'?1/Math.max(.01,result.aps):row.seconds;
   t+=cycle/up;if(t>duration)break;
   let damage=0;
   for(const hand of ['Main','Off']){
    if(hand==='Off'&&state.combat.dual===false)continue;
    const expected=Math.max(0,n(row['hits'+hand]));let count=Math.floor(expected)+(rand()<expected%1?1:0);
    if(row.id==='basic'&&state.combat.dual!==false){ /* resolve basic dual pattern jointly below */count=0; }
    for(let i=0;i<count;i++){const b=choose(result.profile.bins,rand);damage+=Object.values(mitigate(row['raw'+hand],state,b.m)).reduce((x,y)=>x+y,0);}
   }
   if(row.id==='basic'&&state.combat.dual!==false){const u=rand();for(const h of (u<.25?['Main']:u<.5?['Off']:['Main','Off'])){const b=choose(result.profile.bins,rand);damage+=Object.values(mitigate(row['raw'+h],state,b.m)).reduce((x,y)=>x+y,0);}}
   if(damage>0)events.push({time:t,damage,skill:row.name,target:'단일 대상',source:'player',kind:'direct'});
  }
 }
 if(result.extra>0)for(let x=.25;x<=duration;x+=.25)events.push({time:x,damage:result.extra*.25,skill:'입력한 추가 피해',target:'단일 대상',source:'player',kind:'extra'});
 events.sort((a,b)=>a.time-b.time);return {events,result};
}
function analyzeEvents(events,{start=0,end=60,window=5,step=.25}={}){
 start=n(start);end=n(end);window=clamp(window,.1,120);step=clamp(step,.05,10);
 if(!(end>start))throw new Error('종료 시간은 시작 시간보다 커야 합니다.');
 const rows=events.filter(e=>Number.isFinite(e.time)&&Number.isFinite(e.damage)&&e.damage>=0&&e.time>=start&&e.time<=end).sort((a,b)=>a.time-b.time);
 const duration=end-start;step=Math.max(step,duration/2000);const total=rows.reduce((s,e)=>s+e.damage,0),groups={},targets={};
 for(const e of rows){groups[e.skill||'미지정']=n(groups[e.skill||'미지정'])+e.damage;targets[e.target||'미지정']=n(targets[e.target||'미지정'])+e.damage;}
 let left=0,right=0,sum=0,peak=0;const points=[];
 const evaluate=t=>{while(right<rows.length&&rows[right].time<=t){sum+=rows[right].damage;right++;}const bound=t-window;while(left<right&&rows[left].time<=bound){sum-=rows[left].damage;left++;}const denom=Math.min(window,t-start);return denom>0?sum/denom:0;};
 // True moving-window peak (at event timestamps), excluding warm-up < window.
 for(const e of rows){const v=evaluate(e.time);if(e.time-start>=window)peak=Math.max(peak,v);}
 left=0;right=0;sum=0;
 for(let t=start+step;t<end-1e-8;t+=step)points.push({time:t-start,dps:evaluate(t)});
 points.push({time:duration,dps:evaluate(end)});
 if(duration<window)peak=null;
 return {total,duration,average:total/duration,peak,points,groups,targets,count:rows.length,window};
}
function flatten(obj,prefix='',out={}){if(obj===null||typeof obj!=='object'){out[prefix]=obj;return out;}if(Array.isArray(obj)){obj.slice(0,30).forEach((x,i)=>flatten(x,prefix?`${prefix}.${i}`:`${i}`,out));return out;}for(const[k,v]of Object.entries(obj))flatten(v,prefix?`${prefix}.${k}`:k,out);return out;}
function parseCSV(text){
 const rows=[];let row=[],value='',quote=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){value+='"';i++;}else quote=!quote;}else if(c===','&&!quote){row.push(value);value='';}else if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(x=>x.trim()))rows.push(row);row=[];value='';}else value+=c;}
 if(quote)throw new Error('CSV의 따옴표가 닫히지 않았습니다.');row.push(value);if(row.some(x=>x.trim()))rows.push(row);if(rows.length<2)throw new Error('헤더와 최소 한 행의 데이터가 필요합니다.');const headers=rows.shift().map((x,i)=>x.trim().replace(/^\uFEFF/,'')||`column_${i}`);return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));
}
function findArrays(v,path='',depth=0,out=[]){if(depth>8)return out;if(Array.isArray(v)){if(v.length&&v.some(x=>x&&typeof x==='object'&&!Array.isArray(x)))out.push({path:path||'(root)',rows:v});return out;}if(v&&typeof v==='object')for(const[k,x]of Object.entries(v))findArrays(x,path?`${path}.${k}`:k,depth+1,out);return out;}
function mapEvents(rows,map){
 const result=[];let skipped=0;const mult=map.unit==='ms'?.001:map.unit==='us'?.000001:1;
 for(const raw of rows){const r=flatten(raw);const tv=r[map.time],dv=r[map.damage];if(tv===undefined||tv===null||tv===''||dv===undefined||dv===null||dv===''){skipped++;continue;}const time=Number(tv)*mult,damage=Number(dv);if(!Number.isFinite(time)||!Number.isFinite(damage)||damage<0){skipped++;continue;}result.push({time,damage,skill:String(r[map.skill]??'미지정'),target:String(r[map.target]??'미지정'),source:String(r[map.source]??'미지정')});}
 if(!result.length)throw new Error('시간·피해에 해당하는 숫자 필드를 찾지 못했습니다. 단위와 필드 매핑을 확인하세요.');const origin=result.reduce((v,e)=>Math.min(v,e.time),Infinity);if(map.relative!==false)for(const e of result)e.time-=origin;return {events:result,skipped,origin};
}
function parseTooltip(text){
 const stats={},recognized=[],unknown=[];
 const typeWords={physical:['Physical','물리'],pierce:['Piercing','Pierce','관통'],fire:['Fire','화염'],cold:['Cold','냉기'],lightning:['Lightning','번개'],acid:['Acid','산성'],vitality:['Vitality','생명력'],aether:['Aether','에테르'],chaos:['Chaos','카오스'],elemental:['Elemental','원소']};
 for(const raw of String(text).split(/\r?\n/)){const line=raw.trim();if(!line)continue;let key=null,value=null;
  if(/(converted|전환|변환|확률|chance|seconds|초간|over \d|per second|duration|regenerat|재생|[+]\d+ to )/i.test(line)){unknown.push(line);continue;}
  const nums=line.match(/[+-]?\d+(?:\.\d+)?/g)?.map(Number)||[];
  if(!nums.length){unknown.push(line);continue;}
  const pct=/%/.test(line);value=nums[0];
  if(!pct&&/\d\s*[-–~]\s*\d/.test(line)&&nums.length>=2)value=(Math.abs(nums[0])+Math.abs(nums[1]))/2;
  if(/Offensive Ability|공격 능력/i.test(line))key=pct?'oaPct':'oa';
  else if(/Defensive Ability|방어 능력/i.test(line))key=pct?'daPct':'da';
  else if(/Critical Damage|치명타 피해/i.test(line))key='crit';
  else if(/Attack Speed|공격 속도/i.test(line))key='attackSpeed';
  else if(/All Damage|모든 피해/i.test(line))key='incAll';
  else if(/Armor Piercing|방어구 관통/i.test(line))key='armorPiercing';
  else if(/Health|최대 체력|생명력 최대|^체력/i.test(line))key=pct?'hpPct':'hp';
  else if(!/Resistance|저항|지속/i.test(line)&&/Damage|피해/i.test(line))for(const[t,words]of Object.entries(typeWords))if(words.some(w=>new RegExp(w,'i').test(line))){key=t==='elemental'?(pct?'incElemental':'flat_elemental'):(pct?'inc_'+t:'flat_'+t);break;}
  if(key){stats[key]=n(stats[key])+value;recognized.push({line,key,value});}else unknown.push(line);
 }
 return {stats,recognized,unknown};
}
const api={TYPES,LABELS,n,clamp,vec,copy,sumStats,flat,add,scale,pth,critProfile,convert,rrValue,aggregate,pool,calculate,simulate,analyzeEvents,flatten,parseCSV,findArrays,mapEvents,parseTooltip};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.GD=api;
})(typeof globalThis!=='undefined'?globalThis:this);
