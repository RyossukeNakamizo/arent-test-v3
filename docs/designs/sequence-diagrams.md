# シーケンス図

## 1. Token Proxy（APS認証フロー）

```mermaid
sequenceDiagram
    participant B as Browser (Next.js)
    participant API as Backend API
    participant Cache as Token Cache
    participant APS as APS Auth API

    B->>API: GET /api/aps/token
    API->>Cache: キャッシュ確認
    alt キャッシュヒット（有効期限内）
        Cache-->>API: cached token
    else キャッシュミス or 期限切れ
        API->>APS: POST /authentication/v2/token<br/>(client_id + client_secret)
        APS-->>API: { access_token, expires_in }
        API->>Cache: トークン保存（expires_in - 60s）
    end
    API-->>B: { access_token, expires_in }
    Note over B: Autodesk.Viewing.Initializer(token)
    Note over B: viewer.loadDocumentNode(urn)
```

**設計判断**: Client Secret はサーバーサイドのみ。キャッシュ有効期限はAPIレスポンスの `expires_in` より60秒短く設定し、期限切れトークンをフロントに返さない。

---

## 2. ピン登録（指摘作成フロー）

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant V as APS Viewer
    participant UI as Next.js UI
    participant API as Backend API
    participant Dom as Domain Layer
    participant DB as PostgreSQL

    U->>V: 3Dモデル上をクリック
    V-->>UI: hitTest結果<br/>{dbId, worldPosition}
    UI->>UI: 指摘入力フォーム表示
    U->>UI: タイトル・内容・カテゴリ入力
    U->>UI: 送信
    UI->>API: POST /api/issues<br/>{title, description, issueType, location}
    API->>Dom: Issue.Create(...)
    Dom->>Dom: Location バリデーション<br/>(Element→dbId必須 / Space→worldPosition必須)
    Dom-->>API: Issue エンティティ
    API->>DB: INSERT INTO issues
    DB-->>API: OK
    API-->>UI: 201 Created { id, status: "Open" }
    UI->>V: ピンアイコン描画<br/>(viewer.overlays)
```

---

## 3. 指摘CRUD + 写真アップロード

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant UI as Next.js UI
    participant API as Backend API
    participant Dom as Domain Layer
    participant Blob as MinIO
    participant DB as PostgreSQL

    Note over U,DB: 写真アップロード（Blob先行保存戦略）
    U->>UI: 写真ファイル選択（是正前）
    UI->>API: POST /api/issues/{id}/photos<br/>(multipart: file + photoType)
    API->>Blob: PutObject(key, stream)
    Blob-->>API: OK (BlobKey確定)
    API->>Dom: Photo.Create(blobKey, Before)
    API->>Dom: issue.AddPhoto(photo)
    API->>DB: UPDATE issues (Photos追加)
    alt DB登録成功
        DB-->>API: OK
        API-->>UI: 201 Created
    else DB登録失敗
        API->>Blob: DeleteObject(key)
        Note over Blob: 孤立Blob即時削除（ベストエフォート）
        API-->>UI: 500 Error
    end

    Note over U,DB: 状態遷移
    U->>UI: ステータス変更 "InProgress"
    UI->>API: PATCH /api/issues/{id}/status
    API->>Dom: issue.StartProgress()
    Dom->>Dom: Open → InProgress 検証
    API->>DB: UPDATE issues SET status
    API-->>UI: 200 OK
```

---

## 4. 一覧→3D位置連携

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant List as 指摘一覧パネル
    participant API as Backend API
    participant V as APS Viewer

    List->>API: GET /api/issues?page=1
    API-->>List: { items: [...], totalCount }
    List->>List: 一覧テーブル描画

    U->>List: 指摘行クリック
    List->>List: location 取得

    alt 部材指摘 (Element)
        List->>V: viewer.select([dbId])
        List->>V: viewer.fitToView([dbId])
        V->>V: 部材ハイライト + カメラ移動
    else 空間指摘 (Space)
        List->>V: viewer.navigation.setPosition(worldPosition)
        List->>V: viewer.navigation.setTarget(worldPosition)
        V->>V: カメラを指定座標に移動
    end

    Note over V: ピンアイコンとツールチップ表示
```
