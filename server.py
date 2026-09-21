"""Local-only server. Downloads public item data once, never uploads user builds."""
from __future__ import annotations
import argparse, json, threading, webbrowser, urllib.parse, traceback, sys
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from catalog_backend import build_catalog
ROOT=Path(__file__).resolve().parent
state={'phase':'loading','message':'아이템 DB 준비 중','progress':0}
lock=threading.Lock(); catalog=None; cache_dir=ROOT/'data-cache'; fixture_file=None; offline_mode=False

def update(**kw):
    with lock: state.update(kw)
    print(kw.get('message',''),flush=True)

def load(cache,fixture=None):
    global catalog
    try:
        path=Path(fixture) if fixture else cache/'catalog.json'
        if path.exists():
            catalog=json.loads(path.read_text('utf-8'))
            if not fixture and catalog.get('meta',{}).get('fixture'): raise ValueError('Production cache contains a test fixture; remove this cache.')
            if not fixture and not catalog.get('automation'):
                if offline_mode: raise ValueError('Offline cache does not contain v3 skills/devotions.')
                catalog=build_catalog(cache,update)
        else:
            if offline_mode: raise ValueError('Offline launch requires an already prepared v3 catalog.json.')
            catalog=build_catalog(cache,update)
        if fixture:
            catalog.setdefault('meta',{})['fixture']=True
            catalog['meta']['scope']='검사 표본 — 실제 전체 게임 DB 아님'
        if catalog.get('schema')!='grim-catalog/v2' or not isinstance(catalog.get('items'),list): raise ValueError('Invalid cached catalog schema')
        update(phase='ready',progress=100,message='검색 DB 준비 완료',meta=catalog['meta'])
    except Exception as e:
        catalog=None
        update(phase='error',message=f'{type(e).__name__}: {e}',progress=0)
        traceback.print_exc()

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        expected=f'http://{self.headers.get("Host","")}'
        if self.headers.get('Host','').split(':')[0] not in ('127.0.0.1','localhost') or self.headers.get('X-Grim-Lab')!='1' or self.headers.get('Origin',expected)!=expected:
            return self.send_json(403,{'error':'Same-origin local request required'})
        if self.path!='/api/retry': return self.send_json(404,{'error':'Not found'})
        with lock:
            restart=state['phase']=='error'
            if restart: state.update(phase='loading',message='DB 다시 연결 중',progress=0)
        if restart: threading.Thread(target=load,args=(cache_dir,fixture_file),daemon=True).start()
        self.send_json(200,{'restarted':restart})
    def do_GET(self):
        host=self.headers.get('Host','').split(':')[0]
        if host not in ('127.0.0.1','localhost'): return self.send_json(403,{'error':'Localhost only'})
        p=urllib.parse.urlsplit(self.path).path
        if p=='/api/status':
            with lock: status=dict(state)
            return self.send_json(200,status)
        if p=='/api/catalog':
            if catalog is None: return self.send_json(503,state)
            return self.send_json(200,catalog)
        if p=='/api/portable':
            if catalog is None: return self.send_json(503,state)
            html=(ROOT/'index.html').read_text('utf-8')
            payload=json.dumps(catalog,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
            html=html.replace('<!-- EMBEDDED_CATALOG -->','<script id="embedded-catalog" type="application/json">'+payload+'</script>')
            return self.send_bytes(200,html.encode('utf-8'),'text/html; charset=utf-8','Grim_DPS_Lab_Offline.html')
        if p in ('/','/index.html'):
            return self.send_bytes(200,(ROOT/'index.html').read_bytes(),'text/html; charset=utf-8')
        self.send_json(404,{'error':'Not found'})
    def send_json(self,status,obj): self.send_bytes(status,json.dumps(obj,ensure_ascii=False).encode('utf-8'),'application/json; charset=utf-8')
    def send_bytes(self,status,data,kind,attachment=None):
        self.send_response(status);self.send_header('Content-Type',kind);self.send_header('Content-Length',str(len(data)))
        self.send_header('X-Content-Type-Options','nosniff');self.send_header('Cache-Control','no-store')
        self.send_header('Referrer-Policy','no-referrer')
        if attachment:self.send_header('Content-Disposition','attachment; filename="'+attachment+'"')
        self.end_headers(); self.wfile.write(data)
    def log_message(self,format,*args):
        if '/api/status' not in (args[0] if args else ''): super().log_message(format,*args)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--no-browser',action='store_true');parser.add_argument('--port',type=int,default=8765)
    parser.add_argument('--offline',action='store_true');parser.add_argument('--ready-file',default='')
    parser.add_argument('--cache',default=str(ROOT/'data-cache'));parser.add_argument('--fixture',help='TEST ONLY: normalized catalog JSON')
    args=parser.parse_args();cache_dir=Path(args.cache);fixture_file=args.fixture;offline_mode=args.offline
    for port in range(args.port,args.port+20):
        try: server=ThreadingHTTPServer(('127.0.0.1',port),Handler);break
        except OSError:
            if port==args.port+19:raise
    threading.Thread(target=load,args=(Path(args.cache),args.fixture),daemon=True).start()
    url=f'http://127.0.0.1:{port}/';print('\nGrim DPS Lab v3: '+url+'\nKeep this window open. Ctrl+C to stop.\n',flush=True)
    if args.ready_file:
        ready=Path(args.ready_file);ready.parent.mkdir(parents=True,exist_ok=True);ready.write_text(json.dumps({'url':url,'port':port,'pid':__import__('os').getpid(),'offline':args.offline,'fixture':bool(args.fixture)}),encoding='utf-8')
    if not args.no_browser:webbrowser.open(url)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()
