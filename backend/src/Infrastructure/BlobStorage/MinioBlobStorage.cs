using Minio;
using Minio.DataModel.Args;
using IssueManager.Api.Application.Interfaces;

namespace IssueManager.Api.Infrastructure.BlobStorage;

public class MinioBlobStorage : IBlobStorage
{
    private readonly IMinioClient _client;
    private readonly IMinioClient? _externalClient;
    private readonly string _bucket;

    public MinioBlobStorage(IMinioClient client, IConfiguration config)
    {
        _client = client;
        _bucket = config["MINIO_BUCKET"] ?? "issue-photos";

        // 外部アクセス用のPresigned URL生成には別クライアントを使用
        var externalEndpoint = config["MINIO_EXTERNAL_ENDPOINT"];
        if (!string.IsNullOrEmpty(externalEndpoint))
        {
            var accessKey = config["MINIO_ACCESS_KEY"] ?? "minioadmin";
            var secretKey = config["MINIO_SECRET_KEY"] ?? "minioadmin";
            var useSsl = config["MINIO_USE_SSL"] == "true";
            _externalClient = new MinioClient()
                .WithEndpoint(externalEndpoint)
                .WithCredentials(accessKey, secretKey)
                .WithSSL(useSsl)
                .Build();
        }
    }

    public async Task EnsureBucketAsync(CancellationToken ct = default)
    {
        var exists = await _client.BucketExistsAsync(
            new BucketExistsArgs().WithBucket(_bucket), ct);
        if (!exists)
        {
            await _client.MakeBucketAsync(
                new MakeBucketArgs().WithBucket(_bucket), ct);
        }
    }

    public async Task<string> UploadAsync(string key, Stream content, string contentType, CancellationToken ct = default)
    {
        await _client.PutObjectAsync(new PutObjectArgs()
            .WithBucket(_bucket)
            .WithObject(key)
            .WithStreamData(content)
            .WithObjectSize(content.Length)
            .WithContentType(contentType), ct);
        return key;
    }

    public async Task<Stream> DownloadAsync(string key, CancellationToken ct = default)
    {
        var ms = new MemoryStream();
        await _client.GetObjectAsync(new GetObjectArgs()
            .WithBucket(_bucket)
            .WithObject(key)
            .WithCallbackStream(stream => stream.CopyTo(ms)), ct);
        ms.Position = 0;
        return ms;
    }

    public async Task DeleteAsync(string key, CancellationToken ct = default)
    {
        await _client.RemoveObjectAsync(new RemoveObjectArgs()
            .WithBucket(_bucket)
            .WithObject(key), ct);
    }

    public async Task<string> GetPresignedUrlAsync(string key, int expirySeconds = 3600, CancellationToken ct = default)
    {
        // 外部クライアントがある場合はそちらでPresigned URLを生成（署名が正しく計算される）
        var client = _externalClient ?? _client;
        return await client.PresignedGetObjectAsync(new PresignedGetObjectArgs()
            .WithBucket(_bucket)
            .WithObject(key)
            .WithExpiry(expirySeconds));
    }
}
