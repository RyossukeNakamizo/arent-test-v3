using Microsoft.AspNetCore.Mvc;
using IssueManager.Api.Application.Commands;
using IssueManager.Api.Application.Queries;
using IssueManager.Api.Domain.Enums;
using IssueManager.Api.Domain.ValueObjects;

namespace IssueManager.Api.Api.Controllers;

[ApiController]
[Route("api/issues")]
public class IssuesController : ControllerBase
{
    private readonly IssueCommandHandler _commands;
    private readonly IssueQueryHandler _queries;

    public IssuesController(IssueCommandHandler commands, IssueQueryHandler queries)
    {
        _commands = commands;
        _queries = queries;
    }

    /// <summary>指摘一覧取得</summary>
    [HttpGet]
    public async Task<IActionResult> GetList([FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        var (items, totalCount) = await _queries.HandleAsync(new GetIssueListQuery(page, pageSize), ct);
        return Ok(new
        {
            items = items.Select(i => MapToDto(i)),
            totalCount,
            page,
            pageSize
        });
    }

    /// <summary>指摘詳細取得</summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        try
        {
            var issue = await _queries.HandleAsync(new GetIssueByIdQuery(id), ct);
            return Ok(MapToDto(issue));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = new { code = "NOT_FOUND", message = $"Issue {id} not found" } });
        }
    }

    /// <summary>指摘作成</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateIssueRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Title))
            return BadRequest(new { error = new { code = "VALIDATION_ERROR", message = "title is required" } });

        try
        {
            var cmd = new CreateIssueCommand(
                req.Title,
                req.Description ?? "",
                Enum.Parse<IssueType>(req.IssueType, true),
                Enum.Parse<LocationType>(req.Location.Type, true),
                req.Location.DbId,
                req.Location.WorldPosition is { } wp ? new WorldPosition(wp.X, wp.Y, wp.Z) : null
            );
            var id = await _commands.HandleAsync(cmd, ct);
            return Created($"/api/issues/{id}", new { id, status = "Open", createdAt = DateTime.UtcNow });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = new { code = "VALIDATION_ERROR", message = ex.Message } });
        }
    }

    /// <summary>状態遷移</summary>
    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> TransitionStatus(Guid id, [FromBody] TransitionStatusRequest req, CancellationToken ct)
    {
        try
        {
            var target = Enum.Parse<IssueStatus>(req.Status, true);
            await _commands.HandleAsync(new TransitionStatusCommand(id, target), ct);
            return Ok(new { id, status = req.Status, updatedAt = DateTime.UtcNow });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = new { code = "NOT_FOUND", message = $"Issue {id} not found" } });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = new { code = "INVALID_STATUS_TRANSITION", message = ex.Message } });
        }
    }

    /// <summary>指摘内容更新</summary>
    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateIssueRequest req, CancellationToken ct)
    {
        try
        {
            var issue = await _commands.HandleAsync(new UpdateIssueCommand(id, req.Description), ct);
            return Ok(MapToDto(issue));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = new { code = "NOT_FOUND", message = $"Issue {id} not found" } });
        }
    }

    private static object MapToDto(Domain.Entities.Issue i) => new
    {
        i.Id,
        i.Title,
        i.Description,
        issueType = i.IssueType.ToString(),
        status = i.Status.ToString(),
        location = new
        {
            type = i.Location.Type.ToString(),
            dbId = i.Location.DbId,
            worldPosition = i.Location.WorldPosition is { } wp ? new { wp.X, wp.Y, wp.Z } : null
        },
        photos = i.Photos.Select(p => new
        {
            p.Id,
            p.BlobKey,
            photoType = p.PhotoType.ToString(),
            p.UploadedAt
        }),
        photoCount = i.Photos.Count,
        i.CreatedAt,
        i.UpdatedAt
    };
}

// --- Request DTOs ---

public record CreateIssueRequest(string Title, string? Description, string IssueType, LocationRequest Location);
public record LocationRequest(string Type, int? DbId, WorldPositionRequest? WorldPosition);
public record WorldPositionRequest(double X, double Y, double Z);
public record TransitionStatusRequest(string Status);
public record UpdateIssueRequest(string? Description);
