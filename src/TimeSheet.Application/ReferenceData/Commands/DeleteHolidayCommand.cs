using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.ReferenceData.Commands;

public record DeleteHolidayCommand(Guid Id) : IRequest<Result>;
