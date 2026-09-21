# 실제 Windows 검증 절차

**현재 첨부된 결과는 `not_run`입니다. 아래 작업이 존재한다는 사실은 Windows 검증 완료를 뜻하지 않습니다.**

## 준비된 검사

`tests/windows_e2e.py`는 네이티브 Windows가 아니면 종료 코드 2와 `not_run`을 기록합니다. Linux나 브라우저 사용자 에이전트를 Windows처럼 변경해서 통과시키지 않습니다.

Windows에서는 다음을 실제 실행하도록 작성했습니다.

1. 공백과 한글이 포함된 새 임시 폴더에 앱 복사.
2. 기존 `.runtime`과 `data-cache` 없이 `START_WINDOWS.cmd` 실행.
3. 기본 포트를 일부러 점유하여 다음 포트로 이동하는지 확인.
4. 별도의 앱용 Python/DuckDB 런타임 다운로드·실행 확인.
5. 공개 전체 DB를 내려받고 검사 표본이 아닌지 확인.
6. 충분한 아이템·스킬·별자리 수와 원시 숙련도 배열 확인.
7. Windows Chromium에서 실제 localhost 페이지 열기.
8. 한국어 장비 검색·장착과 서약운반자 배분의 자동 스킬 레벨 확인.
9. DB 포함 HTML 저장 → 파일 주소로 다시 열기 → 외부 요청 없이 같은 계산 확인.
10. 빌드 저장 후 새로고침, 비허용 파일 경로가 노출되지 않는지 확인.
11. 프로세스 종료 → `-Offline`으로 캐시 재시작.
12. 실제 상태·오류·콘솔·화면을 테스트 산출물에 저장.

이 테스트도 게임 본체를 실행하지 않으며, 실제 게임 DPS 정확도·SmartScreen·백신·모든 Windows 버전·기본 브라우저 연결까지 보증하지 않습니다. 테스트는 `-NoBrowser`로 서버를 띄우고 테스트용 Chromium으로 접속합니다.

## GitHub Actions에서 실행

권한이 있는 저장소에 이 ZIP의 **루트 내용 전체**를 업로드합니다. `.github/workflows/windows-e2e.yml`이 저장소 루트에서 정확한 위치에 있어야 합니다. 사용자 빌드·개인 로그·토큰은 업로드할 필요가 없습니다.

Actions에서 `Native Windows live database end-to-end`를 선택해 `Run workflow`를 실행합니다. 워크플로는 콘텐츠 읽기 권한만 사용하며, 실제 테스트 결과를 `native-windows-test-results` 산출물로 저장합니다. 브라우저·런타임·공개 DB 다운로드에는 인터넷이 필요합니다. 외부 배포 변경이나 GitHub 다운로드 제한 때문에 실패할 수 있습니다.

**실행 전 이 배포에 들어 있는 과거 `tests/reports`는 Linux의 기록입니다. 워크플로 실행이 성공했는지는 새 실행 로그와 새 `windows-e2e.json`으로 판단하세요.**

## Windows PC에서 직접 검사

사용자 실행은 `START_WINDOWS.cmd`만으로 진행하도록 구성했습니다. 아래 명령은 검증을 위한 테스트 제어기이며, 일반 앱 실행의 필수 설치가 아닙니다.

```powershell
py -3 -m pip install "playwright>=1.55,<2"
py -3 -m playwright install chromium
py -3 tests/windows_e2e.py
```

결과 파일:

- `tests/reports/windows-e2e.json`
- `tests/reports/windows-first-console.txt`
- `tests/reports/windows-offline-console.txt`
- `tests/reports/windows-skills.png`

`status: passed`는 위 테스트가 그 환경에서 통과했다는 의미입니다. `not_run`이나 `failed`를 성공으로 해석하지 마세요. 테스트 스크립트 자체 역시 아직 네이티브 Windows에서 실행 검증되지 않았습니다.
