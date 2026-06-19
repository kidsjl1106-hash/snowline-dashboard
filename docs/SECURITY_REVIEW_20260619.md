# SNOWLINE dashboard security review

Date: 2026-06-19

## Decision

Do not rely on IP allowlisting as the primary security control for the current GitHub Pages deployment.

The dashboard is a static GitHub Pages site, and GitHub Pages does not provide a simple visitor IP allowlist for a public Pages site. IP allowlisting can be useful only when the site is moved behind a platform that supports edge access control, such as Netlify traffic rules, Cloudflare Access, a company VPN, or an internal reverse proxy.

## Primary fix applied

The dashboard no longer loads Google Sheets directly from the browser with the public `docs.google.com/spreadsheets/.../gviz/tq` JSONP endpoint.

Instead, both production and test dashboard code now requests sheet data through:

```js
window.SnowlineAuth.request({ action: "sheet", sheetName })
```

That request includes the logged-in session token and is validated by Google Apps Script before any sheet data is returned.

## Authentication hardening applied

- Browser sessions are stored in `sessionStorage` instead of long-lived `localStorage`.
- Old `localStorage` login sessions are removed automatically on load.
- The dashboard refuses to unlock unless the login response includes both a token and a user object.
- Apps Script session lifetime was reduced from 720 hours to 8 hours.
- Apps Script now temporarily blocks an account after 5 failed login attempts for 15 minutes.
- The test-only `패밀리세일DB원본` sheet was added to the server-side allowed sheet list.

## Required deployment steps

1. Copy the updated `google-apps-script/Code.gs` into the Apps Script project.
2. Deploy a new Apps Script web app version.
3. Confirm `auth-config.js` still points to the new `/exec` URL if the deployment URL changed.
4. Make the source Google Sheet private or restricted so direct public sheet access is not possible.
5. Deploy the updated GitHub Pages files.
6. Test with a logged-out browser session:
   - Opening the dashboard should show the login screen.
   - Pressing login with an invalid password should not enter the dashboard.
   - Dashboard data should load only after a valid approved login.

## Optional IP restriction

If company-only network access is still required, put the site behind one of these:

- Cloudflare Access with company email or VPN policy
- Netlify traffic rules or WAF with company IP allowlist
- Internal reverse proxy reachable only through company VPN

This should be treated as an extra layer, not a replacement for login and server-side data authorization.
