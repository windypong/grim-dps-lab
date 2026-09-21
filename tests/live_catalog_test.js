/* Integration tests against the actual downloaded public catalog, not fixtures.
   These validate data wiring, not agreement with in-game DPYes measurements. */
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),report={suite:'live public catalog integration',fixture:false,gameDPSValidated:false,checks:[]};
global.GD=require('../src/engine.js');global.DATA=require('../src/data.js');global.CATALOG=require('../src/catalog.js');global.AUTO=require('../src/auto-engine.js');require('../src/auto-ui.js');
function check(name,fn){try{fn();report.checks.push({name,status:'passed'});console.log('PASS '+name);}catch(e){report.checks.push({name,status:'failed',error:String(e.stack||e)});console.error('FAIL '+name+' '+e.message);}}
try{
 const db=JSON.parse(fs.readFileSync(process.argv[2]||path.join(__dirname,'reports/live-catalog.json'),'utf8'));
 assert(!db.meta.fixture&&!db.meta.testOnly);assert(db.items.length>1000);CATALOG.DB.accept(db);
 report.dataset={version:db.meta.gameVersion,release:db.meta.release,items:db.items.length,skills:db.automation.skills.length,devotions:db.automation.devotions.length};
 const state=DATA.state(false),notes=AUTOUI.preset(state);
 check('all Oathbearer preset skill and constellation names resolve',()=>assert.deepStrictEqual(notes,[]));
 check('preset allocates exactly 250 skill points',()=>assert.strictEqual(AUTO.compile(state,db).spent,250));
 check('weapon attack without a weapon does not show invented DPS',()=>assert.strictEqual(GD.calculate(state).total,0));
 const gun=CATALOG.DB.search('서약운반자','main','item',null).rows[0];
 check('Korean search finds actual Oathbearer weapon',()=>{assert(gun);assert(gun.raw.length);assert(gun.level>=84);});
 for(const slot of ['main','off'])state.equipment[slot].parts.item={name:gun.name,enabled:true,db:{id:gun.id,roll:'mean'},stats:{}};
 const result=GD.calculate(state),c=result.autoReport;
 const sk=name=>{const row=c.skills.find(x=>x.en===name);assert(row,'Missing '+name);return row;};
 for(const name of ['Bloodfangs','Bursting Round','Chilling Rounds','Storm Spread']){
  check(name+' uses native WPAttack semantics',()=>assert.strictEqual(sk(name).role,'wps'));
  check(name+' reads native skillChanceWeight',()=>{const row=result.rows.find(x=>x.id===sk(name).id);assert(row);assert.strictEqual(row.skill.chance,sk(name).raw.skillChanceWeight);assert(row.p>0);});
 }
 for(const name of ['Word of Pain','Bonechilling Cry'])check(name+' debuffs the target rather than buffing the player',()=>assert.strictEqual(sk(name).role,'attack'));
 check('Arcane Empowerment joins the Seal instead of being discarded as pet AI',()=>{const seal=c.bases.find(x=>x.en==='Inquisitor Seal');assert(seal.raw.offensiveElementalMin>=sk('Arcane Empowerment').raw.offensiveElementalMin);assert(!c.issues.some(x=>x.source===sk('Arcane Empowerment').name&&['pet-modifier','secondary-behavior'].includes(x.code)));});
 check('native cooldown fields are retained for rotation',()=>assert.strictEqual(sk('Bonechilling Cry').raw.cooldownTime,sk('Bonechilling Cry').raw.skillCooldownTime));
 check('Deadly Aim triggers on critical attacks, not incoming hits',()=>assert.strictEqual(c.procs.find(x=>x.en==='Deadly Aim').trigger,'onCritActivationChance'));
 check('Untamed Rage remains conditional on low life',()=>assert.strictEqual(c.procs.find(x=>x.en==='Untamed Rage').trigger,'onLowLifeActivationChance'));
 check('mastery and individual item skill boosts resolve',()=>assert(sk('Storm Spread').bonus>=2));
 check('target resistance reduction includes Bonechilling Cry',()=>assert(c.rrs.some(x=>x.source===sk('Bonechilling Cry').id&&x.type==='pierce'&&x.value>0)));
 check('devotion preset has 55 legal selected points',()=>{assert.strictEqual(c.dev.points,55);assert(!c.issues.some(x=>x.severity==='error'&&/affinity|star-path/.test(x.code)));});
 check('supported subtotal is finite and positive',()=>assert(Number.isFinite(result.total)&&result.total>0));
 check('modeled limitations remain exposed',()=>assert(c.issues.some(x=>x.code==='animation')));
 report.subtotalIsNotGameMeasurement=result.total;
}catch(e){report.fatal=String(e.stack||e);console.error(report.fatal);}
report.passed=report.checks.filter(x=>x.status==='passed').length;report.failed=report.checks.filter(x=>x.status==='failed').length+(report.fatal?1:0);
fs.mkdirSync(path.join(__dirname,'reports'),{recursive:true});fs.writeFileSync(path.join(__dirname,'reports/live-catalog-tests.json'),JSON.stringify(report,null,2));
process.exitCode=report.failed?1:0;
