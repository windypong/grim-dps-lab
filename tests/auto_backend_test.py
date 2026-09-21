"""Offline unit/integration tests. Synthetic fixtures; no claim of live DB validation."""
import copy,json,sys,tempfile,hashlib,unittest,threading,urllib.request,urllib.error
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import automation_backend as a, catalog_backend as c, server
ROOT=Path(__file__).resolve().parents[1]
BASE=json.loads((ROOT/'tests/catalog-tables-fixture.json').read_text('utf8'))

def data():
 t=copy.deepcopy(BASE);m='records/skills/playerclass01/_classtraining_class01.dbr';sk='records/skills/playerclass01/test.dbr';effect='records/skills/testbuff.dbr';rows=[]
 def add(r,k,v):rows.append({'record':r,'idx':len(rows),'key':k,'value':v,'value_num':None})
 add(m,'skillMaxLevel','50');add(m,'characterStrength','3;6;9;12');add(m,'skillDisplayName','master')
 add(sk,'Class','Skill_BuffSelf');add(sk,'buffSkillName',effect);add(sk,'cooldownTime','3;4;6')
 add(effect,'Class','Skill_BuffRadius');add(effect,'characterOffensiveAbility','11;17;23;40');add(effect,'skillDisplayName','skill')
 add('records/creatures/pc/malepc01.dbr','characterStrength','50');add('records/creatures/pc/malepc01.dbr','characterLife','200')
 add('records/game/combatformulas.dbr','offensiveAbilityEquation','(offensiveAbilityDV + characterLevelDV * 10 + dexterityDV * 0.5) * (1 + offensiveAbilityModifierDV/100)')
 t['facts']=rows;t['skills']=[{'record':sk,'mastery_record':m,'group_record':sk,'node_kind':'base','name_tag':'skill','effect_record':effect,'max_level':2,'ultimate_level':4}]
 t['labels'] += [{'locale':'en','tag':'master','text':'Soldier'},{'locale':'ko','tag':'master','text':'군인 검사'},{'locale':'en','tag':'skill','text':'Test Skill'},{'locale':'ko','tag':'skill','text':'검사 스킬'}]
 t['sets']=[];t['set_boosts']=[];t['set_modifiers']=[]
 dev={'meta':{'game_version':'TEST'},'constellations':[{'id':'c','name_tag':'master','stars':[{'index':0,'bonuses':{'characterLife':1}}],'affinity_required':{},'affinity_bonus':{}}]}
 return t,dev

class RawTests(unittest.TestCase):
 def test_non_linear_rank_arrays_not_interpolated(self):self.assertEqual(a.parsed('1;3;8;22'),[1,3,8,22])
 def test_numeric_scalars_not_forced_to_arrays(self):self.assertEqual(a.parsed('8'),8)
 def test_string_equations_preserved_not_evaluated(self):self.assertEqual(a.parsed('x*3+1'),'x*3+1')
 def test_bad_numeric_values_not_treated_as_finite(self):self.assertIsNone(a.parsed(float('inf')))
 def test_last_duplicate_key_wins(self):self.assertEqual(a.fact_index([{'record':'r','idx':2,'key':'k','value':'7'},{'record':'r','idx':1,'key':'k','value':'2'}])['r']['k'],7)
 def test_chain_cycle_stops(self):self.assertEqual(len(a.chain('a',{'a':{'buffSkillName':'b.dbr'},'b.dbr':{'buffSkillName':'a'}})),2)
 def test_raw_root_and_buff_arrays_both_retained(self):
  t,d=data();x=a.build_automation(t,d)['skills'][0];self.assertEqual(x['stats']['cooldownTime'],[3,4,6]);self.assertEqual(x['stats']['characterOffensiveAbility'],[11,17,23,40])
 def test_effect_key_wins_without_erasing_other_root(self):
  t,d=data();t['facts'].append({'record':'records/skills/testbuff.dbr','idx':99,'key':'cooldownTime','value':'9;8'});x=a.build_automation(t,d)['skills'][0];self.assertEqual(x['stats']['cooldownTime'],[9,8])
 def test_korean_skill_and_mastery_names(self):
  t,d=data();x=a.build_automation(t,d);self.assertEqual(x['skills'][0]['name'],'검사 스킬');self.assertEqual(x['masteries'][0]['name'],'군인 검사')
 def test_exact_mastery_arrays(self):
  t,d=data();self.assertEqual(a.build_automation(t,d)['masteries'][0]['stats']['characterStrength'],[3,6,9,12])
 def test_missing_raw_rank_diagnosed_not_filled(self):
  t,d=data();t['facts']=[];x=a.build_automation(t,d);self.assertEqual(x['skills'][0]['rankSource'],'missing');self.assertTrue(x['meta']['diagnostics'])
 def test_formula_binding_only_known_canonical_key(self):
  t,d=data();x=a.build_automation(t,d);self.assertEqual(x['player']['formulaBindings']['oa']['key'],'offensiveAbilityEquation');self.assertNotIn('hp',x['player']['formulaBindings'])
 def test_set_arrays_and_piece_thresholds(self):
  t,d=data();t['sets']=[{'set_record':'records/items/lootsets/test.dbr','name_tag':'master','members':3}];t['set_boosts']=[{'set_record':'records/items/lootsets/test.dbr','pieces':2,'target':'s','level':1}];t['facts'].append({'record':'records/items/lootsets/test.dbr','idx':100,'key':'characterLife','value':'0;200;200'});x=a.build_automation(t,d)['sets'][0];self.assertEqual(x['stats']['characterLife'],[0,200,200]);self.assertEqual(x['boosts'][0]['pieces'],2)
 def test_devotion_exact_power_arrays(self):
  t,d=data();d['constellations'][0]['stars'][0]['celestial_power']={'dbr':t['skills'][0]['record'],'level':4,'name_tag':'skill'};x=a.build_automation(t,d)['devotions'][0]['stars'][0]['celestial_power'];self.assertEqual(x['rankStats']['characterOffensiveAbility'],[11,17,23,40]);self.assertEqual(x['rankSource'],'raw-arrays')
 def test_numeric_weapon_requirement_retained(self):self.assertEqual(a.trim({'Ranged1h':1})['Ranged1h'],1)

class DownloadTests(unittest.TestCase):
 def setup_fake(self,folder,wrong_version=False):
  t,d=data();d['meta']['game_version']='OTHER' if wrong_version else 'TEST';payload={n:('TEST ONLY '+n).encode() for n in c.REQUIRED}
  manifest={'schema_version':'2','tag':'TEST','game_version':'TEST','published_utc':'TEST','download_base':c.RELEASE+'TEST','assets':[{'name':n,'sha256':hashlib.sha256(v).hexdigest()} for n,v in payload.items()]};calls=[]
  def fetch(url,*args):
   calls.append(url)
   if url.endswith('deposit.lock'):return json.dumps(manifest).encode()
   if url.endswith('devotions.json'):return json.dumps(d).encode()
   return payload[url.rsplit('/',1)[-1]]
  return t,d,payload,manifest,calls,fetch
 def test_full_orchestration_with_synthetic_parquet_reader(self):
  with tempfile.TemporaryDirectory() as f:
   t,d,payload,manifest,calls,fetch=self.setup_fake(f)
   with patch.object(c,'fetch',fetch),patch.object(c,'read_parquet',lambda p:t[p.name[:-8]]),patch.object(a,'load_filtered_facts',lambda p:t['facts']):
    x=c.build_catalog(Path(f));self.assertTrue(x['automation']['skills']);self.assertEqual(len(calls),len(c.REQUIRED)+2);self.assertEqual(x['meta']['automationVersion'],3)
    calls.clear();y=c.build_catalog(Path(f));self.assertEqual(calls,[]);self.assertEqual(x['items'],y['items'])
 def test_corrupt_raw_cache_redownloads(self):
  with tempfile.TemporaryDirectory() as f:
   t,d,p,m,calls,fetch=self.setup_fake(f)
   with patch.object(c,'fetch',fetch),patch.object(c,'read_parquet',lambda p:t[p.name[:-8]]),patch.object(a,'load_filtered_facts',lambda p:t['facts']):
    c.build_catalog(Path(f));calls.clear();(Path(f)/'facts.parquet').write_text('BROKEN');c.build_catalog(Path(f));self.assertEqual(len(calls),1);self.assertTrue(calls[0].endswith('facts.parquet'))
 def test_mismatched_devotion_version_fails(self):
  with tempfile.TemporaryDirectory() as f:
   t,d,p,m,calls,fetch=self.setup_fake(f,True)
   with patch.object(c,'fetch',fetch),patch.object(c,'read_parquet',lambda p:t[p.name[:-8]]),patch.object(a,'load_filtered_facts',lambda p:t['facts']):
    with self.assertRaisesRegex(ValueError,'버전 불일치'):c.build_catalog(Path(f))
   self.assertFalse((Path(f)/'catalog.json').exists())
 def test_checksum_failure_fails_closed(self):
  with tempfile.TemporaryDirectory() as f:
   t,d,p,m,calls,fetch=self.setup_fake(f)
   def bad(url,*args):return fetch(url,*args) if url.endswith('deposit.lock') else b'BROKEN'
   with patch.object(c,'fetch',bad):
    with self.assertRaisesRegex(ValueError,'Checksum'):c.build_catalog(Path(f))
   self.assertFalse((Path(f)/'catalog.json').exists())
 def test_http_and_private_hosts_rejected(self):
  for u in ['http://github.com/x','https://localhost/x','https://evil.test/x']:
   with self.assertRaises(ValueError):c.fetch(u)

class ServerTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.http=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler);cls.base='http://127.0.0.1:'+str(cls.http.server_port);server.catalog=json.loads((ROOT/'tests/auto-catalog-fixture.json').read_text('utf8'));server.state={'phase':'ready','meta':server.catalog['meta']};cls.thread=threading.Thread(target=cls.http.serve_forever,daemon=True);cls.thread.start()
 @classmethod
 def tearDownClass(cls):cls.http.shutdown();cls.http.server_close()
 def test_api_contains_v3_automation(self):self.assertIn('automation',json.load(urllib.request.urlopen(self.base+'/api/catalog')))
 def test_backend_files_not_served(self):
  with self.assertRaises(urllib.error.HTTPError) as e:urllib.request.urlopen(self.base+'/server.py')
  self.assertEqual(e.exception.code,404)
 def test_rebinding_host_blocked(self):
  with self.assertRaises(urllib.error.HTTPError) as e:urllib.request.urlopen(urllib.request.Request(self.base+'/',headers={'Host':'evil.test'}))
  self.assertEqual(e.exception.code,403)
 def test_cross_origin_mutation_blocked(self):
  with self.assertRaises(urllib.error.HTTPError) as e:urllib.request.urlopen(urllib.request.Request(self.base+'/api/retry',data=b'',headers={'Origin':'https://evil.test','X-Grim-Lab':'1'}))
  self.assertEqual(e.exception.code,403)
 def test_portable_contains_db_without_plain_script_injection(self):
  text=urllib.request.urlopen(self.base+'/api/portable').read().decode();self.assertIn('id="embedded-catalog"',text);self.assertIn('grim-automation/v3',text);self.assertIn('TEST ONLY',text)
 def test_offline_missing_cache_does_not_download(self):
  old=server.catalog
  with tempfile.TemporaryDirectory() as f,patch.object(server,'offline_mode',True),patch.object(server,'build_catalog') as build:
   server.load(Path(f));self.assertEqual(server.state['phase'],'error');build.assert_not_called();self.assertIsNone(server.catalog)
  server.catalog=old;server.state={'phase':'ready'}
 def test_production_test_fixture_rejected(self):
  old=server.catalog
  with tempfile.TemporaryDirectory() as f:
   (Path(f)/'catalog.json').write_text(json.dumps(old),encoding='utf8');server.load(Path(f));self.assertEqual(server.state['phase'],'error');self.assertIsNone(server.catalog)
  server.catalog=old;server.state={'phase':'ready'}

if __name__=='__main__':
 suite=unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__]);r=unittest.TextTestRunner(verbosity=2).run(suite)
 report={'suite':'v3 backend + local HTTP','platform':sys.platform,'fixture':True,'liveDownloadValidated':False,'passed':r.testsRun-len(r.failures)-len(r.errors),'failed':len(r.failures)+len(r.errors),'errors':[(str(t),e) for t,e in r.failures+r.errors]}
 (ROOT/'tests/reports').mkdir(exist_ok=True);(ROOT/'tests/reports/backend.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8');sys.exit(not r.wasSuccessful())
