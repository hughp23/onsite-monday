using FluentAssertions;
using OnsiteMonday.Api.DTOs.Jobs;
using OnsiteMonday.Api.Validators;

namespace OnsiteMonday.Api.Tests.Unit.Validators;

public class ApplyToJobRequestValidatorTests
{
    private readonly ApplyToJobRequestValidator _sut = new();

    [Fact]
    public void NullCoverNote_IsValid() =>
        _sut.Validate(new ApplyToJobRequest()).IsValid.Should().BeTrue();

    [Fact]
    public void CoverNoteOver1000Chars_IsInvalid() =>
        _sut.Validate(new ApplyToJobRequest { CoverNote = new string('a', 1001) }).IsValid.Should().BeFalse();

    [Fact]
    public void CoverNoteOf1000Chars_IsValid() =>
        _sut.Validate(new ApplyToJobRequest { CoverNote = new string('a', 1000) }).IsValid.Should().BeTrue();
}
