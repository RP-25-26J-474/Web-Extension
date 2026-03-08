# AURA Extension Build Script
# Creates a clean build folder without .git and development files

Write-Host "🌟 Building AURA Interaction Tracker Extension..." -ForegroundColor Green

# Create build directory
$buildDir = "build"
if (Test-Path $buildDir) {
    Remove-Item $buildDir -Recurse -Force
}
New-Item -ItemType Directory -Path $buildDir | Out-Null

# Files and folders to include
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

# Copy files
Write-Host "📦 Copying files..." -ForegroundColor Cyan
foreach ($item in $includeItems) {
    if (Test-Path $item) {
        Copy-Item $item -Destination $buildDir -Recurse -Force
        Write-Host "   ✓ $item" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "✅ Build complete!" -ForegroundColor Green
Write-Host "📁 Clean extension is in: $buildDir\" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  • Load '$buildDir' folder in Chrome (chrome://extensions/)" -ForegroundColor Gray
Write-Host "  • Or zip it for distribution: Compress-Archive -Path build\* -DestinationPath aura-extension.zip" -ForegroundColor Gray

