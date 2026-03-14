using IssueManager.Api.Domain.Entities;

namespace IssueManager.Api.Application.Interfaces;

/// <summary>
/// Issue リポジトリ抽象（永続化戦略 8.4）
/// Domain層はこのインターフェースのみ参照。DB実装の詳細を知らない。
/// </summary>
public interface IIssueRepository
{
    Task<Issue?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<(IReadOnlyList<Issue> Items, int TotalCount)> GetListAsync(int page, int pageSize, CancellationToken ct = default);
    Task AddAsync(Issue issue, CancellationToken ct = default);
    Task UpdateAsync(Issue issue, CancellationToken ct = default);
    Task<bool> ExistsAsync(Guid id, CancellationToken ct = default);
    Task AddPhotoAsync(Guid issueId, Photo photo, CancellationToken ct = default);
}

/// <summary>
/// Blob ストレージ抽象（外部依存隔離 8.5）
/// MinIO / Azure Blob / S3 を差し替え可能にする。
/// </summary>
public interface IBlobStorage
{
    Task<string> UploadAsync(string key, Stream content, string contentType, CancellationToken ct = default);
    Task<Stream> DownloadAsync(string key, CancellationToken ct = default);
    Task DeleteAsync(string key, CancellationToken ct = default);
    Task<string> GetPresignedUrlAsync(string key, int expirySeconds = 3600, CancellationToken ct = default);
}

/// <summary>
/// APS Token Provider 抽象（外部依存隔離 8.5）
/// 2-legged OAuth の実装詳細を Application層から隔離。
/// </summary>
public interface IApsTokenProvider
{
    Task<(string AccessToken, int ExpiresIn)> GetTokenAsync(CancellationToken ct = default);
}
