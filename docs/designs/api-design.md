# API設計書

## エンドポイント一覧

| Method | Path | 責務 | CQRS |
|--------|------|------|------|
| GET | `/health` | ヘルスチェック | — |
| GET | `/api/aps/token` | APS Viewer トークン取得（Token Proxy） | Query |
| GET | `/api/aps/urn` | APS Model URN 取得 | Query |
| GET | `/api/issues` | 指摘一覧取得 | Query |
| GET | `/api/issues/{id}` | 指摘詳細取得 | Query |
| POST | `/api/issues` | 指摘作成 | Command |
| PATCH | `/api/issues/{id}/status` | 状態遷移 | Command |
| PATCH | `/api/issues/{id}` | 指摘内容更新 | Command |
| POST | `/api/issues/{id}/photos` | 写真アップロード | Command |
| GET | `/api/issues/{id}/photos/{photoId}/url` | 写真Presigned URL取得 | Query |

---

## Request / Response 定義

### GET `/api/aps/token`

**Response 200:**
```json
{
  "access_token": "eyJ...",
  "expires_in": 3600
}
```

Backend が 2-legged OAuth で APS Authentication API からトークンを取得し、フロントに返却する。Client Secret はレスポンスに含めない。

---

### GET `/api/aps/urn`

**Response 200:**
```json
{
  "urn": "dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6..."
}
```

環境変数 `APS_MODEL_URN` に設定された3DモデルのURNを返却する。Viewer初期化時に使用。

**エラー 500:** `APS_MODEL_URN` が未設定の場合
```json
{
  "error": {
    "code": "CONFIG_ERROR",
    "message": "APS_MODEL_URN not configured"
  }
}
```

---

### POST `/api/issues`

**Request Body:**
```json
{
  "title": "5F 天井ダクト干渉",
  "description": "梁H-300とダクトφ400が干渉。ルート変更が必要",
  "issueType": "Construction",
  "location": {
    "type": "Element",
    "dbId": 12345,
    "worldPosition": { "x": 10.5, "y": 3.2, "z": 15.0 }
  }
}
```

**Response 201:**
```json
{
  "id": "a1b2c3d4-...",
  "title": "5F 天井ダクト干渉",
  "status": "Open",
  "createdAt": "2026-03-14T10:00:00Z"
}
```

**バリデーション:**
- `title`: 必須、1-200文字
- `issueType`: enum値のいずれか
- `location.type` が `Element` の場合 `dbId` 必須
- `location.type` が `Space` の場合 `worldPosition` 必須

---

### GET `/api/issues?page=1&pageSize=20`

**Response 200:**
```json
{
  "items": [
    {
      "id": "a1b2c3d4-...",
      "title": "5F 天井ダクト干渉",
      "issueType": "Construction",
      "status": "Open",
      "location": {
        "type": "Element",
        "dbId": 12345,
        "worldPosition": { "x": 10.5, "y": 3.2, "z": 15.0 }
      },
      "photoCount": 2,
      "createdAt": "2026-03-14T10:00:00Z",
      "updatedAt": "2026-03-14T10:00:00Z"
    }
  ],
  "totalCount": 42,
  "page": 1,
  "pageSize": 20
}
```

---

### PATCH `/api/issues/{id}/status`

**Request Body:**
```json
{
  "status": "InProgress"
}
```

**Response 200:**
```json
{
  "id": "a1b2c3d4-...",
  "status": "InProgress",
  "updatedAt": "2026-03-14T11:00:00Z"
}
```

**エラー 400:** 不正な状態遷移（例: Open → Done）

---

### POST `/api/issues/{id}/photos`

**Request:** `multipart/form-data`
- `file`: 画像ファイル (JPEG/PNG, 最大10MB)
- `photoType`: `Before` | `After`

**Response 201:**
```json
{
  "id": "photo-uuid-...",
  "photoType": "Before",
  "uploadedAt": "2026-03-14T12:00:00Z"
}
```

**整合性フロー:**
1. MinIO に先行保存
2. DB にメタデータ登録
3. 失敗時は Blob 即時削除（ベストエフォート）

---

### GET `/api/issues/{id}/photos/{photoId}/url`

**Response 200:**
```json
{
  "url": "http://localhost:9000/issue-photos/issues/.../photo-uuid?X-Amz-...",
  "expiresIn": 3600
}
```

MinIO の Presigned URL を返却。フロントから直接 MinIO に GET する。

---

## エラーレスポンス共通形式

```json
{
  "error": {
    "code": "INVALID_STATUS_TRANSITION",
    "message": "Done への遷移は InProgress からのみ可能（現在: Open）"
  }
}
```

| HTTP Status | 用途 |
|-------------|------|
| 400 | バリデーションエラー / 不正な状態遷移 |
| 404 | Issue / Photo が存在しない |
| 413 | ファイルサイズ超過 |
| 500 | サーバー内部エラー |
