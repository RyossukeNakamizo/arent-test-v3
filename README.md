# APS Issue Manager

施工現場向け指摘管理ツール。Autodesk Platform Services（APS）Viewer上でBIMモデルを表示しながら、現場の指摘事項をCRUD管理できるWebアプリケーション。

## スクリーンショット

> `docs/images/` に配置予定

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js 15 / TypeScript / Tailwind CSS |
| バックエンド | .NET 10 / ASP.NET Core / Clean Architecture |
| BIM Viewer | Autodesk Platform Services (APS) Viewer v7 |
| データベース | PostgreSQL 16 |
| オブジェクトストレージ | MinIO (S3互換) |
| インフラ | Docker Compose |
| テスト | xUnit (.NET) |

## アーキテクチャ
```
Frontend (Next.js :3000)
  └── ApsViewer ─── IssueList ─── IssueDetail ─── StatusBadge
         │
         ↓ REST API
Backend (.NET :5001)
  └── API Layer → Application (CQRS) → Domain → Infrastructure
                                            ↓           ↓
                                       PostgreSQL     MinIO
         │
         └── APS Token Proxy → Autodesk Cloud
```

詳細は [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) を参照。

## セットアップ

### 前提条件

- Docker Desktop
- Autodesk Platform Services アカウント（無料）
  - APS Client ID / Client Secret の取得が必要
  - [APS Developer Portal](https://aps.autodesk.com/) で取得

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

`.env` を開き、以下を設定：
```env
APS_CLIENT_ID=your_client_id_here
APS_CLIENT_SECRET=your_client_secret_here
```

**3. 起動**
```bash
docker compose up --build
```

**4. アクセス**

| URL | サービス |
|-----|---------|
| http://localhost:3000 | アプリケーション |
| http://localhost:9001 | MinIO コンソール (minioadmin / minioadmin) |
| http://localhost:5001/swagger | API ドキュメント |

## 主な機能

- **BIMモデル表示**: Revit MEPモデル（.rvt）をブラウザで3D表示
- **指摘作成**: 部材クリック（Element）または空間クリック（Space）で位置を記録
- **状態管理**: Open → InProgress → Done の一方向状態遷移（完了後は変更不可）
- **写真管理**: 是正前/是正後の写真をアップロード・ライトボックス表示
- **カメラ遷移**: 指摘一覧からクリックするとBIMモデル上の該当箇所にカメラが移動

## 開発

### テスト実行
```bash
cd backend
dotnet test tests/ --logger "console;verbosity=detailed"
```

### ディレクトリ構成
```
arent-test-v3/
├── frontend/          # Next.js アプリケーション
│   └── src/
│       ├── components/  # ApsViewer, IssueList, IssueDetail 等
│       ├── lib/         # API クライアント
│       └── types/       # TypeScript 型定義
├── backend/           # .NET アプリケーション
│   ├── src/
│   │   ├── Api/         # REST コントローラー
│   │   ├── Application/ # CQRS コマンド/クエリ
│   │   ├── Domain/      # エンティティ・値オブジェクト
│   │   └── Infrastructure/ # DB・ストレージ・APS
│   └── tests/         # xUnit ユニットテスト
├── docs/              # ドキュメント
└── docker-compose.yml
```

## ライセンス

MIT
