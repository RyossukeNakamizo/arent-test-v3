using Microsoft.EntityFrameworkCore;
using IssueManager.Api.Application.Interfaces;
using IssueManager.Api.Domain.Entities;

namespace IssueManager.Api.Infrastructure.Persistence;

public class PostgresIssueRepository : IIssueRepository
{
    private readonly AppDbContext _db;

    public PostgresIssueRepository(AppDbContext db) => _db = db;

    public async Task<Issue?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _db.Issues
            .Include(i => i.Photos)
            .FirstOrDefaultAsync(i => i.Id == id, ct);
    }

    public async Task<(IReadOnlyList<Issue> Items, int TotalCount)> GetListAsync(
        int page, int pageSize, CancellationToken ct = default)
    {
        var total = await _db.Issues.CountAsync(ct);
        var items = await _db.Issues
            .Include(i => i.Photos)
            .OrderByDescending(i => i.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);
        return (items, total);
    }

    public async Task AddAsync(Issue issue, CancellationToken ct = default)
    {
        _db.Issues.Add(issue);
        await _db.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(Issue issue, CancellationToken ct = default)
    {
        // エンティティが既にトラッキングされている場合は変更を自動検出
        // 新しいPhotosはEF Coreが自動的に検出してINSERTする
        // Issueの変更（UpdatedAt等）も自動検出される
        await _db.SaveChangesAsync(ct);
    }

    public async Task<bool> ExistsAsync(Guid id, CancellationToken ct = default)
    {
        return await _db.Issues.AnyAsync(i => i.Id == id, ct);
    }

    public async Task AddPhotoAsync(Guid issueId, Photo photo, CancellationToken ct = default)
    {
        // Photo を直接追加（IssueId shadow property をセット）
        _db.Photos.Add(photo);
        _db.Entry(photo).Property("IssueId").CurrentValue = issueId;

        // Issue の UpdatedAt を更新（Owned Entity の変更追跡問題を回避）
        await _db.Issues
            .Where(i => i.Id == issueId)
            .ExecuteUpdateAsync(s => s.SetProperty(i => i.UpdatedAt, DateTime.UtcNow), ct);

        await _db.SaveChangesAsync(ct);
    }
}
