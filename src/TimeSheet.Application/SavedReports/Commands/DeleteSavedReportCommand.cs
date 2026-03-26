using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.SavedReports.Commands;

public record DeleteSavedReportCommand(Guid Id) : IRequest<Result>;
