# Phase Gate Guide

## Phase定義×Git×QCD
### Phase 1 設計: アーキテクチャ図/ER図/API設計/シーケンス図 → Supervisor承認
`git commit -m "phase-1: design"` → `git tag phase-1-design`
### Phase 2 実装: 全API/Frontend/Docker起動/要求機能6項目
`git commit -m "phase-2: impl"` → `git tag phase-2-impl`
### Phase 3 QA: ユニットテスト/ヘルスチェック/QA Report/KNOWN-ERRORS最終レビュー
`git commit -m "phase-3: qa"` → `git tag phase-3-qa`
### Phase 4 納品: README8項目/確認書/gitignore/Docker手順
`git commit -m "phase-4: release"` → `git tag phase-4-release`

## QCD Gate
Phase完了→QCDテンプレコピー→Quality/Cost/Delivery記入→CEO承認→git tag→次Phase
次Phase開始時: 前Phase の ADR + DEBUG + QCD を全レビューしてから着手
