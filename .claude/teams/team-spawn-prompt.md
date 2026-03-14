# Agent Teams スポーンプロンプト

> 前提: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` / v2.1.32+ / Opus 4.6+

## 実装Phase用チーム（メイン利用）

```
Create an agent team for the APS Viewer issue management tool.
Team name: arent-impl

CRITICAL - Before ANY work, every teammate MUST read:
1. CLAUDE.md  2. docs/debug-registry/KNOWN-ERRORS.md  3. tasks/todo.md

Teammate "backend" - .NET 10 Backend:
- Domain layer, API endpoints, MinIO, APS Token Proxy
- ONLY modify backend/. Branch: feature/backend-{task}
- After EVERY debug: write docs/debug-registry/DEBUG-{NNN}.md IMMEDIATELY

Teammate "frontend" - Next.js Frontend:
- APS Viewer v7, pin UI, issue form, photo upload, list
- Token Proxy: call backend /api/aps/token, NEVER use Secret directly
- ONLY modify frontend/. Branch: feature/frontend-{task}
- After EVERY debug: write docs/debug-registry/DEBUG-{NNN}.md IMMEDIATELY

Teammate "qa" - Quality Assurance:
- Run tests, Docker validation, API verification
- Report top 10 issues by priority to Lead
- Every bug → DEBUG-{NNN}.md. Same pattern twice → flag SMP violation

Coordinate API contract through messaging. Lead manages Phase Gate.
```

## コンテキスト分離ルール
| Teammate | 変更可能 | 読取可能 |
|----------|---------|---------|
| Lead | docs/, tasks/, .claude/ | 全て |
| backend | backend/, docs/decisions/, docs/debug-registry/ | 全て |
| frontend | frontend/, docs/decisions/, docs/debug-registry/ | 全て |
| qa | backend/tests/, docs/debug-registry/ | 全て |
