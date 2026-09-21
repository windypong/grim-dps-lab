"""Fetch the public game-data deposit and normalize it for the local item picker.
No GrimTools scraping, arbitrary URL proxy, executable evaluation, or game-file access.
"""
from __future__ import annotations
import hashlib, json, math, re, urllib.request, urllib.parse
from collections import Counter, defaultdict
from pathlib import Path

REPO = 'https://raw.githubusercontent.com/tednaleid/grimdawn-devotions/main/'
RELEASE = 'https://github.com/tednaleid/grimdawn-devotions/releases/download/'
REQUIRED = ['labels.parquet','entities.parquet','stats.parquet','relations.parquet','boosts.parquet','conversions.parquet','skills.parquet','skill_modifiers.parquet','facts.parquet','sets.parquet','set_boosts.parquet','set_modifiers.parquet']
UA='GrimDPSLab/3.0 (public dataset downloader; no GrimTools requests)'

def fetch(url: str, limit: int=40_000_000) -> bytes:
    p=urllib.parse.urlsplit(url)
    if p.scheme!='https' or p.hostname not in {'raw.githubusercontent.com','github.com'}:
        raise ValueError('Unsupported data-source URL')
    request=urllib.request.Request(url,headers={'User-Agent':UA})
    with urllib.request.urlopen(request,timeout=90) as r:
        data=r.read(limit+1)
    if len(data)>limit: raise ValueError('Data file exceeds size limit')
    return data

def clean(s):
    s=re.sub(r'\{(?:\^|%)[^}]*\}', '', str(s or ''))
    s=re.sub(r'\[/?(?:b|i|color)[^\]]*\]', '', s)
    return s.replace('\n',' ').strip()

def num(x,default=0):
    try:
        v=float(x)
        return v if math.isfinite(v) else default
    except (ValueError,TypeError): return default

def arr(x):
    if isinstance(x,(tuple,list)): return list(x)
    if not x: return []
    if isinstance(x,str):
        try:
            v=json.loads(x)
            if isinstance(v,list): return v
        except ValueError: pass
        return [a.strip() for a in x.split(';') if a.strip()]
    return []

def read_parquet(path: Path):
    try: import duckdb
    except ImportError as e:
        raise RuntimeError('DuckDB not installed. Start with START_WINDOWS.cmd or run: python -m pip install -r requirements.txt') from e
    with duckdb.connect() as con:
        con.execute("SET enable_external_access=true")
        cur=con.execute('SELECT * FROM read_parquet(?)',[str(path)])
        cols=[d[0] for d in cur.description]
        return [dict(zip(cols,row)) for row in cur.fetchall()]

SLOTS={'main_hand':'main','off_hand':'off','head':'head','chest':'chest','shoulders':'shoulders','hands':'gloves','gloves':'gloves','legs':'pants','pants':'pants','feet':'boots','boots':'boots','waist':'belt','belt':'belt','neck':'amulet','amulet':'amulet','ring':'ring1','medal':'medal','relic':'relic'}

def normalize(tables: dict, meta: dict) -> dict:
    labels=defaultdict(dict)
    for r in tables['labels']:
        loc=str(r.get('locale','')).lower().replace('_','-')
        if loc.startswith('ko') or loc in ('korean','text-ko'): loc='ko'
        elif loc.startswith('en') or loc in ('english','text-en'): loc='en'
        else: continue
        labels[loc][r['tag']]=clean(r.get('text'))
    def label(tag,lang): return labels[lang].get(tag) or labels['en'].get(tag) or str(tag or '')
    skill_names={r['record']:{'en':label(r.get('name_tag'),'en'),'ko':label(r.get('name_tag'),'ko')} for r in tables.get('skills',[])}
    bystat=defaultdict(list); byboost=defaultdict(list); byconv=defaultdict(list); bymod=defaultdict(list); applies=defaultdict(list)
    for r in tables['stats']:
        lo=num(r.get('value_min')); hi=num(r.get('value_max'),lo)
        bystat[r['record']].append({'stat':r['stat_id'],'source':r.get('source','self'),'min':lo,'max':hi,
             'low':num(r['display_low']) if r.get('display_low') is not None else None,
             'high':num(r['display_high']) if r.get('display_high') is not None else None})
    for r in tables.get('relations',[]):
        if r['kind']=='applies_to': applies[r['src']].append(r['dst'])
    for r in tables.get('boosts',[]):
        target=r['target']; sn=skill_names.get(target,{})
        byboost[r['record']].append({'kind':r['kind'],'target':target,'name':sn.get('ko') or target.split('/')[-1],
                                     'en':sn.get('en',''),'level':num(r['level'])})
    for r in tables.get('conversions',[]):
        byconv[r['record']].append({'from':r['from_type'],'to':r['to_type'],'percent':num(r['percent'])})
    for r in tables.get('skill_modifiers',[]):
        sn=skill_names.get(r['modified_skill'],{})
        bymod[r['item_record']].append({'skill':r['modified_skill'],'name':sn.get('ko',''),'en':sn.get('en',''),
            'stat':r['stat_id'],'value':num(r['value']),'from':r.get('from_type'),'to':r.get('to_type'),
            'carrier':r.get('modifier_record'),'refreshSkill':r.get('refresh_skill'),'refreshTrigger':r.get('refresh_trigger')})
    items=[]
    for r in tables['entities']:
        domain=r['domain']; rec=r['record']; tag=r.get('name_tag')
        if domain not in {'gear','component','augment','relic','affix'} or not tag: continue
        ko=label(tag,'ko'); en=label(tag,'en')
        if ko==tag and en==tag: continue  # Unnamed internal templates are not searchable items.
        slots=[]
        for x in arr(r.get('slots')):
            y=SLOTS.get(x,x)
            slots.extend(['ring1','ring2'] if y=='ring1' else [y])
        part={'gear':'item','relic':'item','component':'component','augment':'augment'}.get(domain)
        if domain=='relic': slots=['relic']
        if domain=='affix':
            text=(rec+' '+str(r.get('gear_type',''))).lower()
            part='prefix' if 'prefix' in text else 'suffix' if 'suffix' in text else 'affix'
        # Keep original names plus tier, never infer a mythical prefix solely from level.
        empowered=bool(r.get('is_empowered'))
        if empowered:
            if not re.search(r'^(mythical|empowered) ',en,re.I):
                pre=labels['en'].get('tagItemNamePrefixMythical' if num(r.get('item_level'))>=84 else 'tagItemNamePrefixEmpowered')
                if pre: en=clean(pre)+' '+en
            # Korean can still be searched by the original tag translation; tier stays explicit.
        items.append({'id':rec,'name':ko,'en':en,'part':part,'domain':domain,'slots':slots,'type':r.get('gear_type') or '',
            'rarity':r.get('rarity') or '', 'level':num(r.get('item_level')),'empowered':empowered,
            'requirements':{'level':num(r.get('req_level')),'physique':num(r.get('req_physique')),'cunning':num(r.get('req_cunning')),'spirit':num(r.get('req_spirit'))},
            'aps':num(r.get('attacks_per_sec')),'applies':applies[rec],
            'raw':bystat[rec],'boosts':byboost[rec],'conversions':byconv[rec],'modifiers':bymod[rec],
            'set':r.get('set_record') or '', 'grantedSkill':r.get('granted_skill') or '',
            'description':label(r.get('text_tag'),'ko') if r.get('text_tag') else ''})
    items.sort(key=lambda x:(x['part'] or '',x['name'],-x['level'],x['id']))
    return {'schema':'grim-catalog/v2','meta':{**meta,'count':len(items),'counts':dict(Counter(x['part'] for x in items)),
        'source':REPO,'scope':'공개 게임 추출 DB · 숫자와 번역만 사용 · 그림툴 공식 API 아님'},'items':items}

def build_catalog(cache: Path, progress=lambda **kw:None) -> dict:
    cache.mkdir(parents=True,exist_ok=True)
    lockpath=cache/'deposit.lock'
    if lockpath.exists(): lock=json.loads(lockpath.read_text('utf-8'))
    else:
        progress(message='공개 데이터 배포 목록 확인 중',progress=1)
        lock=json.loads(fetch(REPO+'deposit.lock',200_000))
        if not str(lock.get('download_base','')).startswith(RELEASE): raise ValueError('Unexpected release host')
        lockpath.write_text(json.dumps(lock),encoding='utf-8')
    if str(lock.get('schema_version'))!='2': raise ValueError('지원하지 않는 데이터 스키마입니다. 앱 업데이트가 필요합니다.')
    assets={a['name']:a for a in lock['assets']}
    tables={}
    for index,name in enumerate(REQUIRED):
        a=assets.get(name)
        if not a or not re.fullmatch('[a-f0-9]{64}',a['sha256']): raise ValueError('Release manifest incomplete: '+name)
        p=cache/name
        if not p.exists() or hashlib.sha256(p.read_bytes()).hexdigest()!=a['sha256']:
            progress(message=f'{name} 내려받는 중 ({index+1}/{len(REQUIRED)})',progress=3+int(index*70/len(REQUIRED)))
            data=fetch(lock['download_base']+'/'+name)
            if hashlib.sha256(data).hexdigest()!=a['sha256']: raise ValueError('Checksum mismatch: '+name)
            tmp=p.with_suffix('.part'); tmp.write_bytes(data);tmp.replace(p)
        progress(message=f'{name} 읽는 중',progress=5+int(index*70/len(REQUIRED)))
        
        if name=='facts.parquet':
            from automation_backend import load_filtered_facts
            tables['facts']=load_filtered_facts(p)
        else: tables[name[:-8]]=read_parquet(p)
    progress(message='한국어 이름과 장비 옵션 연결 중',progress=85)
    result=normalize(tables,{'gameVersion':lock['game_version'],'release':lock['tag'],'published':lock['published_utc'],
                             'downloadedAt':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()})
    from automation_backend import build_automation
    progress(message='별자리 그래프와 정확한 레벨 배열 연결 중',progress=88)
    dp=cache/'devotions.json'
    if dp.exists(): dev=json.loads(dp.read_text('utf-8'))
    else:
        raw=fetch(REPO+'data/devotions.json',5_000_000)
        dev=json.loads(raw)
        game=dev.get('meta',{}).get('game_version') or dev.get('meta',{}).get('gameVersion')
        if game!=lock['game_version']:
            raise ValueError('아이템/별자리 버전 불일치: '+str(lock['game_version'])+' / '+str(game)+'. 다른 버전을 섞어 계산하지 않습니다.')
        dp.write_bytes(raw)
    game=dev.get('meta',{}).get('game_version') or dev.get('meta',{}).get('gameVersion')
    if game!=lock['game_version']: raise ValueError('캐시의 별자리 데이터 버전이 아이템과 다릅니다. 캐시를 갱신하세요.')
    result['automation']=build_automation(tables,dev)
    result['meta']['automationVersion']=3
    result['meta']['devotionSha256']=hashlib.sha256(dp.read_bytes()).hexdigest()
    result['meta']['rankSource']='raw DBR arrays from checksum-verified facts.parquet'
    result['meta']['devotionProvenance']='Public repository main JSON, version checked; local SHA recorded, not authenticated by deposit.lock'
    auto=result['automation']
    if not auto['skills'] or not auto['devotions']: raise ValueError('스킬/별자리 DB가 비어 있습니다.')
    if any(x['rankSource']=='missing' for x in auto['masteries']): raise ValueError('숙련도 원시 데이터 누락. 가정값으로 숙련도 능력치를 만들지 않습니다.')
    progress(message='전체 자동 계산 데이터 검증·저장 중',progress=96)
    if not result['items']: raise ValueError('아이템 데이터가 비어 있습니다. 가짜 데이터로 대체하지 않습니다.')
    temp=cache/'catalog.tmp'; temp.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    temp.replace(cache/'catalog.json')
    return result
