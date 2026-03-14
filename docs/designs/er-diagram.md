# ER図（ドメインモデル）

## Issue / Location / Photo

```mermaid
erDiagram
    Issue ||--o{ Photo : "has"
    Issue ||--|| Location : "has"

    Issue {
        uuid id PK
        string title "NOT NULL"
        text description
        enum issue_type "Quality|Safety|Construction|DesignChange"
        enum status "Open|InProgress|Done"
        timestamp created_at
        timestamp updated_at
    }

    Location {
        uuid id PK
        uuid issue_id FK
        enum location_type "Element|Space"
        int db_id "NULL可 (部材指摘時に使用)"
        float world_x "NULL可 (空間指摘時に使用)"
        float world_y "NULL可"
        float world_z "NULL可"
    }

    Photo {
        uuid id PK
        uuid issue_id FK
        string blob_key "MinIO上のオブジェクトキー"
        enum photo_type "Before|After"
        timestamp uploaded_at
    }
```

## 設計判断

- **Location を値オブジェクトとして扱う**: DDDの観点ではLocationはIssueの一部。テーブルはEF Core の Owned Entity として Issue テーブルに埋め込むか、別テーブルとするかは実装時に決定
- **Photo は子エンティティ**: Issue集約の境界内。Issue経由でのみ追加・参照
- **BlobKey**: MinIO上のオブジェクトパス。実ファイルはDBに保存しない
- **状態遷移**: `status` カラムはenum。遷移ルールはDomain層のIssueエンティティが制御（DBトリガーは使わない）
