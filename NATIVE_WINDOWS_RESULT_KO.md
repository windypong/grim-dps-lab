# 실제 Windows 검사 결과 — 2026-09-21 UTC

## 최종 결과

GitHub Actions 실행 #3은 성공했습니다.
- 실행: https://github.com/windypong/grim-dps-lab/actions/runs/35562739431
- 검사 대상 커밋: 3f7f31cdada4c2904121430c8e49c7ee5b8b70f1
- 테스트 브랜치: fix/windows-duckdb-startup. main은 변경하거나 병합하지 않았습니다.
- 실제 환경: Windows Server 2022, 빌드 20348, Python 3.12.10, DuckDB 1.4.1, Windows Chromium.
- 검사는 fixes/prepare_candidate.py의 명시적 호환성 패치를 적용한 작업 폴더에서 진행했습니다.
- 배포 ZIP은 이 패치가 이미 적용된 소스와 빌드 결과입니다. 저장소 main의 Download ZIP은 수정 배포본과 다릅니다.

## 통과한 검사

- 기존 계산·카탈로그·Python 서버 검사: 68 + 48 + 20 + 27 = 163개.
- 실제 DuckDB/Parquet 읽기 회귀 검사: 4개. SQL 읽기를 모의 함수로 대체하지 않았습니다.
- 실제 공개 게임 DB 연결 검사: 23개. 스킬 이름·WPS 분류·발동 확률 키·버프/디버프 연결 등을 검사했습니다.
- Windows 시작부터 오프라인 재실행까지: 20개. 최종 실패 0개.
- 새 한글·공백 경로에서 CMD 런처를 실제 실행했습니다.
- 앱 전용 Python/DuckDB 다운로드, 기존 포트 충돌 시 대체 포트, 전체 DB 다운로드/해시 검사가 통과했습니다.
- Windows Chromium에서 한국어 아이템 검색, 장착, 장비 스킬 보너스, 250포인트 프리셋 계산이 통과했습니다.
- DB 포함 HTML 내보내기, 서버/네트워크 없는 파일 재실행, 계산값 일치, 저장 복원, 캐시 오프라인 재시작이 통과했습니다.

## 실제 데이터와 배포 파일

- 데이터 스냅샷: Grim Dawn 1.3.0.7 / deposit-24756825.3. 그림툴 최신 DB를 실시간 동기화한 것이 아닙니다.
- 검색 레코드 14,026개: 장비/유물 7,344, 접두사 2,782, 접미사 3,409, 기타 접사 5, 증강제 379, 컴포넌트 107.
- 스킬 데이터 315개, 별자리/갈림길 데이터 109개.
- Actions 아티팩트: native-windows-test-results-3, ID 10622348774.
- 아티팩트 ZIP SHA-256: a7e51575f3eb127352e80011d49c10ae788ce87cdc146701944fd7ebbba53a39.
- 수정 배포본: Grim_DPS_Lab_v3.0.1_Windows_Checked.zip.
- 오프라인 실행본: Grim_DPS_Lab_Offline.html. 런처와 추가 DB 다운로드가 필요하지 않습니다.
- 소스 45개 파일은 tested-source-manifest.json의 SHA-256과 배포 ZIP 내용을 대조해 모두 일치했습니다.

## 발견하고 수정한 문제

1. DuckDB 연결 후 enable_external_access 설정을 바꾸어 시작을 실패하던 오류. 연결 생성 시 config로 지정하도록 수정했습니다.
2. 일부 Windows PowerShell 실행 경로에서 Get-FileHash를 찾지 못하던 오류. .NET SHA-256으로 동일한 체크섬 검사를 수행합니다.
3. 브라우저가 실제 카탈로그를 받기 전에 ready를 알리고 null.meta를 읽어 멈추던 오류. 카탈로그 수신과 검색 인덱스 생성 후에만 ready 상태로 전환합니다.
4. 실제 DB의 Skill_WPAttack 클래스와 skillChanceWeight 필드를 읽지 못하던 오류.
5. 충동의 프리셋 이름 Impetus를 실제 DB의 Impulse로 수정했습니다.
6. 고통의 언령/소름 끼치는 함성의 적 디버프 분류와 마법적 강화의 표식 연결을 수정했습니다.
7. 치명타/저체력 발동 분류, 원시 쿨다운 필드 연결, 무기 미장착 상태의 피해 표시를 수정했습니다.

## 검증하지 않은 것

- 사용자 개인 Windows 10/11 PC 자체와 기본 브라우저 자동 실행 연결은 직접 검사하지 않았습니다. CMD는 -NoBrowser로 실행하고 Chromium으로 실제 localhost에 접속했습니다.
- 이 테스트는 프로그램 실행/데이터 연결 검사입니다. 실제 게임 및 DPYes 측정치와의 정확한 일치는 검증하지 않았습니다.
- 펫 AI, 특수 공격 주기, 일부 파생 능력치와 발동 유지율 등 기존 근사/미지원 범위는 남아 있습니다.
- 스킬 315개가 조회된다는 것이 모든 스킬의 게임 동작을 검증했다는 뜻은 아닙니다.
