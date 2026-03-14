namespace IssueManager.Api.Domain.Enums;

/// <summary>
/// 指摘ステータス。遷移ルール: Open → InProgress → Done（逆行不可）
/// ビジネスルールは Issue エンティティ内で制御する。
/// </summary>
public enum IssueStatus
{
    Open = 0,
    InProgress = 1,
    Done = 2
}
