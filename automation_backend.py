"""Exact-rank metadata for the v3 build compiler.

Only numeric arrays or literal values from the public raw DBR deposit are used.
The three-point summary table is deliberately NOT interpolated. Missing game
metadata stays missing and is diagnosed by the client. No eval / game binaries.
"""
from __future__ import annotations
from collections import defaultdict
import json, math, re
from pathlib import Path

LINKS = ('buffSkillName','petSkillName')
STAT_PREFIX = ('character','offensive','defensive','retaliation','skill','projectile','spawn','pet','conversion','weapon','chance','onHit','onCrit','attack','duration','cooldown','target','num','damage','life','mana','augment','racial','strength','dexterity','intelligence')
META_KEYS = {'Class','templateName','skillDisplayName','skillBaseDescription','buffSkillName','petSkillName','spawnObjects','modSpawnObjects','skillTier','skillMasteryLevel','skillDependency','skillDependencies','skillDependancy','skillDependancies','exclusiveSkill','isExclusive','skillExclusive','skillExclusiveGroup','skillRequirement','skillUsesWeapon','skillWeaponType','dualWieldOnly','requiresDualWield','sword','axe','mace','scepter','dagger','ranged1h','ranged2h','shield','sword2h','axe2h','mace2h','offhand','unarmed','Sword','Axe','Mace','Scepter','Dagger','Ranged1h','Ranged2h','Shield','Sword2h','Axe2h','Mace2h','Offhand','Unarmed','twoHandedOnly'}


def parsed(value):
    if isinstance(value,(int,float)):
        return value if math.isfinite(value) else None
    if value is None:return None
    text=str(value).strip()
    if not text:return None
    parts=text.split(';')
    try:
        nums=[float(x) for x in parts]
        if all(math.isfinite(x) for x in nums):return nums if len(parts)>1 else nums[0]
    except ValueError: pass
    return text


def fact_index(rows):
    out=defaultdict(dict)
    # Preserve last-wins semantics for repeated keys in DBR file order.
    for r in sorted(rows,key=lambda x:(x['record'],x.get('idx',0))):
        val=parsed(r.get('value',r.get('value_num')))
        if val is not None:out[r['record']][r['key']]=val
    return dict(out)


def chain(record, facts, limit=12):
    seen=set();queue=[record];result=[]
    while queue and len(result)<limit:
        rec=queue.pop(0)
        if rec in seen:continue
        seen.add(rec);d=facts.get(rec)
        if not d:continue
        result.append((rec,d))
        for k in LINKS:
            v=d.get(k)
            if isinstance(v,str) and v.endswith('.dbr'):queue.append(v)
    return result


def trim(d):
    return {k:v for k,v in d.items() if (k in META_KEYS or k.startswith(STAT_PREFIX)) and
            (isinstance(v,str) or isinstance(v,list) and any(v) or isinstance(v,(int,float)) and v!=0)}


def skill_definition(row,facts,names):
    rec=row['record'];hops=chain(rec,facts)
    # Derived effect_record is a useful fallback, but not a substitute for chains.
    effect=row.get('effect_record')
    if effect and effect not in [r for r,_ in hops] and effect in facts:hops.append((effect,facts[effect]))
    merged={}
    for _,d in hops:
        for k,v in trim(d).items():
            # A trailing zero-filled template must not erase a real earlier value.
            if v!=0 and v!=[]:merged[k]=v
    root=facts.get(rec,{})
    numeric={k:v for k,v in merged.items() if isinstance(v,(int,float,list))}
    metadata={k:v for k,v in merged.items() if isinstance(v,str)}
    tag=row.get('name_tag') or merged.get('skillDisplayName')
    desc=merged.get('skillBaseDescription','')
    maxrank=int(row.get('max_level') or root.get('skillMaxLevel') or 1)
    ultimate=int(row.get('ultimate_level') or root.get('skillUltimateLevel') or maxrank)
    return {'id':rec,'mastery':row.get('mastery_record',''),'group':row.get('group_record') or rec,
        'kind':row.get('node_kind','base'),'name':names.get('ko',{}).get(tag) or names.get('en',{}).get(tag) or str(tag or rec.split('/')[-1]),
        'en':names.get('en',{}).get(tag) or str(tag or ''),'description':names.get('ko',{}).get(desc) or names.get('en',{}).get(desc) or '',
        'max':maxrank,'ultimate':ultimate,'class':root.get('Class',merged.get('Class','')),
        'effectClass':hops[-1][1].get('Class','') if hops else '',
        'x':row.get('ui_x'),'y':row.get('ui_y'),'stats':numeric,'meta':metadata,
        'masteryRequired':root.get('skillMasteryLevel') or None,
        'layers':[{'record':r,'class':d.get('Class',''),'stats':trim(d)} for r,d in hops], 'rawRecords':[r for r,_ in hops],'rankSource':'raw-arrays' if hops else 'missing',
        'exclusive':bool(root.get('skillExclusiveGroup') or root.get('exclusiveSkill') or root.get('isExclusive') or root.get('skillExclusive') or
                         'exclusive' in str(root.get('Class','')).lower())}


def build_automation(tables,devotions):
    facts=fact_index(tables['facts']);names=defaultdict(dict)
    for r in tables['labels']:
        loc=str(r.get('locale','')).lower().replace('_','-')
        if loc in ('en','english','text-en') or loc.startswith('en-'): loc='en'
        elif loc in ('ko','korean','text-ko') or loc.startswith('ko-'):loc='ko'
        else:continue
        names[loc][r['tag']]=str(r.get('text',''))
    def label(tag):return names['ko'].get(tag) or names['en'].get(tag) or str(tag or '')
    roster=tables.get('skills',[])
    skills=[skill_definition(row,facts,names) for row in roster]
    byid={x['id']:x for x in skills}
    diagnostics=[]
    masters=[]
    for rec in sorted({r['mastery_record'] for r in roster if r.get('mastery_record')}):
        d=facts.get(rec,{})
        # Mastery nodes are scalar or complete per-rank arrays, not skill-summary rows.
        tag=d.get('skillDisplayName')
        if not tag:
            hit=re.search(r'playerclass(\d+)',rec);num=int(hit[1]) if hit else 0
            tag=('tagGDX'+str({7:1,8:1,9:2,10:3}.get(num,3))+f'Class{num:02}SkillName00A' if num>=7 else f'tagClass{num:02}SkillName00A')
        masters.append({'id':rec,'name':label(tag),'en':names['en'].get(tag,str(tag)),
                        'max':int(d.get('skillMaxLevel') or 50),'stats':trim(d),'rankSource':'raw-arrays' if d else 'missing'})
    # Button records can carry tier dependencies unavailable on the skill shell.
    for rec,d in facts.items():
        if not rec.startswith('records/ui/skills/class'):continue
        target=d.get('skillName')
        if target in byid:
            skill=byid[target]
            tier=d.get('skillTier') or d.get('skillMasteryLevel')
            if isinstance(tier,(int,float)) and 0<tier<=50:skill['uiTier']=tier
            dep=[v for k,v in d.items() if 'depend' in k.lower() and isinstance(v,str) and v in byid]
            if dep:skill['prerequisites']=dep
    for s in skills:
        if s['rankSource']=='missing':diagnostics.append('Missing raw skill record: '+s['id'])
    # Generic engine expressions and base player record are retained, never executed as code.
    player_candidates=[(r,d) for r,d in facts.items() if r.startswith('records/creatures/pc/') and re.search(r'(male|female)pc',r,re.I)]
    base=next(((r,d) for r,d in player_candidates if 'female' not in r.lower()),player_candidates[0] if player_candidates else ('',{}))
    formulas={r:d for r,d in facts.items() if r.startswith('records/game/') and any('equation' in k.lower() or 'formula' in k.lower() for k in d)}
    if not base[0]:diagnostics.append('Base player record unavailable; base growth uses labelled reference profile')
    # Sets: ordinary set stats are cumulative arrays indexed by number of distinct members.
    boosts=defaultdict(list);modifiers=defaultdict(list)
    for r in tables.get('set_boosts',[]):boosts[r['set_record']].append(r)
    for r in tables.get('set_modifiers',[]):modifiers[r['set_record']].append(r)
    sets=[]
    for r in tables.get('sets',[]):
        rec=r['set_record'];sets.append({'id':rec,'name':label(r.get('name_tag')),'members':r.get('members'),
            'stats':trim(facts.get(rec,{})),'boosts':boosts[rec],'modifiers':modifiers[rec]})
    # All item-granted skills, including nested buff/pet wrappers.
    granted={}
    levels=defaultdict(set)
    for e in tables.get('entities',[]):
        if e.get('granted_skill'):
            d=facts.get(e['record'],{});levels[e['granted_skill']].add(int(d.get('itemSkillLevel') or 1))
    for rec,lvls in levels.items():
        if rec in byid:definition=dict(byid[rec])
        else:definition=skill_definition({'record':rec},facts,names)
        definition['grantLevels']=sorted(lvls);granted[rec]=definition
    # Retain pet records + their skill graphs for inspectable out-of-scope diagnostics.
    pets={}
    wanted=set()
    for s in list(skills)+list(granted.values()):
        for r in s['rawRecords']:
            d=facts.get(r,{})
            for k in ('spawnObjects','modSpawnObjects'):
                if isinstance(d.get(k),str):wanted.update(d[k].split(';'))
    for c in devotions.get('constellations',[]):
        c['name']=label(c.get('name_tag'));c['en']=names['en'].get(c.get('name_tag'),'')
        for star in c.get('stars',[]):
            p=star.get('celestial_power')
            if p:
                p['name']=label(p.get('name_tag'));p['en']=names['en'].get(p.get('name_tag'),'')
                raw=skill_definition({'record':p['dbr'],'max_level':p.get('level',1),'ultimate_level':p.get('level',1)},facts,names)
                p['rankStats']=raw['stats'];p['rawMeta']=raw['meta'];p['rankSource']=raw['rankSource']
                if p.get('pet') and isinstance(p['pet'],dict):wanted.update([v for k,v in p['pet'].items() if k in ('dbr','record') and isinstance(v,str)])
    for rec in wanted:
        if rec not in facts:continue
        d=facts[rec];pet_skills=[]
        for k,v in d.items():
            if isinstance(v,str) and v.startswith('records/skills/'):
                definition=skill_definition({'record':v},facts,names)
                number=re.search(r'(\d+)$',k)
                definition['levelRule']=d.get('skillLevel'+number[1],1) if number else 1
                pet_skills.append(definition)
        pets[rec]={'id':rec,'stats':trim(d),'skills':pet_skills}
    return {'schema':'grim-automation/v3','meta':{'skillCount':len(skills),'masteryCount':len(masters),'devotionCount':len(devotions.get('constellations',[])),
            'rankMethod':'Exact raw DBR arrays; no three-breakpoint interpolation','diagnostics':diagnostics},
        'masteries':masters,'skills':skills,'devotions':devotions.get('constellations',[]),'sets':sets,
        'grantedSkills':granted,'itemGrantLevels':{e['record']:int(facts.get(e['record'],{}).get('itemSkillLevel') or 1) for e in tables.get('entities',[]) if e.get('granted_skill')},'pets':pets,'player':{'record':base[0],'raw':trim(base[1]),'formulas':formulas,'formulaBindings':{kind:{'record':'records/game/combatformulas.dbr','key':key,'scope':'final'} for kind,key in [('oa','offensiveAbilityEquation'),('da','defensiveAbilityEquation')] if isinstance(formulas.get('records/game/combatformulas.dbr',{}).get(key),str)}}}


def load_filtered_facts(path):
    import duckdb
    # Do not materialize 24 million template-zero rows into Python.
    with duckdb.connect() as con:
        cur=con.execute("""WITH selected AS (SELECT record,idx,key,value,value_num FROM read_parquet(?)
          WHERE (record LIKE 'records/skills/%' OR record LIKE 'records/game/%'
            OR record LIKE 'records/creatures/pc/%' OR record LIKE 'records/creatures/pets/%'
            OR record LIKE 'records/ui/skills/class%' OR record LIKE 'records/items/lootsets/%'
            OR key IN ('itemSkillLevel'))), latest AS (
          SELECT * FROM selected QUALIFY row_number() OVER(PARTITION BY record,key ORDER BY idx DESC)=1)
          SELECT * FROM latest WHERE value IS NOT NULL AND value NOT IN ('','0','0.000000')
          ORDER BY record,idx""",[str(path)])
        cols=[x[0] for x in cur.description]
        return [dict(zip(cols,row)) for row in cur.fetchall()]
