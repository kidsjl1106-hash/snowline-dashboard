# Google Sheets Access Policy

대시보드 사용자는 원본 구글시트 공유 권한이 없어도 데이터를 조회할 수 있어야 합니다.

## Required Apps Script Deployment

Apps Script 웹 앱 배포 설정은 아래와 같아야 합니다.

- Execute as: Me
- Who has access: Anyone

이 설정이면 승인된 대시보드 계정은 Apps Script API로만 데이터를 조회하고, 구글시트 자체 공유 권한은 필요하지 않습니다.

## Keep

- 대시보드 로그인/승인 절차는 유지합니다.
- 브라우저에서 구글시트 URL이나 CSV 공개 URL로 직접 접근하지 않습니다.
- 구글시트는 공개 공유하지 않습니다.

## If Users See Sheet Permission Errors

Apps Script에서 새 배포 버전을 만들 때 `Execute as: Me`가 아닌 사용자 실행으로 배포된 상태일 가능성이 큽니다. 새 배포를 만들고 웹 앱 URL을 유지하거나, 새 URL이 발급되면 `auth-config.js`의 `apiUrl`을 교체해야 합니다.
