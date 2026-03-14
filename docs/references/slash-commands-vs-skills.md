# Slash Commands vs Skills：使い分け

## 比較

| 観点 | Slash Commands | Skills |
|------|---------------|--------|
| 定義場所 | `.claude/commands/*.md` | `.claude/skills/*.md`（YAMLフロントマター） |
| トリガー | ユーザーが `/コマンド名` で明示呼び出し | description にマッチ時に Claude が自動ロード |
| 用途 | 定型ワークフロー（PRレビュー等） | 行動規範・判断基準（JIT参照） |

## このプロジェクトでの使い分け

| ファイル | 種別 | 呼び出し方 |
|---------|------|----------|
| `.claude/skills/baseline.md` | Skill | 自動ロード（複雑タスク・アーキテクチャ判断時） |
| `.claude/commands/review-pr.md`（任意追加） | Command | `/review-pr` で手動呼び出し |

## 判断基準

- 「ユーザーが明示的に呼び出す」→ Slash Command
- 「Claude が文脈判断で自動適用」→ Skill
