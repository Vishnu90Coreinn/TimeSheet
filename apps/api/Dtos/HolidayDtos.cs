using System.ComponentModel.DataAnnotations;

namespace TimeSheet.Api.Dtos;

public record UpsertHolidayRequest(
    [Required][MaxLength(200)] string Name,
    DateOnly Date,
    bool IsRecurring
);

public record HolidayResponse(Guid Id, string Name, DateOnly Date, bool IsRecurring, DateTime CreatedAtUtc);
