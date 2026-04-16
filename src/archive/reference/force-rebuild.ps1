cd C:\dev\holy-quest-ai

Get-Process Code -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 3

Remove-Item -Recurse -Force "$env:APPDATA\Code\Cache" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:APPDATA\Code\CachedData" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:APPDATA\Code\CachedExtensions" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:APPDATA\Code\Code Cache" -ErrorAction SilentlyContinue

Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue

$lineCount = (Get-Content src\extension.ts).Count
Write-Host "Extension.ts has $lineCount lines"

if ((Get-Content src\extension.ts -Raw) -match "marked") {
    Write-Host "Extension.ts contains markdown library" -ForegroundColor Green
} else {
    Write-Host "Extension.ts missing markdown code" -ForegroundColor Red
    exit
}

Write-Host "Building..." -ForegroundColor Yellow
npm run compile

if ((Get-Content dist\extension.js -Raw) -match "marked") {
    Write-Host "Build contains markdown library" -ForegroundColor Green
} else {
    Write-Host "Build missing markdown" -ForegroundColor Red
    exit
}

$size = (Get-Item dist\extension.js).Length / 1KB
Write-Host "Build size: $size KB"

Write-Host "Build complete!" -ForegroundColor Green
Write-Host "Now run: code ." -ForegroundColor Yellow
Write-Host "Then press F5" -ForegroundColor Yellow