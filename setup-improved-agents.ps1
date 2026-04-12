# Holy Quest AI - Improved Agent System Setup
# This script automates the entire upgrade process

Write-Host "🚀 Holy Quest AI - Agent System Upgrade" -ForegroundColor Cyan
Write-Host "=========================================`n" -ForegroundColor Cyan

$ErrorActionPreference = "Stop"

# 1. Create necessary directories
Write-Host "📁 Creating directory structure..." -ForegroundColor Yellow
$dirs = @(
    "src\agents",
    "src\system",
    "src\types"
)

foreach ($dir in $dirs) {
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "   ✅ Created $dir" -ForegroundColor Green
    }
}

# 2. Create PROJECT_CONTEXT.md in game project
Write-Host "`n📄 Creating PROJECT_CONTEXT.md..." -ForegroundColor Yellow
$contextPath = "C:\dev\holy-fact-quest\PROJECT_CONTEXT.md"
$contextContent = @'
# HOLY FACT QUEST - PROJECT CONTEXT

## 🎯 CRITICAL FACTS (Read before ANY action)

### PROJECT TYPE
- **React Native mobile app** (iOS/Android)
- **Expo framework** SDK ~51.0
- **TypeScript**
- **NOT a web app!**

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