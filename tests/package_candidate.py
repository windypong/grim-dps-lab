"""Package the *prepared and tested* workspace, never an unpatched source ZIP."""
from pathlib import Path
import json,zipfile,hashlib,os
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'tests/reports'
report=json.loads((out/'windows-e2e.json').read_text('utf8'))
live=json.loads((out/'live-catalog-tests.json').read_text('utf8'))
if report['status']!='passed' or live['failed']:
    raise SystemExit('Refusing to package a failed native test candidate')
skip={'.git','.runtime','data-cache','__pycache__','reports','preview'}
files=[p for p in ROOT.rglob('*') if p.is_file() and not any(x in skip for x in p.relative_to(ROOT).parts) and p.suffix not in {'.zip','.pyc'}]
manifest={p.relative_to(ROOT).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
provenance={'testedCommit':os.environ.get('GITHUB_SHA'),'runId':os.environ.get('GITHUB_RUN_ID'),
 'nativeWindowsReport':report,'liveCatalogReport':live,'sourceSHA256':manifest,
 'preparedCandidate':True,'gameDPSValidated':False}
(out/'tested-source-manifest.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2),encoding='utf8')
note='''# Windows 실검사 수정본 — v3.0.1\n\n이 ZIP은 GitHub Actions의 실제 Windows 환경에서 수정 적용, 빌드,\n새 런타임과 실제 DB 다운로드, Chromium 검사 및 오프라인 재실행을\n통과한 작업 폴더를 패키징한 파일입니다.\n\n1. 새 폴더에 전부 압축 해제합니다.\n2. START_WINDOWS.cmd를 실행합니다.\n3. 기존 빌드는 앱의 JSON 불러오기로 복원합니다.\n\n처음 DB를 받는 데 인터넷 연결이 필요합니다. 별도 제공한 DB 포함\nHTML은 런처 없이 브라우저에서 열 수 있습니다.\n\n이전 README/TEST_REPORT의 미검증 설명은 초기 v3 개발 당시 기록입니다.\n현재 실행 검증 결과는 tests/reports/windows-e2e.json과\ntests/reports/tested-source-manifest.json을 보세요.\n\n수정: DuckDB 시작 전 설정, 런타임 해시 검사, DB ready 이벤트 순서,\n실제 WPS 클래스·발동률 키, 충동 프리셋 이름, 적 디버프/표식 강화의\n분류, 조건부 발동 및 쿨다운 필드 연결.\n\n실제 게임/DPYes 수치 일치 검증은 하지 않았습니다.\n펫 AI·특수 공격과 일부 파생 수식은 여전히 미지원/근사입니다.\n'''
archive=out/'Grim_DPS_Lab_v3.0.1_Windows_Checked.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for p in files:z.write(p,'Grim_DPS_Lab_v3.0.1/'+p.relative_to(ROOT).as_posix())
    z.writestr('Grim_DPS_Lab_v3.0.1/START_HERE_KO.md',note)
    for name in ['windows-e2e.json','live-catalog-tests.json','parquet-real.json','candidate-source.json','tested-source-manifest.json']:
        z.write(out/name,'Grim_DPS_Lab_v3.0.1/tests/reports/'+name)
print('Packaged tested Windows candidate: '+str(archive))
