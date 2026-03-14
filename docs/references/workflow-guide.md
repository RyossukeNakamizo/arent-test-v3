# ワークフロー詳細

## 全体フロー
開始→CLAUDE.md+KNOWN-ERRORS+todo+handoff読込→Phase確認
Phase1(設計): Supervisor(opus)+Research(haiku)→Mermaid図→QA→CEO承認→QCD→tag
Phase2(実装): AgentTeams(frontend+backend並列sonnet)→DEBUG即記録→QCD→tag
Phase3(QA): QA(sonnet)→問題Top10→Supervisor→CEO→修正→QCD→tag
Phase4(納品): README8項目→確認書→tag

## QAレビュー集約
QA検証→DEBUG即記録→優先度Top10→Supervisor集約→CEO提示→承認→実装反映

## ブランチ: main←develop←feature/{agent}-{task}
