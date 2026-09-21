/* Item data adapter. Values from a pinned public game-data snapshot, not a fake item template. */
(function(root){'use strict';
const clean=x=>String(x??'').normalize('NFKC').toLowerCase().replace(/신화적인|강화된|mythical|empowered/g,'').replace(/[\s\-_'’·:()]/g,'');
const TYPES={physical:'physical',pierce:'pierce',piercing:'pierce',fire:'fire',cold:'cold',lightning:'lightning',poison:'acid',acid:'acid',life:'vitality',vitality:'vitality',aether:'aether',chaos:'chaos',elemental:'elemental'};
const dtype=x=>TYPES[String(x||'').replace(/^Damage/i,'').toLowerCase()]||null;
const SINGLE={characterOffensiveAbility:'oa',characterOffensiveAbilityModifier:'oaPct',characterDefensiveAbility:'da',characterDefensiveAbilityModifier:'daPct',characterLife:'hp',characterLifeModifier:'hpPct',offensiveCritDamageModifier:'crit',characterAttackSpeedModifier:'attackSpeed',characterTotalSpeedModifier:'attackSpeed',offensiveTotalDamageModifier:'incAll',offensiveDamageModifier:'incAll',offensiveElementalModifier:'incElemental',offensivePierceRatio:'armorPiercing',offensivePierceRatioModifier:'armorPiercingPct',defensiveProtection:'armor',defensiveProtectionModifier:'armorPct',characterHealIncreasePercent:'healingPct',characterStrength:'physique',characterDexterity:'cunning',characterIntelligence:'spirit',characterStrengthModifier:'physiquePct',characterDexterityModifier:'cunningPct',characterIntelligenceModifier:'spiritPct'};
function statKey(s){if(SINGLE[s])return SINGLE[s];for(const [raw,t] of Object.entries({Physical:'physical',Pierce:'pierce',Fire:'fire',Cold:'cold',Lightning:'lightning',Poison:'acid',Life:'vitality',Aether:'aether',Chaos:'chaos',Elemental:'elemental'})){if(s==='offensive'+raw||s==='offensive'+raw+'Min')return 'flat_'+t;if(s==='offensive'+raw+'Modifier')return t==='elemental'?'incElemental':'inc_'+t;if(s==='defensive'+raw)return 'res_'+t;}
 return null;}
const ACTIVE={dar:['onslaught','맹공격'],storm:['stormspread','폭풍분사'],cold:['chillingrounds','냉각성탄환'],fang:['bloodfangs','피의송곳니'],burst:['burstinground','폭발성탄환']};
function scope(m){const text=clean((m.en||'')+' '+(m.name||'')+' '+(m.skill||''));for(const[k,words]of Object.entries(ACTIVE))if(words.some(w=>text.includes(clean(w))))return k;return null;}
function value(r,roll='mean'){
 const mean=(Number(r.min)||0)/2+(Number(r.max??r.min)||0)/2;
 if(roll==='low'&&Number.isFinite(r.low))return r.low;
 if(roll==='high'&&Number.isFinite(r.high))return r.high;
 return mean;
}
const METADATA=/^(augment|item|skillLevel|loot|characterLevel|defensiveBlock|characterMana|characterLight|characterExperience)/;
function mapped(item,roll='mean'){
 const stats={},unapplied=[],display=[],modifiers=[];
 const add=(k,v)=>{if(Number.isFinite(v)&&v!==0)stats[k]=(stats[k]||0)+v;};
 for(const r of item.raw||[]){if(r.source!=='self'){unapplied.push({reason:'발동/펫 효과 · 유지율 자동 계산 제외',...r});continue;}
  const v=value(r,roll),key=statKey(r.stat);
  if(key){add(key,v);display.push({key,value:v,raw:r.stat});}
  else if(!METADATA.test(r.stat)&&v!==0)unapplied.push({...r,reason:'현재 DPS 엔진 미지원'});
 }
 for(const c of item.conversions||[]){const f=dtype(c.from),t=dtype(c.to);if(t==='pierce'&&f&&f!=='pierce')add('conv_'+f,Number(c.percent));else unapplied.push({reason:'관통 이외 전환 미지원',stat:`${c.from} → ${c.to}`,min:c.percent,max:c.percent});}
 for(const m of item.modifiers||[]){const s=scope(m);if(!s){unapplied.push({...m,reason:'해당 스킬 조건부 변경 · 기본 합계에 미포함'});continue;}
  if(m.stat==='weaponDamagePct'){add(s==='dar'?'darWD':'wd_'+s,m.value);continue;}
  if(/^(chanceToUse|chanceToUseSkill|skillChanceToUse)$/.test(m.stat)&&s!=='dar'){add('chance_'+s,m.value);continue;}
  const k=statKey(m.stat);
  if(k?.startsWith('flat_')){modifiers.push({scope:s,kind:'flat',key:k,value:m.value});continue;}
  if(/^conversionPercentage/.test(m.stat)&&dtype(m.to)==='pierce'&&dtype(m.from)){modifiers.push({scope:s,kind:'conversion',key:'conv_'+dtype(m.from),value:m.value});continue;}
  unapplied.push({...m,reason:'스킬 변경 수치 표시 · 자동 계산 미지원'});
 }
 return {stats,unapplied,display,modifiers};
}
function tagType(t){return String(t||'').replace(/[^a-z0-9]/gi,'').toLowerCase().replace('gun1h','ranged1h').replace('gun2h','ranged2h');}
function compatible(x,slot,part,base){
 if(part==='ascension')return false;
 if(part!==x.part&&!(x.part==='affix'&&['prefix','suffix'].includes(part)))return false;
 if(part==='item'){
  if(slot==='relic')return x.domain==='relic';
  if(x.domain==='relic')return false;
  if(x.slots?.length)return x.slots.includes(slot)||((slot==='ring1'||slot==='ring2')&&x.slots.includes('ring'));
  const rec=x.id.toLowerCase();const check={main:/gearweapons/,off:/gearweapons|offhand|shield/,head:/head/,chest:/chest|torso/,shoulders:/shoulder/,gloves:/hands|glove/,pants:/legs|pants/,boots:/feet|boot/,belt:/waist|belt/,amulet:/neck|amulet/,ring1:/ring/,ring2:/ring/,medal:/medal/};return check[slot]?.test(rec)||false;
 }
 if(['prefix','suffix'].includes(part)){
  if(base&&/legendary|epic/i.test(base.rarity||''))return false;
  // Source deposit does not carry full loot-table affix compatibility. Do not invent it.
  return !x.slots?.length||x.slots.includes(slot);
 }
 if(slot==='relic')return false;
 if(x.applies?.length&&base?.type){const b=tagType(base.type);return x.applies.some(a=>{const t=tagType(a);return t===b||t==='all'||(t==='weapon'&&['main','off'].includes(slot))||(t==='armor'&&!['main','off','amulet','ring1','ring2','medal'].includes(slot))||(t==='ring'&&slot.startsWith('ring'));});}
 return !x.slots?.length||x.slots.includes(slot);
}
const DB={data:null,phase:'loading',message:'검색 DB 연결 중',progress:0,subscribers:[],error:'',
 on(fn){this.subscribers.push(fn);},emit(){this.subscribers.forEach(fn=>fn(this));},
 get(id){return this.data?.items.find(x=>x.id===id);},
 search(q,slot,part,base,{rarity='',maxLevel=100,offset=0,limit=60}={}){const words=String(q||'').split(/\s+/).map(clean).filter(Boolean);const all=(this.data?.items||[]).filter(x=>compatible(x,slot,part,base)&&(!rarity||x.rarity.toLowerCase()===rarity.toLowerCase())&&x.level<=maxLevel&&words.every(w=>x._search.includes(w)));all.sort((a,b)=>{const qa=clean(a.name)===clean(q)||clean(a.en)===clean(q),qb=clean(b.name)===clean(q)||clean(b.en)===clean(q);return Number(qb)-Number(qa)||b.level-a.level||a.name.localeCompare(b.name,'ko');});return {total:all.length,rows:all.slice(offset,offset+limit)};},
 accept(data){if(data?.schema!=='grim-catalog/v2'||!Array.isArray(data.items))throw new Error('지원하지 않는 DB 형식');this.data=data;for(const x of data.items)x._search=clean([x.name,x.en,x.id,x.level,x.rarity,...(x.boosts||[]).map(y=>y.name)].join(' '));this.phase='ready';this.message=`${data.items.length.toLocaleString('ko-KR')}개 레코드 · ${data.meta.gameVersion}`;this.progress=100;this.emit();},
 async load(){try{const embedded=document.getElementById('embedded-catalog');if(embedded){this.accept(JSON.parse(embedded.textContent));return;}
   if(location.protocol==='file:'){throw new Error('전체 검색 DB를 준비하려면 ZIP을 풀고 START_WINDOWS.cmd를 실행하세요. 첫 실행 후에는 앱의 ‘DB 포함 HTML 저장’으로 완전 오프라인 파일을 만들 수 있습니다.');}
   const started=Date.now();while(Date.now()-started<600000){const r=await fetch('/api/status',{cache:'no-store'});if(!r.ok)throw new Error('DB 서버에 연결할 수 없습니다. START_WINDOWS.cmd로 실행하세요.');const s=await r.json();this.phase=s.phase;this.message=s.message;this.progress=s.progress||0;this.emit();if(s.phase==='error')throw new Error(s.message);if(s.phase==='ready'){const cr=await fetch('/api/catalog',{cache:'no-store'});if(!cr.ok)throw new Error('DB 다운로드 실패');this.accept(await cr.json());return;}await new Promise(ok=>setTimeout(ok,1100));}throw new Error('DB 준비 시간이 초과되었습니다. 실행 창의 오류를 확인하세요.');
 }catch(e){this.phase='error';this.error=e.message;this.message=e.message;this.emit();}}
};
root.CATALOG={DB,statKey,mapped,value,compatible,clean,dtype,scope};if(typeof module!=='undefined')module.exports=root.CATALOG;
})(typeof globalThis!=='undefined'?globalThis:this);
