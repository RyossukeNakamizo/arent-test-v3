using IssueManager.Api.Domain.Enums;

namespace IssueManager.Api.Domain.Entities;

/// <summary>写真エンティティ（Issue集約の子）</summary>
public class Photo
{
    public Guid Id { get; private set; }
    public string BlobKey { get; private set; } = default!;
    public PhotoType PhotoType { get; private set; }
    public DateTime UploadedAt { get; private set; }

    private Photo() { }

    public static Photo Create(string blobKey, PhotoType photoType)
    {
        if (string.IsNullOrWhiteSpace(blobKey))
            throw new ArgumentException("BlobKey は必須です");

        return new Photo
        {
            Id = Guid.NewGuid(),
            BlobKey = blobKey,
            PhotoType = photoType,
            UploadedAt = DateTime.UtcNow
        };
    }

    /// <summary>外部指定のIdでPhoto作成（BlobKeyとIdの一貫性確保用）</summary>
    public static Photo CreateWithId(Guid id, string blobKey, PhotoType photoType)
    {
        if (id == Guid.Empty)
            throw new ArgumentException("Id は必須です");
        if (string.IsNullOrWhiteSpace(blobKey))
            throw new ArgumentException("BlobKey は必須です");

        return new Photo
        {
            Id = id,
            BlobKey = blobKey,
            PhotoType = photoType,
            UploadedAt = DateTime.UtcNow
        };
    }
}
