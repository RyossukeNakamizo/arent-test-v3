#!/bin/bash
# Hook: TaskCompleted - DEBUG log未記録チェック
echo "⚠ タスク完了前: 発生エラーは全て DEBUG-{NNN}.md に記録済みですか？"
echo "  KNOWN-ERRORS.md に昇格すべきパターンはありませんか？"
exit 2
