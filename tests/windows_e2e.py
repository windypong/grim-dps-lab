"""Run the *actual Windows launcher* from a fresh, spaced Korean path.
Requires Python+Playwright only for the test controller. The app's own embedded
Python/DuckDB are separately downloaded through START_WINDOWS.cmd.
This script refuses to label a non-Windows run as passed.
"""
from pathlib import Path
import os,sys,json,time,subprocess,shutil,tempfile,socket,urllib.request,traceback,argparse
ROOT=Path(__file__).resolve().parents[1]
REPORT=ROOT/'tests/reports/windows-e2e.json'

def main():
 report={'suite':'native Windows end-to-end','platform':sys.platform,'status':'not_run','checks':[],
         'gameDPSValidated':False,'defaultBrowserAssociationValidated':False,'fixture':False}
 REPORT.parent.mkdir(parents=True,exist_ok=True)
 if sys.platform!='win32':
  report['reason']='Requires native Windows. Linux/Wine/UA spoofing is not Windows verification.'
  REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8');print(report['reason']);return 2
 from playwright.sync_api import sync_playwright
 report['osVersion']=sys.getwindowsversion().__repr__();report['controllerPython']=sys.version
 temp=Path(tempfile.mkdtemp(prefix='grim-e2e-'));work=temp/'그림 검사 폴더'/'Grim DPS Lab';work.parent.mkdir(parents=True)
 shutil.copytree(ROOT,work,ignore=shutil.ignore_patterns('.runtime','data-cache','__pycache__','.git','reports','preview'))
 proc=None;stdout=None;browser=None;reservation=None
 def check(name,ok,detail=None):
  report['checks'].append({'name':name,'status':'passed' if ok else 'failed','detail':detail});print(('PASS ' if ok else 'FAIL ')+name,flush=True)
  if not ok:raise AssertionError(name)
 def launch(offline=False):
  nonlocal proc,stdout
  startup=work/'startup.json';startup.unlink(missing_ok=True)
  stdout=open(temp/('offline-console.txt' if offline else 'first-console.txt'),'w',encoding='utf8')
  args=['cmd.exe','/d','/c','START_WINDOWS.cmd','-NoBrowser','-Port','8899','-ReadyFile','startup.json','-Cache','data-cache']
  if offline:args+=['-Offline']
  env=os.environ.copy();env.update(GRIM_LAB_CI='1',PYTHONUTF8='1',PYTHONIOENCODING='utf-8')
  proc=subprocess.Popen(args,cwd=work,env=env,stdout=stdout,stderr=subprocess.STDOUT)
  deadline=time.time()+(90 if offline else 1200);info=None
  while time.time()<deadline:
   if proc.poll() is not None:raise RuntimeError('Windows launcher exited: '+str(proc.returncode))
   if startup.exists():
    try:
     info=json.loads(startup.read_text('utf8'));status=json.load(urllib.request.urlopen(info['url']+'api/status',timeout=10))
     if status['phase']=='error':raise RuntimeError(status['message'])
     if status['phase']=='ready':return info,status
    except (urllib.error.URLError,json.JSONDecodeError):pass
   time.sleep(1)
  raise TimeoutError('Windows launch/DB initialization timeout')
 def stop():
  nonlocal proc,stdout
  if proc and proc.poll() is None:subprocess.run(['taskkill','/PID',str(proc.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  if proc:
   try:proc.wait(20)
   except subprocess.TimeoutExpired:proc.kill()
  if stdout:stdout.close()
  proc=stdout=None
 try:
  reservation=socket.socket();reservation.bind(('127.0.0.1',8899));reservation.listen()
  info,status=launch();check('native launcher succeeded from a path with spaces and Korean',True)
  check('occupied port falls back to another port',info['port']!=8899)
  check('runtime independently prepared', (work/'.runtime/python/python.exe').exists() and (work/'.runtime/python/site-packages/grim-duckdb-verified.json').exists())
  catalog=json.load(urllib.request.urlopen(info['url']+'api/catalog',timeout=90));auto=catalog.get('automation',{})
  check('live DB, not test fixture',not catalog['meta'].get('fixture') and not catalog['meta'].get('testOnly'))
  check('full public roster present',len(catalog['items'])>1000 and len(auto.get('skills',[]))>=300 and len(auto.get('devotions',[]))>=50,
        {'items':len(catalog['items']),'skills':len(auto.get('skills',[])),'devotions':len(auto.get('devotions',[]))})
  check('raw mastery arrays available',all(x['rankSource']=='raw-arrays' for x in auto['masteries']))
  report['dataMetadata']=catalog['meta']
  (ROOT/'tests/reports/live-catalog.json').write_text(json.dumps(catalog,ensure_ascii=False),encoding='utf8')
  with sync_playwright() as p:
   browser=p.chromium.launch(headless=True);page=browser.new_page(viewport={'width':1440,'height':1000},accept_downloads=True)
   page.set_default_timeout(30000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
   page.goto(info['url']);page.wait_for_function('window.CATALOG?.DB.phase==="ready"')
   check('Windows Chromium reaches localhost app',True)
   page.locator('[data-action="library"]').first.click();page.locator('#library-search').fill('서약운반자')
   page.locator('.db-card').first.wait_for(state='visible')
   check('real Korean item search',page.locator('.db-card').count()>0)
   page.locator('.db-card').first.click();page.locator('[data-action="equip-db"]').click()
   check('item raw options automatically installed',bool(page.evaluate('LAB.getState().equipment.main.parts.item.db.id')))
   page.locator('[data-action="template"]').click()
   close=page.locator('[data-action="close-modal"]')
   if close.count():close.first.click()
   r=page.evaluate('LAB.getResult()');check('preset compiles skill ranks without manual coefficients',r['autoReport']['spent']==250 and len(r['autoReport']['skills'])>=20)
   check('supported DPS computed',r['total']>0)
   page.locator('[data-action="tab"][data-tab="skills"]').first.click()
   page.screenshot(path=str(ROOT/'tests/reports/windows-skills.png'),full_page=False)
   check('automatic skill level includes equipment',any(x['bonus']>0 for x in r['autoReport']['skills']))
   with page.expect_download() as dl:page.locator('[data-action="portable"]').first.click()
   offline=temp/'offline.html';dl.value.save_as(offline)
   check('offline export contains data and build',offline.stat().st_size>100000)
   offpage=browser.new_page(accept_downloads=True);http=[]
   def route(req):
    if req.request.url.startswith(('http://','https://')):http.append(req.request.url);req.abort()
    else:req.continue_()
   offpage.route('**/*',route);offpage.goto(offline.as_uri());offpage.wait_for_function('window.CATALOG?.DB.phase==="ready"')
   check('exported file reopens with no server/network',len(http)==0)
   restored=offpage.evaluate('LAB.getResult().total');check('offline calculation matches',abs(restored-r['total'])<1e-7)
   shutil.copyfile(offline,ROOT/'tests/reports/Grim_DPS_Lab_Offline.html')
   check('no JavaScript exceptions',not errors,errors)
   page.reload();page.wait_for_function('window.CATALOG?.DB.phase==="ready"');check('same-origin persisted build restores',page.evaluate('LAB.getResult().autoReport.spent')==250)
   check('source files not publicly served',page.request.get(info['url']+'server.py').status==404)
   browser.close();browser=None
  stop();reservation.close();reservation=None
  info,status=launch(True);check('cached offline restart with strict no-download flag',info['offline'] and status['phase']=='ready')
  check('offline cache retains snapshot',status['meta']['gameVersion']==report['dataMetadata']['gameVersion'])
  report['status']='passed'
 except Exception as e:
  report['status']='failed';report['error']=repr(e);report['traceback']=traceback.format_exc();print(report['traceback'])
 finally:
  if browser:
   try:browser.close()
   except Exception:pass
  stop()
  if reservation:reservation.close()
  for f in temp.glob('*console.txt'):
   shutil.copyfile(f,ROOT/'tests/reports'/('windows-'+f.name))
   if report['status']!='passed':
    print('LAUNCHER LOG '+f.name+'\n'+f.read_text('utf8',errors='replace')[-16000:],flush=True)
  report['passed']=sum(x['status']=='passed' for x in report['checks']);report['finishedAt']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
  REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
  shutil.rmtree(temp,ignore_errors=True)
 return 0 if report['status']=='passed' else 1
if __name__=='__main__':sys.exit(main())
