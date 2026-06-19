param(
  [string]$OutputZip = "snowline-dashboard-security-20260619.zip"
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$codeFiles = @(
  "app.js",
  "auth.js",
  "google-apps-script\Code.gs",
  "Code-for-Apps-Script.txt",
  "Code-for-Apps-Script-compact.txt",
  "release\test\app.js",
  "release\test\auth.js"
)

$forbiddenPatterns = @(
  "docs\.google\.com/spreadsheets",
  "gviz/tq",
  "PUBLIC_SHEET_JSONP_BASE_URL",
  "loadSheetJsonp",
  "tableToRows",
  "localStorage\.setItem\(sessionKey",
  "sessionHours: 720"
)

Write-Host "SNOWLINE security deployment preflight" -ForegroundColor Cyan

foreach ($file in $codeFiles) {
  if (!(Test-Path -LiteralPath $file)) {
    throw "Missing required file: $file"
  }
}

foreach ($pattern in $forbiddenPatterns) {
  $matches = Select-String -Path $codeFiles -Pattern $pattern -ErrorAction SilentlyContinue
  if ($matches) {
    $matches | ForEach-Object {
      Write-Host ("Forbidden pattern found: {0}:{1} {2}" -f $_.Path, $_.LineNumber, $_.Line) -ForegroundColor Red
    }
    throw "Security preflight failed."
  }
}

$requiredChecks = @{
  "app.js" = 'SnowlineAuth.request({ action: "sheet", sheetName })'
  "auth.js" = "sessionStorage.setItem(sessionKey"
  "google-apps-script\Code.gs" = "LOGIN_ATTEMPT_LIMIT"
  "Code-for-Apps-Script.txt" = "sessionHours: 8"
  "release\test\app.js" = 'SnowlineAuth.request({ action: "sheet", sheetName })'
  "release\test\auth.js" = "sessionStorage.setItem(sessionKey"
}

foreach ($entry in $requiredChecks.GetEnumerator()) {
  $found = Select-String -Path $entry.Key -Pattern ([regex]::Escape($entry.Value)) -SimpleMatch:$false -ErrorAction SilentlyContinue
  if (!$found) {
    throw "Required security marker not found in $($entry.Key): $($entry.Value)"
  }
}

$packageFiles = @(
  "index.html",
  "app.js",
  "styles.css",
  "auth-config.js",
  "auth.css",
  "auth.js",
  "_headers",
  "netlify.toml",
  "copy-apps-script.html",
  "Code-for-Apps-Script.txt",
  "Code-for-Apps-Script-compact.txt",
  "AUTH_SETUP.md",
  "README.md"
)

$packageDirs = @(
  "assets",
  "google-apps-script",
  "release",
  "docs",
  ".github"
)

$tempDir = Join-Path $Root ".security-package"
if (Test-Path -LiteralPath $tempDir) {
  Remove-Item -LiteralPath $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempDir | Out-Null

foreach ($file in $packageFiles) {
  if (Test-Path -LiteralPath $file) {
    Copy-Item -LiteralPath $file -Destination (Join-Path $tempDir $file) -Force
  }
}

foreach ($dir in $packageDirs) {
  if (Test-Path -LiteralPath $dir) {
    Copy-Item -LiteralPath $dir -Destination (Join-Path $tempDir $dir) -Recurse -Force
  }
}

$zipPath = Join-Path $Root $OutputZip
if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

Compress-Archive -Path (Join-Path $tempDir "*") -DestinationPath $zipPath -Force
Remove-Item -LiteralPath $tempDir -Recurse -Force

Write-Host "Security package created:" -ForegroundColor Green
Write-Host $zipPath
Write-Host ""
Write-Host "Manual external steps still required:" -ForegroundColor Yellow
Write-Host "1. Paste google-apps-script\Code.gs into Apps Script and deploy a new web app version."
Write-Host "2. Restrict Google Sheet sharing to selected accounts only."
Write-Host "3. Push/deploy these files to GitHub Pages."
