# Hooks設定ガイド

## Hook一覧

| イベント | マッチャー | スクリプト | 動作 |
|---------|----------|----------|------|
| PreToolUse | Write\|Edit\|Bash | pre-tool-guard.sh | APS認証ハードコード検出・危険コマンドブロック → deny |
| PostToolUse | Write\|Edit | post-tool-format.sh | prettier / dotnet format 自動実行 |
| TeammateIdle | （全発火） | teammate-idle-check.sh | KNOWN-ERRORS未読 → exit 2 差し戻し |
| TaskCompleted | （全発火） | task-completed-check.sh | DEBUG未記録 → exit 2 ブロック |

## settings.json フォーマット（正式）

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|Bash",
        "hooks": [
          { "type": "command", "command": ".claude/hooks/pre-tool-guard.sh" }
        ]
      }
    ]
  }
}
```

重要: matcher group → hooks 配列 → hook handler（type + command）の3層ネスト。
TeammateIdle / TaskCompleted は matcher 不要（全イベントで発火）。

## pre-tool-guard.sh の仕組み

- Claude Code が stdin に JSON を渡す: `{"tool_name": "Bash", "tool_input": {"command": "..."}}`
- `jq` で tool_name / tool_input を取得し、パターンマッチで検査
- deny 時は JSON `permissionDecision: "deny"` を stdout に出力 + exit 0
- exit 2 = ブロック（stderr が Claude にフィードバック）

## KNOWN-ERRORS昇格時の対応

1. KNOWN-ERRORS.md にパターン追加
2. pre-tool-guard.sh に grep 検出パターン追加
3. テスト: `echo '{"tool_name":"Write","tool_input":{"content":"clientSecret=ABC123"}}' | .claude/hooks/pre-tool-guard.sh`

## 設定反映タイミング

Claude Code はセッション開始時に hooks をスナップショットする。
settings.json 変更後は `/hooks` コマンドでレビュー → 新セッションで反映。
