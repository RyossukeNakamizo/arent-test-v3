using Microsoft.AspNetCore.Mvc;
using IssueManager.Api.Application.Interfaces;

namespace IssueManager.Api.Api.Controllers;

[ApiController]
[Route("api/aps")]
public class ApsController : ControllerBase
{
    private readonly IApsTokenProvider _tokenProvider;

    public ApsController(IApsTokenProvider tokenProvider) => _tokenProvider = tokenProvider;

    /// <summary>
    /// APS Viewer トークン取得（Token Proxy）
    /// Client Secret はフロントに露出しない。
    /// </summary>
    [HttpGet("token")]
    public async Task<IActionResult> GetToken(CancellationToken ct)
    {
        try
        {
            var (accessToken, expiresIn) = await _tokenProvider.GetTokenAsync(ct);
            return Ok(new { access_token = accessToken, expires_in = expiresIn });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = new { code = "APS_TOKEN_ERROR", message = ex.Message } });
        }
    }

    /// <summary>APS Model URN取得</summary>
    [HttpGet("urn")]
    public IActionResult GetUrn([FromServices] IConfiguration config)
    {
        var urn = config["APS_MODEL_URN"];
        if (string.IsNullOrEmpty(urn))
            return StatusCode(500, new { error = new { code = "CONFIG_ERROR", message = "APS_MODEL_URN not configured" } });
        return Ok(new { urn });
    }
}
