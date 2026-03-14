# コンテキスト管理方針

## 4層メモリ
Layer2(CLAUDE.md+KNOWN-ERRORS)=全Agent常駐 / Layer3(AutoMemory+SubagentMEMORY)
Layer4(各Agentセッション)=独立・/compact対象。AgentTeams時はTeammate別

## JIT参照: resource-map.md参照。必要な時だけロード
## /compact: 残量40%→実行→CLAUDE.md+KNOWN-ERRORS+todo再読込
## Handoff: 30往復超→即生成。終了時→handoff-{date}.yaml必須
