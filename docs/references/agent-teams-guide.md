# エージェント運用ガイド

## モデルルーティング
| 役割 | Model | 理由 |
|------|-------|------|
| Supervisor | opus | 高度推論 |
| Frontend/Backend | sonnet | 実装は十分。速度・コスト効率 |
| QA | sonnet | テスト分類は中程度推論 |
| Research | haiku | Web検索は軽量で十分 |

## Subagents vs Agent Teams
- Subagents: 順次・単一領域・Lead報告で十分 → `.claude/agents/`
- Agent Teams: 並列協調・P2Pメッセージ・クロスレイヤー → `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
- 設計Phase→Subagents / 実装Phase→Agent Teams / QA→Subagents

## 全Agent共通
1. 作業前: CLAUDE.md + KNOWN-ERRORS.md  2. エラー: 即DEBUG  3. 完了: DEBUG件数報告
