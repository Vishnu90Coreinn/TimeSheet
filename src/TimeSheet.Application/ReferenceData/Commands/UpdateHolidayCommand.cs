using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.ReferenceData.Commands;

public record UpdateHolidayCommand(Guid Id, string Name, DateOnly Date, bool IsRecurring) : IRequest<Result<HolidayMutationResult>>;
