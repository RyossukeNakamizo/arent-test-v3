# docker-claude-code-patterns.md
## 用途：Docker Compose環境でのClaude Code運用時にJIT参照
## トリガー：docker-compose.yml生成時、コンテナ環境構築時、認証情報管理設計時

---

## 概要

Docker Compose環境でClaude Codeを運用する際に頻出する問題パターンとその解決策。
ヒアリング Phase 1 でDocker利用が判明した時点で、Phase 3 の生成物にこれらのパターンを織り込む。

---

## パターン1: コンテナ間ホスト名 vs ブラウザアクセスの分離

### 問題

docker-compose内のサービス間通信はDockerネットワーク内のサービス名（`db`, `storage` 等）を使う。
一方、ブラウザやホストマシンからのアクセスは `localhost` を使う。
`.env` に `localhost` と記載すると、コンテナ内からの接続が全て失敗する。

### 解決策: `.env` をDocker内向けに統一 + 外部向け変数を分離

```env
# ✅ コンテナ内通信用（docker-composeサービス名）
DB_HOST=db
CACHE_HOST=redis
BLOB_ENDPOINT=storage:9000

# ✅ ブラウザ/ホストマシンからのアクセス用（別変数として分離）
BLOB_EXTERNAL_ENDPOINT=localhost:9000
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

### CLAUDE.md/設計書への反映

```markdown
## 原則
- .env のホスト名はdocker-composeサービス名を使用する（localhost禁止）
- ブラウザ向けURLは `*_EXTERNAL_*` または `NEXT_PUBLIC_*` プレフィックスで分離
```

### Phase 3 生成時の適用

- `README.md` のDocker起動手順に `.env.example` → `.env` コピー手順を必ず記載
- `docs/references/` に本パターンへの参照を含める

---

## パターン2: Presigned URL のエンドポイント書き換え

### 問題

MinIO / S3互換ストレージでPresigned URLを生成する場合、
クライアントの接続先エンドポイントがURLのベースになる。
コンテナ内から `storage:9000` で接続していると、
Presigned URLも `http://storage:9000/bucket/key?...` になり、ブラウザからアクセス不可。

### 解決策: 生成後にホスト名を置換

```
環境変数:
  BLOB_ENDPOINT=storage:9000          ← コンテナ内接続用
  BLOB_EXTERNAL_ENDPOINT=localhost:9000  ← Presigned URL書き換え用

GetPresignedUrl() {
  url = client.PresignedGetObject(key)
  if (INTERNAL != EXTERNAL) {
    url = url.Replace(INTERNAL, EXTERNAL)
  }
  return url
}
```

### 代替案（大規模向け）

- Nginx リバースプロキシでMinIOをlocalhost経由に統一
- MinIOの `MINIO_SERVER_URL` 環境変数でPresigned URLのベースを明示指定

### 適用判断

| 条件 | 推奨方式 |
|------|---------|
| POC / 小規模 | URL書き換え（シンプル） |
| 本番 / マルチサービス | Nginx Proxy or `MINIO_SERVER_URL` |

---

## パターン3: 認証情報の安全な注入フロー

### 問題

外部サービスの認証情報（API Key / Secret / URN等）をプロジェクトで使う際:
- ソースコードにハードコードされるリスク
- `.env` に手動コピーする際のヒューマンエラー
- CI/CD環境での管理方法

### 解決策: secret.json → .env 自動注入 + Hooks ガードレール

#### ファイル構成

```
project-root/
├── .env.example      ← プレースホルダー値入り（リポジトリに含む）
├── .env              ← 実際の値入り（.gitignore で除外）
├── secret.json       ← 認証情報ソース（.gitignore で除外）
└── .claude/hooks/
    └── pre-tool-guard.sh  ← ハードコード自動検出・ブロック
```

#### 注入フロー

```
secret.json 配置（手動 or CI Secret）
    ↓
.env.example → .env コピー
    ↓
secret.json から値を読み取り .env のプレースホルダーを置換（自動）
    ↓
Hooks が .env 以外への認証情報書き込みを自動ブロック
```

#### スクリプト例（汎用）

```bash
# secret.json から .env への自動注入（jq使用版）
if command -v jq &> /dev/null && [ -f secret.json ]; then
  for key in $(jq -r 'keys[]' secret.json); do
    value=$(jq -r ".$key" secret.json)
    ENV_KEY=$(echo "$key" | sed 's/\([A-Z]\)/_\1/g' | tr '[:lower:]' '[:upper:]' | sed 's/^_//')
    sed -i '' "s|${ENV_KEY}=.*_here|${ENV_KEY}=${value}|" .env
  done
fi
```

```bash
# jq不使用版（grep + sed）
if [ -f secret.json ]; then
  CLIENT_ID=$(grep -o '"clientId"[[:space:]]*:[[:space:]]*"[^"]*"' secret.json | cut -d'"' -f4)
  CLIENT_SECRET=$(grep -o '"clientSecret"[[:space:]]*:[[:space:]]*"[^"]*"' secret.json | cut -d'"' -f4)
  sed -i '' "s|CLIENT_ID=your_client_id_here|CLIENT_ID=${CLIENT_ID}|" .env
  sed -i '' "s|CLIENT_SECRET=your_client_secret_here|CLIENT_SECRET=${CLIENT_SECRET}|" .env
fi
```

#### Hooks ガードレール（pre-tool-guard.sh への追加パターン）

```bash
# 認証情報ハードコード検出（Write|Edit ツール対象）
if echo "$TOOL_INPUT_RAW" | grep -qiE '(clientId|client_id|clientSecret|client_secret|api_key|apiKey)\s*[=:]\s*["'"'"'][A-Za-z0-9]{10,}'; then
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"認証情報のハードコードを検出。.env経由で読み込んでください。"}}' >&1
  exit 0
fi
```

### .gitignore 必須エントリ

```gitignore
.env
.env.local
.env.production
secret.json
*.key
*.pem
```

---

## パターン4: 実機検証付き作業指示書の構造

### 問題

Claude Codeへの作業指示が曖昧だと:
- 修正漏れ（問題は特定したが修正パッチが不完全）
- 検証なし完了（修正したが動作確認せず完了宣言）
- 手戻り（検証で失敗しても次ステップに進んでしまう）

### 解決策: 問題 → パッチ → 検証 → ゲートの4層構造

```markdown
## Step N: {問題名}（{Issue ID} 解消）

### N.1 問題の詳細
{何が壊れているか、なぜ壊れているかを具体的に記述}
{関連ファイル・行番号・エラーメッセージ}

### N.2 修正
{具体的なコード差分またはコマンド}
{複数ファイルにまたがる場合は依存順で記載}

### N.3 検証
{修正が正しいことを証明するコマンド}
{期待される出力}

### N.4 ゲート（次Stepへの進行条件）
{この条件を満たさない場合は次Stepに進まない}
```

### 分岐の扱い

```markdown
### N.1 判断基準
**パターンA**: {条件} → Step N の残りをスキップ、Step N+1 へ
**パターンB**: {条件} → 以下の修正を実行
```

### 最終チェックリスト（指示書末尾に必須）

```markdown
## 最終チェックリスト
| # | 項目 | 必須 | 状態 |
|---|------|------|------|
| 1 | {検証項目} | ✅ | ☐ |
```

---

## パターン5: .NET Preview / Node.js 最新版の Dockerイメージリスク

### 問題

Preview版のSDK/Runtimeイメージ（`dotnet/sdk:10.0-preview`, `node:23` 等）は:
- Docker Hubから予告なく削除・更新される
- ビルド時に突然失敗する
- CI/CD の再現性が保証されない

### 解決策: フォールバック戦略を設計書に明記

```markdown
## Dockerfile フォールバック戦略

### .NET
- 主系: dotnet/sdk:{latest-preview} + aspnet:{latest-preview}
- 副系: dotnet/sdk:{latest-stable} + aspnet:{latest-stable}
- 切替: csproj の TargetFramework + Dockerfile の FROM タグを同時変更

### Node.js
- 主系: node:{latest-lts}-alpine
- 副系: node:{previous-lts}-alpine
- 切替: Dockerfile の FROM タグのみ（package.jsonの engines は範囲指定）
```

### HEALTHCHECK のベースイメージ依存

| ベースイメージ | curl | wget | 推奨 |
|--------------|------|------|------|
| alpine系 | ❌ | ✅ | `wget --spider` |
| debian/ubuntu系 | ❌ | ✅ | `wget --spider` |
| distroless | ❌ | ❌ | アプリ内蔵 `/health` + `CMD` 不可 → `HEALTHCHECK` 削除、compose側で管理 |

```dockerfile
# 汎用 HEALTHCHECK（wget使用）
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1
```

---

## Phase 3 生成時の統合チェック

ヒアリングで Docker Compose 利用が判明した場合、以下を生成物に織り込む:

- [ ] `.env.example` のホスト名がdocker-composeサービス名になっているか
- [ ] ブラウザ向けURL用の `*_EXTERNAL_*` 変数が分離されているか
- [ ] Presigned URL等の外部向けURL生成でホスト名書き換えが設計されているか
- [ ] `secret.json` → `.env` の注入フローが README に記載されているか
- [ ] `pre-tool-guard.sh` に認証情報ハードコード検出パターンが含まれているか
- [ ] `.gitignore` に `.env` / `secret.json` / `*.key` が含まれているか
- [ ] Preview版イメージ使用時のフォールバック戦略が設計書に明記されているか
- [ ] HEALTHCHECK がベースイメージで利用可能なコマンドを使用しているか
- [ ] 作業指示書が「問題→パッチ→検証→ゲート」の4層構造になっているか
