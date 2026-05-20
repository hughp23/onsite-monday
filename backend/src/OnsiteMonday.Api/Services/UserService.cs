using AutoMapper;
using OnsiteMonday.Api.DTOs.Users;
using OnsiteMonday.Api.Repositories;

namespace OnsiteMonday.Api.Services;

public class UserService : IUserService
{
    private readonly IUserRepository _repo;
    private readonly IMapper _mapper;

    public UserService(IUserRepository repo, IMapper mapper)
    {
        _repo = repo;
        _mapper = mapper;
    }

    public async Task<UserDto> GetOrCreateCurrentUserAsync(string cognitoSub, string email, string? firstName = null, string? lastName = null, string? profileImageUrl = null)
    {
        var user = await _repo.GetOrCreateByCognitoSubAsync(cognitoSub, email, firstName, lastName, profileImageUrl);
        return _mapper.Map<UserDto>(user);
    }

    public async Task<UserDto> GetByIdAsync(Guid id)
    {
        var user = await _repo.GetByIdAsync(id)
            ?? throw new KeyNotFoundException($"User {id} not found.");
        return _mapper.Map<UserDto>(user);
    }

    public async Task<UserDto> UpdateCurrentUserAsync(string cognitoSub, string email, UpdateUserRequest request)
    {
        var user = await _repo.GetOrCreateByCognitoSubAsync(cognitoSub, email);

        if (request.FirstName != null) user.FirstName = request.FirstName;
        if (request.LastName != null) user.LastName = request.LastName;
        if (request.BusinessName != null) user.BusinessName = request.BusinessName;
        if (request.Phone != null) user.Phone = request.Phone;
        if (request.Trade != null) user.Trade = request.Trade;
        if (request.Skills != null) user.Skills = request.Skills;
        if (request.Accreditations != null) user.Accreditations = request.Accreditations;
        if (request.DayRate != null) user.DayRate = request.DayRate;
        if (request.DayRateVisible != null) user.DayRateVisible = request.DayRateVisible.Value;
        if (request.Location != null) user.Location = request.Location;
        if (request.TravelRadius != null) user.TravelRadius = request.TravelRadius.Value;
        if (request.ProfileImageUrl != null) user.ProfileImageUrl = request.ProfileImageUrl;
        if (request.Gallery != null) user.Gallery = request.Gallery;

        await _repo.UpdateAsync(user);
        return _mapper.Map<UserDto>(user);
    }

    public async Task<UserDto> CompleteOnboardingAsync(string cognitoSub, string email)
    {
        var user = await _repo.GetOrCreateByCognitoSubAsync(cognitoSub, email);

        user.IsOnboarded = true;
        await _repo.UpdateAsync(user);
        return _mapper.Map<UserDto>(user);
    }

    public async Task<List<TradespersonDto>> GetTradespeopleAsync(string? trade, string? location)
    {
        var users = await _repo.GetTradespeopleAsync(trade, location);
        return _mapper.Map<List<TradespersonDto>>(users);
    }
}
