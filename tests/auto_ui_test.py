"""Chromium DOM integration with a clearly synthetic catalogue.
This environment blocks browser navigation to localhost. We obtain actual server
HTML using Python HTTP and use set_content; that is NOT native Windows E2E.
"""
from pathlib import Path
import sys,json,tempfile,subprocess,time,urllib.request,socket,traceback,math
from playwright.sync_api import sync_playwright
from html.parser import HTMLParser
def embedded_count(text):
 class Parser(HTMLParser):
  def __init__(self):super().__init__();self.ids=[]
  def handle_starttag(self,tag,attrs):
   d=dict(attrs)
   if tag=="script" and d.get("type")=="application/json":self.ids.append(d.get("id"))
 p=Parser();p.feed(text);return p.ids
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tests/reports';OUT.mkdir(exist_ok=True)
report={'suite':'v3 Chromium UI integration','platform':sys.platform,'fixture':True,'gameAccuracyValidated':False,'mode':'Python HTTP from actual local server -> Chromium set_content; NOT browser navigation / native Windows','checks':[]}
proc=None;browser=None;errors=[]
def check(name,ok,details=None):
 report['checks'].append({'name':name,'status':'passed' if ok else 'failed','details':details})
 print(('PASS ' if ok else 'FAIL ')+name,flush=True)
 if not ok:raise AssertionError(name)
try:
 with tempfile.TemporaryDirectory(prefix='grim-ui-') as td:
  temp=Path(td);ready=temp/'ready.json';console=open(temp/'server.log','w')
  proc=subprocess.Popen([sys.executable,str(ROOT/'server.py'),'--fixture',str(ROOT/'tests/auto-catalog-fixture.json'),'--no-browser','--port','8831','--ready-file',str(ready)],cwd=ROOT,stdout=console,stderr=subprocess.STDOUT)
  for _ in range(100):
   if ready.exists():
    info=json.loads(ready.read_text());url=info['url'];status=json.load(urllib.request.urlopen(url+'api/status'))
    if status['phase']=='ready':break
   time.sleep(.1)
  else:raise RuntimeError('Fixture server startup failed')
  html=urllib.request.urlopen(url+'api/portable').read().decode()
  check('HTTP server embeds explicit fixture marker',json.loads(urllib.request.urlopen(url+'api/catalog').read())['meta']['fixture'])
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
   page=browser.new_page(viewport={'width':1440,'height':1000},accept_downloads=True)
   page.set_default_timeout(6000);page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
   page.set_content(html);page.wait_for_function('CATALOG.DB.phase==="ready"')
   check('App starts with no JavaScript exception',not errors)
   check('Fixture label visibly warns not real game data','검사 표본' in page.locator('body').inner_text())
   check('Initial missing-primary has no invented DPS',page.evaluate('LAB.getResult().total')==0)
   page.locator('[data-action="library"]').first.click();page.locator('#library-search').fill('서약운반자')
   check('Korean item search returns items',page.locator('.db-card').count()>0)
   page.locator('.db-card').first.click();page.locator('[data-action="equip-db"]').click()
   check('Item selected in UI stores DB record',bool(page.evaluate('LAB.getState().equipment.main.parts.item.db.id')))
   page.locator('[data-action="template"]').click()
   if page.locator('[data-action="close-modal"]').count():page.locator('[data-action="close-modal"]').first.click()
   r=page.evaluate('LAB.getResult()');check('Preset sets exact total hard points 250',r['autoReport']['spent']==250)
   check('Skill levels receive automatic equipment bonuses',any(s['bonus']>0 for s in r['autoReport']['skills']))
   check('Supported-effect DPS is computed',r['total']>0)
   check('Devotion preset has 55 selected stars',r['autoReport']['dev']['points']==55)
   saved=page.evaluate('LAB.getState()')
   def tab(name):page.locator('.tabbar [data-action="tab"][data-tab="'+name+'"]').click()
   tab('skills');primary=saved['auto']['primary'];sel='[data-a-op="point"][data-a-key="'+primary+'"]'
   before=r['total'];page.locator(sel).fill('1');page.locator(sel).dispatch_event('change');after=page.evaluate('LAB.getResult().total')
   check('Changing hard skill points automatically changes DPS',0<after<before)
   page.locator(sel).fill('16');page.locator(sel).dispatch_event('change')
   check('Restoring skill points restores DPS',abs(page.evaluate('LAB.getResult().total')-before)<1e-6)
   seal=page.locator('[data-a-op="condition"][data-a-key="inSeal"]');seal.uncheck();off=page.evaluate('LAB.getResult().total');check('Area buff toggle changes auto damage',off<before);seal.check()
   check('Area buff is not duplicated on restore',abs(page.evaluate('LAB.getResult().total')-before)<1e-6)
   (ROOT/'preview').mkdir(exist_ok=True)
   page.screenshot(path=str(ROOT/'preview/skills-test-only.png'),full_page=False)
   tab('character');ca=page.locator('[data-a-op="attr"][data-a-key="cunning"]');oldOA=page.evaluate('LAB.getResult().a.oa');ca.fill('10');ca.dispatch_event('change');check('Attribute allocation automatically changes OA',page.evaluate('LAB.getResult().a.oa')<oldOA)
   page.evaluate('(s)=>LAB.setState(s)',saved)
   tab('devotions');first=page.locator('.star-node').first;oldpoints=page.evaluate('LAB.getResult().autoReport.dev.points');first.focus();first.press('Enter')
   check('Keyboard toggles devotion star and recalculates',page.evaluate('LAB.getResult().autoReport.dev.points')==oldpoints-1)
   page.locator('.star-node').first.focus();page.locator('.star-node').first.press('Enter')
   check('Restored devotion returns original damage',abs(page.evaluate('LAB.getResult().total')-before)<1e-6)
   page.screenshot(path=str(ROOT/'preview/devotions-test-only.png'),full_page=False)
   tab('target');target=page.locator('[data-a-op="target-res"][data-a-key="pierce"]');target.fill('80');target.dispatch_event('change');check('Target resistance automatically lowers DPS',page.evaluate('LAB.getResult().total')<before)
   page.evaluate('(s)=>LAB.setState(s)',saved)
   page.locator('[data-action="snapshot"]').first.click()
   tab('character');ca=page.locator('[data-a-op="attr"][data-a-key="cunning"]');ca.fill('40');ca.dispatch_event('change')
   check('A/B comparison section visible','A' in page.locator('body').inner_text())
   tab('analysis');check('Analysis includes real modeled skill rows',page.locator('tbody tr').count()>4)
   page.screenshot(path=str(ROOT/'preview/analysis-test-only.png'),full_page=False)
   with page.expect_download() as d:page.locator('[data-action="export-build"]').first.click()
   exported=temp/'build.json';d.value.save_as(exported);build=json.loads(exported.read_text())
   check('Build export includes points/attributes/devotions',bool(build.get('auto',{}).get('points')) and bool(build['auto']['devotions']))
   page.evaluate('(s)=>{s.auto.attributes.cunning=2;LAB.setState(s)}',build)
   with page.expect_file_chooser() as fc:page.locator('[data-action="import-build"]').first.click()
   fc.value.set_files(exported);page.wait_for_function('LAB.getState().auto.attributes.cunning===40')
   check('Build JSON re-import restores automatic build',page.evaluate('LAB.getState().auto.attributes.cunning')==40)
   tab('audit');check('Diagnostics expose reference-growth limits','reference-growth' in page.locator('body').inner_text())
   check('Raw enemy RR is included in audit',any(x['kind']=='add' for x in page.evaluate('LAB.getResult().autoReport.rrs')))
   with page.expect_download() as d:page.locator('[data-a-op="export-audit"]').click()
   diag=temp/'diag.json';d.value.save_as(diag);check('Audit export includes unsupported/approximate effects',bool(json.loads(diag.read_text())['issues']))
   # Export must preserve hostile-looking labels as data, not script.
   page.evaluate('()=>{const s=LAB.getState();s.meta.name="</script><script>window.XSS_TEST=1</script>";LAB.setState(s)}')
   value=page.evaluate('LAB.getResult().total')
   with page.expect_download() as d:page.locator('[data-action="portable"]').first.click()
   portable=temp/'offline.html';d.value.save_as(portable);text=portable.read_text()
   check('Offline export includes catalogue and current build',embedded_count(text).count('embedded-catalog')==1 and embedded_count(text).count('embedded-build')==1)
   other=browser.new_page(accept_downloads=True,viewport={'width':1440,'height':1000});other.on('pageerror',lambda e:errors.append(str(e)));other.set_content(text);other.wait_for_function('CATALOG.DB.phase==="ready"')
   check('Embedded offline HTML restores same result',abs(other.evaluate('LAB.getResult().total')-value)<1e-6)
   check('Embedded labels cannot escape JSON script tags',other.evaluate('typeof XSS_TEST')=='undefined')
   with other.expect_download() as d:other.locator('[data-action="portable"]').first.click()
   again=temp/'again.html';d.value.save_as(again);check('Repeated offline export has one copy of DB/build',embedded_count(again.read_text()).count('embedded-build')==1)
   # Mobile: verify all actual tabs, not just one desktop screenshot.
   page.evaluate('(s)=>LAB.setState(s)',saved);page.set_viewport_size({'width':390,'height':844})
   for name in ['gear','character','skills','devotions','target','analysis','audit','logs','help']:
    tab(name);width=page.evaluate('({doc:document.documentElement.scrollWidth,win:innerWidth})')
    check('Mobile no whole-page overflow: '+name,width['doc']<=width['win']+1,width)
   tab('skills');page.screenshot(path=str(ROOT/'preview/mobile-test-only.png'),full_page=False)
   check('No unhandled browser exceptions across tested interactions',not errors,errors)
   report['status']='passed'
except Exception as ex:
 report.update(status='failed',error=repr(ex),traceback=traceback.format_exc());print(report['traceback'])
finally:
 if browser:
  try:browser.close()
  except Exception:pass
 if proc:
  proc.terminate()
  try:proc.wait(5)
  except subprocess.TimeoutExpired:proc.kill()
 report['passed']=sum(x['status']=='passed' for x in report['checks']);report['failed']=sum(x['status']=='failed' for x in report['checks']);report['jsErrors']=errors
 (OUT/'ui.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
 sys.exit(0 if report.get('status')=='passed' else 1)
