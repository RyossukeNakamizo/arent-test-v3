# arent-test-v3 — 施工現場向け指摘管理ツール

Autodesk Platform Services（APS）Viewer上でBIMモデルを表示しながら、施工現場の指摘事項をCRUD管理できるWebアプリケーション。

## プロジェクト概要

施工現場で発生する品質・安全・施工不備などの指摘を、3D BIMモデル上の位置情報と紐づけて管理するツール。指摘に是正前/是正後の写真を添付し、状態（Open → InProgress → Done）を追跡できる。

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js 15 / TypeScript / Tailwind CSS |
| バックエンド | .NET 10 / ASP.NET Core / Clean Architecture |
| BIM Viewer | Autodesk Platform Services (APS) Viewer v7 |
| データベース | PostgreSQL 16 |
| オブジェクトストレージ | MinIO (S3互換) |
| インフラ | Docker Compose |
| テスト | xUnit (.NET) — 21ケース |

## セットアップ手順

### 前提条件

- Docker Desktop
- Autodesk Platform Services アカウント（[APS Developer Portal](https://aps.autodesk.com/)で無料取得）

### 手順

**1. リポジトリをクローン**
```bash
git clone https://github.com/YOUR_USERNAME/arent-test-v3.git
cd arent-test-v3
```

**2. 認証情報を設定**
```bash
cp .env.example .env
```

`.env` を編集し、APS認証情報を設定：
```env
APS_CLIENT_ID=your_client_id_here
APS_CLIENT_SECRET=your_client_secret_here
APS_MODEL_URN=your_model_urn_here
```

**3. 起動**
```bash
docker compose up --build
```

**4. アクセス**

| URL | サービス |
|-----|---------|
| http://localhost:3000 | アプリケーション |
| http://localhost:5001/swagger | API ドキュメント |
| http://localhost:9001 | MinIO コンソール (minioadmin / minioadmin) |

---

## 8.1 全体アーキテクチャ

### レイヤー構成

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                        │
│   ApsViewer.tsx │ IssueList.tsx │ IssueDetail.tsx           │
└─────────────────────────────────────────────────────────────┘
                              │ REST API
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Layer                               │
│   IssuesController │ PhotosController │ ApsController        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer                          │
│   IssueCommandHandler (Write) │ IssueQueryHandler (Read)     │
│   CreateIssueCommand │ TransitionStatusCommand │ ...         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Domain Layer                             │
│   Issue (集約ルート) │ Photo │ Location │ WorldPosition      │
│   IssueStatus │ IssueType │ LocationType │ PhotoType         │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ 依存方向（内側への依存のみ）
                              │
┌─────────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                        │
│   PostgresIssueRepository │ MinioBlobStorage │ ApsTokenProvider│
│   AppDbContext (EF Core)                                     │
└─────────────────────────────────────────────────────────────┘
```

### 各層の責務

| 層 | 責務 | 主要クラス |
|----|------|-----------|
| **API** | HTTPリクエスト処理、DTO変換 | `IssuesController`, `PhotosController`, `ApsController` |
| **Application** | ユースケース実行、トランザクション制御 | `IssueCommandHandler`, `IssueQueryHandler` |
| **Domain** | ビジネスルール、状態遷移ロジック | `Issue`, `Photo`, `Location`, `WorldPosition` |
| **Infrastructure** | 外部システム接続（DB, Blob, APS） | `PostgresIssueRepository`, `MinioBlobStorage`, `AppDbContext` |

### 依存方向

- **内側への依存のみ許可**: Infrastructure → Domain ← Application ← API
- Domain層は外部ライブラリに依存しない（EF Coreのプライベートコンストラクタのみ例外）
- Application層はインターフェース（`IIssueRepository`, `IBlobStorage`）経由でInfrastructureを利用

### フレームワーク依存の隔離

```
IIssueRepository (Application層で定義)
        ↑ 実装
PostgresIssueRepository (Infrastructure層)
        │ 使用
     EF Core, Npgsql
```

詳細図: [docs/architecture.md](docs/architecture.md)

---

## 8.2 ドメイン設計

### Issue集約の責務

`Issue` クラス（`backend/src/Domain/Entities/Issue.cs`）は集約ルートとして以下を担う：

1. **状態遷移の制御**: `StartProgress()`, `Complete()` メソッドで遷移ルールを強制
2. **子エンティティの管理**: `Photo` コレクションの追加・参照
3. **不変条件の保証**: タイトル必須、ステータス遷移順序

### 状態遷移

```
Open ──StartProgress()──► InProgress ──Complete()──► Done
```

- **逆行不可**: Done → InProgress, InProgress → Open は `InvalidOperationException`
- **スキップ不可**: Open → Done は不可（必ず InProgress を経由）
- **実装場所**: `Issue.StartProgress()`, `Issue.Complete()` メソッド内

```csharp
// backend/src/Domain/Entities/Issue.cs
public void StartProgress()
{
    if (Status != IssueStatus.Open)
        throw new InvalidOperationException($"InProgress への遷移は Open からのみ可能");
    Status = IssueStatus.InProgress;
}
```

### ビジネスルールの所在

| ルール | 実装場所 | 強制方法 |
|--------|---------|---------|
| タイトル必須 | `Issue.Create()` | `ArgumentException` |
| 状態遷移順序 | `Issue.StartProgress()`, `Issue.Complete()` | `InvalidOperationException` |
| Element型はdbId必須 | `Location` コンストラクタ | `ArgumentException` |
| Space型はworldPosition必須 | `Location` コンストラクタ | `ArgumentException` |
| BlobKey必須 | `Photo.Create()` | `ArgumentException` |

### Location値オブジェクト

```csharp
// backend/src/Domain/ValueObjects/Location.cs
public class Location
{
    public LocationType Type { get; }      // Element or Space
    public int? DbId { get; }              // BIM要素ID（Element型で必須）
    public WorldPosition? WorldPosition { get; }  // 3D座標（Space型で必須）
}
```

- **Element型**: 3Dモデル内の部材を指定（`dbId` 必須）
- **Space型**: 3D空間上の任意点を指定（`worldPosition` 必須）
- **両対応**: Element型でも `worldPosition` を持てる（カメラナビゲーション用）

詳細図: [docs/domain-model.md](docs/domain-model.md)

---

## 8.3 読み取りと書き込みの整理

### CQRS的分離

| 種別 | クラス | コマンド/クエリ |
|------|--------|----------------|
| **Command (Write)** | `IssueCommandHandler` | `CreateIssueCommand`, `TransitionStatusCommand`, `UploadPhotoCommand`, `UpdateIssueCommand` |
| **Query (Read)** | `IssueQueryHandler` | `GetIssueListQuery`, `GetIssueByIdQuery` |

### Command側の実装

```csharp
// backend/src/Application/Commands/IssueCommandHandler.cs
public async Task<Guid> HandleAsync(CreateIssueCommand cmd, CancellationToken ct)
{
    var location = new Location(cmd.LocationType, cmd.DbId, cmd.WorldPosition);
    var issue = Issue.Create(cmd.Title, cmd.Description, cmd.IssueType, location);
    await _repo.AddAsync(issue, ct);
    return issue.Id;
}
```

### Query側の実装

```csharp
// backend/src/Application/Queries/IssueQueryHandler.cs
public async Task<(IReadOnlyList<Issue> Items, int TotalCount)> HandleAsync(
    GetIssueListQuery query, CancellationToken ct)
{
    return await _repo.GetListAsync(query.Page, query.PageSize, ct);
}
```

### 件数増加時の拡張方針

現在は同一リポジトリを使用しているが、大量データ時は以下を検討：

1. **Read Model分離**: 非正規化テーブルからクエリ（イベントソーシング不要）
2. **Cursor-based pagination**: offset/limitからカーソルベースに移行
3. **BRINインデックス**: PostgreSQLの日時ベースフィルタ高速化
4. **Redis Cache**: 一覧のキャッシュ（TTL 30秒）

---

## 8.4 永続化戦略

### Repository抽象化

```csharp
// backend/src/Application/Interfaces/IRepositories.cs
public interface IIssueRepository
{
    Task<Issue?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<(IReadOnlyList<Issue> Items, int TotalCount)> GetListAsync(int page, int pageSize, CancellationToken ct = default);
    Task AddAsync(Issue issue, CancellationToken ct = default);
    Task UpdateAsync(Issue issue, CancellationToken ct = default);
    Task AddPhotoAsync(Guid issueId, Photo photo, CancellationToken ct = default);
}
```

### DB依存の隔離

- `AppDbContext` は Infrastructure層に配置
- Domain層のエンティティはEF Coreの属性を使わない（Fluent APIで設定）
- `PostgresIssueRepository` が `IIssueRepository` を実装

### Blob保存戦略

```csharp
// backend/src/Application/Interfaces/IRepositories.cs
public interface IBlobStorage
{
    Task<string> UploadAsync(string key, Stream content, string contentType, CancellationToken ct);
    Task<Stream> DownloadAsync(string key, CancellationToken ct);
    Task DeleteAsync(string key, CancellationToken ct);
    Task<string> GetPresignedUrlAsync(string key, int expirySeconds = 3600, CancellationToken ct);
}
```

- MinIO (S3互換) で実装
- Azure Blob / AWS S3 に差し替え可能

### DBとBlobの整合性戦略

**Blob先行 → DB後続** 方式を採用：

```csharp
// backend/src/Application/Commands/IssueCommandHandler.cs
public async Task<Guid> HandleAsync(UploadPhotoCommand cmd, CancellationToken ct)
{
    // 1. Blob先行保存
    await _blob.UploadAsync(blobKey, cmd.FileStream, cmd.ContentType, ct);

    try
    {
        // 2. DB後続登録
        var photo = Photo.CreateWithId(photoId, blobKey, cmd.PhotoType);
        await _repo.AddPhotoAsync(cmd.IssueId, photo, ct);
        return photo.Id;
    }
    catch
    {
        // 3. 失敗時は孤立Blobを削除（ベストエフォート）
        await _blob.DeleteAsync(blobKey, ct);
        throw;
    }
}
```

詳細図: [docs/er-diagram.md](docs/er-diagram.md)

---

## 8.5 外部依存の隔離

### APS依存の扱い

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│    Frontend     │      │    Backend      │      │   APS Cloud     │
│   (Next.js)     │─────▶│  Token Proxy    │─────▶│   OAuth 2.0     │
│                 │      │  ApsController  │      │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

- **Token Proxy**: Client Secretはバックエンドのみ保持
- **フロントエンド**: APS Viewer SDKを直接読み込み、トークンはバックエンド経由で取得
- **IApsTokenProvider**: 抽象化インターフェース（テスト時にモック可能）

```csharp
// backend/src/Application/Interfaces/IRepositories.cs
public interface IApsTokenProvider
{
    Task<(string AccessToken, int ExpiresIn)> GetTokenAsync(CancellationToken ct);
}
```

### ストレージ依存の扱い

- `IBlobStorage` インターフェースで抽象化
- `MinioBlobStorage` がMinIO SDKを使って実装
- 本番ではAzure Blob / S3実装に差し替え

---

## 8.6 将来本番構成

### クラウド構成（Azure想定）

```
┌─────────────────────────────────────────────────────────────┐
│                     Azure Front Door                         │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        ▼                                           ▼
┌───────────────────┐                   ┌───────────────────┐
│  Azure Static     │                   │  Azure Container  │
│  Web Apps         │                   │  Apps             │
│  (Next.js SSG)    │                   │  (.NET API)       │
└───────────────────┘                   └───────────────────┘
                                                    │
                    ┌───────────────────────────────┴───────────────┐
                    ▼                                               ▼
        ┌───────────────────┐                           ┌───────────────────┐
        │  Azure Database   │                           │  Azure Blob       │
        │  for PostgreSQL   │                           │  Storage          │
        └───────────────────┘                           └───────────────────┘
```

### 認証

- **Azure AD B2C** または **Auth0** で外部認証
- JWTトークンをバックエンドで検証
- 現在はNoAuth（開発用）

### マルチユーザー対応

- **テナント分離**: `Issue` テーブルに `TenantId` カラムを追加
- **RLS (Row Level Security)**: PostgreSQLのRLSポリシーで自動フィルタ
- **組織階層**: 現場 → プロジェクト → 指摘 の3層構造

### 大量データ時の設計

| 課題 | 対策 |
|------|------|
| 一覧表示の遅延 | Cursor-based pagination + インデックス最適化 |
| 写真ファイル増加 | Azure CDN + SASトークン（短期有効） |
| 検索性能 | Elasticsearch / Azure Cognitive Search |
| 同時編集競合 | 楽観ロック（ETag / UpdatedAt比較） |

---

## 要求機能の実装状況

| # | 要求機能 | 状態 | 実装箇所 |
|---|---------|------|---------|
| 1 | 指摘に「場所（3D上の位置）」が紐づく | ✅ | `Location` 値オブジェクト（dbId + worldPosition） |
| 2 | 指摘に写真（複数）を添付できる（是正前/是正後） | ✅ | `Photo` エンティティ（PhotoType: Before/After） |
| 3 | 指摘の状態（Open / InProgress / Done）を管理できる | ✅ | `Issue.StartProgress()`, `Issue.Complete()` |
| 4 | 一覧から対象箇所をすぐに見に行ける | ✅ | ApsViewer `fitToView()` / `navigation.setTarget()` |
| 5 | 部材指摘（Element型）に対応 | ✅ | `LocationType.Element` + `dbId` |
| 6 | 空間指摘（Space型）に対応 | ✅ | `LocationType.Space` + `WorldPosition` |

---

## テスト

### ユニットテスト（xUnit）

```bash
cd backend
dotnet test tests/ --logger "console;verbosity=detailed"
```

**テストケース一覧（21件）**:

| カテゴリ | テスト数 | 内容 |
|---------|---------|------|
| 状態遷移 | 12 | Open→InProgress→Done の正常系・異常系 |
| Location検証 | 9 | Element/Space型の必須項目チェック |

詳細: `backend/tests/Domain/Entities/IssueTests.cs`, `backend/tests/Domain/ValueObjects/LocationTests.cs`

---

## ドキュメント

| ファイル | 内容 |
|---------|------|
| [docs/architecture.md](docs/architecture.md) | 全体アーキテクチャ図（Mermaid） |
| [docs/domain-model.md](docs/domain-model.md) | ドメインモデル設計（クラス図・状態遷移図） |
| [docs/er-diagram.md](docs/er-diagram.md) | ER図（Mermaid） |
| [docs/api-design.md](docs/api-design.md) | API設計資料 |

---

## ライセンス

MIT
