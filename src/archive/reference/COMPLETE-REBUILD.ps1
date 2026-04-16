#Requires -Version 5.1
<#
.SYNOPSIS
    Complete rebuild of Holy Quest AI extension with improved agent system
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

Write-Host @"
╔══════════════════════════════════════════════════════════════╗
║     🔧 HOLY QUEST AI - COMPLETE AGENT SYSTEM REBUILD        ║
╚══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

$confirm = Read-Host "`nThis will modify your extension. Continue? (y/N)"
if ($confirm -ne 'y' -and $confirm -ne 'Y') {
    Write-Host "Cancelled." -ForegroundColor Red
    exit
}

# ============================================================================
# VERIFY ENVIRONMENT
# ============================================================================

Write-Host "`n[1/10] 🔍 Verifying environment..." -ForegroundColor Cyan

$extensionPath = "C:\dev\holy-quest-ai"
$gamePath = "C:\dev\holy-fact-quest"

if (!(Test-Path $extensionPath)) {
    Write-Host "❌ Extension path not found: $extensionPath" -ForegroundColor Red
    exit 1
}

if (!(Test-Path $gamePath)) {
    Write-Host "❌ Game project not found: $gamePath" -ForegroundColor Red
    exit 1
}

Set-Location $extensionPath
Write-Host "   ✅ Environment verified" -ForegroundColor Green

# ============================================================================
# CREATE BACKUP
# ============================================================================

Write-Host "`n[2/10] 💾 Creating backup..." -ForegroundColor Cyan

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = "BACKUP-$timestamp"

if (Test-Path "src") {
    Copy-Item -Path "src" -Destination $backupDir -Recurse -Force
    Write-Host "   ✅ Backup: $backupDir" -ForegroundColor Green
}

# ============================================================================
# CREATE DIRECTORIES
# ============================================================================

Write-Host "`n[3/10] 📁 Creating directories..." -ForegroundColor Cyan

$directories = @(
    "src\agents",
    "src\system",
    "src\types",
    "src\utils"
)

foreach ($dir in $directories) {
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "   ✅ Created $dir" -ForegroundColor Green
    }
}

# ============================================================================
# CREATE PROJECT_CONTEXT.md
# ============================================================================

Write-Host "`n[4/10] 📄 Creating PROJECT_CONTEXT.md..." -ForegroundColor Cyan

$contextPath = Join-Path $gamePath "PROJECT_CONTEXT.md"

# Use here-string with proper escaping
$contextContent = @'
# HOLY FACT QUEST - PROJECT CONTEXT

## CRITICAL FACTS (Read before ANY action)

### PROJECT TYPE
- React Native mobile app (iOS/Android)
- Expo framework SDK ~51.0
- TypeScript
- NOT a web app!

### TECHNOLOGY STACK
```json
{
  "mobile": "React Native 0.74.5",
  "framework": "Expo",
  "language": "TypeScript",
  "state": "Zustand",
  "navigation": "React Navigation",
  "storage": "AsyncStorage",
  "multiplayer": "Socket.io (optional)",
  "ads": "Google Mobile Ads"
}