# Build AURA Extension for Firefox
# Uses manifest-firefox.json

Write-Host "🌟 Building AURA Extension for Firefox..." -ForegroundColor Green

$buildDir = "build-firefox"
if (Test-Path $buildDir) {
    Remove-Item $buildDir -Recurse -Force
}
New-Item -ItemType Directory -Path $buildDir | Out-Null

# Files to include
$includeItems = @(
    "background.js",
    "content.js",
    "popup.html",
    "popup.js",
    "popup.css",
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

# Use Firefox manifest
Copy-Item "manifest-firefox.json" -Destination "$buildDir\manifest.json"
Write-Host "   ✓ manifest.json (Firefox version)" -ForegroundColor Gray

Write-Host ""
Write-Host "✅ Firefox build complete!" -ForegroundColor Green
Write-Host "📁 Location: $buildDir\" -ForegroundColor Yellow

