"""Synthetic integration records. NEVER used as production data or a game oracle."""
from pathlib import Path
import json,copy
ROOT=Path(__file__).resolve().parents[1]
base=json.loads((ROOT/'tests/catalog-fixture.json').read_text())
base['meta'].update(fixture=True,testOnly=True,gameVersion='TEST ONLY — 자동화 검사 표본',automationVersion=3,scope='UI/계산 경로 검사 표본 — 실제 게임 수치 아님')
M1='records/skills/playerclass10/_classtraining_class10.dbr';M2='records/skills/playerclass07/_classtraining_class07.dbr'
def curve(a,b,n):return [round(a+(b-a)*(i/(n-1))**1.17,4) for i in range(n)]
def sk(en,ko,mid,cap,stats,cl='Skill_BuffSelf',group=None,kind='base',ultimate=None):
 rec=mid.rsplit('/',1)[0]+'/'+en.lower().replace(' ','').replace("'",'')+'_TEST.dbr'
 return dict(id=rec,name=ko,en=en,description='합성 검사 데이터. 인게임 수치 아님.',mastery=mid,group=group or rec,kind=kind,max=cap,ultimate=ultimate or cap+10,stats=stats,meta={},rankSource='raw-arrays',class_=cl,**{'class':cl,'effectClass':cl},x=0,y=0,masteryRequired=1,rawRecords=[rec],exclusive=False)
skills=[]
def add(*a,**k):x=sk(*a,**k);skills.append(x);return x
on=add('Onslaught','맹공격 · 검사',M1,16,{'weaponDamagePct':curve(110,210,26),'offensiveColdMin':curve(3,188,26)},'Skill_AttackWeapon')
add('Open Wounds','벌어진 상처 · 검사',M1,12,{'offensiveSlowBleedingMin':curve(10,260,22),'offensiveSlowBleedingDurationMin':3},'Skill_Modifier',on['id'],'modifier')
add("Amatok's Pact",'아마톡의 계약 · 검사',M1,12,{'offensiveColdMin':curve(2,45,22),'characterDefensiveAbility':curve(10,100,22)})
add('Bloodfrenzy','피에 대한 열광 · 검사',M1,12,{'characterAttackSpeedModifier':curve(2,18,22),'offensivePierceModifier':curve(10,100,22)})
add('Bloodfangs','피의 송곳니 · 검사',M1,10,{'chanceToUse':[12,15,18,19,20,21,22,23,24,26,26,27,27,28,28,29,29,30,30,31],'weaponDamagePct':curve(65,110,20),'offensivePierceMin':curve(10,110,20)},'Skill_WeaponPool')
add('Bonechilling Cry','소름 끼치는 함성 · 검사',M1,12,{'defensivePierce':[-x for x in curve(10,40,22)],'offensiveSlowPierceResistanceDurationMin':6,'skillCooldownTime':5,'offensiveColdMin':curve(20,160,22)},'Skill_AttackRadius')
add('Untamed Rage','길들여지지 않은 분노 · 검사',M1,12,{'onLowLifeActivationChance':100,'skillActiveDuration':5,'skillCooldownTime':20,'defensiveDamageAbsorption':curve(10,35,22)})
add('Battle Surge','전투심 고취 · 검사',M1,10,{'onCritActivationChance':30,'skillCooldownTime':8,'characterLifeRegen':curve(30,150,20)})
rally=add('Rallying Cry','집결의 함성 · 검사',M1,12,{'characterOffensiveAbility':curve(30,240,22),'skillCooldownTime':12,'skillActiveDuration':60})
add('Frenzied Cry','광란의 함성 · 검사',M1,1,{'cooldownTime':-4},'Skill_Transmuter',rally['id'],'transmuter',1)
add('Impetus','충동 · 검사',M1,12,{'offensiveCritDamageModifier':curve(2,26,22)},'Skill_Modifier',rally['id'],'modifier')
add('Ranged Expertise','사격 전문가 · 검사',M2,10,{'offensivePierceMin':curve(2,35,20),'characterAttackSpeedModifier':curve(2,18,20)},'Skill_Passive')
for en,ko,cap,raw in [('Bursting Round','폭발성 탄환',10,{'weaponDamagePct':curve(90,170,20),'offensiveFireMin':curve(20,200,20)}),('Chilling Rounds','냉각성 탄환',10,{'weaponDamagePct':curve(60,110,20),'offensiveColdMin':curve(20,230,20)}),('Storm Spread','폭풍 분사',10,{'weaponDamagePct':curve(20,43,20),'offensiveLightningMin':curve(10,150,20),'projectileLaunchNumber':4})]:
 raw['chanceToUse']=[12,15,17,18,19,20,20,21,21,22,22,22,23,23,23,24,24,24,25,25];add(en,ko+' · 검사',M2,cap,raw,'Skill_WeaponPool')
add('Deadly Aim','극한의 조준 · 검사',M2,12,{'onCritActivationChance':100,'skillActiveDuration':5,'skillCooldownTime':10,'characterOffensiveAbilityModifier':10,'offensiveCritDamageModifier':20,'offensiveTotalDamageModifier':70})
renew=add('Word of Renewal','회복의 언령 · 검사',M2,12,{'characterDefensiveAbility':curve(12,170,22),'skillActiveDuration':30,'skillCooldownTime':15})
add('Vigor','활력 · 검사',M2,10,{'characterLife':curve(100,1800,20)},'Skill_Modifier',renew['id'],'modifier')
add('Steel Resolve','강철의 결의 · 검사',M2,10,{'offensiveElementalMin':curve(3,45,20),'defensiveAether':20},'Skill_Modifier',renew['id'],'modifier')
seal=add('Inquisitor Seal','인퀴지터의 표식 · 검사',M2,12,{'defensiveAbsorption':curve(50,380,22)},'Skill_BuffRadius')
add('Arcane Empowerment','마법적 강화 · 검사',M2,12,{'offensiveElementalMin':curve(2,35,22),'offensivePierceMin':curve(2,32,22),'offensiveTotalDamageModifier':curve(10,140,22)},'Skill_Modifier',seal['id'],'modifier')
pain=add('Word of Pain','고통의 언령 · 검사',M2,12,{'offensiveElementalMin':curve(10,140,22),'skillActiveDuration':8},'Skill_AttackRadius')
add('Word of Agony','고난의 언령 · 검사',M2,12,{'offensiveElementalMin':curve(3,40,22)},'Skill_Modifier',pain['id'],'modifier')
add('Death Sentence','죽음의 선고 · 검사',M2,12,{'defensivePierce':[-x for x in curve(5,40,22)],'offensiveSlowPierceResistanceDurationMin':8},'Skill_Modifier',pain['id'],'modifier')
ac=add('Aura of Conviction','단죄의 기세 · 검사',M2,12,{'offensivePierceMin':curve(5,50,22),'characterOffensiveAbility':curve(15,230,22),'offensivePierceModifier':curve(20,210,22),'defensivePhysical':8});ac['exclusive']=True
# No numeric curve above is represented as actual game data. Exact array behavior is the test target.
for i,s in enumerate(skills):s['x']=(i%4)*80;s['y']=(i//4)*90
masters=[{'id':M1,'name':'버서커 · 검사','en':'Berserker','max':50,'rankSource':'raw-arrays','stats':{'characterStrength':[i*3 for i in range(1,51)],'characterDexterity':[i*2 for i in range(1,51)],'characterIntelligence':[i for i in range(1,51)],'characterLife':[i*18 for i in range(1,51)]}}, {'id':M2,'name':'인퀴지터 · 검사','en':'Inquisitor','max':50,'rankSource':'raw-arrays','stats':{'characterStrength':[i*2 for i in range(1,51)],'characterDexterity':[i*3 for i in range(1,51)],'characterIntelligence':[i*2 for i in range(1,51)],'characterLife':[i*20 for i in range(1,51)]}}]
def con(id,en,name,n,req,bonus,stats,power=None):
 stars=[dict(index=i,dbr='test/dev/'+id+str(i),predecessors=[i-1] if i else [],position={'x':(i%3)*80+(i//3)*25,'y':(i//3)*100+(i%2)*30},bonuses=stats if i==0 else {},celestial_power=power if i==n-1 else None,weapon_requirement=None) for i in range(n)]
 return dict(id=id,en=en,name=name+' · 검사',tier=1,stars=stars,affinity_required=req,affinity_bonus=bonus,point_cost=n)
def power(en,name,raw,trigger='AttackEnemy',chance=30):return dict(dbr='test/power/'+en.replace(' ','')+'.dbr',en=en,name=name+' · 검사',level=20,rankStats=raw,rankSource='raw-arrays',rawMeta={},skill_class='Skill_AttackProjectile',proc={'trigger_key':trigger,'chance':chance},pet=None)
cons=[con('crossroads_order','Crossroads Order','갈림길 노랑',1,{}, {'order':1},{'characterLifeModifier':5}),con('crossroads_ascendant','Crossroads Ascendant','갈림길 보라',1,{}, {'ascendant':1},{'characterOffensiveAbility':18}),con('assassins_blade',"Assassin's Blade",'암살자의 칼날',5,{'order':1},{'ascendant':3,'order':2},{'offensivePierceModifier':20},power("Assassin's Mark",'암살자의 표식',{'defensivePierce':[-x for x in curve(10,36,20)],'offensiveSlowPierceResistanceDurationMin':10},'AttackEnemyCrit',100)),con('toad','Toad','두꺼비',4,{'ascendant':1},{'ascendant':2,'eldritch':3},{'characterDexterity':15}),con('ghoul','Ghoul','구울',5,{'chaos':1},{'chaos':3},{'offensiveLifeLeechMin':4},power('Ghoulish Hunger','구울의 굶주림',{'offensiveLifeLeechMin':80,'skillActiveDuration':5,'skillCooldownTime':30},'LifeMonitor',100)),con('hawk','Hawk','보라매',3,{'eldritch':1},{'eldritch':3},{'characterOffensiveAbilityModifier':3,'offensiveCritDamageModifier':5}),con('hydra','Hydra','히드라',6,{'eldritch':3,'chaos':3},{'chaos':2,'eldritch':2},{'characterOffensiveAbilityModifier':4}),con('manticore','Manticore','만티코어',6,{'eldritch':5},{'eldritch':2},{'offensivePierceMin':10},power('Acid Spray','산성 물보라',{'offensivePoisonMin':curve(30,180,20),'offensiveTotalResistanceReductionAbsoluteMin':curve(10,28,20),'offensiveTotalResistanceReductionAbsoluteDurationMin':5,'skillCooldownTime':1.5})),con('sailor',"Sailor's Guide",'뱃사람의 안내',4,{'primordial':1},{'primordial':5},{'characterRunSpeedModifier':8}),con('empty','Empty Throne','비워진 왕좌',4,{'ascendant':1},{'ascendant':5},{'defensiveStun':25}),con('tortoise','Tortoise','거북이',5,{'order':1},{'order':2,'primordial':3},{'characterLife':100},power('Turtle Shell','거북이 껍질',{'defensiveAbsorption':curve(600,6100,20),'skillCooldownTime':25,'skillActiveDuration':5},'LifeMonitor',100)),con('watcher','Solemn Watcher','장엄한 감시자',5,{'primordial':10},{'primordial':3,'order':2},{'characterDefensiveAbilityModifier':5}),con('azrakaa','Azrakaa, the Eternal Sands','영원불변의 모래, 아즈라카',6,{'ascendant':12,'order':6,'primordial':8},{},{'offensivePierceModifier':100},power('Shifting Sands','드나드는 모래',{'offensivePierceMin':curve(30,260,20),'skillCooldownTime':1.5,'weaponDamagePct':30}))]
# Test-only data deliberately exercises self-sustaining affinity checks; it is not the official graph.
# A real crossroad is required only for initial path, this fixture preserves that UI distinction.
base['automation']={'schema':'grim-automation/v3','meta':{'skillCount':len(skills),'masteryCount':len(masters),'devotionCount':len(cons),'diagnostics':[]},'skills':skills,'masteries':masters,'devotions':cons,'sets':[],'grantedSkills':{},'itemGrantLevels':{},'pets':{},'player':{'record':'test/player','raw':{'characterStrength':50,'characterDexterity':50,'characterIntelligence':50,'characterOffensiveAbility':50,'characterDefensiveAbility':50,'characterLife':50},'formulas':{}}}
for item in base['items']:
 item['name']+=' · 검사';item['set']='';item['boosts']=[];item['modifiers']=[];item['grantedSkill']=''
 if item['part']=='item' and item['type']=='ranged1h':
  item['boosts']=[{'kind':'mastery','target':M2,'level':1,'name':'인퀴지터','en':'Inquisitor'}]
  item['requirements']={'level':1,'physique':0,'cunning':0,'spirit':0}
  item['conversions']=[{'from':'Elemental','to':'Pierce','percent':50}]
  item['aps']=1.8
# Add test all-skill relic, armor, and ring with skill modification to exercise updates.
def item(id,name,slot,raw,boosts=[],mods=[],set=''):
 return dict(id=id,name=name+' · 검사',en=name,part='item',domain='relic' if slot=='relic' else 'gear',slots=[slot],type=slot,rarity='Legendary',level=100,requirements={'level':1},aps=0,applies=[],raw=[{'stat':k,'source':'self','min':v,'max':v,'low':v,'high':v} for k,v in raw.items()],boosts=boosts,modifiers=mods,conversions=[],set=set,grantedSkill='',description='합성 테스트용')
base['items'] += [item('test/relic','평온','relic',{'augmentAllLevel':1}),item('test/head','풀려버린 운명의 시선','head',{'augmentAllLevel':1,'defensiveProtection':1600},mods=[{'skill':on['id'],'stat':'weaponDamagePct','value':10}]),item('test/neck','실바리아의 뿌리','amulet',{'characterLife':400},boosts=[{'kind':'mastery','target':M1,'level':1}])]
base['meta']['count']=len(base['items'])
(ROOT/'tests/auto-catalog-fixture.json').write_text(json.dumps(base,ensure_ascii=False),encoding='utf-8')
print(len(skills),'synthetic skill records,',len(cons),'synthetic constellations,',len(base['items']),'test items')
