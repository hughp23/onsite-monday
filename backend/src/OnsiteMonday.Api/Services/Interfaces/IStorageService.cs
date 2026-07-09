namespace OnsiteMonday.Api.Services;

public interface IStorageService
{
    Task<(string UploadUrl, string PublicUrl)> GenerateProfileImageUploadUrlAsync(
        string userId, string contentType);
}
