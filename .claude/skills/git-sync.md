# /git-sync - ローカルGit同期

変更をローカルベアリポジトリに同期するスキル。

## 使い方

```
/git-sync [コミットメッセージ]
```

## 実行手順

1. `git status` で変更を確認
2. `git add -A` で全変更をステージング
3. `git commit -m "メッセージ"` でコミット（メッセージ指定がない場合は変更内容から自動生成）
4. `git push local main` でローカルベアリポジトリに同期

## コミットメッセージ規則

- 指定がない場合: 変更ファイルから自動生成
- Co-Authored-By を自動付与

## リポジトリ構成

```
/Users/ryosukenakamizo/Desktop/arent-test-v3/
├── .git/                    ← ワーキングリポジトリ
└── git/
    └── arent-test-v3.git/   ← ベアリポジトリ（同期先）
```

## 注意事項

- secret.json, .env 等の機密ファイルは .gitignore で除外済み
- 破壊的操作（force push, hard reset）は実行しない
