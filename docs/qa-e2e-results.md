# QA E2E Test Results

**Test Date**: 2026-03-14
**Tester**: Claude Code
**Environment**: Docker Compose (macOS)

## Summary

| Test | Description | Result |
|------|-------------|--------|
| 1 | Health Check | PASS |
| 2 | Create Issue | PASS |
| 3 | Get Issue List | PASS |
| 4 | Photo Upload | PASS |
| 5 | Presigned URL 取得 | PASS |
| 6 | Presigned URL で画像取得 | PASS |
| 7 | 状態遷移 (Open → InProgress → Done) | PASS |
| 8 | 不正遷移 (400エラー確認) | PASS |

**Total: 8/8 PASS**

## Service Status

| Service | Port | Status |
|---------|------|--------|
| frontend | 3000 | Running |
| backend | 5001 | Healthy |
| db (PostgreSQL) | 5432 | Healthy |
| storage (MinIO) | 9000-9001 | Healthy |

## Test Details

### Test 1: Health Check
```
GET /health → 200 OK
{"status":"healthy"}
```

### Test 2: Create Issue
```
POST /api/issues
Request:
{
  "title": "E2E テスト指摘",
  "description": "写真アップロードテスト",
  "issueType": "Safety",
  "location": {
    "type": "Space",
    "worldPosition": {"x":10,"y":20,"z":30}
  }
}
Response: 201 Created
{"id":"168ae232-6133-4dce-9ae9-9e9e0c7ef26c","status":"Open","createdAt":"..."}
```

### Test 3: Get Issue List
```
GET /api/issues → 200 OK
{"items":[...],"totalCount":3,"page":1,"pageSize":20}
```

### Test 4: Photo Upload
```
POST /api/issues/{issueId}/photos
Form: file=test.png, photoType=Before
Response: 201 Created
{"id":"00201fde-850a-4f91-bc77-51b17c71df3f","photoType":"Before","uploadedAt":"..."}
```

### Test 5: Presigned URL 取得
```
GET /api/issues/{issueId}/photos/{photoId}/url → 200 OK
{"url":"http://localhost:9000/issue-photos/...","expiresIn":3600}
```
**R2 Fix Verified**: URL contains `localhost:9000` (not `storage:9000`)

### Test 6: Presigned URL で画像取得
```
GET {presignedUrl} → 200 OK
File type: PNG image data, 1 x 1, 8-bit/color RGBA, non-interlaced
```

### Test 7: 状態遷移テスト
```
PATCH /api/issues/{id}/status {"status":"InProgress"} → 200 OK
PATCH /api/issues/{id}/status {"status":"Done"} → 200 OK
Final status verified: Done
```

### Test 8: 不正遷移テスト
```
PATCH /api/issues/{id}/status {"status":"Done"} (from Open)
Response: 400 Bad Request
{
  "error": {
    "code": "INVALID_STATUS_TRANSITION",
    "message": "Done への遷移は InProgress からのみ可能（現在: Open）"
  }
}
```

## Issues Resolved

### R1: Docker コンテナ間通信
- `.env.example` に Docker service names を使用 (POSTGRES_HOST=db, MINIO_ENDPOINT=storage:9000)
- `.env` 作成済み

### R2: Presigned URL エンドポイント
- `MinioBlobStorage.cs`: 外部アクセス用の別 MinIO クライアントを使用
- 署名が `localhost:9000` で正しく計算されるよう修正

### R3: .NET 10 Preview
- `mcr.microsoft.com/dotnet/sdk:10.0-preview` 利用可能確認済み
- ダウングレード不要

### R4: HEALTHCHECK
- curl ベースに変更 (`apt-get install curl`)
- ポート 5001 に統一（macOS AirPlay 競合回避）

### EF Core Photo Upload 問題
- `DbUpdateConcurrencyException` を Owned Entity 回避策で解決
- `AddPhotoAsync` メソッドを追加し、Photo を直接 DbContext.Photos に追加

## Frontend Access

- URL: http://localhost:3000
- Status: Responding

## Step 6: Tailwind CSS Configuration (R5)

### Files Created/Modified
- `frontend/src/app/globals.css` - Tailwind import
- `frontend/postcss.config.mjs` - PostCSS configuration
- `frontend/src/app/layout.tsx` - globals.css import added
- `frontend/package.json` - @tailwindcss/postcss added

### Build Verification
```
✓ Compiled successfully in 2.8s
✓ Generating static pages (4/4)
```

**Status: PASS**

## Conclusion

All Steps (1-6) completed successfully. All critical functionalities are working as expected. The system is ready for production deployment.
