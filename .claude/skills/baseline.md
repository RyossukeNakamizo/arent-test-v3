---
name: baseline
description: 全プロジェクト共通のClaude Code行動規範。複雑タスク開始時・アーキテクチャ判断時・Phase遷移時・デバッグ発生時に自動ロード。
---

## ワークフロー
1. **Plan優先**: 3ステップ以上はPlanモードで開始。実装前に仕様を書く
2. **Phase Gate×Git**: Phase完了→`git commit`→`git tag`→QCD Gate→CEO承認→次Phase
3. **SMP最重要**: デバッグ→即DEBUG記録→KNOWN-ERRORS必読→2回目は昇格→Hooks追加
4. **Agent戦略**: Subagents(通常)+AgentTeams(並列協調時)。全AgentがCLAUDE.md+KNOWN-ERRORSを読む
5. **Auto Memory**: 修正→自動記録。`#`→即時記録→次回CLAUDE.md反映提案
6. **検証必須**: 動作証明なしに完了マークしない。Checkpointing活用
7. **Hooks**: pre-tool(認証検出)→post-tool(format)→TeammateIdle/TaskCompleted

## コンテキスト保全
- 開始: CLAUDE.md→KNOWN-ERRORS.md→todo.md→handoff-*.yaml
- 残量40%→`/compact`→再読込。30往復超→Handoff即生成。終了時→handoff必須

## タスク管理
tasks/todo.md に計画→確認→実行→マーク→ドキュメント化

## コア原則
シンプル第一 / 根本原因追究 / 影響最小化 / 判断を必ず記録
