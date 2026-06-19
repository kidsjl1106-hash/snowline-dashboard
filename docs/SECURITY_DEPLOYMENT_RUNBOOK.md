# SNOWLINE 보안 반영 실행 문서

작성일: 2026-06-19

## 목적

대시보드 보안을 다음 구조로 운영 반영한다.

- 로그인한 승인 사용자만 대시보드 접근
- Google Sheets 데이터는 브라우저 직접 접근 금지
- 모든 시트 데이터는 Google Apps Script 인증 API를 통해서만 전달
- 세션은 8시간 유지
- 로그인 실패 5회 시 15분 차단

## 1. 반영 전 확인

- 운영 페이지 주소: `https://kidsjl1106-hash.github.io/snowline/`
- 테스트 페이지 주소: `https://kidsjl1106-hash.github.io/snowline/test/`
- Apps Script 원본 파일: `google-apps-script/Code.gs`
- Apps Script 복사용 파일: `Code-for-Apps-Script.txt`
- 운영 API 설정 파일: `auth-config.js`
- 테스트 API 설정 파일: `release/test/auth-config.js`

## 2. Apps Script 서버 반영

1. Google Sheet를 연다.
2. 상단 메뉴에서 `확장 프로그램 > Apps Script`를 연다.
3. Apps Script 편집기에서 `Code.gs` 파일을 연다.
4. 기존 코드를 전체 선택 후 삭제한다.
5. 이 저장소의 `google-apps-script/Code.gs` 또는 `Code-for-Apps-Script.txt` 전체 내용을 붙여넣는다.
6. 저장한다.
7. `initializeAuth` 함수를 한 번 실행한다.
8. 권한 승인 화면이 뜨면 승인한다.
9. `배포 > 배포 관리` 또는 `배포 > 새 배포`로 이동한다.
10. 웹 앱 배포를 새 버전으로 업데이트한다.

권장 웹 앱 설정:

- 유형: 웹 앱
- 실행 사용자: 나
- 액세스 권한: 모든 사용자

주의: 액세스 권한을 `모든 사용자`로 두더라도 실제 데이터는 Apps Script 내부 토큰 검증을 통과해야만 반환된다.

## 3. Apps Script URL 확인

1. 배포 후 `/exec`로 끝나는 웹 앱 URL을 복사한다.
2. `auth-config.js`의 `apiUrl` 값과 비교한다.
3. 테스트 환경을 따로 쓰면 `release/test/auth-config.js`도 확인한다.
4. URL이 바뀌었으면 해당 파일의 `apiUrl` 값을 새 `/exec` URL로 변경한다.

예시:

```js
window.SNOWLINE_AUTH_CONFIG = {
  apiUrl: "https://script.google.com/macros/s/배포_ID/exec",
  sessionKey: "snowline_dashboard_session",
};
```

## 4. Google Sheet 공유 제한

가장 중요한 확인 항목이다.

1. Google Sheet 우측 상단 `공유`를 누른다.
2. 일반 액세스가 `링크가 있는 모든 사용자`이면 안 된다.
3. 일반 액세스를 `제한됨`으로 바꾼다.
4. 필요한 관리자 또는 회사 계정만 직접 추가한다.
5. Apps Script 실행 계정이 해당 Sheet를 읽을 수 있는지 확인한다.

이 단계를 하지 않으면 사용자가 대시보드 로그인을 우회해 시트 원본에 접근할 가능성이 남을 수 있다.

## 5. GitHub Pages 배포

1. 변경된 파일을 GitHub 저장소에 반영한다.
2. `main` 또는 운영 배포 브랜치에 push한다.
3. GitHub Actions의 Pages 배포가 성공했는지 확인한다.
4. 운영 URL이 정상으로 열리는지 확인한다.

반영 대상 주요 파일:

- `app.js`
- `auth.js`
- `google-apps-script/Code.gs`
- `Code-for-Apps-Script.txt`
- `Code-for-Apps-Script-compact.txt`
- `release/test/app.js`
- `release/test/auth.js`

## 6. 운영 검증

시크릿 창 또는 다른 브라우저에서 확인한다.

1. 운영 URL을 연다.
2. 로그인 화면이 먼저 나오는지 확인한다.
3. 비밀번호를 비우거나 틀리게 입력했을 때 대시보드로 들어가지 않는지 확인한다.
4. 승인되지 않은 계정으로 로그인할 수 없는지 확인한다.
5. 승인된 계정으로 로그인했을 때만 데이터가 로딩되는지 확인한다.
6. 개발자 도구 Network 탭에서 `docs.google.com/spreadsheets/.../gviz/tq` 요청이 없는지 확인한다.
7. Network 탭에서 Apps Script `/exec` 요청으로 시트 데이터가 로딩되는지 확인한다.
8. 브라우저를 완전히 닫았다가 다시 열면 재로그인이 필요한지 확인한다.
9. 잘못된 비밀번호를 5회 입력하면 임시 차단 메시지가 나오는지 확인한다.

## 7. IP 제한 추가 판단

현재 GitHub Pages만으로는 방문자 IP allowlist를 간단하게 걸기 어렵다.

회사 IP 사용자만 접속하도록 추가 제한이 필요하면 다음 중 하나를 앞단에 둔다.

- Cloudflare Access
- Netlify Traffic Rules 또는 WAF
- 회사 VPN 전용 내부 프록시

권장 구조:

```text
회사 사용자
  -> 회사 VPN 또는 Cloudflare/Netlify 접근 제한
  -> GitHub Pages 대시보드
  -> Apps Script 인증 API
  -> 제한 공유된 Google Sheet
```

IP 제한은 로그인 보안을 대체하지 않고, 추가 보호 계층으로만 사용한다.

## 8. 문제 발생 시 확인

로그인이 안 되는 경우:

- `auth-config.js`의 `apiUrl`이 최신 Apps Script `/exec` URL인지 확인한다.
- Apps Script 배포가 최신 코드 버전인지 확인한다.
- `initializeAuth`를 실행했는지 확인한다.
- `ADMIN_INITIAL_PASSWORD`, `SESSION_SECRET`, `PASSWORD_PEPPER` Script Properties가 있는지 확인한다.

데이터가 안 뜨는 경우:

- Apps Script의 `CONFIG.allowedSheets`에 시트명이 들어 있는지 확인한다.
- Apps Script 실행 계정이 Google Sheet를 읽을 수 있는지 확인한다.
- Google Sheet 이름이 코드의 시트명과 정확히 일치하는지 확인한다.

로그인 버튼만 눌러도 들어가는 것처럼 보이는 경우:

- 이전 브라우저 세션이 남아 있을 수 있으므로 로그아웃 후 시크릿 창에서 다시 확인한다.
- 운영 페이지가 최신 `auth.js`, `app.js`를 배포했는지 확인한다.
- 개발자 도구 Network 탭에서 파일 캐시가 오래된 버전인지 확인한다.
