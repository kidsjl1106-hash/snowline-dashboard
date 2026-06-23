# Canonical Domain

## Fixed Production URL

The fixed production dashboard URL is:

```text
https://kidsjl1106-hash.github.io/snowline-dashboard/
```

Do not change the production domain during routine program updates, feature changes, Apps Script changes, or cache-busting changes.

## Custom Domain Policy

Do not add a `CNAME` file or switch production to `www.snowline-dashboard.co.kr` unless all of the following are true:

- DNS for `www.snowline-dashboard.co.kr` resolves correctly.
- The user explicitly approves switching the canonical production URL.
- GitHub Pages is verified to serve the site on the custom domain.

Until then, keep the GitHub Pages URL above as the single source of truth.

## Cache Busting

Query strings such as `?v=...`, `?refresh=...`, or script versions may be used for cache busting, but they must not be treated as a domain or canonical URL change.
