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
                    src.ActiveSubscription != null ? src.ActiveSubscription.Tier : "bronze"))
            .ForMember(dest => dest.KycStatus,
                opt => opt.MapFrom(src => src.MangopayKycStatus))
            .ForMember(dest => dest.HasBankAccount,
                opt => opt.MapFrom(src => !string.IsNullOrEmpty(src.MangopayBankAccountId)))
            .ForMember(dest => dest.AutoWithdraw,
                opt => opt.MapFrom(src => src.AutoWithdraw));

        CreateMap<User, TradespersonDto>();
    }
}
