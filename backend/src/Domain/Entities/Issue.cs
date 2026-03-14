using IssueManager.Api.Domain.Enums;
using IssueManager.Api.Domain.ValueObjects;

namespace IssueManager.Api.Domain.Entities;

/// <summary>
/// 指摘（集約ルート）
/// 状態遷移ルールはこのエンティティ内で制御。
/// Open → InProgress → Done（逆行不可・スキップ不可）
/// </summary>
public class Issue
{
    public Guid Id { get; private set; }
    public string Title { get; private set; } = default!;
    public string Description { get; private set; } = default!;
    public IssueType IssueType { get; private set; }
    public IssueStatus Status { get; private set; }
    public Location Location { get; private set; } = default!;
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private readonly List<Photo> _photos = new();
    public IReadOnlyCollection<Photo> Photos => _photos.AsReadOnly();

    private Issue() { } // EF Core用

    public static Issue Create(string title, string description, IssueType issueType, Location location)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new ArgumentException("タイトルは必須です");

        return new Issue
        {
            Id = Guid.NewGuid(),
            Title = title,
            Description = description,
            IssueType = issueType,
            Status = IssueStatus.Open,
            Location = location,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    /// <summary>状態遷移: Open → InProgress</summary>
    public void StartProgress()
    {
        if (Status != IssueStatus.Open)
            throw new InvalidOperationException($"InProgress への遷移は Open からのみ可能（現在: {Status}）");
        Status = IssueStatus.InProgress;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>状態遷移: InProgress → Done</summary>
    public void Complete()
    {
        if (Status != IssueStatus.InProgress)
            throw new InvalidOperationException($"Done への遷移は InProgress からのみ可能（現在: {Status}）");
        Status = IssueStatus.Done;
        UpdatedAt = DateTime.UtcNow;
    }

    public void AddPhoto(Photo photo)
    {
        _photos.Add(photo);
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateDescription(string description)
    {
        Description = description;
        UpdatedAt = DateTime.UtcNow;
    }
}
