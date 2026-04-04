using MediatR;
using TimeSheet.Application.Common.Models;

namespace TimeSheet.Application.TimesheetTemplates.Queries;

public record GetTimesheetTemplatesQuery : IRequest<Result<IReadOnlyList<TimesheetTemplateResult>>>;
public record CreateTimesheetTemplateCommand(string Name, IReadOnlyList<TemplateEntryItemResult> Entries) : IRequest<Result<TimesheetTemplateResult>>;
public record UpdateTimesheetTemplateCommand(Guid TemplateId, string Name, IReadOnlyList<TemplateEntryItemResult> Entries) : IRequest<Result<TimesheetTemplateResult>>;
public record DeleteTimesheetTemplateCommand(Guid TemplateId) : IRequest<Result>;
public record ApplyTimesheetTemplateCommand(Guid TemplateId, DateOnly WorkDate) : IRequest<Result<TemplateApplyOutcome>>;
