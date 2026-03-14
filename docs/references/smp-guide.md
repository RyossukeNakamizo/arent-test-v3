# Same Mistake Prevention（SMP）運用ガイド

## LLMの構造的弱点への対策
1. コンテキスト増大→精度低下: JIT参照でロードを最小化
2. セッション間記憶喪失: DEBUG/KNOWN-ERRORSをファイルに外部化
3. Agent Teams独立コンテキスト: CLAUDE.md+KNOWN-ERRORSが構造的共有記憶

## デバッグ即時記録フロー
エラー発生→作業中断→DEBUG-{NNN}.md作成→KNOWN-ERRORS確認(既出?)→
YES(2回目)→昇格登録→Hooks更新 / NO(初回)→修正→根本原因・再発防止策記録

## Agent Teams での SMP
- Lead: DEBUG監視・KNOWN-ERRORS昇格判断・Hooks更新
- Teammate: 実装前にKNOWN-ERRORS必読。エラー→即DEBUG作成。完了時にDEBUG件数報告
- メッセージ例: 「DEBUG-003にエラー記録した、確認して」
