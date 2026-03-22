using MediatR;
using TimeSheet.Application.Common.Interfaces;
using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Application.Leave.Commands;

public class ApplyLeaveCommandHandler(
    ILeaveRepository leaveRepo,
    IUnitOfWork unitOfWork,
    ICurrentUserService currentUser,
    IDateTimeProvider dateTimeProvider)
    : IRequestHandler<ApplyLeaveCommand, Result<ApplyLeaveResult>>
{
    public async Task<Result<ApplyLeaveResult>> Handle(ApplyLeaveCommand request, CancellationToken ct)
    {
        var userId = currentUser.UserId;

        if (request.ToDate < request.FromDate)
            return Result<ApplyLeaveResult>.Failure("ToDate must be on or after FromDate.");

        var days = new List<DateOnly>();
        for (var d = request.FromDate; d <= request.ToDate; d = d.AddDays(1))
            if (d.DayOfWeek != DayOfWeek.Saturday && d.DayOfWeek != DayOfWeek.Sunday)
                days.Add(d);

        if (days.Count == 0)
            return Result<ApplyLeaveResult>.Failure("No working days in selected range.");

        var conflictDates = await leaveRepo.GetActiveDatesAsync(userId, days, ct);
        if (conflictDates.Count > 0)
            return Result<ApplyLeaveResult>.Conflict($"You already have a leave request on {string.Join(", ", conflictDates.Select(d => d.ToString("MMM d")))}. Cancel it first before re-applying.");

        var rejected = await leaveRepo.GetRejectedForDatesAsync(userId, days, ct);
        if (rejected.Count > 0)
            leaveRepo.RemoveRange(rejected);

        var leaveGroupId = Guid.NewGuid();
        var requests = days.Select(day => new LeaveRequest
        {
            UserId = userId,
            LeaveTypeId = request.LeaveTypeId,
            LeaveDate = day,
            IsHalfDay = request.IsHalfDay,
            Comment = request.Comment,
            Status = LeaveRequestStatus.Pending,
            LeaveGroupId = leaveGroupId,
            CreatedAtUtc = dateTimeProvider.UtcNow
        }).ToList();

        leaveRepo.AddRange(requests);
        await unitOfWork.SaveChangesAsync(ct);

        return Result<ApplyLeaveResult>.Success(new ApplyLeaveResult(leaveGroupId, requests.Count));
    }
}
