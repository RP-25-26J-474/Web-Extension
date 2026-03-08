# Build AURA Extension for Chrome

Write-Host "🌟 Building AURA Extension for Chrome/Edge..." -ForegroundColor Green

$buildDir = "build-chrome"
if (Test-Path $buildDir) {
    Remove-Item $buildDir -Recurse -Force
}
New-Item -ItemType Directory -Path $buildDir | Out-Null

# Files to include
$includeItems = @(
    "manifest.json",
    "background.js",
    "content.js",
    "popup.html",
    "popup.js",
    "popup.css",
    "env.js",
    "config.js",
    "config.module.js",
    "api-client.js",
    "interaction-aggregator.js",
    "icons",
    "LICENSE"
)

Write-Host "📦 Copying files..." -ForegroundColor Cyan
foreach ($item in $includeItems) {
    if (Test-Path $item) {
        Copy-Item $item -Destination $buildDir -Recurse -Force
        Write-Host "   ✓ $item" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "✅ Chrome/Edge build complete!" -ForegroundColor Green
Write-Host "📁 Location: $buildDir\" -ForegroundColor Yellow

