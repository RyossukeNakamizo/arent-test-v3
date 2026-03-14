# リソースマップ

## 毎セッション必読
| リソース | パス |
|---------|------|
| 既知エラーDB | docs/debug-registry/KNOWN-ERRORS.md |
| タスク管理 | tasks/todo.md |
| Handoff | tasks/handoff-*.yaml（最新） |

## JIT参照
| リソース | パス | トリガー |
|---------|------|---------|
| SMP運用 | docs/references/smp-guide.md | デバッグ発生時 |
| チームスポーン | .claude/teams/team-spawn-prompt.md | チーム起動時 |
| Phase Gate | docs/references/phase-gate-guide.md | Phase遷移時 |
| Agent運用 | docs/references/agent-teams-guide.md | チーム構成判断時 |
| コンテキスト | docs/references/context-architecture.md | /compact前後 |
| ワークフロー | docs/references/workflow-guide.md | フロー確認時 |
| Hooks | docs/references/hooks-setup.md | Hook変更時 |
| Slash Commands vs Skills | docs/references/slash-commands-vs-skills.md | ワークフロー種別判断時 |
| ヒアリング | docs/references/hearing-guide.md | 設計開始時 |
| 回答不能時サポート | docs/references/support-guide.md | 「未定」回答検知時 |

## 設計資料
| リソース | パス |
|---------|------|
| アーキテクチャ図 | docs/designs/architecture.md |
| ER図 | docs/designs/er-diagram.md |
| API設計書 | docs/designs/api-design.md |
| シーケンス図 | docs/designs/sequence-diagrams.md |

## Subagent定義 (.claude/agents/)
supervisor(opus) / frontend-engineer(sonnet) / backend-engineer(sonnet) / qa(sonnet) / research(haiku)

## テンプレート (docs/templates/ — コピーして使用)
qcd-gate / design-note / implementation-confirmation / decision-record / debug-log / handoff-template
