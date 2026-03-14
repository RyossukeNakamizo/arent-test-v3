using IssueManager.Api.Application.Interfaces;
using IssueManager.Api.Domain.Entities;
using IssueManager.Api.Domain.Enums;
using IssueManager.Api.Domain.ValueObjects;

namespace IssueManager.Api.Application.Commands;

/// <summary>指摘作成コマンド</summary>
public record CreateIssueCommand(
    string Title,
    string Description,
    IssueType IssueType,
    LocationType LocationType,
    int? DbId,
    WorldPosition? WorldPosition
);

/// <summary>写真アップロードコマンド</summary>
public record UploadPhotoCommand(Guid IssueId, Stream FileStream, string ContentType, PhotoType PhotoType);

/// <summary>状態遷移コマンド</summary>
public record TransitionStatusCommand(Guid IssueId, IssueStatus TargetStatus);

/// <summary>指摘内容更新コマンド</summary>
public record UpdateIssueCommand(Guid IssueId, string? Description);

/// <summary>
/// Command Handler（書き込み責務）
/// Blob整合性戦略: MinIO先行保存 → DB後続登録 → 失敗時は孤立Blobをバッチ削除
/// </summary>
public class IssueCommandHandler
{
    private readonly IIssueRepository _repo;
    private readonly IBlobStorage _blob;

    public IssueCommandHandler(IIssueRepository repo, IBlobStorage blob)
    {
        _repo = repo;
        _blob = blob;
    }

    public async Task<Guid> HandleAsync(CreateIssueCommand cmd, CancellationToken ct)
    {
        var location = new Location(cmd.LocationType, cmd.DbId, cmd.WorldPosition);
        var issue = Issue.Create(cmd.Title, cmd.Description, cmd.IssueType, location);
        await _repo.AddAsync(issue, ct);
        return issue.Id;
    }

    public async Task<Guid> HandleAsync(UploadPhotoCommand cmd, CancellationToken ct)
    {
        // Issueの存在確認（Owned Entity の読み込みを回避）
        if (!await _repo.ExistsAsync(cmd.IssueId, ct))
            throw new KeyNotFoundException($"Issue {cmd.IssueId} not found");

        // 同一GuidをBlobKeyとPhoto.Idに使用（Presigned URL取得時の一貫性確保）
        var photoId = Guid.NewGuid();
        var blobKey = $"issues/{cmd.IssueId}/photos/{photoId}";

        // Blob先行保存（整合性戦略: MinIO先行 → DB後続）
        await _blob.UploadAsync(blobKey, cmd.FileStream, cmd.ContentType, ct);

        try
        {
            // Photo を直接追加（EF Core Owned Entity の変更追跡問題を回避）
            var photo = Photo.CreateWithId(photoId, blobKey, cmd.PhotoType);
            await _repo.AddPhotoAsync(cmd.IssueId, photo, ct);
            return photo.Id;
        }
        catch
        {
            // DB登録失敗時: 孤立Blobは定期バッチで削除（ベストエフォート）
            await _blob.DeleteAsync(blobKey, ct).ConfigureAwait(false);
            throw;
        }
    }

    public async Task HandleAsync(TransitionStatusCommand cmd, CancellationToken ct)
    {
        var issue = await _repo.GetByIdAsync(cmd.IssueId, ct)
            ?? throw new KeyNotFoundException($"Issue {cmd.IssueId} not found");

        switch (cmd.TargetStatus)
        {
            case IssueStatus.InProgress: issue.StartProgress(); break;
            case IssueStatus.Done: issue.Complete(); break;
            default: throw new ArgumentException($"Invalid target status: {cmd.TargetStatus}");
        }

        await _repo.UpdateAsync(issue, ct);
    }

    public async Task<Issue> HandleAsync(UpdateIssueCommand cmd, CancellationToken ct)
    {
        var issue = await _repo.GetByIdAsync(cmd.IssueId, ct)
            ?? throw new KeyNotFoundException($"Issue {cmd.IssueId} not found");

        if (cmd.Description is not null)
            issue.UpdateDescription(cmd.Description);

        await _repo.UpdateAsync(issue, ct);
        return issue;
    }
}
