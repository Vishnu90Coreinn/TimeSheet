using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.Timesheets.Queries;

public record GetEntryOptionsQuery : IRequest<Result<EntryOptionsResult>>;
