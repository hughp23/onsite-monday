using Amazon.S3;
using Amazon.S3.Model;

namespace OnsiteMonday.Api.Services;

public class S3StorageService : IStorageService
{
    private readonly IAmazonS3 _s3;
    private readonly string _bucket;
    private readonly string _region;

    public S3StorageService(IAmazonS3 s3, IConfiguration config)
    {
        _s3 = s3;
        _bucket = config["Aws:S3Bucket"]
            ?? throw new InvalidOperationException("Aws:S3Bucket is not configured.");
        _region = config["Aws:Region"]
            ?? throw new InvalidOperationException("Aws:Region is not configured.");
    }

    public Task<(string UploadUrl, string PublicUrl)> GenerateProfileImageUploadUrlAsync(
        string userId, string contentType)
    {
        var ext = contentType == "image/png" ? "png" : "jpg";
        var key = $"profile-images/{userId}.{ext}";

        var uploadUrl = _s3.GetPreSignedURL(new GetPreSignedUrlRequest
        {
            BucketName = _bucket,
            Key = key,
            Verb = HttpVerb.PUT,
            ContentType = contentType,
            Expires = DateTime.UtcNow.AddMinutes(5),
        });

        var publicUrl = $"https://{_bucket}.s3.{_region}.amazonaws.com/{key}";
        return Task.FromResult((uploadUrl, publicUrl));
    }
}
