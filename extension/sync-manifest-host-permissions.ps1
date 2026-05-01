# Sync API host_permissions in manifest.json from env.js.
# Source of truth:
#   - API_BASE_URL
#   - ONBOARDING_GAME_BASE_URL
#   - ML_BASE_URL

param(
    [string]$ManifestPath = "manifest.json",
    [string]$EnvPath = "env.js"
)

function Get-MatchValue {
    param(
        [string]$Content,
        [string]$Name
    )
    $regex = "const\s+$Name\s*=\s*['""](?<value>[^'""]+)['""]"
    $m = [regex]::Match($Content, $regex)
    if ($m.Success) { return $m.Groups["value"].Value }
    return $null
}

function To-HostPermission {
    param([string]$Url)
    try {
        $uri = [Uri]$Url
        return "$($uri.Scheme)://$($uri.Host)/*"
    } catch {
        return $null
    }
}

if (!(Test-Path $ManifestPath)) {
    throw "Manifest not found: $ManifestPath"
}
if (!(Test-Path $EnvPath)) {
    throw "Env file not found: $EnvPath"
}

$envContent = Get-Content $EnvPath -Raw
$manifestObj = Get-Content $ManifestPath -Raw | ConvertFrom-Json

$apiUrl = Get-MatchValue -Content $envContent -Name "API_BASE_URL"
$onboardingUrl = Get-MatchValue -Content $envContent -Name "ONBOARDING_GAME_BASE_URL"
$mlUrl = Get-MatchValue -Content $envContent -Name "ML_BASE_URL"

$apiHostPermissions = @(
    (To-HostPermission -Url $apiUrl),
    (To-HostPermission -Url $onboardingUrl),
    (To-HostPermission -Url $mlUrl)
) | Where-Object { $_ } | Select-Object -Unique

$manifestObj.host_permissions = @("<all_urls>") + $apiHostPermissions

$manifestJson = $manifestObj | ConvertTo-Json -Depth 20
Set-Content -Path $ManifestPath -Value $manifestJson

Write-Host "Synced host_permissions from env.js:"
$manifestObj.host_permissions | ForEach-Object { Write-Host "  - $_" }
