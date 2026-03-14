# Claude Code 作業指示書: arent-test-v3 最終仕上げ

**作成日**: 2026-03-14
**プロジェクト**: `/Users/ryosukenakamizo/Desktop/arent-test-v3`
**配置先**: プロジェクトルート直下（`claude-code-work-instructions.md`）
**目的**: QA v2修正済みコードベースを `docker compose up --build` で完全動作する提出品質に仕上げる

---

## 現状サマリー

**完了済み**:
- QA v1(10件) + v2(5件新規)指摘のうち P1-NEW-1 / P2-NEW-2 / P2-NEW-3 → **コード反映済み・検証完了**
- 設計ドキュメント（README 317行 / Mermaid図6本 / API設計10エンドポイント）→ **完成済み**
- Claude Code環境（CLAUDE.md / baseline.md / Hooks / Agents）→ **整備済み**

**本指示書で解消する残存問題（5件）**:

| # | 問題 | 重要度 | 発見経緯 |
|---|------|--------|---------|
| R1 | `.env.example` のホスト名がDocker内通信に非対応 | **CRITICAL** | コード検証で新規発見 |
| R2 | Presigned URLがコンテナ内ホスト名で生成される | **CRITICAL** | コード検証で新規発見 |
| R3 | .NET 10 Preview Dockerイメージの可用性リスク | HIGH | QA v2 P2-EXISTING |
| R4 | backend HEALTHCHECK が curl 依存（aspnetイメージに未搭載） | HIGH | QA v2 P3-NEW-5 |
| R5 | Tailwind CSS設定ファイル不在 | LOW | QA v2 P3-NEW-4 |

---

## ⚠️ 絶対遵守事項

- **破壊的コマンド絶対禁止**: `rm -rf` 等は使用しない。ファイル操作は `cp` コマンドのみ
- **設計書なし実装禁止**: 修正はこの指示書に記載された範囲のみ
- **修正完了後に報告**: CLAUDE.md / README / docs/ を変更した場合は承認確認

---

## Step 1: Docker コンテナ間通信の修正 + `.env` 作成（R1 解消）

### 1.1 問題の詳細

`.env.example` では以下のようにホスト名が `localhost` になっている:

```
POSTGRES_HOST=localhost
MINIO_ENDPOINT=localhost:9000
```

`docker compose` 環境では、backendコンテナからDBやMinIOへの接続はDockerネットワーク内のサービス名（`db`, `storage`）を使う必要がある。`localhost` ではコンテナ自身を指すため接続失敗する。

### 1.2 修正: `.env.example` を更新

```env
# APS（Autodesk Platform Services）
APS_CLIENT_ID=your_client_id_here
APS_CLIENT_SECRET=your_client_secret_here
APS_MODEL_URN=your_model_urn_here

# PostgreSQL（docker-compose内サービス名で接続）
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=issue_manager
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# MinIO（docker-compose内サービス名で接続）
MINIO_ENDPOINT=storage:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=issue-photos
MINIO_USE_SSL=false

# Backend
BACKEND_PORT=5000
ASPNETCORE_ENVIRONMENT=Development

# Frontend（ブラウザからアクセスするためlocalhost）
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

### 1.3 `secret.json` の確認

プロジェクトルートに `secret.json` が配置されている。APS認証情報（clientId / clientSecret / urn）が格納されている。

```bash
# secret.json の存在確認
cat secret.json
```

期待される内容:
```json
{
  "clientId": "...",
  "clientSecret": "...",
  "urn": "..."
}
```

※ `secret.json` は `.gitignore` に含まれており、リポジトリには含まれない。

### 1.4 `.env` ファイル作成 + APS認証情報の自動反映

```bash
# .env.example をベースに .env を作成
cp .env.example .env

# secret.json から APS 認証情報を読み取って .env に反映
APS_ID=$(cat secret.json | grep -o '"clientId"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
APS_SECRET=$(cat secret.json | grep -o '"clientSecret"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
APS_URN=$(cat secret.json | grep -o '"urn"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)

# .env 内のプレースホルダーを実際の値に置換
sed -i '' "s|APS_CLIENT_ID=your_client_id_here|APS_CLIENT_ID=${APS_ID}|" .env
sed -i '' "s|APS_CLIENT_SECRET=your_client_secret_here|APS_CLIENT_SECRET=${APS_SECRET}|" .env
sed -i '' "s|APS_MODEL_URN=your_model_urn_here|APS_MODEL_URN=${APS_URN}|" .env
```

**検証**: .env に認証情報が正しく入ったか確認:
```bash
grep "^APS_" .env
# 期待: 3行とも your_..._here ではなく実際の値が入っていること
```

⚠️ **注意**: `.env` に認証情報を書き込むのは正当な操作。ただしソースコードへのハードコードは `pre-tool-guard.sh` が自動ブロックする。

### 1.5 `.env` が `.gitignore` に含まれていることを確認

```bash
grep "^\.env$" .gitignore
# 出力: .env → OK
grep "^secret\.json$" .gitignore
# 出力: secret.json → OK
```

---

## Step 2: Presigned URL エンドポイント問題の修正（R2 解消）

### 2.1 問題の詳細

`MinioBlobStorage` は DI で注入された `IMinioClient` を使って Presigned URL を生成する。
MinIOクライアントの接続先が `storage:9000`（Docker内サービス名）の場合、生成される Presigned URL も `http://storage:9000/issue-photos/issues/xxx/photos/yyy?...` になる。

この URL はブラウザ（ホストマシン）からはアクセスできない。ブラウザからは `http://localhost:9000/...` でアクセスする必要がある。

### 2.2 修正方針

**Presigned URL のホスト名を書き換える**。環境変数 `MINIO_EXTERNAL_ENDPOINT` を追加し、Presigned URL 生成時にホスト名を置換する。

### 2.3 修正: `.env.example` と `.env` に環境変数追加

```bash
# .env.example に追記
echo '' >> .env.example
echo '# MinIO外部アクセス用（Presigned URL書き換え用。ブラウザからのアクセスに使用）' >> .env.example
echo 'MINIO_EXTERNAL_ENDPOINT=localhost:9000' >> .env.example

# .env にも同様に追記
echo '' >> .env
echo 'MINIO_EXTERNAL_ENDPOINT=localhost:9000' >> .env
```

### 2.4 修正: `backend/src/Infrastructure/BlobStorage/MinioBlobStorage.cs`

```csharp
using Minio;
using Minio.DataModel.Args;
using IssueManager.Api.Application.Interfaces;

namespace IssueManager.Api.Infrastructure.BlobStorage;

public class MinioBlobStorage : IBlobStorage
{
    private readonly IMinioClient _client;
    private readonly string _bucket;
    private readonly string? _internalEndpoint;
    private readonly string? _externalEndpoint;

    public MinioBlobStorage(IMinioClient client, IConfiguration config)
    {
        _client = client;
        _bucket = config["MINIO_BUCKET"] ?? "issue-photos";
        _internalEndpoint = config["MINIO_ENDPOINT"];
        _externalEndpoint = config["MINIO_EXTERNAL_ENDPOINT"];
    }

    public async Task EnsureBucketAsync(CancellationToken ct = default)
    {
        var exists = await _client.BucketExistsAsync(
            new BucketExistsArgs().WithBucket(_bucket), ct);
        if (!exists)
        {
            await _client.MakeBucketAsync(
                new MakeBucketArgs().WithBucket(_bucket), ct);
        }
    }

    public async Task<string> UploadAsync(string key, Stream content, string contentType, CancellationToken ct = default)
    {
        await _client.PutObjectAsync(new PutObjectArgs()
            .WithBucket(_bucket)
            .WithObject(key)
            .WithStreamData(content)
            .WithObjectSize(content.Length)
            .WithContentType(contentType), ct);
        return key;
    }

    public async Task<Stream> DownloadAsync(string key, CancellationToken ct = default)
    {
        var ms = new MemoryStream();
        await _client.GetObjectAsync(new GetObjectArgs()
            .WithBucket(_bucket)
            .WithObject(key)
            .WithCallbackStream(stream => stream.CopyTo(ms)), ct);
        ms.Position = 0;
        return ms;
    }

    public async Task DeleteAsync(string key, CancellationToken ct = default)
    {
        await _client.RemoveObjectAsync(new RemoveObjectArgs()
            .WithBucket(_bucket)
            .WithObject(key), ct);
    }

    public async Task<string> GetPresignedUrlAsync(string key, int expirySeconds = 3600, CancellationToken ct = default)
    {
        var url = await _client.PresignedGetObjectAsync(new PresignedGetObjectArgs()
            .WithBucket(_bucket)
            .WithObject(key)
            .WithExpiry(expirySeconds));

        // Docker内サービス名 → 外部アクセス用ホスト名に書き換え
        if (!string.IsNullOrEmpty(_internalEndpoint) &&
            !string.IsNullOrEmpty(_externalEndpoint) &&
            _internalEndpoint != _externalEndpoint)
        {
            url = url.Replace(_internalEndpoint, _externalEndpoint);
        }

        return url;
    }
}
```

### 2.5 検証ポイント

修正後、以下を確認:
1. `curl http://localhost:5000/api/issues/{id}/photos/{photoId}/url` で返る URL が `http://localhost:9000/...` であること（`http://storage:9000/...` でないこと）
2. その URL にブラウザまたは curl でアクセスして画像が取得できること

---

## Step 3: .NET 10 Preview 問題の対応（R3 解消）

### 3.1 判断基準

```bash
docker compose up --build 2>&1 | head -50
```

**パターンA**: `dotnet/sdk:10.0-preview` が存在しビルド成功 → Step 3 の残りをスキップ、Step 4 へ

**パターンB**: イメージ不在エラー → 以下の net9.0 ダウングレードを実行

### 3.2 ダウングレード修正（パターンB の場合のみ）

#### `backend/IssueManager.Api.csproj`

```xml
<!-- 変更前 -->
<TargetFramework>net10.0</TargetFramework>

<!-- 変更後 -->
<TargetFramework>net9.0</TargetFramework>
```

#### `backend/Dockerfile`

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY *.csproj ./
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
COPY --from=build /app .
EXPOSE 5000
ENV ASPNETCORE_URLS=http://+:5000
ENTRYPOINT ["dotnet", "IssueManager.Api.dll"]
```

※ HEALTHCHECK はStep 4で別途設定するためDockerfileからは削除。

#### NuGet パッケージ互換性（変更不要）

- `Npgsql.EntityFrameworkCore.PostgreSQL 9.*` → net9.0 互換
- `Minio 6.*` → net9.0 互換
- `Swashbuckle.AspNetCore 7.*` → net9.0 互換

#### README.md の更新

README.md 内の `.NET 10` 記述を全て `.NET 9` に置換:

```bash
# 確認（置換対象の行を表示）
grep -n "\.NET 10\|net10\|dotnet.*10" README.md

# 手動で該当箇所を .NET 9 / net9.0 に修正
```

---

## Step 4: HEALTHCHECK 修正（R4 解消）

### 4.1 問題

`aspnet:10.0-preview`（または `aspnet:9.0`）イメージに `curl` はプリインストールされていない。
`wget` は Debian ベースの aspnet イメージに含まれている。

### 4.2 修正: `backend/Dockerfile`

既存の HEALTHCHECK 行を以下に置換（Step 3 でDockerfile全体を書き換えた場合は追記）:

```dockerfile
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1
```

### 4.3 修正: `docker-compose.yml`

backend サービスの healthcheck を修正:

```yaml
  backend:
    build: { context: ./backend, dockerfile: Dockerfile }
    ports: ["5000:5000"]
    env_file: .env
    depends_on:
      db: { condition: service_healthy }
      storage: { condition: service_healthy }
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:5000/health"]
      interval: 10s
      timeout: 5s
      retries: 5
```

### 4.4 ビルド＆起動検証

```bash
docker compose down
docker compose up --build -d

# 30秒待機後にヘルスチェック状態確認
sleep 30
docker compose ps
```

**期待結果**: 全4サービスが `Up (healthy)` または `Up` 状態。

---

## Step 5: E2E 動作確認

### 5.1 Backend API テスト

```bash
# 1. ヘルスチェック
curl -s http://localhost:5000/health
# 期待: {"status":"healthy"}

# 2. 指摘作成
ISSUE_RESPONSE=$(curl -s -X POST http://localhost:5000/api/issues \
  -H "Content-Type: application/json" \
  -d '{
    "title": "テスト指摘",
    "description": "ひび割れ確認",
    "issueType": "Quality",
    "location": {
      "type": "Space",
      "worldPosition": {"x": 1.0, "y": 2.0, "z": 3.0}
    }
  }')
echo "$ISSUE_RESPONSE"
ISSUE_ID=$(echo "$ISSUE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "ISSUE_ID=$ISSUE_ID"

# 3. 指摘一覧取得
curl -s "http://localhost:5000/api/issues?page=1&pageSize=10"

# 4. テスト画像生成＋写真アップロード
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB\x82' > /tmp/test.png

PHOTO_RESPONSE=$(curl -s -X POST "http://localhost:5000/api/issues/${ISSUE_ID}/photos" \
  -F "file=@/tmp/test.png" \
  -F "photoType=Before")
echo "$PHOTO_RESPONSE"
PHOTO_ID=$(echo "$PHOTO_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "PHOTO_ID=$PHOTO_ID"

# 5. Presigned URL取得（R2修正の検証: localhost:9000 であること）
URL_RESPONSE=$(curl -s "http://localhost:5000/api/issues/${ISSUE_ID}/photos/${PHOTO_ID}/url")
echo "$URL_RESPONSE"
# ★確認: URLに "storage:9000" が含まれていないこと（"localhost:9000" であること）

# 6. Presigned URLで画像取得
PRESIGNED_URL=$(echo "$URL_RESPONSE" | grep -o '"url":"[^"]*"' | cut -d'"' -f4)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PRESIGNED_URL")
echo "HTTP_CODE=$HTTP_CODE"
# 期待: 200

# 7. 状態遷移テスト
curl -s -X PATCH "http://localhost:5000/api/issues/${ISSUE_ID}/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "InProgress"}'
# 期待: status=InProgress

curl -s -X PATCH "http://localhost:5000/api/issues/${ISSUE_ID}/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "Done"}'
# 期待: status=Done

# 8. 不正遷移テスト
curl -s -w "\nHTTP_CODE: %{http_code}\n" -X PATCH "http://localhost:5000/api/issues/${ISSUE_ID}/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "Open"}'
# 期待: 400エラー
```

### 5.2 Frontend 動作確認（ブラウザ目視）

`http://localhost:3000` にアクセスし、以下を確認:

| # | 確認項目 | チェック |
|---|---------|---------|
| 1 | 画面が表示される（左: Viewer領域 / 右: サイドパネル） | ☐ |
| 2 | 指摘一覧に Step 5.1 で作成した指摘が表示される | ☐ |
| 3 | 指摘クリック → 詳細パネルが開く | ☐ |
| 4 | 詳細パネルで写真が **実画像** 表示される（📷アイコンではない） | ☐ |
| 5 | 「対応開始」→「完了にする」ボタンが機能する | ☐ |
| 6 | 「📷 写真追加」から画像をアップロードできる | ☐ |

※ APS Viewerは APS_CLIENT_ID がダミー値の場合はトークン取得失敗でエラー表示になるが、それ以外のUI機能は正常動作すること。

### 5.3 E2E結果の記録

テスト結果を `docs/qa-e2e-results.md` に記録すること。

---

## Step 6（任意）: Tailwind CSS 設定追加（R5 解消）

**提出最低ラインは Step 5 完了まで。Step 6 は品質向上施策。**

### 6.1 Tailwind v4 設定（CSS-first configuration）

#### `frontend/src/app/globals.css`（新規作成）

```css
@import "tailwindcss";
```

#### `frontend/postcss.config.mjs`（新規作成）

```javascript
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

#### `frontend/src/app/layout.tsx`（globals.css インポート追加）

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "APS Issue Manager",
  description: "BIM 3D指摘管理ツール - APS Viewer × 施工現場向け",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
```

#### パッケージ追加

```bash
cd frontend
npm install -D @tailwindcss/postcss
```

※ `package-lock.json` が更新されるのでコミット対象に含める。

### 6.2 検証

```bash
docker compose down
docker compose up --build
```

フロントエンドビルドが成功することを確認。

---

## 最終チェックリスト

| # | 項目 | 必須 | 状態 |
|---|------|------|------|
| 1 | `.env` 作成済み（`POSTGRES_HOST=db`, `MINIO_ENDPOINT=storage:9000`） | ✅ | ☐ |
| 2 | `MINIO_EXTERNAL_ENDPOINT=localhost:9000` 設定済み | ✅ | ☐ |
| 3 | `MinioBlobStorage` Presigned URL ホスト名書き換え実装済み | ✅ | ☐ |
| 4 | .NET SDK/Runtimeビルド成功（10 or 9）| ✅ | ☐ |
| 5 | HEALTHCHECK: `wget` 方式に修正（Dockerfile + docker-compose） | ✅ | ☐ |
| 6 | `docker compose up --build` で全4サービス起動 | ✅ | ☐ |
| 7 | API: 指摘CRUD + 写真アップロード + Presigned URL取得が動作 | ✅ | ☐ |
| 8 | API: 状態遷移 Open→InProgress→Done が動作 | ✅ | ☐ |
| 9 | Frontend: 写真実画像表示が動作（P1-NEW-1 + P2-NEW-2 最終検証） | ✅ | ☐ |
| 10 | Presigned URL が `localhost:9000` ベースで返る（`storage:9000` でない） | ✅ | ☐ |
| 11 | README.md の.NETバージョン記述がビルド実態と一致 | ✅ | ☐ |
| 12 | `.env` が `.gitignore` に含まれている | ✅ | ☐ |
| 13 | Tailwind CSS 設定追加 | 任意 | ☐ |
| 14 | `docs/qa-e2e-results.md` 作成 | 推奨 | ☐ |
| 15 | `tasks/todo.md` のPhase 3/4チェックボックス更新 | 推奨 | ☐ |

---

## 修正ファイル一覧（想定）

| ファイル | 操作 | Step |
|---------|------|------|
| `.env.example` | 修正（ホスト名変更 + MINIO_EXTERNAL_ENDPOINT追加） | 1, 2 |
| `.env` | 新規作成（.env.exampleからコピー） | 1 |
| `backend/src/Infrastructure/BlobStorage/MinioBlobStorage.cs` | 修正（Presigned URL書き換え） | 2 |
| `backend/IssueManager.Api.csproj` | 条件付き修正（net10.0→net9.0） | 3 |
| `backend/Dockerfile` | 修正（イメージタグ + HEALTHCHECK） | 3, 4 |
| `docker-compose.yml` | 修正（backend healthcheck） | 4 |
| `README.md` | 条件付き修正（.NETバージョン） | 3 |
| `docs/qa-e2e-results.md` | 新規作成 | 5 |
| `frontend/src/app/globals.css` | 新規作成（任意） | 6 |
| `frontend/postcss.config.mjs` | 新規作成（任意） | 6 |
| `frontend/src/app/layout.tsx` | 修正（任意） | 6 |
