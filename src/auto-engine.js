/* Grim DPS Lab v3. Build compiler + explicit expected-value model.
 * No eval, interpolation of sampled ranks, fabricated item values, or silent
 * success for missing skills. A prediction is not a replay of Grim Dawn / DPYes.
 */
(function(root){'use strict';
const N=x=>Number.isFinite(Number(x))?Number(x):0, C=(x,a,b)=>Math.max(a,Math.min(b,N(x)));
const cp=x=>JSON.parse(JSON.stringify(x)), plus=(a,k,v)=>{if(Number.isFinite(v)&&v)a[k]=N(a[k])+v;};
const DIRECT=['physical','pierce','fire','cold','lightning','acid','vitality','aether','chaos'];
const DOT=['trauma','bleed','burn','frostburn','electrocute','poison','decay'];
const ALL=[...DIRECT,...DOT]; const zero=()=>Object.fromEntries(ALL.map(t=>[t,0]));
const TYPE={Physical:'physical',Pierce:'pierce',Piercing:'pierce',Fire:'fire',Cold:'cold',Lightning:'lightning',Poison:'acid',Acid:'acid',Life:'vitality',Vitality:'vitality',Aether:'aether',Chaos:'chaos',Elemental:'elemental',SlowPhysical:'trauma',SlowBleeding:'bleed',Bleeding:'bleed',SlowFire:'burn',SlowCold:'frostburn',SlowLightning:'electrocute',SlowPoison:'poison',SlowLife:'decay'};
const TO_DOT={physical:'trauma',fire:'burn',cold:'frostburn',lightning:'electrocute',acid:'poison',vitality:'decay'};
const DOT_RES={trauma:'physical',burn:'fire',frostburn:'cold',electrocute:'lightning',poison:'acid',decay:'vitality',bleed:'bleed'};
const SIMPLE={characterStrength:'physique',characterDexterity:'cunning',characterIntelligence:'spirit',characterStrengthModifier:'physiquePct',characterDexterityModifier:'cunningPct',characterIntelligenceModifier:'spiritPct',characterOffensiveAbility:'oa',characterOffensiveAbilityModifier:'oaPct',characterDefensiveAbility:'da',characterDefensiveAbilityModifier:'daPct',characterLife:'hp',characterLifeModifier:'hpPct',characterMana:'energy',characterManaModifier:'energyPct',characterLifeRegen:'regen',characterLifeRegenModifier:'regenPct',characterManaRegen:'energyRegen',characterManaRegenModifier:'energyRegenPct',characterAttackSpeedModifier:'attackSpeed',characterSpellCastSpeedModifier:'castSpeed',characterRunSpeedModifier:'moveSpeed',characterTotalSpeedModifier:'totalSpeed',offensiveCritDamageModifier:'crit',offensiveTotalDamageModifier:'incAll',offensiveDamageModifier:'incAll',offensiveElementalModifier:'incElemental',defensiveProtection:'armor',defensiveProtectionModifier:'armorPct',defensiveArmorAbsorptionModifier:'armorAbsorbPct',defensiveAbsorptionPercent:'armorAbsorbPct',defensiveArmorAbsorption:'armorAbsorbPct',characterHealIncreasePercent:'healingPct',offensiveLifeLeechMin:'leech',offensiveLifeLeech:'leech',offensivePierceRatio:'armorPiercing',offensivePierceRatioModifier:'armorPiercingPct',defensiveDamageAbsorption:'absorbPct',defensiveDamageAbsorptionModifier:'absorbPct',defensiveAbsorption:'flatAbsorb',defensiveAbsorptionProtection:'flatAbsorb',skillCooldownReduction:'cdr',augmentAllLevel:'allSkills',characterDodgePercent:'dodge',characterDeflectProjectile:'deflect',defensiveTotalSpeedResistance:'cc_slow',defensiveStun:'cc_stun',defensiveFreeze:'cc_freeze',defensivePetrify:'cc_petrify',defensiveTrap:'cc_trap',defensiveSleep:'cc_sleep',defensiveKnockdown:'cc_knockdown',defensiveDisruption:'cc_disruption',characterRangedDexterityReqReduction:'reqRangedCunning',characterJewelryIntelligenceReqReduction:'reqJewelrySpirit',characterArmorStrengthReqReduction:'reqArmorPhysique',characterWeaponsStrengthReqReduction:'reqWeaponPhysique'};
const CONTROL=/^(?:Class|skill(?:MaxLevel|UltimateLevel|MasteryLevel|Tier|Display|BaseDescription|Mana|Use|Target|Radius|Range|Angle|Time|Delay|Cooldown|Life|Energy|Name|Connection|Charge|Projectile|Chance|Requirement|Dependency|Dependanc)|weaponDamagePct|chanceToUse|cooldownTime|duration|buff|projectile|spawn|modSpawn|pet|conversion|onHit|onCrit|onAttack|trigger|attack|num|template|augment|item|loot|racial|Sword|Axe|Mace|Scepter|Dagger|Ranged|Shield|Offhand|Unarmed|sword|axe|mace|ranged|shield|offhand|unarmed|twoHand|dualWield|requires|defensiveBlock|character(?:Light|Experience|Level|Constitution))/;
const AFF=['ascendant','chaos','eldritch','order','primordial'];
const clean=s=>String(s||'').toLowerCase().replace(/[\s_'’:\-]/g,'');
function type(x){const k=String(x||'').replace(/^Damage/i,'');return TYPE[k]||Object.entries(TYPE).find(([a])=>a.toLowerCase()===k.toLowerCase())?.[1]||ALL.find(t=>t===k.toLowerCase())||null;}
function rank(v,r){if(r<=0)return 0;if(Array.isArray(v)){if(!v.length)return 0;return N(v[Math.min(Math.max(0,Math.floor(r)-1),v.length-1)]);}return typeof v==='number'?v:0;}
function atRank(stats,r){const out={};if(r<=0)return out;for(const[k,v]of Object.entries(stats||{}))if(typeof v==='number'||Array.isArray(v))out[k]=rank(v,r);if(out.skillCooldownTime!=null&&out.cooldownTime==null)out.cooldownTime=out.skillCooldownTime;if(out.projectileLaunchNumber!=null&&out.projectileNumber==null)out.projectileNumber=out.projectileLaunchNumber;return out;}
function issue(list,code,source,message,severity='warning'){if(!list.some(x=>x.code===code&&x.source===source&&x.message===message))list.push({code,source,message,severity});}
function defaults(){return {enabled:true,level:100,skillBudget:250,attributeBudget:109,attributes:{physique:60,cunning:44,spirit:5},masteries:{},points:{},disabled:{},primary:'',devotions:{},bindings:{},powerLevels:{},conditions:{inSeal:true,lowHealth:false,onHit:false},rotation:{},profile:{},offhandMode:'auto',timing:{mode:'estimated',measuredAPS:2.5,uptime:90,projectileHitFraction:.75},target:{da:3000,resists:{physical:30,pierce:40,fire:40,cold:40,lightning:40,acid:40,vitality:40,aether:40,chaos:40,bleed:30},armor:1800,armorAbsorption:70,absorption:0,flatAbsorption:0,avoidance:0,leechResist:80},difficulty:'ultimate'};}
function config(s){return {...defaults(),...(s.auto||{}),attributes:{...defaults().attributes,...s.auto?.attributes},timing:{...defaults().timing,...s.auto?.timing},conditions:{...defaults().conditions,...s.auto?.conditions},target:{...defaults().target,...s.auto?.target,resists:{...defaults().target.resists,...s.auto?.target?.resists}}};}
function mappedKey(k){if(SIMPLE[k])return SIMPLE[k];let m;
 if((m=/^offensive(.+?)(Modifier|DurationModifier|DurationMin|DurationMax|Min|Max)?$/.exec(k))){const t=TYPE[m[1]];if(t){const end=m[2]||'';return end==='Modifier'?'inc_'+t:end==='DurationModifier'?'dotDuration_'+t:end.startsWith('Duration')?'duration_'+t:'flat_'+t;}}
 if((m=/^defensive(.+?)(Resistance|MaxResist|MaxResistance)?$/.exec(k))){const t=TYPE[m[1]];if(t)return (m[2]?.startsWith('Max')?'maxRes_':'res_')+t;}
 return null;
}
function mapRaw(raw,{source='',issues=[],allowFlat=true,scalar=1}={}){
 const o={};for(const[k,v0]of Object.entries(raw||{})){
  if(typeof v0!=='number'||!v0)continue;if(/Max$/.test(k)&&raw[k.replace(/Max$/,'Min')]!=null)continue;
  let v=v0;if(/Min$/.test(k)&&Number.isFinite(raw[k.replace(/Min$/,'Max')]))v=(v+raw[k.replace(/Min$/,'Max')])/2;
  let key=mappedKey(k);
  if(key){if(!allowFlat&&key.startsWith('flat_'))continue;
   const chance=raw[k.replace(/Min$/,'')+'Chance']??raw[k+'Chance'];if(chance!=null)v*=C(chance,0,100)/100;
   plus(o,key,v*scalar);
  } else if(!CONTROL.test(k)&&!/^offensive.*(?:Chance|Resistance|Ability|Reduced|Reduction|DamageMult|TotalDamageReduction)/.test(k)&&!/^retaliation/.test(k))issue(issues,'unmapped-stat',source,k+' 수치 자동 적용 미지원');
  else if(/^offensive.*(?:Resistance|Ability|Reduced|Reduction)/.test(k)&&!rr({[k]:v},'check').length&&!/Duration|offensiveSlowDefensiveAbilityMin/.test(k))issue(issues,'unmapped-combat',source,k+' 전투 효과는 소계에 미반영');
  else if(/^racial/.test(k))issue(issues,'racial',source,'종족별 피해/방어 보너스는 특정 종족 선택 모델 미지원으로 미반영');
  else if(/^retaliation/.test(k))issue(issues,'retaliation',source,'반격 피해는 공격 횟수/피격 종류가 필요하여 총 DPS에 미포함');
 }
 // raw elementalResistance vocabulary used by devotion JSON
 if(raw.defensiveElementalResistance){o.res_elemental=N(raw.defensiveElementalResistance)*scalar;}
 return o;
}
function sum(...rows){const out={};for(const row of rows)for(const[k,v]of Object.entries(row||{}))plus(out,k,N(v));return out;}
function flat(stats){const out=zero();for(const t of ALL)out[t]=N(stats['flat_'+t]);for(const t of ['fire','cold','lightning'])out[t]+=N(stats.flat_elemental)/3;return out;}
function convRows(stats,meta){const out=[];for(const[k,v]of Object.entries(stats||{})){let m=/^conversionPercentage(\d*)$/.exec(k);if(!m||!v)continue;const i=m[1],a=type(meta?.['conversionInType'+i]),b=type(meta?.['conversionOutType'+i]);if(a&&b)out.push({from:a,to:b,percent:v});}return out;}
function conversion(packet,phases,armorPiercing=0){let left={...packet},done=zero();
 for(const phase of phases){const next={...left};for(const from of ALL){let rows=(phase||[]).flatMap(c=>c.from==='elemental'?['fire','cold','lightning'].map(t=>({...c,from:t})):c).filter(c=>c.from===from&&ALL.includes(c.to)&&c.to!==from&&c.percent>0);const total=rows.reduce((s,c)=>s+c.percent,0);if(!total||!left[from])continue;const used=Math.min(total,100),unit=left[from]*used/100;next[from]-=unit;for(const c of rows)done[c.to]+=unit*c.percent/total;}
  // DoT analogues convert with their parent damage. Never physical trauma -> pierce (there is no pierce DoT).
  for(const [parent,dt]of Object.entries(TO_DOT)){let rows=(phase||[]).flatMap(c=>c.from==='elemental'?['fire','cold','lightning'].map(t=>({...c,from:t})):c).filter(c=>c.from===parent&&TO_DOT[c.to]&&c.from!==c.to&&c.percent>0);const total=rows.reduce((s,c)=>s+c.percent,0);if(total&&left[dt]){const q=left[dt]*Math.min(total,100)/100;next[dt]-=q;for(const c of rows)done[TO_DOT[c.to]]+=q*c.percent/total;}}
  left=next;
 }
 const ap=C(armorPiercing,0,100)/100;done.pierce+=N(left.physical)*ap;left.physical=N(left.physical)*(1-ap);
 return Object.fromEntries(ALL.map(t=>[t,N(left[t])+N(done[t])]));
}
function isRanged(w){return /ranged|gun|pistol|crossbow/i.test(w?.type||w?.id||'');}
function weaponAllowed(rule,weapons){if(!rule)return true;const requested=rule.weapons||rule;if(!Array.isArray(requested))return true;return requested.some(r=>weapons.some(w=>{const a=clean(r),b=clean(w?.type);return a===b||a==='weapon'||a==='ranged1h'&&/ranged1h|gun1h/.test(b)||a==='ranged2h'&&/ranged2h|gun2h/.test(b)||a.includes('2h')&&b===a;}));}
function effectiveLevel(skill,points,boosts,all){const p=C(points,0,skill.max);if(!p)return {hard:0,bonus:0,level:0};if(skill.kind==='transmuter')return {hard:p,bonus:0,level:p};const b=N(all)+N(boosts[skill.id])+N(boosts[skill.mastery]);return {hard:p,bonus:b,level:Math.min(skill.ultimate||skill.max,p+b)};}
function classify(s,raw,override){if(override)return override;const text=clean(s.en+' '+s.name),cl=s.class+' '+s.effectClass;
 if(/cadence|cadans|칼날박자/.test(text))return 'special';
 if(/werewolf|wereraven|늑대인간|까마귀인간/.test(text))return 'pet';
 if(/inquisitorseal|인퀴지터의표식/.test(text))return 'area';
 if(/onslaught|savagery|righteousfervor|firestrike|beronathsfury|trollrage|맹공격/.test(text))return 'dar';
 if(/WeaponPool|WeaponProc/i.test(cl)||raw.chanceToUse>0)return 'wps';
 if(/Summon|SpawnPet|PetModifier/i.test(cl)||s.meta?.spawnObjects)return 'pet';
 if(/auraofcensure|veilofshadow|nightschill/i.test(text))return 'aura';
 if(/BuffDebuff|Debuff/.test(cl))return 'attack';
 if(/Passive|Toggle|BuffRadius|BuffSelf|BuffOther/i.test(cl))return 'buff';
 if(/Attack|Projectile|Wave|Beam|BuffDebuff|Debuff|Ground|Ray|Area|Radius/i.test(cl))return 'attack';
 if(s.kind==='modifier'||s.kind==='transmuter')return 'modifier';
 const hasDamage=Object.entries(raw).some(([k,v])=>/^offensive.*(?:Min|Max)$/.test(k)&&v&&mappedKey(k)?.startsWith('flat_'));
 if(hasDamage||raw.weaponDamagePct)return 'attack';if(Object.keys(mapRaw(raw)).length)return 'buff';return 'unknown';
}
function procTrigger(raw,def){if(def?.proc?.trigger_key)return def.proc.trigger_key;
 for(const k of ['onCritActivationChance','onHitActivationChance','onAttackActivationChance','onLowLifeActivationChance','onEnemyDeathActivationChance','onBlockActivationChance'])if(raw[k])return k;return null;}
function renewal(rate,chance,cooldown){const lambda=Math.max(0,N(rate))*C(chance,0,100)/100;return lambda?lambda/(1+lambda*Math.max(0,N(cooldown))):0;}
function buffUptime(rate,duration){return 1-Math.exp(-Math.max(0,rate)*Math.max(0,duration));}
function readMods(mods,id,issues){const out={},conversions=[];for(const m of mods.filter(m=>m.skill===id)){
 if(m.refreshSkill||m.refreshTrigger||/refresh|reset/i.test(m.stat)){issue(issues,'cooldown-reset',id,'확률형 재사용 초기화는 회전 빈도에 미반영');continue;}
 if(m.from&&m.to){if(type(m.from)&&type(m.to))conversions.push({from:type(m.from),to:type(m.to),percent:m.value});}
 else plus(out,m.stat,N(m.value));
 }return {raw:out,conversions};}
function rr(raw,source){const out=[];const add=(t,kind,v)=>{for(const x of t==='elemental'?['fire','cold','lightning']:[DOT_RES[t]||t])out.push({source,type:x,kind,value:Math.abs(v)});};
 for(const[k,v]of Object.entries(raw||{})){
  if(!v||typeof v!=='number'||/Duration/.test(k))continue;
  if(/Max$/.test(k)&&raw[k.replace(/Max$/,'Min')]!=null)continue;
  let m=/^defensive(.+?)(?:Resistance)?$/.exec(k);if(m&&v<0){const t=type(m[1]);if(t){add(t,'add',v);continue;}}
  m=/^offensive(?:Slow)?(.+?)Resistance(?:Min|Max|Modifier)?$/.exec(k);
  if(m){const t=type(m[1]);if(t){add(t,'add',v);continue;}}
  m=/^offensive(.*?)ResistanceReduction(Absolute|Percent)(?:Min|Max)?$/.exec(k);
  if(m){const t=!m[1]||m[1]==='Total'?'all':type(m[1]);if(t)add(t,m[2]==='Absolute'?'flat':'percent',v);}
 }
 return out;
}
function rrDuration(raw){return Math.max(0,...Object.entries(raw||{}).filter(([k])=>/Resistance.*DurationMin|skillActiveDuration/.test(k)).map(([,v])=>N(v)))||5;}
function enemyDA(raw){return Math.max(0,-N(raw.characterDefensiveAbility),N(raw.offensiveSlowDefensiveAbilityMin));}
function resistance(target,t,rrs){const typ=DOT_RES[t]||t;let r=N(target.resists?.[typ]);const relevant=rrs.filter(x=>x.type==='all'||x.type===typ),add={};let flat=0,pct=0;for(const x of relevant){if(x.kind==='add')add[x.source]=Math.max(N(add[x.source]),x.value);else if(x.kind==='flat')flat=Math.max(flat,x.value);else pct=Math.max(pct,x.value);}
 r-=Object.values(add).reduce((a,b)=>a+b,0);
 // Measured order: distinct -Y -> strongest Z% (signed) -> strongest flat X.
 r*=1-Math.sign(r)*C(pct,0,100)/100;return r-flat;
}
function negate(n){return Object.fromEntries(Object.entries(n).map(([k,v])=>[k,-v]));}
function devotionState(auto,data,weapons,issues){let aff=Object.fromEntries(AFF.map(a=>[a,0])),points=0,stats={},powers=[],selected=[],weaponRR=[];
 for(const c of data.devotions||[]){const pick=new Set((auto.devotions[c.id]||[]).map(Number));const real=c.stars.filter(s=>pick.has(s.index));points+=real.length;if(pick.size!==real.length)issue(issues,'unknown-star',c.name,'알 수 없는 별 인덱스','error');if(real.length===c.stars.length){for(const a of AFF)aff[a]+=N(c.affinity_bonus?.[a]);}selected.push({c,real,pick});}
 if(points>55)issue(issues,'devotion-budget','별자리',`55포인트 초과: ${points}`,'error');
 for(const {c,real,pick}of selected){if(!real.length)continue;for(const a of AFF)if(N(c.affinity_required?.[a])>aff[a])issue(issues,'affinity',c.name,`${a} 친화도 부족 (${aff[a]}/${c.affinity_required[a]})`,'error');
  for(const st of real){if((st.predecessors||[]).length&&!st.predecessors.some(p=>pick.has(p)))issue(issues,'star-path',c.name,`${st.index+1}번 별의 선행 별이 없습니다.`,'error');
   if(weaponAllowed(st.weapon_requirement,weapons)){stats=sum(stats,mapRaw(st.bonuses,{source:c.name,issues}));weaponRR.push(...rr(st.bonuses,c.id));}
   else issue(issues,'weapon-gate',c.name,`${st.index+1}번 별: 장착 무기 조건 불충족, 옵션 제외`);
   if(st.pet_bonuses)issue(issues,'pet-bonus',c.name,'펫 전용 능력치는 플레이어에게 합산하지 않습니다.');
   if(st.celestial_power){const p=st.celestial_power,r=C(auto.powerLevels[p.dbr]??p.level,1,p.level||25);powers.push({id:p.dbr,name:p.name||c.name,level:r,raw:atRank(p.rankStats,r),meta:p.rawMeta||{},def:p,class:p.skill_class,kind:'power',binding:auto.bindings[p.dbr]||'',rankSource:p.rankSource});}
  }
 }
 return {aff,points,stats,powers,weaponRR};
}
function gather(state,catalog,auto,issues){const data=catalog.automation,byItem=new Map(catalog.items.map(x=>[x.id,x]));let global={},local={main:{},off:{}},slotArmor={},boosts={},mods=[],conversions=[],sources=[],weapons=[],sets={},grants=[],requirements=[],weaponRR=[];
 for(const[slot,eq]of Object.entries(state.equipment||{})){if(eq.enabled===false)continue;let body=null;
  for(const[part,p]of Object.entries(eq.parts||{})){if(!p||p.enabled===false)continue;const id=p.db?.id||p.db?.record;const item=id?byItem.get(id):null;
   if(!item){if(p.name||Object.values(p.stats||{}).some(Boolean)){if(auto.allowLegacyManual){global=sum(global,p.stats||{});issue(issues,'manual',slot+':'+part,'수동 보정값 사용');}else issue(issues,'unresolved-item',slot+':'+part,`${p.name||'수동 옵션'}: DB 미연결, 계산 제외`);}continue;}
   if(part==='item'){body=item;requirements.push({slot,item});if(['main','off'].includes(slot))weapons.push({...item,slot});if(item.set){sets[item.set]??=new Set();sets[item.set].add(item.id);}}
   const raw={};for(const row of item.raw||[]){if(row.source!=='self')continue;raw[row.stat]=root.CATALOG.value(row,p.db?.roll||'mean');}
   weaponRR.push(...rr(raw,item.id).map(x=>({...x,hand:['main','off'].includes(slot)?slot:''})));let stats=mapRaw(raw,{source:item.name,issues});if(['main','off'].includes(slot)){const loc={};for(const[k,v]of Object.entries(stats))if(k.startsWith('flat_')||k.startsWith('duration_')||k==='armorPiercing'||k==='leech'){loc[k]=v;delete stats[k];}local[slot]=sum(local[slot],loc);}
   if(['head','chest','shoulders','gloves','pants','boots'].includes(slot)&&stats.armor){plus(slotArmor,slot,stats.armor);delete stats.armor;}
   global=sum(global,stats);sources.push({name:item.name,source:'equipment',slot,part,stats});
   for(const b of item.boosts||[])plus(boosts,b.target,b.level);
   mods.push(...(item.modifiers||[]));for(const c of item.conversions||[]){if(type(c.from)&&type(c.to))conversions.push({from:type(c.from),to:type(c.to),percent:N(c.percent)});else issue(issues,'conversion-type',item.name,`${c.from} → ${c.to} 전환 미지원`);}
   if(item.grantedSkill){const def=data.grantedSkills?.[item.grantedSkill];if(def){const level=N(data.itemGrantLevels?.[item.id])||1;grants.push({...def,level,item:item.id,sourceName:item.name});}else issue(issues,'missing-grant',item.name,'아이템 발동 스킬 원시 데이터가 없습니다.');}
  }
  for(const part of ['component','augment','prefix','suffix']){const p=eq.parts?.[part],it=p?.db?.id&&byItem.get(p.db.id);if(it&&body&&!root.CATALOG.compatible(it,slot,part,body))issue(issues,'item-slot',body.name,`${part} ${it.name} 부위 조건 불일치`,'error');}
 }
 const setDetails=[];for(const[id,pieces]of Object.entries(sets)){const s=data.sets.find(x=>x.id===id);if(!s){issue(issues,'missing-set',id,'세트 데이터 미확보');continue;}const count=pieces.size,raw=atRank(s.stats,count),stats=mapRaw(raw,{source:s.name,issues});global=sum(global,stats);sources.push({name:s.name+' '+count+'세트',source:'set',stats});setDetails.push({id,name:s.name,count,members:s.members});
  for(const b of s.boosts||[])if(b.pieces<=count)plus(boosts,b.target,N(b.level));
  for(const m of s.modifiers||[])if(m.pieces<=count)mods.push({skill:m.modified_skill,stat:m.stat_id,value:N(m.value),from:m.from_type,to:m.to_type});
  conversions.push(...convRows(raw,s.stats));
 }
 return {global,local,slotArmor,boosts,mods,conversions,sources,weapons,grants,requirements,setDetails,weaponRR};
}
/* Safe arithmetic parser used only for retained literal game equations.
   Case-insensitive variables/functions; no member access, strings, assignment. */
function equation(text,vars){const tokens=String(text).match(/(?:\d*\.\d+|\d+\.?\d*)(?:[eE][+-]?\d+)?|[A-Za-z_][\w]*|[+\-*/^(),]/g)||[];if(tokens.join('').toLowerCase()!==String(text).replace(/\s/g,'').toLowerCase())throw Error('Unsupported equation token');let i=0;const env=Object.fromEntries(Object.entries(vars).map(([k,v])=>[k.toLowerCase(),v]));
 const funcs={floor:Math.floor,ceil:Math.ceil,round:Math.round,min:Math.min,max:Math.max,abs:Math.abs,pow:Math.pow,sqrt:Math.sqrt};
 function primary(){const t=tokens[i++];if(t==='+')return primary();if(t==='-')return -primary();if(t==='('){const v=addExpr();if(tokens[i++]!==')')throw Error('Missing )');return v;}if(/^\d|^\./.test(t))return Number(t);if(!t)throw Error('Missing value');const key=t.toLowerCase();if(tokens[i]==='('){if(!funcs[key])throw Error('Unsupported function');i++;const args=[addExpr()];while(tokens[i]===','){i++;args.push(addExpr());}if(tokens[i++]!==')')throw Error('Missing )');return funcs[key](...args);}if(!(key in env))throw Error('Missing equation variable: '+t);return N(env[key]);}
 function power(){const a=primary();if(tokens[i]==='^'){i++;return a**power();}return a;}function mul(){let a=power();while(['*','/'].includes(tokens[i])){const op=tokens[i++],b=power();a=op==='*'?a*b:a/b;}return a;}function addExpr(){let a=mul();while(['+','-'].includes(tokens[i])){const op=tokens[i++],b=mul();a=op==='+'?a+b:a-b;}return a;}const val=addExpr();if(i!==tokens.length||!Number.isFinite(val))throw Error('Invalid equation');return val;}
function attributes(auto,g,data,issues){const raw=data.player?.raw||{},lv=C(auto.level,1,100);const profile=auto.profile||{};
 // Explicit reference fallback rather than presenting guessed base constants as verified game data.
 const base={physique:raw.characterStrength??50,cunning:raw.characterDexterity??50,spirit:raw.characterIntelligence??50,oa:raw.characterOffensiveAbility??50,da:raw.characterDefensiveAbility??50,hp:raw.characterLife??50};
 const verified=!!data.player?.record;
 if(!verified)issue(issues,'reference-base','능력치','플레이어 기본 레코드 없음: 공개 가이드 기준 프로필 사용. 총 능력치는 게임 대조 전 근사값');
 const attrs={};for(const k of ['physique','cunning','spirit'])attrs[k]=(N(base[k])+N(auto.attributes[k])*8+N(g[k]))*(1+N(g[k+'Pct'])/100);
 // Formula bindings must be explicit record/key matches rather than selecting any equation with a similar word.
 const bindings=data.player?.formulaBindings||{},equations=data.player?.formulas||{};
 const vars={charLevel:lv,playerLevel:lv,level:lv,characterLevelDV:lv,strength:attrs.physique,dexterity:attrs.cunning,intelligence:attrs.spirit,strengthDV:attrs.physique,dexterityDV:attrs.cunning,intelligenceDV:attrs.spirit,bonusDV:0,offensiveAbilityDV:N(base.oa)+N(g.oa),defensiveAbilityDV:N(base.da)+N(g.da),offensiveAbilityModifierDV:N(g.oaPct),defensiveAbilityModifierDV:N(g.daPct)};
 const growth={oa:lv*10,da:lv*10,hp:lv*20},formulaValues={},formulasUsed=[];
 for(const k of ['oa','da','hp']){const b=bindings[k];if(b&&equations[b.record]?.[b.key]){try{const v=equation(equations[b.record][b.key],vars);if(b.scope==='final')formulaValues[k]=v;else growth[k]=v;formulasUsed.push(k);}catch(e){issue(issues,'formula',k,e.message);}}}
 if(formulasUsed.length<3)issue(issues,'reference-growth','능력치','DB의 정확한 전체식을 연결하지 못한 항목은 참고 프로필로 계산합니다. OA/DA 레벨당 10·속성당 0.4, 체력 레벨당 20 등은 원시 게임식 대조 전 근사입니다. 정확한 최종 수치를 보증하지 않습니다.');
 const out={...g,...attrs};out.oa=profile.baseOA==null&&formulaValues.oa!=null?formulaValues.oa:(N(profile.baseOA??(N(base.oa)+growth.oa))+.4*attrs.cunning+N(g.oa))*(1+N(g.oaPct)/100);
 out.da=profile.baseDA==null&&formulaValues.da!=null?formulaValues.da:(N(profile.baseDA??(N(base.da)+growth.da))+.4*attrs.physique+N(g.da))*(1+N(g.daPct)/100);
 out.hp=profile.baseHP==null&&formulaValues.hp!=null?formulaValues.hp:(N(profile.baseHP??(N(base.hp)+growth.hp))+2.5*attrs.physique+attrs.cunning+1.5*attrs.spirit+N(g.hp))*(1+N(g.hpPct)/100);
 if(formulasUsed.length)issue(issues,'formula-provenance','능력치','원시 게임식 적용: '+formulasUsed.join(', ')+'. 식의 변수는 장비/속성/레벨에서 공급하며 bonusDV=0 기준입니다. 실제 캐릭터 대조 필요.');
 plus(out,'inc_physical',.41*attrs.cunning);plus(out,'inc_pierce',.41*attrs.cunning);plus(out,'inc_trauma',.46*attrs.cunning);plus(out,'inc_bleed',.46*attrs.cunning);
 for(const t of ['fire','cold','lightning','acid','vitality','aether','chaos'])plus(out,'inc_'+t,.47*attrs.spirit);for(const t of ['burn','frostburn','electrocute','poison','decay'])plus(out,'inc_'+t,.5*attrs.spirit);
 out.speed=C(100+N(g.attackSpeed)+N(g.totalSpeed),10,200);out.castSpeed=C(100+N(g.castSpeed)+N(g.totalSpeed),10,200);out.armor=N(g.armor)*(1+N(g.armorPct)/100);out.armorAbsorption=Math.min(100,70*(1+N(g.armorAbsorbPct)/100));return out;
}
function checkRequirements(items,a,auto,issues){for(const {slot,item}of items){const req=item.requirements||{};if(req.level>auto.level)issue(issues,'requirement',item.name,`요구 레벨 ${req.level}`,'error');for(const k of ['physique','cunning','spirit']){let red=0;if(k==='cunning'&&isRanged(item))red=N(a.reqRangedCunning);if(k==='spirit'&&['ring1','ring2','amulet','medal'].includes(slot))red=N(a.reqJewelrySpirit);if(k==='physique')red=['main','off'].includes(slot)?N(a.reqWeaponPhysique):N(a.reqArmorPhysique);const need=Math.ceil(N(req[k])*(1-C(red,0,100)/100));if(need>N(a[k]))issue(issues,'requirement',item.name,`${k} ${need} 필요 / ${N(a[k]).toFixed(0)}. 미충족 장비의 옵션은 계획 비교를 위해 남겼지만 유효 빌드가 아닙니다.`,'error');}}}
function compile(state,catalog){const issues=[];if(!catalog?.automation) return {ready:false,issues:[{code:'database',source:'DB',message:'정확한 레벨 배열을 포함한 v3 DB가 필요합니다.',severity:'error'}]};const data=catalog.automation,auto=config(state),gear=gather(state,catalog,auto,issues);let stats={...gear.global};const sources=[...gear.sources];
 if(catalog.meta.fixture)issue(issues,'fixture','DB','검사 표본입니다. 실제 게임 빌드 성능이 아닙니다.');
 let spent=0;const masters=Object.entries(auto.masteries).filter(([,r])=>N(r)>0);if(masters.length>2)issue(issues,'mastery-count','직업','숙련도는 최대 두 개입니다.','error');
 for(const[id,p]of masters){const m=data.masteries.find(x=>x.id===id);if(!m){issue(issues,'missing-mastery',id,'알 수 없는 직업','error');continue;}spent+=N(p);if(p>m.max)issue(issues,'mastery-cap',m.name,'숙련도 상한 초과','error');const r=atRank(m.stats,Math.min(p,m.max)),add=mapRaw(r,{source:m.name,issues});stats=sum(stats,add);sources.push({name:m.name,source:'mastery',stats:add});}
 const dev=devotionState(auto,data,gear.weapons,issues);stats=sum(stats,dev.stats);sources.push({name:'별자리',source:'devotion',stats:dev.stats});
 const skillMap=new Map(data.skills.map(s=>[s.id,s])),skills=[];for(const s of data.skills){const p=N(auto.points[s.id]);if(!p)continue;spent+=p;
  if(!auto.masteries[s.mastery]){issue(issues,'wrong-mastery',s.name,'선택하지 않은 직업의 스킬','error');continue;}if(p>s.max)issue(issues,'skill-cap',s.name,'직접 투자 상한 초과','error');
  const levels=effectiveLevel(s,p,gear.boosts,stats.allSkills);if(s.masteryRequired&&auto.masteries[s.mastery]<s.masteryRequired)issue(issues,'mastery-tier',s.name,`숙련도 ${s.masteryRequired} 필요`,'error');
  if(s.group!==s.id&&!(auto.points[s.group]>0))issue(issues,'prerequisite',s.name,'기본 스킬에 먼저 투자해야 합니다.','error');
  for(const dep of s.prerequisites||[])if(!auto.points[dep])issue(issues,'prerequisite',s.name,'선행 스킬 미투자','error');
  if(!s.masteryRequired)issue(issues,'tier-unverified',s.name,'숙련도 해금 단계는 원본 UI 메타데이터 미확인. 포인트·선행 그룹만 검사');
  if(s.rankSource!=='raw-arrays')issue(issues,'missing-ranks',s.name,'정확한 레벨 배열 없음. 피해 추정에서 제외','error');
  const m=readMods(gear.mods,s.id,issues),raw=sum(atRank(s.stats,levels.level),m.raw);const meta={...s.meta};const role=classify(s,raw,auto.rotation[s.id]?.role);
  skills.push({...s,...levels,raw,meta,conversions:[...convRows(raw,meta),...m.conversions],role,enabled:auto.disabled[s.id]!==true});
 }
 if(spent>auto.skillBudget)issue(issues,'skill-budget','스킬',`${auto.skillBudget}포인트 초과: ${spent}`,'error');let attrSpent=Object.values(auto.attributes).reduce((a,b)=>a+N(b),0);if(attrSpent>auto.attributeBudget)issue(issues,'attribute-budget','능력치',`${auto.attributeBudget}포인트 초과: ${attrSpent}`,'error');
 // Modifiers and transmuters affect their group only; do not become independent buffs.
 const bases=skills.filter(s=>s.kind==='base');for(const s of skills.filter(s=>s.kind!=='base'&&s.enabled)){const b=bases.find(x=>x.id===s.group);if(!b)continue;
  if(s.kind==='pet_modifier'){issue(issues,'pet-modifier',s.name,'펫 전용 효과: 플레이어 피해에 합산하지 않음');continue;}
  if((/Secondary|AutoCast|Projectile|Nova/.test(s.class)||/brimstone|explosivestrike/.test(clean(s.en)))&&Object.keys(s.raw).some(k=>/^offensive.*Min$/.test(k))){issue(issues,'secondary-behavior',s.name,'추가 폭발/파편의 별도 타격 패턴 미지원: 이 강화 노드의 효과는 소계에서 제외');continue;}
  b.raw=sum(b.raw,s.raw);b.conversions.push(...s.conversions);
 }
 let exclusives=bases.filter(s=>s.enabled&&(s.exclusive||/AuraofConviction|AuraofCensure|Bloodborne|Possession|Menhir.sBulwark|Oleron.sRage|StarPact|RecklessPower|Stormcaller.sPact|PrimalBond|DivineMandate|PathoftheThree|MasterofDeath|HarbingerofSouls/i.test(clean(s.en))));if(exclusives.length>1)issue(issues,'exclusive','독점 스킬','독점 스킬 두 개 이상 활성화. 하나만 켜세요.','error');
 const attacks=[],buffs=[],procs=[],rrs=[];const globalConv=[...gear.conversions];
 for(const b of bases.filter(s=>s.enabled)){
  if(b.role==='pet'||b.role==='special'||b.role==='unknown'){issue(issues,'unsupported-skill',b.name,b.role==='pet'?'소환·변신 AI/공격 패턴은 자동 DPS에 미포함':b.role==='special'?'카덴스 등 특수 타격 순서 모델 미지원':'스킬 실행 형태를 확인하지 못하여 총 DPS에서 제외');continue;}
  if(b.role==='buff'||b.role==='area'){if(b.role==='area'&&!auto.conditions.inSeal)continue;const trigger=procTrigger(b.raw);if(trigger){procs.push({...b,trigger,isBuff:true});continue;}
   gear.weaponRR.push(...rr(b.raw,b.id));const st=mapRaw(b.raw,{source:b.name,issues});stats=sum(stats,st);sources.push({name:b.name,source:'skill',stats:st});globalConv.push(...b.conversions);buffs.push(b);
   if(N(b.raw.offensiveTotalDamageReduction)||N(b.raw.offensiveTotalDamageReductionMin))plus(stats,'enemyDamageReduction',Math.max(N(b.raw.offensiveTotalDamageReduction),N(b.raw.offensiveTotalDamageReductionMin)));
  } else {attacks.push(b);if(auto.rotation[b.id]?.enabled!==false){rrs.push(...rr(b.raw,b.id));stats.enemyDA=Math.max(N(stats.enemyDA),enemyDA(b.raw));}}
 }
 for(const g of gear.grants){const raw=atRank(g.stats,g.level),role=classify(g,raw,auto.rotation[g.id]?.role),trigger=procTrigger(raw),entry={...g,id:g.id+'@'+g.item,skillId:g.id,raw,conversions:convRows(raw,g.meta),role,name:g.sourceName+' · '+g.name,trigger};if(auto.disabled[entry.id])continue;
  if(g.rankSource!=='raw-arrays'){issue(issues,'missing-grant-rank',entry.name,'아이템 스킬 정확한 레벨 데이터 누락');continue;}
  if(role==='pet'){issue(issues,'pet-grant',entry.name,'아이템 소환수 피해 미포함');continue;}
  if(trigger)procs.push({...entry,isBuff:role==='buff'});else if(role==='buff'){stats=sum(stats,mapRaw(raw,{source:entry.name,issues}));globalConv.push(...entry.conversions);buffs.push(entry);}else if(auto.rotation[g.id]?.enabled)attacks.push(entry);else issue(issues,'item-active',entry.name,'수동 사용 아이템 스킬은 회전에 켜야 피해에 포함됩니다.');
 }
 for(const b of bases){if(/savagery|righteousfervor/.test(clean(b.en)))issue(issues,'charge-model',b.name,'충전 단계별 런타임 배율/축적 상태는 원시 레벨 값 외에 자동 재현하지 못합니다.');if(/channel|beam|ray/i.test(b.class))issue(issues,'channel-model',b.name,'집중형 스킬의 틱 간격·에너지 제한은 실행시간 근사입니다.');}
 const learned=new Set([...bases.map(x=>x.id),...gear.grants.map(x=>x.id)]),bindingUsed=new Set();for(const p of dev.powers){if(!p.binding){issue(issues,'unbound-power',p.name,'연결 스킬 미선택: 별자리 발동 효과 제외');continue;}if(!learned.has(p.binding)){issue(issues,'invalid-binding',p.name,'배우지 않은 스킬에 연결됨','error');continue;}if(bindingUsed.has(p.binding)){issue(issues,'duplicate-binding',p.name,'하나의 스킬에 두 별자리 효과 연결','error');continue;}bindingUsed.add(p.binding);
  if(p.rankSource!=='raw-arrays'){issue(issues,'missing-power-rank',p.name,'정확한 별자리 발동 레벨 배열 누락');continue;}if(p.def.pet){issue(issues,'pet-power',p.name,'별자리 소환수 AI/피해 미포함');continue;}
  const trigger=procTrigger(p.raw,p.def)||'onAttackActivationChance';procs.push({...p,trigger,isBuff:!DIRECT.some(t=>flat(mapRaw(p.raw))[t])&&!rr(p.raw,p.id).length,conversions:convRows(p.raw,p.meta)});
 }
 const a=attributes(auto,stats,data,issues);const weights={head:.15,chest:.26,shoulders:.15,gloves:.12,pants:.20,boots:.12};a.armorBySlot=Object.fromEntries(Object.keys(weights).map(k=>[k,(N(gear.slotArmor[k])+N(stats.armor))*(1+N(stats.armorPct)/100)]));a.armor=Object.entries(weights).reduce((v,[k,w])=>v+a.armorBySlot[k]*w,0);checkRequirements(gear.requirements,a,auto,issues);let primary=attacks.find(s=>s.id===auto.primary);if(!primary){primary=attacks.find(s=>s.role==='dar')||attacks.find(s=>s.role==='attack');}
 if(!primary)issue(issues,'primary','주력 스킬','피해를 계산할 주력 공격 스킬을 선택하세요.','error');
 gear.weaponRR.push(...dev.weaponRR);
 const planned=true;return {ready:!!primary&&(primary.role!=='dar'||!!gear.weapons.find(w=>w.slot==='main')),valid:!issues.some(x=>x.severity==='error'),auto,data,a,stats,skills,bases,attacks,buffs,procs,primary,gear,dev,spent,attrSpent,sources,conversions:globalConv,rrs,issues,planned};
}
function skillWD(s,fallback=0){return s?.raw?.weaponDamagePct==null?fallback:N(s.raw.weaponDamagePct);}
function packet(state,a,base,proc,hand,globalConv,issues){const w=state.gear.local[hand]||{},weapon=flat(w),globalFlat=flat(a),bd=mapRaw(base?.raw||{}, {source:base?.name,issues}),pd=mapRaw(proc?.raw||{}, {source:proc?.name,issues}),wd=skillWD(base,base?.role==='dar'?100:0)/100*(proc?skillWD(proc,100)/100:1);let raw=zero();const bf=flat(bd),pf=flat(pd);for(const t of ALL)raw[t]=(weapon[t]+globalFlat[t])*wd+bf[t]+pf[t];
 // Carry additive skill-tree bonuses through conversion without multiplying
 // them by global % damage a second time. Skill bonuses follow original type.
 const skillBonus=zero();for(const t of ALL){skillBonus[t]=raw[t]*(N(bd['inc_'+t])+N(pd['inc_'+t])+N(bd.incAll)+N(pd.incAll)+(['fire','cold','lightning'].includes(t)?N(bd.incElemental)+N(pd.incElemental):0))/100;}
 const phases=[ [...(base?.conversions||[]),...(proc?.conversions||[])],globalConv],ap=wd>0?C(w.armorPiercing*(1+N(a.armorPiercingPct)/100),0,100):0;
 const converted=conversion(raw,phases,ap),bonusConverted=conversion(skillBonus,phases,ap);
 for(const t of ALL){const elemental=['fire','cold','lightning'].includes(t)?N(a.incElemental):0;converted[t]=converted[t]*Math.max(0,1+(N(a['inc_'+t])+N(a.incAll)+elemental)/100)+bonusConverted[t];
  converted[t]*=Math.max(0,1+(N(base?.raw.skillTotalDamageModifier)+N(proc?.raw.skillTotalDamageModifier))/100);
 }

 return converted;
}
function mitigated(packet,target,profile,rrs,spell=false){const result=zero(),bins=spell?(root.GD.critProfile(Math.max(profile.oa||1,target.da),target.da,profile.bonusCrit||0).bins):profile.bins;
 for(const b of bins){if(!b.m)continue;const vals={};for(const t of DIRECT){let d=N(packet[t])*b.m*Math.max(0,1-resistance(target,t,rrs)/100);if(t==='physical')d-=Math.min(d,N(target.armor))*C(target.armorAbsorption,0,100)/100;d*=1-C(target.absorption,0,100)/100;vals[t]=d;}
  const pre=Object.values(vals).reduce((x,y)=>x+y,0),post=Math.max(0,pre-N(target.flatAbsorption)),ratio=pre?post/pre:0;for(const t of DIRECT)result[t]+=vals[t]*ratio*b.p*(1-C(target.avoidance,0,100)/100);
 }
 for(const t of DOT)result[t]=N(packet[t])*profile.mean*Math.max(0,1-resistance(target,t,rrs)/100)*(1-C(target.absorption,0,100)/100);return result;
}
function hits(s,dual,auto){const name=clean(s.en+' '+s.name),p=auto.rotation[s.id]||{};if(p.hitsMain!=null)return {main:N(p.hitsMain),off:dual?N(p.hitsOff):0};
 if(/stormspread|폭풍분사/.test(name)){const count=N(s.raw.projectileNumber)||N(s.raw.projectileNumberMax)||4;return {main:count*C(auto.timing.projectileHitFraction,0,1),off:dual?count*C(auto.timing.projectileHitFraction,0,1):0};}
 if(/chillinground|bloodfang|냉각성탄환|피의송곳니/.test(name))return {main:2,off:dual?2:0};
 const pnum=Math.max(1,N(s.raw.projectileNumber)||1);return {main:pnum,off:dual?1:0};
}
function duration(s,auto,weaponAPS,speed){const p=auto.rotation[s?.id]||{};if(p.cycleMs>0)return p.cycleMs/1000*200/speed;const name=clean(s?.en+' '+s?.name);let factor=1;if(/chillinground|stormspread|냉각성탄환|폭풍분사/.test(name))factor=1.2;if(/bloodfang|피의송곳니/.test(name))factor=.95;return factor/(Math.max(.1,weaponAPS)*speed/100);}
function expected(state,catalog){const c=compile(state,catalog);if(!c.primary||!c.a)return empty(c);const {auto}=c;const issues=c.issues;const main=c.gear.weapons.find(w=>w.slot==='main'),off=c.gear.weapons.find(w=>w.slot==='off');const dual=!!off&&!/shield|offhand/i.test(off.type)&&auto.offhandMode!=='single';let a=c.a,stats=c.stats;const target=auto.target,extraRows=[],rrs=[...c.rrs],procStats={};let computed;
 const wdScale=C(skillWD(c.primary,c.primary.role==='dar'?100:0)/100,0,1);if(wdScale){rrs.push(...c.gear.weaponRR.filter(x=>!x.hand||x.hand==='main'||dual).map(x=>({...x,value:x.value*wdScale})));if(c.gear.weaponRR.length)issue(issues,'weapon-rr','무기/별자리','무기 전달 저항 감소: 주력 무기 피해 계수(상한 100%) 기준. 다중 사격별 전달·시간 유지율은 근사');}
 const weaponAPS=N(main?.aps)||1.5;if(!main?.aps)issue(issues,'attack-speed','무기','기본 공격 속도 데이터 누락: 초당 1.5회 참고값 사용');
 issue(issues,'animation','공격 동작','공격별 애니메이션 길이는 추정 배율입니다. 측정 APS 모드로 전환 가능');
 // A single-pass mean-uptime model approximates on-attack buffs; not a fixed-point game simulation.
 const calculateRows=()=>{
  const profile=root.GD.critProfile(a.oa,Math.max(1,N(target.da)-N(a.enemyDA)),N(a.crit));profile.oa=a.oa;profile.bonusCrit=N(a.crit);
  let choices=c.attacks.filter(s=>s.role==='wps'&&s.enabled&&c.primary.role==='dar').map(s=>({...s,chance:C(s.raw.chanceToUse||s.raw.chanceToUseSkill,0,100)}));
  const pool=root.GD.pool(choices),rows=[];let mean=0,seconds=0;
  const addRow=(s,p,basic=false)=>{const h=basic?{main:dual?.75:1,off:dual?.75:0}:hits(s,dual,auto);const pm=packet(c,a,c.primary,basic?null:s,'main',c.conversions,issues),po=packet(c,a,c.primary,basic?null:s,'off',c.conversions,issues),em=mitigated(pm,target,profile,rrs),eo=mitigated(po,target,profile,rrs);let types=zero();for(const t of ALL)types[t]=em[t]*h.main+eo[t]*h.off;const damage=DIRECT.reduce((x,t)=>x+types[t],0);const time=duration(basic?c.primary:s,auto,weaponAPS,a.speed);mean+=p*damage;seconds+=p*time;rows.push({id:basic?'basic':s.id,name:basic?c.primary.name:s.name,p,chance:s?.chance,wd:basic?100:skillWD(s,100),hitsMain:h.main,hitsOff:h.off,damage,seconds:time,types,rawMain:pm,rawOff:po,skill:basic?c.primary:s});};
  if(c.primary.role==='dar'){for(const row of pool.rows)addRow(row,row.p);if(pool.basic)addRow(c.primary,pool.basic,true);}else{const p=packet(c,a,c.primary,null,'main',c.conversions,issues),em=mitigated(p,target,profile,rrs),hit=hits(c.primary,false,auto).main;for(const t of ALL)em[t]*=hit;const damage=DIRECT.reduce((x,t)=>x+em[t],0),cd=Math.max(0,N(c.primary.raw.cooldownTime))*(1-C(a.cdr,0,80)/100),time=Math.max(cd,N(c.primary.raw.skillChargeDuration),1/(Math.max(.1,weaponAPS)*a.castSpeed/100));mean=damage;seconds=time;rows.push({id:c.primary.id,name:c.primary.name,p:1,hitsMain:hit,hitsOff:0,wd:skillWD(c.primary),damage,seconds:time,types:em,rawMain:p,rawOff:zero(),skill:c.primary});}
  let aps=auto.timing.mode==='measured'?C(auto.timing.measuredAPS,.01,20):1/Math.max(.03,seconds);return {profile,pool,rows,aps,mean,seconds};
 };
 computed=calculateRows();
 const sourceRate=id=>{const r=computed.rows.find(x=>x.id===id);if(r)return computed.aps*r.p*Math.max(1,r.hitsMain+r.hitsOff);if(id===c.primary.id)return computed.aps;const attack=c.attacks.find(x=>x.id===id);if(attack){const interval=Math.max(.2,N(auto.rotation[id]?.interval)||N(attack.raw.cooldownTime)||N(attack.raw.skillActiveDuration)||3);return 1/interval;}return 0;};
 const rates={};for(const p of c.procs){const raw=p.raw,trigger=p.trigger||'',key=trigger,percent=N(raw[key])||N(p.def?.proc?.chance)||100;let rate;
  if(/LowLife|lowLife|lowHealth|LifeMonitor/i.test(key)){if(!auto.conditions.lowHealth){issue(issues,'conditional',p.name,'저체력 미발동 상태. 효과 제외');continue;}rate=1/Math.max(1,N(raw.cooldownTime));}
  else if(/onHit|HitBy|Block|Death|Kill/i.test(key)){if(!auto.conditions.onHit){issue(issues,'conditional',p.name,'피격·처치 조건 미선택. 효과 제외');continue;}rate=N(auto.profile.incomingHitsPerSecond)||1;}
  else {rate=p.binding?sourceRate(p.binding):computed.aps;if(/Crit/i.test(key))rate*=computed.profile.crit;}
  if(!rate){issue(issues,'proc-rate',p.name,'연결 스킬의 발동 기회가 없어 효과 제외');continue;}const hz=renewal(rate,percent,N(raw.cooldownTime)*(1-C(a.cdr,0,80)/100));rates[p.id]=hz;
  const effects=rr(raw,p.skillId||p.id);if(effects.length){const dur=rrDuration(raw);const up=buffUptime(hz,dur);rrs.push(...effects.map(x=>({...x,value:x.value*up})));issue(issues,'average-rr',p.name,'확률형 저항 감소는 평균 유지율 근사. 실측 적 저항은 시간에 따라 변합니다.');}
  if(enemyDA(raw))a.enemyDA=Math.max(N(a.enemyDA),enemyDA(raw)*buffUptime(hz,rrDuration(raw)));
  if(p.isBuff){const dur=N(raw.skillActiveDuration)||N(raw.duration)||N(raw.buffDuration)||5,up=buffUptime(hz,dur);const st=mapRaw(raw,{source:p.name,issues,scalar:up});Object.assign(procStats,sum(procStats,st));extraRows.push({id:p.id,name:p.name,kind:'buff',dps:0,rate:hz,uptime:up});}
 }
 if(Object.keys(procStats).length){stats=sum(stats,procStats);a=attributes(auto,stats,c.data,issues);issue(issues,'average-buffs','발동 버프','확률형 버프를 평균 유지율로 반영한 근사. 치명타·공속의 시간별 상관은 미재현');}
 computed=calculateRows();const uptime=C(auto.timing.uptime,0,100)/100;let castFraction=0;const castRows=[];
 for(const sk of c.attacks.filter(x=>x.id!==c.primary.id&&x.role!=='wps')){if(auto.rotation[sk.id]?.enabled===false)continue;const raw=sk.raw,p=auto.rotation[sk.id]||{},dur=N(raw.skillActiveDuration)||N(raw.offensiveSlowPierceResistanceDurationMin),interval=Math.max(.2,N(p.interval)||Math.max(N(raw.cooldownTime)*(1-C(a.cdr,0,80)/100),dur>0?dur:3)),hz=1/interval,castTime=sk.role==='aura'?0:(N(p.castTime)||.35);castFraction+=hz*castTime;
  const pkt=packet(c,a,sk,null,'main',c.conversions,issues),v=mitigated(pkt,target,computed.profile,rrs),dps=DIRECT.reduce((x,t)=>x+v[t],0)*hz*uptime;castRows.push({id:sk.id,name:sk.name,kind:'spell',dps,rate:hz,types:v,raw,uptime:1});}
 castFraction=C(castFraction,0,.9);if(castFraction)issue(issues,'rotation','회전','보조 공격 기본 재시전 간격과 시전시간은 근사값. 회전 설정에서 조정 가능');
 const effectiveAPS=computed.aps*(1-castFraction),direct=computed.mean*effectiveAPS*uptime,types=zero(),dots={};
 for(const r of computed.rows){r.dps=r.p*r.damage*effectiveAPS*uptime;for(const t of DIRECT)types[t]+=r.p*r.types[t]*effectiveAPS*uptime;
  for(const t of DOT){if(!r.types[t])continue;const duration=N(mapRaw(r.skill.raw)['duration_'+t])||N(mapRaw(c.primary.raw)['duration_'+t])||3,hz=r.p*effectiveAPS*uptime*computed.profile.hit,perTargetRate=r.types[t]/Math.max(1,r.hitsMain+r.hitsOff);const value=perTargetRate*buffUptime(hz,duration*(1+N(a['dotDuration_'+t])/100));const group=t+':weapon-shared';if(!dots[group]||value>dots[group].dps)dots[group]={id:group,name:'무기 공격 '+t,kind:'dot',dps:value,type:t,rate:hz,uptime:buffUptime(hz,duration)};}
 }
 for(const p of c.procs.filter(x=>!x.isBuff&&rates[x.id])){const hz=rates[p.id],v=mitigated(packet(c,a,p,null,'main',c.conversions,issues),target,computed.profile,rrs),hit=Math.max(1,N(auto.rotation[p.id]?.hitsMain)||1);let dps=DIRECT.reduce((x,t)=>x+v[t],0)*hz*hit*uptime;extraRows.push({id:p.id,name:p.name,kind:'proc',dps,rate:hz,uptime});for(const t of DIRECT)types[t]+=v[t]*hz*hit*uptime;
  for(const t of DOT)if(v[t]){const dur=N(mapRaw(p.raw)['duration_'+t])||3,dps=v[t]*buffUptime(hz*uptime,dur);dots[t+':'+p.id]={id:p.id+':'+t,name:p.name+' '+t,kind:'dot',dps,type:t};}
 }
 for(const sk of castRows){for(const t of DIRECT)types[t]+=sk.types[t]*sk.rate*uptime;for(const t of DOT)if(sk.types[t]){const dur=N(mapRaw(sk.raw)['duration_'+t])||3;dots[t+':'+sk.id]={id:sk.id+':'+t,name:sk.name+' '+t,kind:'dot',dps:sk.types[t]*buffUptime(sk.rate*uptime,dur),type:t};}}
 const dotRows=Object.values(dots);if(dotRows.length)issue(issues,'dot-model','지속 피해','같은 무기 출처는 가장 큰 평균값만 유지. 별도 스킬 출처는 합산. 치명타 스냅샷 경쟁/정확한 재적용 틱은 미재현');
 for(const d of dotRows)types[d.type]+=d.dps;const extras=[...castRows,...extraRows,...dotRows],extra=extras.reduce((x,r)=>x+r.dps,0);
 const armorWeights={head:.15,chest:.26,shoulders:.15,gloves:.12,pants:.20,boots:.12};a.armorBySlot=Object.fromEntries(Object.keys(armorWeights).map(k=>[k,(N(c.gear.slotArmor[k])+N(stats.armor))*(1+N(stats.armorPct)/100)]));a.armor=Object.entries(armorWeights).reduce((v,[k,w])=>v+a.armorBySlot[k]*w,0);c.a=a;c.stats=stats;c.issues=issues;c.valid=!issues.some(x=>x.severity==='error');c.rrs=rrs;c.rates=rates;c.castFraction=castFraction;
 const fallback=issues.some(x=>x.code.startsWith('reference-')),excluded=issues.filter(x=>/unsupported|pet-|missing-|unmapped|retaliation|secondary|racial|charge-model|channel-model/.test(x.code));
 return {a:{g:a,oa:a.oa,da:a.da,hp:a.hp,speed:a.speed,hands:{main:flat(sum(a,c.gear.local.main)),off:flat(sum(a,c.gear.local.off))},warnings:[]},profile:computed.profile,pool:computed.pool,rows:computed.rows,aps:effectiveAPS,meanCycle:computed.seconds,meanDamage:computed.mean,direct,extra,total:direct+extra,types,extras,warnings:issues.map(x=>`${x.source}: ${x.message}`),uptime,autoReport:c,coverage:{excluded:excluded.length,reference:fallback,valid:c.valid,scope:'지원된 효과의 기대값 · 게임 엔진/DPYes 실측 아님'}};
}
function empty(c){return {a:{g:{},oa:0,da:0,hp:0,speed:100,hands:{main:zero(),off:zero()},warnings:[]},profile:{mean:0,crit:0,hit:0,bins:[]},pool:{sum:0,basic:1,rows:[]},rows:[],aps:0,meanCycle:0,meanDamage:0,direct:0,extra:0,total:0,types:zero(),extras:[],warnings:c.issues.map(x=>x.message),uptime:0,autoReport:c,coverage:{excluded:0,reference:false,valid:false,scope:'계산 준비 전'}};}
const api={DIRECT,DOT,ALL,AFF,TYPE,N,C,rank,atRank,mappedKey,mapRaw,sum,flat,type,conversion,equation,effectiveLevel,classify,renewal,buffUptime,resistance,rr,rrDuration,readMods,devotionState,defaults,config,gather,compile,expected,empty};
root.AUTO=api;if(typeof module!=='undefined')module.exports=api;
if(root.GD){const manual=root.GD.calculate;root.GD.calculate=s=>s.auto?.enabled?expected(s,root.CATALOG?.DB?.data):manual(s);}
})(typeof globalThis!=='undefined'?globalThis:this);
