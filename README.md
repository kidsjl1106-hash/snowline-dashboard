# SNOWLINE Sales Dashboard

SNOWLINE 영업 대시보드 프로젝트입니다. Google Sheets 데이터를 Google Apps Script 인증 서버를 통해 불러오고, 승인된 계정만 접근할 수 있도록 구성되어 있습니다.

## 운영 주소

고정 운영 주소는 `https://kidsjl1106-hash.github.io/snowline-dashboard/` 입니다.

일반 기능 업데이트, Apps Script 업데이트, 캐시 버전 변경 중에는 운영 도메인을 변경하지 않습니다. `www.snowline-dashboard.co.kr` 전환은 DNS 설정 확인과 사용자 명시 승인 후에만 진행합니다. 자세한 기준은 `docs/CANONICAL_DOMAIN.md`를 참고하세요.

## 주요 파일

- `index.html`, `app.js`, `styles.css`: 대시보드 메인 화면
- `auth.js`, `auth.css`, `auth-config.js`: 로그인, 회원가입, 세션 설정
- `google-apps-script/Code.gs`: Google Apps Script 인증 및 시트 API 원본
- `Code-for-Apps-Script*.txt`, `copy-apps-script.html`: Apps Script 복사용 자료
- `release/`: production/test 배포본
- `snowline-dashboard-*.zip`, `snowline-dashboard-codex-backup-*`: 기존 백업 및 배포 압축 파일
- `.github/workflows/pages.yml`: GitHub Pages 배포 워크플로

## 로컬 실행

```powershell
python -m http.server 5173 --bind 127.0.0.1
```

브라우저에서 `http://127.0.0.1:5173/`로 접속합니다.

## GitHub Pages 배포

1. GitHub 저장소를 만들고 이 프로젝트를 push합니다.
2. GitHub 저장소의 `Settings > Pages`에서 Source를 `GitHub Actions`로 설정합니다.
3. `main` 또는 `master` 브랜치에 push하면 `.github/workflows/pages.yml`이 공개 사이트 파일을 배포합니다.

## 테스트 페이지

GitHub Pages 배포 후 운영 페이지는 저장소 기본 주소에서 열리고, 테스트 버전은 `/test/` 경로에서 열립니다.

- 운영: `https://kidsjl1106-hash.github.io/snowline/`
- 테스트: `https://kidsjl1106-hash.github.io/snowline/test/`

`test.html`은 테스트 페이지로 이동하는 리다이렉트 파일입니다.

주의: GitHub Pages는 Netlify의 `_headers` 보안 헤더를 적용하지 않습니다. 보안 헤더까지 유지하려면 GitHub 저장소를 Netlify에 연결해 자동 배포하는 방식이 더 적합합니다.

## Apps Script 설정

Google Apps Script에는 `google-apps-script/Code.gs` 또는 `Code-for-Apps-Script-compact.txt` 내용을 붙여넣고 배포한 뒤, 생성된 `/exec` URL을 `auth-config.js`의 `apiUrl`에 넣습니다.

`Code.gs`는 Script Properties의 `ADMIN_INITIAL_PASSWORD`, `SESSION_SECRET`, `PASSWORD_PEPPER`를 사용합니다. 공개 저장소로 운영할 경우 Spreadsheet ID와 Apps Script URL이 노출될 수 있으므로 비공개 저장소 사용을 권장합니다.
