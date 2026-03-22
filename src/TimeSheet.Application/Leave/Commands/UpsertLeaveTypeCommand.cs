using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Leave.Commands;

public record UpsertLeaveTypeCommand(Guid? Id, string Name, bool IsActive) : IRequest<Result<Guid>>;
