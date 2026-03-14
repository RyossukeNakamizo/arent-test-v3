using Microsoft.EntityFrameworkCore;
using Minio;
using IssueManager.Api.Application.Commands;
using IssueManager.Api.Application.Queries;
using IssueManager.Api.Application.Interfaces;
using IssueManager.Api.Infrastructure.Persistence;
using IssueManager.Api.Infrastructure.BlobStorage;
using IssueManager.Api.Infrastructure.ApsProxy;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration.AddEnvironmentVariables();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

// PostgreSQL
var connStr = $"Host={Env("POSTGRES_HOST", "localhost")};" +
              $"Port={Env("POSTGRES_PORT", "5432")};" +
              $"Database={Env("POSTGRES_DB", "issue_manager")};" +
              $"Username={Env("POSTGRES_USER", "postgres")};" +
              $"Password={Env("POSTGRES_PASSWORD", "postgres")}";
builder.Services.AddDbContext<AppDbContext>(opt => opt.UseNpgsql(connStr));

// MinIO
builder.Services.AddSingleton<IMinioClient>(_ =>
    new MinioClient()
        .WithEndpoint(Env("MINIO_ENDPOINT", "localhost:9000"))
        .WithCredentials(Env("MINIO_ACCESS_KEY", "minioadmin"), Env("MINIO_SECRET_KEY", "minioadmin"))
        .WithSSL(Env("MINIO_USE_SSL", "false") == "true")
        .Build());

// DI: Infrastructure → Domain interfaces
builder.Services.AddScoped<IIssueRepository, PostgresIssueRepository>();
builder.Services.AddScoped<IBlobStorage, MinioBlobStorage>();
builder.Services.AddHttpClient<IApsTokenProvider, ApsTokenProvider>();

// DI: Application handlers
builder.Services.AddScoped<IssueCommandHandler>();
builder.Services.AddScoped<IssueQueryHandler>();

var app = builder.Build();

// Startup: Auto-migrate + MinIO bucket
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.EnsureCreatedAsync();
    var blob = scope.ServiceProvider.GetRequiredService<IBlobStorage>() as MinioBlobStorage;
    if (blob is not null) await blob.EnsureBucketAsync();
}

app.UseCors();
app.UseSwagger();
app.UseSwaggerUI();
app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));
app.Run();

static string Env(string key, string fallback) =>
    Environment.GetEnvironmentVariable(key) ?? fallback;
