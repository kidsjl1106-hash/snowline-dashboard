param(
  [string]$ProductionUrl = "https://kidsjl1106-hash.github.io/snowline-dashboard/",
  [string]$TestUrl = "https://kidsjl1106-hash.github.io/snowline-dashboard/test/",
  [string]$ApiUrl = "https://script.google.com/macros/s/AKfycbxlD1pK91_eovpcfhSt67elcnHZaf6z68vaUgp2NKL3nb40qsMk3wn2Nk5R4y-Z-aYx/exec"
)

$ErrorActionPreference = "Stop"

function Assert-Health {
  param(
    [bool]$Condition,
    [string]$Message
  )

  if (-not $Condition) {
    throw $Message
  }
}

function Invoke-HealthWebRequest {
  param([string]$Url)

  Invoke-WebRequest -Uri $Url -UseBasicParsing -MaximumRedirection 5 -TimeoutSec 25
}

function Test-DashboardPage {
  param(
    [string]$Name,
    [string]$Url,
    [bool]$Production
  )

  Write-Host "Checking $Name page: $Url"
  $response = Invoke-HealthWebRequest -Url $Url
  Assert-Health ($response.StatusCode -eq 200) "$Name page returned HTTP $($response.StatusCode)."

  $html = [string]$response.Content
  Assert-Health ($html.Contains("auth.js")) "$Name page does not reference auth.js."
  Assert-Health ($html.Contains("app.js")) "$Name page does not reference app.js."
  Assert-Health ($html.Contains("Content-Security-Policy")) "$Name page is missing CSP meta tag."
  Assert-Health ($html.Contains("Members")) "$Name page is missing member management markup."

  if ($Production) {
    Assert-Health (-not $html.Contains("Price Monitoring")) "Production page still contains price monitoring UI."
    Assert-Health (-not $html.Contains("Action Queue")) "Production page still contains action queue UI."
  }
}

function Test-StaticAsset {
  param([string]$Url)

  Write-Host "Checking static asset: $Url"
  $response = Invoke-HealthWebRequest -Url $Url
  Assert-Health ($response.StatusCode -eq 200) "Static asset failed: $Url"
  Assert-Health ($response.RawContentLength -gt 100) "Static asset response is unexpectedly small: $Url"
}

function Invoke-AuthApi {
  param([hashtable]$Payload)

  $body = $Payload | ConvertTo-Json -Compress -Depth 6
  Invoke-RestMethod -Uri $ApiUrl -Method Post -ContentType "text/plain;charset=utf-8" -Body $body -TimeoutSec 35
}

function Test-UnauthorizedApiBlock {
  Write-Host "Checking unauthorized API block"
  $response = Invoke-AuthApi -Payload @{
    action = "sheet"
    sheetName = "CS DB"
    token = "invalid-token"
  }

  Assert-Health (-not [bool]$response.ok) "Invalid token unexpectedly read sheet data."
}

function Test-OptionalAuthenticatedDataLoad {
  if (-not $env:SNOWLINE_HEALTH_USER -or -not $env:SNOWLINE_HEALTH_PASSWORD) {
    Write-Host "Skipping authenticated data check. Set SNOWLINE_HEALTH_USER and SNOWLINE_HEALTH_PASSWORD secrets to enable it."
    return
  }

  Write-Host "Checking authenticated data load"
  $login = Invoke-AuthApi -Payload @{
    action = "login"
    userId = $env:SNOWLINE_HEALTH_USER
    password = $env:SNOWLINE_HEALTH_PASSWORD
  }
  Assert-Health ([bool]$login.ok -and [bool]$login.token) "Health user login failed."

  $csRecords = Invoke-AuthApi -Payload @{
    action = "csRecords"
    token = $login.token
  }
  Assert-Health ([bool]$csRecords.ok -and $null -ne $csRecords.rows) "CS records API failed."

  $inventory = Invoke-AuthApi -Payload @{
    action = "inventorySummary"
    token = $login.token
  }
  Assert-Health ([bool]$inventory.ok -and $null -ne $inventory.products) "Inventory summary API failed."

  $sales = Invoke-AuthApi -Payload @{
    action = "salesSummary"
    token = $login.token
  }
  Assert-Health ([bool]$sales.ok -and $null -ne $sales.teams) "Sales summary API failed."
}

Test-DashboardPage -Name "Production" -Url $ProductionUrl -Production $true
Test-DashboardPage -Name "Test" -Url $TestUrl -Production $false

Test-StaticAsset -Url "$($ProductionUrl)auth-config.js?v=2026070301"
Test-StaticAsset -Url "$($ProductionUrl)auth.js?v=2026072002"
Test-StaticAsset -Url "$($ProductionUrl)app.js?v=2026072001"

Test-UnauthorizedApiBlock
Test-OptionalAuthenticatedDataLoad

Write-Host "Snowline dashboard health check passed."
