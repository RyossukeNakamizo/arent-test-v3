using Microsoft.AspNetCore.Mvc;
using IssueManager.Api.Application.Commands;
using IssueManager.Api.Application.Interfaces;
using IssueManager.Api.Domain.Enums;

namespace IssueManager.Api.Api.Controllers;

[ApiController]
[Route("api/issues/{issueId:guid}/photos")]
public class PhotosController : ControllerBase
{
    private readonly IssueCommandHandler _commands;
    private readonly IBlobStorage _blob;

    public PhotosController(IssueCommandHandler commands, IBlobStorage blob)
    {
        _commands = commands;
        _blob = blob;
    }

    /// <summary>写真アップロード（Blob先行保存戦略）</summary>
    [HttpPost]
    [RequestSizeLimit(10 * 1024 * 1024)] // 10MB
    public async Task<IActionResult> Upload(Guid issueId, IFormFile file, [FromForm] string photoType, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { error = new { code = "VALIDATION_ERROR", message = "file is required" } });

        if (!Enum.TryParse<PhotoType>(photoType, true, out var pt))
            return BadRequest(new { error = new { code = "VALIDATION_ERROR", message = "photoType must be Before or After" } });

        try
        {
            using var stream = file.OpenReadStream();
            var cmd = new UploadPhotoCommand(issueId, stream, file.ContentType, pt);
            var photoId = await _commands.HandleAsync(cmd, ct);
            return Created($"/api/issues/{issueId}/photos/{photoId}", new
            {
                id = photoId,
                photoType = pt.ToString(),
                uploadedAt = DateTime.UtcNow
            });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = new { code = "NOT_FOUND", message = $"Issue {issueId} not found" } });
        }
    }

    /// <summary>写真Presigned URL取得</summary>
    [HttpGet("{photoId:guid}/url")]
    public async Task<IActionResult> GetPresignedUrl(Guid issueId, Guid photoId, CancellationToken ct)
    {
        // Construct the blob key pattern
        var key = $"issues/{issueId}/photos/{photoId}";
        try
        {
            var url = await _blob.GetPresignedUrlAsync(key, 3600, ct);
            return Ok(new { url, expiresIn = 3600 });
        }
        catch
        {
            return NotFound(new { error = new { code = "NOT_FOUND", message = "Photo not found" } });
        }
    }
}
