using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.ReferenceData.Queries;

public record GetHolidaysQuery(int? Year) : IRequest<Result<List<HolidayResult>>>;

public record HolidayResult(Guid Id, string Name, DateOnly Date, bool IsRecurring, DateTime CreatedAtUtc);
