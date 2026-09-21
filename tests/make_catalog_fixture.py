"""Protocol test fixture, not an authoritative item database or measured build."""
import json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from catalog_backend import normalize
T={k:[] for k in ['labels','entities','stats','relations','boosts','conversions','skills','skill_modifiers']}
def item(rec,name,en,domain,slots,typ,rarity='Legendary',level=94,stats=None):
 tag='test_'+str(len(T['entities']))
 T['labels'] += [{'locale':'ko','tag':tag,'text':name},{'locale':'en','tag':tag,'text':en}]
 T['entities'].append({'record':rec,'name_tag':tag,'domain':domain,'slots':slots,'gear_type':typ,'rarity':rarity,'item_level':level,'req_level':level,'req_cunning':400 if typ=='ranged1h' else 0,'is_empowered':False})
 for stat,value in (stats or {}).items():
  lo,hi=(value if isinstance(value,list) else (value,value))
  T['stats'].append({'record':rec,'source':'self','stat_id':stat,'value_min':lo,'value_max':hi,'display_low':lo*.8 if lo==hi else None,'display_high':hi*1.2 if lo==hi else None})
 return rec
r=item('records/items/gearweapons/guns1h/d205_gun1h.dbr','서약운반자','Oathbearer','gear',['main_hand','off_hand'],'ranged1h',stats={'offensivePhysical':[60,77],'offensivePierce':[15,21],'offensivePierceRatio':100,'offensivePierceModifier':86,'characterOffensiveAbility':78,'offensiveCritDamageModifier':6,'characterAttackSpeedModifier':10})
T['conversions'].append({'record':r,'from_type':'Elemental','to_type':'Pierce','percent':45})
T['skills'].append({'record':'records/skills/playerclass10/bloodborne1.dbr','name_tag':'bloodborne'})
T['labels'] += [{'locale':'ko','tag':'bloodborne','text':'혈통의 힘'},{'locale':'en','tag':'bloodborne','text':'Bloodborne'}]
T['boosts'].append({'record':r,'kind':'skill','target':'records/skills/playerclass10/bloodborne1.dbr','level':2})
item('records/items/gearweapons/guns1h/old.dbr','서약운반자','Oathbearer','gear',['main_hand','off_hand'],'ranged1h',level=65,stats={'offensivePhysical':50,'offensivePierceModifier':60})
item('records/items/gearhands/plagueguard.dbr','역병보호 장갑','Plagueguard Grips','gear',['hands'],'hands','Rare',94,{'characterAttackSpeedModifier':5})
item('records/items/gearaccessories/ring.dbr','검사용 반지','Test Ring','gear',['ring'],'ring',stats={'characterOffensiveAbility':40})
c=item('records/items/materia/blades.dbr','칼날의 문장','Seal of Blades','component',[],'component','Rare',75,{'offensivePierce':10})
T['relations'].append({'src':c,'kind':'applies_to','dst':'ranged1h'})
a=item('records/items/enchants/powder.dbr','제련 부산물 가루','Steelbloom Powder','augment',[],'augment','Rare',70,{'offensivePierce':10,'offensivePierceModifier':50,'characterDefensiveAbility':70})
T['relations'] += [{'src':a,'kind':'applies_to','dst':x} for x in ['ring','amulet']]
item('records/items/lootaffixes/prefix/ruthless_armor.dbr','무자비한','Ruthless','affix',[],'affix','Rare',90,{'offensivePierceModifier':70,'characterOffensiveAbility':30})
item('records/items/lootaffixes/suffix/alacrity.dbr','아마라스타의 날렵함의',"of Amarasta's Flurry",'affix',[],'affix','Rare',90,{'characterAttackSpeedModifier':12})
item('records/items/gearrelic/serenity.dbr','평온','Serenity','relic',['relic'],'relic',stats={'characterLife':300})
# A known-looking modifier name for engine scope testing, with explicit fixture values.
T['skills'].append({'record':'records/skills/playerclass10/onslaught1.dbr','name_tag':'onslaught'})
T['labels'] += [{'locale':'ko','tag':'onslaught','text':'맹공격'},{'locale':'en','tag':'onslaught','text':'Onslaught'}]
m=item('records/items/gearaccessories/medal_test.dbr','검사용 맹공격 메달','Test Onslaught Medal','gear',['medal'],'medal',stats={})
T['skill_modifiers'] += [{'item_record':m,'modified_skill':'records/skills/playerclass10/onslaught1.dbr','stat_id':'weaponDamagePct','value':10}, {'item_record':m,'modified_skill':'records/skills/playerclass10/onslaught1.dbr','stat_id':'conversionPercentage','value':100,'from_type':'Cold','to_type':'Pierce'}]
meta={'gameVersion':'1.3.0.7 · UI 검사 표본','release':'TEST-FIXTURE','published':'2026-09-20','testOnly':True}
result=normalize(T,meta)
p=Path(__file__).with_name('catalog-fixture.json');p.write_text(json.dumps(result,ensure_ascii=False),encoding='utf-8')
Path(__file__).with_name('catalog-tables-fixture.json').write_text(json.dumps(T,ensure_ascii=False),encoding='utf-8')
print(len(result['items']),'test-only fixture records')
