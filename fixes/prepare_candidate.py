"""Prepare the reviewed UI/DB compatibility candidate on the isolated test branch.
This script edits only the listed application files. It is idempotent, checks
expected source fragments, and records hashes. CI packages the resulting source,
not the unmodified checkout. It does not download or execute external code.
"""
from pathlib import Path
import hashlib,json
ROOT=Path(__file__).resolve().parents[1]
PATCHES={
 'src/catalog.js':[
  ("this.phase=s.phase;this.message=s.message;this.progress=s.progress||0;this.emit();", "this.phase=s.phase==='ready'?'loading':s.phase;this.message=s.phase==='ready'?'DB 전송·검색 인덱스 준비 중':s.message;this.progress=s.phase==='ready'?95:(s.progress||0);this.emit();")
 ],
 'src/auto-ui.js':[("'Impetus':2","'Impulse':2")],
 'src/auto-engine.js':[
  ("if(/WeaponPool|WeaponProc/i.test(cl)||raw.chanceToUse>0)return 'wps';", "if(/WPAttack|WeaponPool|WeaponProc/i.test(cl)||raw.chanceToUse>0||raw.skillChanceWeight>0)return 'wps';"),
  ("if(/Summon|SpawnPet|PetModifier/i.test(cl)||s.meta?.spawnObjects)return 'pet';", "if(/arcaneempowerment|마법적강화/.test(text)&&s.group!==s.id)return 'modifier';\n if(/Summon|SpawnPet|PetModifier/i.test(cl)||s.meta?.spawnObjects)return 'pet';"),
  ("if(/BuffDebuff|Debuff/.test(cl))return 'attack';", "if(/Debuff|Debuf|AttackBuffRadius/i.test(cl))return 'attack';"),
  ("function procTrigger(raw,def){if(def?.proc?.trigger_key)return def.proc.trigger_key;", "function procTrigger(raw,def){if(def?.proc?.trigger_key)return def.proc.trigger_key;\n const cl=(def?.class||'')+' '+(def?.effectClass||'');\n if(/PassiveOnCrit/i.test(cl))return 'onCritActivationChance';\n if(/PassiveOnLife/i.test(cl))return 'onLowLifeActivationChance';"),
  ("if(s.kind==='pet_modifier'){", "if(s.kind==='pet_modifier'&&!(/arcaneempowerment|마법적강화/.test(clean(s.en+' '+s.name))&&b.role==='area')){"),
  ("if((/Secondary|AutoCast|Projectile|Nova/.test(s.class)||/brimstone|explosivestrike/.test(clean(s.en)))", "if((/Secondary(?!_PetModifier)|AutoCast|Projectile|Nova/.test(s.class)||/brimstone|explosivestrike/.test(clean(s.en)))"),
  ("procTrigger(b.raw)","procTrigger(b.raw,b)"),
  ("trigger=procTrigger(raw),entry=", "trigger=procTrigger(raw,g),entry="),
  ("chance:C(s.raw.chanceToUse||s.raw.chanceToUseSkill,0,100)", "chance:C(s.raw.skillChanceWeight??s.raw.chanceToUse??s.raw.chanceToUseSkill,0,100)"),
  ("const meta={...s.meta};const role=classify", "if(raw.skillCooldownTime!=null&&raw.cooldownTime==null)raw.cooldownTime=raw.skillCooldownTime;const meta={...s.meta};const role=classify"),
  ("const raw=atRank(g.stats,g.level),role=", "const raw=atRank(g.stats,g.level);if(raw.skillCooldownTime!=null&&raw.cooldownTime==null)raw.cooldownTime=raw.skillCooldownTime;const role="),
  ("if(!c.primary||!c.a)return empty(c)", "if(!c.primary||!c.a||!c.ready)return empty(c)")
 ]
}

def prepare():
 report={}
 for name,changes in PATCHES.items():
  path=ROOT/name;source=path.read_text(encoding='utf8')
  original=hashlib.sha256(source.encode()).hexdigest()
  for old,new in changes:
   if new in source:continue
   if source.count(old)!=1:raise RuntimeError('Unexpected source: '+name+' / '+old[:70])
   source=source.replace(old,new,1)
  path.write_text(source,encoding='utf8',newline='\n')
  report[name]={'before':original,'after':hashlib.sha256(path.read_bytes()).hexdigest()}
 out=ROOT/'tests/reports';out.mkdir(parents=True,exist_ok=True)
 (out/'candidate-source.json').write_text(json.dumps(report,indent=2),encoding='utf8')
 print('Prepared explicit candidate: '+', '.join(report))
if __name__=='__main__':prepare()
