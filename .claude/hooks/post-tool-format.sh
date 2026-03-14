#!/bin/bash
# Hook: PostToolUse (Write|Edit) - 自動フォーマット
# stdin から JSON を受け取り、変更されたファイルパスを取得してフォーマット
set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null || echo "")

if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

case "$FILE_PATH" in
  frontend/*.ts|frontend/*.tsx|frontend/*.js|frontend/*.jsx)
    npx --prefix frontend prettier --write "$FILE_PATH" 2>/dev/null || true
    ;;
  backend/*.cs)
    dotnet format backend/ --include "$FILE_PATH" 2>/dev/null || true
    ;;
esac

exit 0
