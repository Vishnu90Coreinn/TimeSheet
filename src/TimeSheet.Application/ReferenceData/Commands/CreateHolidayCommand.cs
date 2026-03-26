using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.ReferenceData.Commands;

public record CreateHolidayCommand(string Name, DateOnly Date, bool IsRecurring) : IRequest<Result<HolidayMutationResult>>;

public record HolidayMutationResult(Guid Id, string Name, DateOnly Date, bool IsRecurring, DateTime CreatedAtUtc);
