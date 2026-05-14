namespace OnsiteMonday.Api.DTOs.Users;

public record RegisterBankAccountRequest(string SortCode, string AccountNumber, string HolderName);
