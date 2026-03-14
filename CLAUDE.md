# CLAUDE.md

APS Viewer × 施工現場向け指摘管理ツール。BIM 3D上にピン配置＋指摘写真管理。
Stack: Next.js + .NET 10 + PostgreSQL + MinIO + Docker Compose

## 原則
- DDD・レイヤー分離・CQRS。設計ドキュメント（Mermaid図）を実装前に作成
- APS 2-legged OAuth は Token Proxy（Backend経由）。Secretフロント露出禁止
- Blob整合性: MinIO先行→DB後続。dbId＋worldPosition両対応

## 禁止事項
- APS認証情報ハードコード（`.env`必須）
- 設計書なし実装 / 確認書なし完了 / QCD Gate未通過のPhase遷移
- 既知エラー再発（KNOWN-ERRORS.md記載問題の繰り返し）
- Hooks自動拒否 → `.claude/hooks/`

## SMP ← 最重要
デバッグ→即DEBUG記録→2回目はKNOWN-ERRORS昇格→Hooks追加
全Agent実装前にKNOWN-ERRORS必読 → `docs/references/smp-guide.md`

## Phase Gate
完了→`git commit`→`git tag phase-{N}-{name}`→QCD→CEO承認→次Phase
詳細 → `docs/references/phase-gate-guide.md`

## エージェント
Subagents: supervisor(opus), frontend/backend/qa(sonnet), research(haiku)
Agent Teams（並列時）→ `docs/references/agent-teams-guide.md`

## コンテキスト保全
開始: CLAUDE.md→KNOWN-ERRORS→todo→handoff読込 / 残量40%: /compact→再読込
30往復超: Handoff即生成 / 終了: handoff-{date}.yaml必須 / JIT原則

## リソース（JIT）
全マップ→`docs/references/resource-map.md` / 必読: KNOWN-ERRORS + todo.md
設計判断: ADR-{NNN}.md / デバッグ: DEBUG-{NNN}.md / 共通規範: /baseline

## 管理
原則のみ記載。手順はdocs/外部化。更新はCEO承認後。禁止事項変更→Hooks同期

## 更新履歴
| 日付 | 更新内容 | 承認者 |
|------|---------|--------|
| 2026-03-14 | 初版（SMP+Subagents+AgentTeams+PhaseGate+QCD+Handoff） | CEO |
