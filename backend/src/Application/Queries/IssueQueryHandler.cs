using IssueManager.Api.Application.Interfaces;
using IssueManager.Api.Domain.Entities;

namespace IssueManager.Api.Application.Queries;

/// <summary>指摘一覧クエリ</summary>
public record GetIssueListQuery(int Page = 1, int PageSize = 20);

/// <summary>指摘詳細クエリ</summary>
public record GetIssueByIdQuery(Guid Id);

/// <summary>
/// Query Handler（読み取り責務）
/// 件数増加時の設計方針:
/// - Read Model を分離し、非正規化テーブルからクエリ
/// - Cursor-based pagination に移行
/// - PostgreSQL の BRIN インデックスで日時ベースフィルタを高速化
/// </summary>
public class IssueQueryHandler
{
    private readonly IIssueRepository _repo;
    private readonly IBlobStorage _blob;

    public IssueQueryHandler(IIssueRepository repo, IBlobStorage blob)
    {
        _repo = repo;
        _blob = blob;
    }

    public async Task<(IReadOnlyList<Issue> Items, int TotalCount)> HandleAsync(
        GetIssueListQuery query, CancellationToken ct)
    {
        return await _repo.GetListAsync(query.Page, query.PageSize, ct);
    }

    public async Task<Issue> HandleAsync(GetIssueByIdQuery query, CancellationToken ct)
    {
        return await _repo.GetByIdAsync(query.Id, ct)
            ?? throw new KeyNotFoundException($"Issue {query.Id} not found");
    }
}
