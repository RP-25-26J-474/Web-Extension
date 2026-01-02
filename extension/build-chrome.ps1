# Build AURA Extension for Chrome/Edge
# Uses manifest-chrome.json

Write-Host "🌟 Building AURA Extension for Chrome/Edge..." -ForegroundColor Green

$buildDir = "build-chrome"
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

# Use Chrome manifest
Copy-Item "manifest-chrome.json" -Destination "$buildDir\manifest.json"
Write-Host "   ✓ manifest.json (Chrome version)" -ForegroundColor Gray

Write-Host ""
Write-Host "✅ Chrome/Edge build complete!" -ForegroundColor Green
Write-Host "📁 Location: $buildDir\" -ForegroundColor Yellow

