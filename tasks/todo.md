# タスク管理

## Phase 1: 設計
- [x] プロジェクトスキャフォールド（32ファイル + frontend/backend scaffold）
- [x] アーキテクチャ図（Mermaid） — docs/designs/architecture.md
- [x] ER図（Mermaid） — docs/designs/er-diagram.md
- [x] API設計書（エンドポイント + Request/Response） — docs/designs/api-design.md
- [x] シーケンス図: Token Proxy / ピン登録 / 指摘CRUD / 一覧→3D連携 — docs/designs/sequence-diagrams.md
- [x] README 設計記述 8.1-8.6 完備
- [x] Domain層 scaffold（Issue/Photo/Location/Enums）
- [x] Application層 scaffold（Commands/Queries/Interfaces）
- [ ] APS Viewer v7 + 2-legged OAuth 仕様調査 → ADR
- [ ] docker-compose構成の動作検証
- [ ] QCD Gate Phase 1 → git tag phase-1-design

## Phase 2: 実装
- [x] Backend: Infrastructure層（EF Core DbContext / MinIO実装 / APS Token Provider）
- [x] Backend: API Controllers（指摘CRUD / Token Proxy / Photo Upload）
- [x] Frontend: APS Viewer v7統合（Token Proxy経由）
- [x] Frontend: ピンUI（dbId + worldPosition hitTest）
- [x] Frontend: 指摘入力フォーム / 写真アップロード / 一覧 / 3D連携
- [x] docker-compose.yml 4サービス起動確認（NEXT_PUBLIC_API_BASE_URL修正済み）
- [ ] QCD Gate Phase 2 → git tag phase-2-impl

## Phase 3: QA
- [ ] ドメイン層ユニットテスト（状態遷移 / Location バリデーション）
- [ ] Docker全サービスヘルスチェック
- [ ] API手動確認（curl）
- [ ] QA Report → Supervisor → CEO
- [ ] QCD Gate Phase 3 → git tag phase-3-qa

## Phase 4: 納品
- [ ] README最終確認（設計記述8項目 + Docker手順）
- [ ] 確認書作成
- [ ] git tag phase-4-release

## 進行中
（なし）

## 完了
（なし）
