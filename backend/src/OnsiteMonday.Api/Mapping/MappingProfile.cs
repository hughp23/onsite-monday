using AutoMapper;
using OnsiteMonday.Api.Domain;
using OnsiteMonday.Api.DTOs.Users;

namespace OnsiteMonday.Api.Mapping;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        CreateMap<User, UserDto>()
            .ForMember(dest => dest.Subscription,
                opt => opt.MapFrom(src =>
                    src.ActiveSubscription != null ? src.ActiveSubscription.Tier : "bronze"));

        CreateMap<User, TradespersonDto>();
    }
}
