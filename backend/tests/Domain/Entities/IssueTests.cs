using Xunit;
using IssueManager.Api.Domain.Entities;
using IssueManager.Api.Domain.Enums;
using IssueManager.Api.Domain.ValueObjects;

namespace IssueManager.Api.Tests.Domain.Entities;

public class IssueTests
{
    // ── ヘルパー ──────────────────────────────────────────
    private static Issue CreateOpenIssue()
    {
        var location = new Location(
            LocationType.Space,
            dbId: null,
            new WorldPosition(10.0, 20.0, 30.0)
        );
        return Issue.Create(
            title: "テスト指摘",
            description: "テスト説明",
            issueType: IssueType.Safety,
            location: location
        );
    }

    // ── StartProgress ────────────────────────────────────

    [Fact]
    public void StartProgress_FromOpen_ChangesStatusToInProgress()
    {
        var issue = CreateOpenIssue();
        issue.StartProgress();
        Assert.Equal(IssueStatus.InProgress, issue.Status);
    }

    [Fact]
    public void StartProgress_FromInProgress_ThrowsInvalidOperationException()
    {
        var issue = CreateOpenIssue();
        issue.StartProgress();
        Assert.Throws<InvalidOperationException>(() => issue.StartProgress());
    }

    [Fact]
    public void StartProgress_FromDone_ThrowsInvalidOperationException()
    {
        var issue = CreateOpenIssue();
        issue.StartProgress();
        issue.Complete();
        Assert.Throws<InvalidOperationException>(() => issue.StartProgress());
    }

    // ── Complete ─────────────────────────────────────────

    [Fact]
    public void Complete_FromInProgress_ChangesStatusToDone()
    {
        var issue = CreateOpenIssue();
        issue.StartProgress();
        issue.Complete();
        Assert.Equal(IssueStatus.Done, issue.Status);
    }

    [Fact]
    public void Complete_FromOpen_ThrowsInvalidOperationException()
    {
        var issue = CreateOpenIssue();
        Assert.Throws<InvalidOperationException>(() => issue.Complete());
    }

    [Fact]
    public void Complete_FromDone_ThrowsInvalidOperationException()
    {
        var issue = CreateOpenIssue();
        issue.StartProgress();
        issue.Complete();
        Assert.Throws<InvalidOperationException>(() => issue.Complete());
    }

    // ── 状態遷移シーケンス ────────────────────────────────

    [Fact]
    public void FullTransition_OpenToInProgressToDone_Succeeds()
    {
        var issue = CreateOpenIssue();
        Assert.Equal(IssueStatus.Open, issue.Status);
        issue.StartProgress();
        Assert.Equal(IssueStatus.InProgress, issue.Status);
        issue.Complete();
        Assert.Equal(IssueStatus.Done, issue.Status);
    }

    // ── UpdateDescription ─────────────────────────────────

    [Fact]
    public void UpdateDescription_WithValidText_UpdatesDescription()
    {
        var issue = CreateOpenIssue();
        issue.UpdateDescription("更新された説明");
        Assert.Equal("更新された説明", issue.Description);
    }

    // ── AddPhoto ──────────────────────────────────────────

    [Fact]
    public void AddPhoto_ValidPhoto_AppearsInPhotosCollection()
    {
        var issue = CreateOpenIssue();
        var photo = Photo.Create(blobKey: "photos/test.jpg", photoType: PhotoType.After);
        issue.AddPhoto(photo);
        Assert.Single(issue.Photos);
        Assert.Contains(issue.Photos, p => p.BlobKey == "photos/test.jpg");
    }

    // ── Create ────────────────────────────────────────────

    [Fact]
    public void Create_WithEmptyTitle_ThrowsArgumentException()
    {
        var location = new Location(LocationType.Space, null, new WorldPosition(0, 0, 0));
        Assert.Throws<ArgumentException>(() =>
            Issue.Create(
                title: "",
                description: "説明",
                issueType: IssueType.Quality,
                location: location
            )
        );
    }

    [Fact]
    public void Create_WithValidData_SetsInitialStatusToOpen()
    {
        var issue = CreateOpenIssue();
        Assert.Equal(IssueStatus.Open, issue.Status);
    }

    [Fact]
    public void Create_WithValidData_GeneratesNonEmptyId()
    {
        var issue = CreateOpenIssue();
        Assert.NotEqual(Guid.Empty, issue.Id);
    }
}
