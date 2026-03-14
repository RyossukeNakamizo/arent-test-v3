# APS Viewer × 施工現場向け 指摘管理ツール

BIM 3Dモデル上にピン配置＋指摘写真管理Webアプリ。  
施工現場ヒアリングから導出した4要件（位置紐付・写真添付・状態管理・3D再現）を実現する。

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router / TypeScript) |
| Backend | .NET 10 Web API (C#) ※Preview版使用 |
| DB | PostgreSQL 16 |
| Blob Storage | MinIO (S3互換) |
| 3D Viewer | Autodesk Platform Services (APS) Viewer v7 |
| Infrastructure | Docker Compose |

---

## 8.1 全体アーキテクチャ

### レイヤー構成

```
┌─────────────────────────────────────────────────────┐
│ Presentation Layer (Next.js)                        │
│  APS Viewer v7 / React Components / API Client      │
├─────────────────────────────────────────────────────┤
│ API Layer (.NET 10 Controllers)                     │
│  HTTP routing / validation / DTO mapping             │
├─────────────────────────────────────────────────────┤
│ Application Layer (Commands / Queries)              │
│  ユースケース制御 / CQRS責務分離                       │
├─────────────────────────────────────────────────────┤
│ Domain Layer (Entities / Value Objects / Enums)      │
│  Issue集約 / 状態遷移 / ビジネスルール                  │
├─────────────────────────────────────────────────────┤
│ Infrastructure Layer                                │
│  PostgreSQL(EF Core) / MinIO / APS Token Proxy       │
└─────────────────────────────────────────────────────┘
```

### 各層の責務

- **Presentation**: UI描画・ユーザーインタラクション・APS Viewer操作。Backend API のみ呼び出す
- **API**: HTTPエンドポイント公開・リクエストバリデーション・DTO↔ドメインモデル変換
- **Application**: ユースケース単位のオーケストレーション。Command（書込）とQuery（読取）を分離
- **Domain**: ビジネスルールの唯一の所在地。フレームワーク依存ゼロ
- **Infrastructure**: 外部システム（DB・Blob・APS API）との接続実装。インターフェースを通じてのみ上位層と結合

### 依存方向

```
Presentation → API → Application → Domain ← Infrastructure
                                      ↑                ↑
                                  依存方向は常に内側へ
                                  Infrastructure は Domain の
                                  インターフェースを実装する
```

Domain層は他のどの層にも依存しない。Infrastructure層はDomain層が定義するインターフェース（`IIssueRepository`, `IBlobStorage`, `IApsTokenProvider`）を実装する（依存性逆転原則）。

### フレームワーク依存の隔離

- Domain層: Pure C#。EF Core・ASP.NET・MinIO SDK への参照なし
- Application層: `CancellationToken` のみ .NET 標準ライブラリに依存
- Infrastructure層: EF Core / Npgsql / Minio SDK / HttpClient の具象実装を閉じ込める
- Frontend: APS Viewer SDKの呼び出しは `src/lib/` に集約。コンポーネントは Viewer SDK を直接参照しない

---

## 8.2 ドメイン設計

### Issue の責務

Issue は集約ルート（Aggregate Root）。指摘に関するビジネスルールの唯一の所有者。

```
Issue (集約ルート)
├── Id: Guid
├── Title: string
├── Description: string
├── IssueType: enum (Quality / Safety / Construction / DesignChange)
├── Status: enum (Open / InProgress / Done)
├── Location: 値オブジェクト
│   ├── Type: enum (Element / Space)
│   ├── DbId?: int (部材指摘時)
│   └── WorldPosition?: {X,Y,Z} (空間指摘時)
├── Photos: Photo[] (子エンティティ)
│   ├── Id, BlobKey, PhotoType (Before/After), UploadedAt
├── CreatedAt, UpdatedAt
└── ファクトリメソッド: Issue.Create(...)
```

### 状態遷移の実装場所

状態遷移ロジックは **Issue エンティティ内** に閉じ込める（ドメイン層）。

```
Open ──→ InProgress ──→ Done
 (StartProgress)    (Complete)

- 逆行不可: Done → Open は InvalidOperationException
- スキップ不可: Open → Done は InvalidOperationException
- Application層は Issue.StartProgress() / Issue.Complete() を呼ぶだけ
```

### ビジネスルールの所在

| ルール | 実装場所 |
|--------|---------|
| 状態遷移制約 | `Issue.StartProgress()` / `Issue.Complete()` |
| Location バリデーション | `Location` 値オブジェクトのコンストラクタ |
| Title 必須チェック | `Issue.Create()` ファクトリメソッド |
| BlobKey 必須チェック | `Photo.Create()` ファクトリメソッド |

全てのビジネスルールは Domain 層に集約。Application / API 層はルール判定を行わない。

---

## 8.3 読み取りと書き込みの整理

### Command と Query の責務整理

```
Command（書き込み）                    Query（読み取り）
├── CreateIssueCommand               ├── GetIssueListQuery
├── UploadPhotoCommand               ├── GetIssueByIdQuery
├── TransitionStatusCommand          └── (将来: フィルタ/検索クエリ)
└── IssueCommandHandler              └── IssueQueryHandler
    ↓ write path                         ↓ read path
    IIssueRepository.Add/Update          IIssueRepository.GetList/GetById
```

POCスコープでは同一リポジトリインターフェースを Command / Query 双方から利用する（論理的CQRS）。物理的なRead/Writeモデル分離は件数増加時に導入する。

### 件数増加時の設計方針

| 段階 | 対応 |
|------|------|
| ~1,000件 | 現行のまま（単一テーブル + Offset Pagination） |
| ~10,000件 | Cursor-based pagination導入。`CreatedAt` + `Id` 複合インデックス |
| ~100,000件 | Read Model 分離（非正規化テーブル or Materialized View） |
| ~1,000,000件 | PostgreSQL パーティショニング（プロジェクト単位） |

写真の Blob メタデータはDBに最小限（BlobKey + PhotoType）のみ保持し、実データは常に MinIO から配信する。Read Model 分離時も Blob アクセスパスは不変。

---

## 8.4 永続化戦略

### Repository の抽象化

```csharp
public interface IIssueRepository
{
    Task<Issue?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<(IReadOnlyList<Issue> Items, int TotalCount)> GetListAsync(int page, int pageSize, CancellationToken ct);
    Task AddAsync(Issue issue, CancellationToken ct);
    Task UpdateAsync(Issue issue, CancellationToken ct);
}
```

Domain層がこのインターフェースを定義し、Infrastructure層が PostgreSQL (EF Core + Npgsql) で実装する。

### DB依存の隔離

- EF Core の `DbContext` は Infrastructure 層にのみ存在
- Domain エンティティに `[Table]` / `[Column]` 等のORM属性を付与しない
- マッピングは `IEntityTypeConfiguration<T>` で Infrastructure 側に定義

### Blob 保存戦略

```
写真ファイル → MinIO (S3互換 API)
キー構造: issues/{issueId}/photos/{photoId}
バケット: issue-photos（.env で設定）
```

`IBlobStorage` インターフェースにより、MinIO → Azure Blob / AWS S3 への切り替えが可能。

### DB と Blob の整合性戦略

```
1. MinIO に先行保存（Blob書き込み）
2. PostgreSQL にメタデータ登録（DB書き込み）
3. DB登録失敗時 → Blob を即時削除（ベストエフォート）
4. 即時削除も失敗した場合 → 孤立Blobとして残存
5. 定期バッチ: DBに参照されない BlobKey を検出→削除（Orphan Cleanup Job）
```

Blob先行保存を選択した理由: DB トランザクション内で外部 HTTP 呼び出し（MinIO）を行うとロック時間が長くなる。先行保存 + 補償ロジックのほうがスループットが高い。

---

## 8.5 外部依存の隔離

### APS 依存の扱い

```
Frontend (ブラウザ)
    │ GET /api/aps/token
    ▼
Backend Token Proxy (.NET)
    │ POST https://developer.api.autodesk.com/authentication/v2/token
    │ (Client ID + Client Secret → 2-legged OAuth)
    ▼
APS Authentication API
    │ access_token 返却
    ▼
Backend → Frontend に token 返却
    │
    ▼
Frontend: Autodesk.Viewing.Initializer(token) → Viewer 起動
```

- **Client Secret はフロントエンドに一切露出しない**（Token Proxy パターン）
- `IApsTokenProvider` インターフェースにより、認証ロジックの実装詳細を Application 層から隔離
- トークンキャッシュ: `expires_in` に基づき Backend 側でインメモリキャッシュ（再取得頻度を最小化）

### ストレージ依存の扱い

- `IBlobStorage` インターフェースで MinIO の SDK 依存を Infrastructure 層に閉じ込め
- Application 層は `UploadAsync(key, stream, contentType)` のみ知る
- Presigned URL 生成も `IBlobStorage` 経由（フロントから直接 MinIO にアクセスしない）

---

## 8.6 将来本番構成

### クラウドに上げるなら？

| 現在（ローカル） | 本番構成 |
|-------------|---------|
| PostgreSQL (Docker) | Azure Database for PostgreSQL Flexible Server / Amazon RDS |
| MinIO (Docker) | Azure Blob Storage / AWS S3 |
| .NET on Docker | Azure Container Apps / AWS ECS Fargate |
| Next.js on Docker | Vercel / Azure Static Web Apps + CDN |

`IBlobStorage` / `IIssueRepository` のインターフェース差し替えのみで移行可能。Domain / Application 層は変更不要。

### 認証を入れるなら？

- Azure AD B2C / Auth0 / Keycloak を IdP として導入
- Backend: JWT Bearer 認証ミドルウェアを API Layer に追加
- Frontend: NextAuth.js でセッション管理
- Issue エンティティに `CreatedBy` / `AssignedTo` フィールドを追加

### マルチユーザー対応するなら？

- Project エンティティを追加し、Issue を Project に所属させる
- Row Level Security (PostgreSQL) or Application レベルのテナントフィルタ
- MinIO バケットをプロジェクト単位で分離、IAMポリシーで制御
- 楽観的ロック（`RowVersion` / `xmin`）で同時編集の競合を検出

### 大量データ時の設計は？

| 課題 | 対応策 |
|------|--------|
| Issue 件数増大 | PostgreSQL パーティショニング（プロジェクト×年月） |
| 写真データ肥大化 | CDN（CloudFront / Azure CDN）でキャッシュ配信 |
| 3D モデル多数 | APS Model Derivative API でオンデマンド変換 |
| 検索要件 | PostgreSQL Full-Text Search → 将来は Elasticsearch |
| リアルタイム同期 | SignalR / WebSocket で指摘一覧のライブ更新 |

---

## セットアップ

```bash
git clone {repo} && cd arent-test
cp .env.example .env  # APS_CLIENT_ID / SECRET / URN を設定
docker compose up -d
# Frontend: http://localhost:3000
# API: http://localhost:5000 / Swagger: http://localhost:5000/swagger
# MinIO Console: http://localhost:9001 (minioadmin / minioadmin)
```

> **Note**: Backend は .NET 10 Preview を使用しています。GA版リリース（2025年11月予定）後に `mcr.microsoft.com/dotnet/sdk:10.0` へ更新してください。Preview版イメージが利用不可の場合は、Dockerfile の `10.0-preview` を `9.0` に変更することで .NET 9 LTS でも動作します。

## プロジェクト構成

```
├── CLAUDE.md                          # Claude Code プロジェクト設定
├── .claude/
│   ├── agents/                        # Subagent 定義（5ロール）
│   ├── hooks/                         # 自動ガードレール
│   ├── skills/baseline.md             # 共通行動規範
│   ├── teams/team-spawn-prompt.md     # Agent Teams スポーン
│   └── settings.json                  # Claude Code 設定
├── frontend/                          # Next.js 15
│   ├── src/app/                       # App Router
│   ├── src/components/                # UI コンポーネント
│   ├── src/lib/api.ts                 # API Client (Token Proxy経由)
│   └── src/types/                     # TypeScript 型定義
├── backend/                           # .NET 10 Web API
│   ├── src/Domain/                    # エンティティ・値オブジェクト・Enum
│   ├── src/Application/               # Commands / Queries / Interfaces
│   ├── src/Infrastructure/            # EF Core / MinIO / APS Proxy
│   └── src/Api/Controllers/           # HTTP エンドポイント
├── docs/
│   ├── designs/                       # Mermaid図・ER図・API設計・シーケンス図
│   ├── decisions/                     # ADR (Architecture Decision Record)
│   ├── debug-registry/                # SMP デバッグログ・既知エラーDB
│   ├── references/                    # ワークフロー・ガイド類
│   └── templates/                     # 設計書・確認書テンプレート
├── tasks/todo.md                      # タスク管理
├── docker-compose.yml                 # 4サービス構成
└── .env.example                       # 環境変数テンプレート
```

## Claude Code 運用

- **Subagents**: supervisor(opus), frontend/backend(sonnet), qa(sonnet), research(haiku)
- **Agent Teams**: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` で並列協調
- **Phase Gate**: phase-1-design → phase-2-impl → phase-3-qa → phase-4-release
- **SMP**: デバッグ即記録 → 2回目でKNOWN-ERRORS昇格 → Hooks自動拒否
- **Handoff**: セッション終了時に `tasks/handoff-{date}.yaml` 生成
