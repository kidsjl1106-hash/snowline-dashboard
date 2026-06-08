# SNOWLINE 로그인 서버 설정

현재 GitHub Pages 정적 페이지는 회원가입/로그인 화면만 담당합니다. 실제 비밀번호 검증, 관리자 승인, 구글시트 데이터 전달, 신규 회원가입 이메일 알림은 Google Apps Script에서 처리합니다.

## 1. Apps Script 만들기

1. 구글시트 `1whGIBwNUDKzZp6hczvqNqExN_icFmwHPCt7385W15ws`를 엽니다.
2. `확장 프로그램` > `Apps Script`를 엽니다.
3. `google-apps-script/Code.gs` 내용을 붙여넣습니다.
4. `프로젝트 설정` > `스크립트 속성`에 아래 값을 추가합니다.

```text
ADMIN_INITIAL_PASSWORD = 임성진 관리자 초기 비밀번호
ADMIN_NOTIFICATION_EMAIL = 신규 회원가입 알림을 받을 관리자 이메일
```

5. Apps Script 편집기에서 `initializeAuth` 함수를 한 번 실행합니다.
6. 이메일 알림 권한 확인용으로 `sendSignupNotificationTest` 함수를 한 번 실행합니다.
   - 처음 실행 시 Google 권한 승인 화면이 뜰 수 있습니다.
   - 메일이 오면 신규 회원가입 알림 설정이 완료된 것입니다.

## 2. 웹 앱으로 배포

1. `배포` > `새 배포`
2. 유형: `웹 앱`
3. 실행 사용자: `나`
4. 액세스 권한: `모든 사용자`
5. 배포 후 `/exec`로 끝나는 웹 앱 URL을 복사합니다.

## 3. GitHub Pages 코드에 URL 입력

`auth-config.js`의 `apiUrl`에 Apps Script 웹 앱 URL을 입력합니다.

```js
window.SNOWLINE_AUTH_CONFIG = {
  apiUrl: "https://script.google.com/macros/s/여기에_배포_ID/exec",
  sessionKey: "snowline_dashboard_session",
};
```

이후 GitHub Pages 운영 배포본의 `auth-config.js`에 같은 URL이 들어가 있는지 확인합니다.

## 신규 회원가입 이메일 알림

`google-apps-script/Code.gs`는 회원가입 요청이 `pending` 상태로 저장된 직후 관리자에게 이메일을 보냅니다.

- 기본 수신자: `kidsjl1106@gmail.com`
- 변경 방법: Apps Script `스크립트 속성`의 `ADMIN_NOTIFICATION_EMAIL` 값을 변경
- 제목 형식: `[SNOWLINE] 신규 회원가입 승인 요청 - 이름`
- 본문 내용: 계정 이름, 본인 이름, 요청 일시, 관리자 승인 링크

이메일 발송 실패가 발생해도 회원가입 요청은 정상 접수되며, 실패 내용은 `dashboard_auth_audit` 시트에 `signup_notify_failed`로 기록됩니다.

## 관리자 권한

관리자 계정은 서버 코드에서 `limseongjin` 하나로 고정되어 있습니다. 로그인 화면에는 `Limseongjin`으로 입력해도 됩니다. 다른 사용자는 회원가입 후 `승인 관리`에서 승인해야 로그인할 수 있습니다.
