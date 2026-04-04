using TimeSheet.Application.Common.Models;
using TimeSheet.Domain.Interfaces;
using AppInterfaces = TimeSheet.Application.Common.Interfaces;

namespace TimeSheet.Infrastructure.Services;

public class LeaveQueryService(
    ILeaveReadRepository leaveReadRepository,
    ILeaveRepository leaveRepository,
    ILeavePolicyRepository leavePolicyRepository) : AppInterfaces.ILeaveQueryService
{
    public async Task<List<AppInterfaces.LeaveTypeResult>> GetLeaveTypesAsync(bool activeOnly, CancellationToken ct = default)
        => (await leaveReadRepository.GetLeaveTypesAsync(activeOnly, ct))
            .Select(x => new AppInterfaces.LeaveTypeResult(x.Id, x.Name, x.IsActive))
            .ToList();

    public async Task<List<AppInterfaces.LeaveRequestResult>> GetMyRequestsAsync(Guid userId, CancellationToken ct = default)
        => (await leaveReadRepository.GetMyRequestsAsync(userId, ct))
            .Select(MapLeaveRequestRow)
            .ToList();

    public async Task<PagedResult<AppInterfaces.LeaveRequestResult>> GetMyRequestsPageAsync(
        Guid userId,
        string? search,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var (rows, totalCount, effectivePage) = await leaveRepository.GetUserRequestsPageAsync(userId, search, sortBy, descending, page, pageSize, ct);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));
        return new PagedResult<AppInterfaces.LeaveRequestResult>(
            rows.Select(MapLeaveRequestRow).ToList(),
            effectivePage,
            pageSize,
            totalCount,
            totalPages,
            sortBy,
            descending ? "desc" : "asc");
    }

    public async Task<List<AppInterfaces.LeaveGroupResult>> GetMyGroupedRequestsAsync(Guid userId, CancellationToken ct = default)
        => (await leaveReadRepository.GetMyGroupedRequestsAsync(userId, ct))
            .Select(g => new AppInterfaces.LeaveGroupResult(g.GroupId, g.LeaveTypeName, g.FromDate, g.ToDate, g.Days, g.Status, g.AppliedOnDate, g.ApprovedByUsername, g.Comment))
            .ToList();

    public async Task<List<AppInterfaces.LeaveBalanceResult>> GetBalanceAsync(Guid userId, int year, CancellationToken ct = default)
        => (await leaveReadRepository.GetBalancesAsync(userId, year, ct))
            .Select(x => new AppInterfaces.LeaveBalanceResult(x.LeaveTypeId, x.LeaveTypeName, x.TotalDays, x.UsedDays, x.RemainingDays))
            .ToList();

    public async Task<List<AppInterfaces.LeavePolicyResult>> GetPoliciesAsync(CancellationToken ct = default)
        => (await leaveReadRepository.GetPoliciesAsync(ct))
            .Select(MapLeavePolicyRow)
            .ToList();

    public async Task<PagedResult<AppInterfaces.LeavePolicyResult>> GetPoliciesPageAsync(
        string? search,
        bool? isActive,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var (rows, totalCount, effectivePage) = await leavePolicyRepository.GetPagedAsync(search, isActive, sortBy, descending, page, pageSize, ct);
        var items = rows.Select(p => new AppInterfaces.LeavePolicyResult(
            p.Id,
            p.Name,
            p.IsActive,
            p.Allocations.Select(a => new AppInterfaces.LeavePolicyAllocationResult(a.LeaveTypeId, a.LeaveTypeName, a.DaysPerYear)).ToList())).ToList();

        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));
        return new PagedResult<AppInterfaces.LeavePolicyResult>(items, effectivePage, pageSize, totalCount, totalPages, sortBy, descending ? "desc" : "asc");
    }

    public async Task<List<AppInterfaces.LeaveRequestResult>> GetPendingForManagerAsync(Guid managerId, bool isAdmin, CancellationToken ct = default)
        => (await leaveReadRepository.GetPendingForManagerAsync(managerId, isAdmin, ct))
            .Select(MapLeaveRequestRow)
            .ToList();

    public async Task<PagedResult<AppInterfaces.LeaveRequestResult>> GetPendingForManagerPageAsync(
        Guid managerId,
        bool isAdmin,
        string? search,
        string sortBy,
        bool descending,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var (rows, totalCount, effectivePage) = await leaveRepository.GetPendingForManagerPageAsync(managerId, isAdmin, search, sortBy, descending, page, pageSize, ct);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));
        return new PagedResult<AppInterfaces.LeaveRequestResult>(
            rows.Select(MapLeaveRequestRow).ToList(),
            effectivePage,
            pageSize,
            totalCount,
            totalPages,
            sortBy,
            descending ? "desc" : "asc");
    }

    public async Task<IReadOnlyList<AppInterfaces.LeaveCalendarDayResult>> GetCalendarAsync(Guid userId, int year, int month, CancellationToken ct = default)
        => (await leaveRepository.GetCalendarAsync(userId, year, month, ct))
            .Select(x => new AppInterfaces.LeaveCalendarDayResult(x.Date, x.Type))
            .ToList();

    public async Task<IReadOnlyList<AppInterfaces.TeamLeaveCalendarDayResult>> GetTeamCalendarAsync(Guid userId, string role, int year, int month, CancellationToken ct = default)
        => (await leaveRepository.GetTeamCalendarAsync(userId, role, year, month, ct))
            .Select(day => new AppInterfaces.TeamLeaveCalendarDayResult(
                day.Date,
                day.Entries.Select(entry => new AppInterfaces.TeamLeaveEntryResult(entry.UserId, entry.Username, entry.DisplayName, entry.LeaveTypeName, entry.Status)).ToList()))
            .ToList();

    public async Task<AppInterfaces.LeaveConflictResult> GetConflictsAsync(Guid currentUserId, string role, DateOnly fromDate, DateOnly toDate, Guid? targetUserId, CancellationToken ct = default)
    {
        var result = await leaveRepository.GetConflictsAsync(currentUserId, role, fromDate, toDate, targetUserId, ct);
        return new AppInterfaces.LeaveConflictResult(result.ConflictingCount, result.ConflictingUsernames);
    }

    public async Task<IReadOnlyList<AppInterfaces.TeamOnLeaveResult>> GetTeamOnLeaveAsync(Guid userId, CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return (await leaveRepository.GetTeamOnLeaveAsync(userId, today, today.AddDays(14), ct))
            .Select(x => new AppInterfaces.TeamOnLeaveResult(x.UserId, x.Username, x.FromDate, x.ToDate, x.LeaveTypeName, x.Status))
            .ToList();
    }

    private static AppInterfaces.LeaveRequestResult MapLeaveRequestRow(PagedLeaveRequestRow x)
        => new(x.Id, x.UserId, x.Username, x.LeaveDate, x.LeaveTypeId, x.LeaveTypeName, x.IsHalfDay, x.Status, x.Comment, x.ReviewedByUserId, x.ReviewedByUsername, x.ReviewerComment, x.CreatedAtUtc, x.ReviewedAtUtc);

    private static AppInterfaces.LeavePolicyResult MapLeavePolicyRow(LeavePolicyReadRow row)
        => new(row.Id, row.Name, row.IsActive, row.Allocations.Select(a => new AppInterfaces.LeavePolicyAllocationResult(a.LeaveTypeId, a.LeaveTypeName, a.DaysPerYear)).ToList());
}
