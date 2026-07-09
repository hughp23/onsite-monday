using Amazon.S3;
using Amazon.S3.Model;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Moq;
using OnsiteMonday.Api.Services;

namespace OnsiteMonday.Api.Tests.Unit;

public class StorageServiceTests
{
    private static IConfiguration MakeConfig(string bucket = "onsite-monday-media") =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Aws:S3Bucket"] = bucket,
                ["Aws:Region"] = "eu-west-2",
            })
            .Build();

    [Fact]
    public async Task GenerateProfileImageUploadUrlAsync_Jpeg_ReturnsCorrectUrls()
    {
        var s3Mock = new Mock<IAmazonS3>();
        s3Mock
            .Setup(m => m.GetPreSignedURL(It.IsAny<GetPreSignedUrlRequest>()))
            .Returns("https://onsite-monday-media.s3.eu-west-2.amazonaws.com/profile-images/user-123.jpg?X-Amz-Signature=abc");

        var sut = new S3StorageService(s3Mock.Object, MakeConfig());

        var (uploadUrl, publicUrl) = await sut.GenerateProfileImageUploadUrlAsync("user-123", "image/jpeg");

        uploadUrl.Should().StartWith("https://onsite-monday-media.s3.eu-west-2.amazonaws.com/profile-images/user-123.jpg?");
        publicUrl.Should().Be("https://onsite-monday-media.s3.eu-west-2.amazonaws.com/profile-images/user-123.jpg");
    }

    [Fact]
    public async Task GenerateProfileImageUploadUrlAsync_Png_UsesPngExtension()
    {
        var s3Mock = new Mock<IAmazonS3>();
        s3Mock
            .Setup(m => m.GetPreSignedURL(It.IsAny<GetPreSignedUrlRequest>()))
            .Returns("https://onsite-monday-media.s3.eu-west-2.amazonaws.com/profile-images/user-456.png?X-Amz-Signature=abc");

        var sut = new S3StorageService(s3Mock.Object, MakeConfig());

        var (_, publicUrl) = await sut.GenerateProfileImageUploadUrlAsync("user-456", "image/png");

        publicUrl.Should().EndWith(".png");
    }

    [Fact]
    public async Task GenerateProfileImageUploadUrlAsync_CallsGetPreSignedUrl_WithPutVerbAndCorrectParams()
    {
        GetPreSignedUrlRequest? captured = null;
        var s3Mock = new Mock<IAmazonS3>();
        s3Mock
            .Setup(m => m.GetPreSignedURL(It.IsAny<GetPreSignedUrlRequest>()))
            .Callback<GetPreSignedUrlRequest>(r => captured = r)
            .Returns("https://fake-url");

        var sut = new S3StorageService(s3Mock.Object, MakeConfig());

        await sut.GenerateProfileImageUploadUrlAsync("user-789", "image/jpeg");

        captured.Should().NotBeNull();
        captured!.Verb.Should().Be(HttpVerb.PUT);
        captured.BucketName.Should().Be("onsite-monday-media");
        captured.Key.Should().Be("profile-images/user-789.jpg");
        captured.ContentType.Should().Be("image/jpeg");
        captured.Expires.Should().BeCloseTo(DateTime.UtcNow.AddMinutes(5), TimeSpan.FromSeconds(10));
    }
}
