#!/bin/bash
# Hook: PreToolUse (Write|Edit|Bash)
# APS認証情報ハードコード検出 + 危険コマンドブロック
# Claude Code は JSON を stdin で渡す。$CLAUDE_TOOL_INPUT も利用可能。
set -euo pipefail

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null || echo "")
TOOL_INPUT_RAW=$(echo "$INPUT" | jq -r '.tool_input | tostring' 2>/dev/null || echo "")

# --- 危険コマンドブロック（Bash ツール） ---
if [ "$TOOL_NAME" = "Bash" ]; then
  COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || echo "")

  # rm -rf / 破壊的コマンド検出
  if echo "$COMMAND" | grep -qiE 'rm\s+(-[a-zA-Z]*[rRf]|--recursive|--force)'; then
    echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"破壊的コマンド(rm -rf等)は禁止です。Finder操作またはcpを使用してください。"}}' >&1
    exit 0
  fi

  # .env / secret.json の外部送信検出
  if echo "$COMMAND" | grep -qiE '(curl|wget|nc).*\.(env|secret)'; then
    echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"認証情報ファイルの外部送信は禁止です。"}}' >&1
    exit 0
  fi
fi

# --- APS認証情報ハードコード検出（Write|Edit ツール） ---
if [ "$TOOL_NAME" = "Write" ] || [ "$TOOL_NAME" = "Edit" ] || [ "$TOOL_NAME" = "MultiEdit" ]; then
  if echo "$TOOL_INPUT_RAW" | grep -qiE '(clientId|client_id|clientSecret|client_secret)\s*[=:]\s*["'"'"'][A-Za-z0-9]{10,}'; then
    echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"APS認証情報のハードコードを検出しました。.env経由で読み込んでください。"}}' >&1
    exit 0
  fi

  if echo "$TOOL_INPUT_RAW" | grep -qiE 'urn:adsk\.(objects|wipprod|wipstg)'; then
    echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"APS URNのハードコードを検出しました。.env経由で読み込んでください。"}}' >&1
    exit 0
  fi
fi

exit 0
