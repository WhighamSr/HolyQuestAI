# HOLY QUEST AI — CLEAN ARCHITECTURE PLAN
Generated: April 12, 2026

## Audit Summary
- Total files found in src: 30
- Backup/compiled files archived: 28
- Primary working files remaining: 4

## Primary Working Files (Active)
| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| src/extension.ts | Main entry point, webview, API calls | 498 | Needs Splitting |
| src/agents/AgentCoordinator.ts | Multi-agent orchestration | 100 | Active |
| src/system/constants.ts | System prompts and constants | 32 | Active |
| src/types/agents.ts | TypeScript type definitions | 32 | Active |

## Files Archived

### archive/compiled/ (18 files)
- extension.js
- extension.js.map
- extension.OLD.js
- extension.OLD.js.map
- extension.backup.js
- extension.backup.js.map
- extension_backup_needMemory.js
- extension_backup_needMemory.js.map
- extension_ENHANCED.js
- extension_ENHANCED.js.map
- extension backup 2 with beautiful ui.js
- extension backup 2 with beautiful ui.js.map
- AgentCoordinator.js
- AgentCoordinator.js.map
- constants.js
- constants.js.map
- agents.js
- agents.js.map

### archive/old-versions/ (9 files)
- extension.OLD.ts
- extension.backup.ts
- extension.ts.backup
- extension.ts.backup-20251127-024733
- extension.ts.broken
- extension.ts.old-backup
- extension_backup_needMemory.ts
- extension_ENHANCED.ts
- extension backup 2 with beautiful ui.ts

### archive/reference/ (1 file)
- USE AGENTS  RETURNED.txt

## Target Clean Architecture
```
src/
├── extension.ts              (entry point only, max 100 lines)
├── types/
│   ├── agents.ts             (agent types - existing)
│   └── index.ts              (shared types - new)
├── agents/
│   ├── AgentCoordinator.ts   (existing - refactor)
│   ├── analyst.ts            (new - split from coordinator)
│   ├── mobileExpert.ts       (new - split from coordinator)
│   └── qualityEngineer.ts    (new - split from coordinator)
├── memory/
│   └── conversationStore.ts  (new - persistent memory)
├── webview/
│   ├── panel.ts              (new - webview manager)
│   ├── html/
│   │   └── chat.html         (new - extracted from extension.ts)
│   ├── css/
│   │   └── styles.css        (new - extracted from extension.ts)
│   └── js/
│       └── chat.js           (new - extracted from extension.ts)
├── utils/
│   ├── tokenCounter.ts       (new - extracted from extension.ts)
│   ├── errorHandler.ts       (new - retry logic)
│   └── fileOperations.ts     (new - workspace file ops)
├── system/
│   └── constants.ts          (existing - keep)
└── archive/
    ├── compiled/             (archived .js files)
    ├── old-versions/         (archived backup .ts files)
    └── reference/            (archived .txt files)
```

## Build Order for Prompt 2+

### Phase 1 - Foundation (Prompts 2-5):
1. Extract webview HTML/CSS/JS from extension.ts
2. Create persistent memory system
3. Implement error handling with retry logic
4. Clean up extension.ts entry point

### Phase 2 - Agent Enhancement (Prompts 6-9):
5. Split agents into individual files
6. Implement SharedMemory for agents
7. Add Divine Council debate system
8. Add agent confidence scoring

### Phase 3 - Competitive Features (Prompts 10-14):
9. Workspace intelligence (file reading)
10. Apply to File with diff preview
11. Stop generation capability
12. Multi-image support
13. Codebase Cartographer

### Phase 4 - Surpassing Features (Prompts 15-20):
14. Project Brain knowledge graph
15. Quest Mode gamification
16. Prophecy Mode
17. Sentinel security scanner
18. Voice of God Mode (ElevenLabs)
19. Ministry Mode (team deployment)

## Protected Files Registry
SHA256 hashes generated at start of this session:

| File | Hash |
|------|------|
| package.json | C398BF0D68F3531B8017DE1EE930E06D65B1FC521F4A68D19005A951C451D267 |
| package-lock.json | A05A018DCC24850BE4AB8FE898C8C1CA0AB4FF143C1B40DA482AD1FCFE75F680 |
| tsconfig.json | 08E30EB07E0E90C52958E69B3F126005B88335F662CC0B839B26EEB5F2F550CD |
| .vscodeignore | 9879C650B1C1E61C0186F90CAA9F289BB88B506E4687EF151C81A13F076516A1 |
