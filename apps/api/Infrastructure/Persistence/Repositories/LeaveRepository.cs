using Microsoft.EntityFrameworkCore;
using TimeSheet.Api.Application.Common.Models;
using TimeSheet.Api.Application.Leave.Models;
using TimeSheet.Api.Data;
using TimeSheet.Api.Dtos;
using TimeSheet.Api.Models;

namespace TimeSheet.Api.Infrastructure.Persistence.Repositories;

public class LeaveRepository(TimeSheetDbContext dbContext) : ILeaveRepository
{
    public async Task<IReadOnlyList<DateOnly>> GetExistingNonRejectedDatesAsync(Guid userId, IReadOnlyCollection<DateOnly> leaveDates, CancellationToken cancellationToken)
    {
        return await dbContext.LeaveRequests
            .AsNoTracking()
            .Where(lr => lr.UserId == userId && lr.Status != LeaveRequestStatus.Rejected && leaveDates.Contains(lr.LeaveDate))
            .Select(lr => lr.LeaveDate)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<LeaveRequest>> GetRejectedRequestsForDatesAsync(Guid userId, IReadOnlyCollection<DateOnly> leaveDates, CancellationToken cancellationToken)
    {
        return await dbContext.LeaveRequests
            .Where(lr => lr.UserId == userId && lr.Status == LeaveRequestStatus.Rejected && leaveDates.Contains(lr.LeaveDate))
            .ToListAsync(cancellationToken);
    }

    public void RemoveLeaveRequests(IEnumerable<LeaveRequest> requests) => dbContext.LeaveRequests.RemoveRange(requests);

    public void AddLeaveRequests(IEnumerable<LeaveRequest> requests) => dbContext.LeaveRequests.AddRange(requests);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => dbContext.SaveChangesAsync(cancellationToken);

    public async Task<PagedResult<LeaveRequestResponse>> GetMyLeaveRequestsAsync(Guid userId, MyLeaveListQuery query, CancellationToken cancellationToken)
    {
        var leaveRequests = dbContext.LeaveRequests
            .AsNoTracking()
            .Where(x => x.UserId == userId);

        if (!query.FetchAll)
        {
            if (!string.IsNullOrWhiteSpace(query.Status) && Enum.TryParse<LeaveRequestStatus>(query.Status, true, out var status))
            {
                leaveRequests = leaveRequests.Where(x => x.Status == status);
            }

            if (query.FromDate.HasValue)
            {
                leaveRequests = leaveRequests.Where(x => x.LeaveDate >= query.FromDate.Value);
            }

            if (query.ToDate.HasValue)
            {
                leaveRequests = leaveRequests.Where(x => x.LeaveDate <= query.ToDate.Value);
            }
        }

        var isAscending = string.Equals(query.SortDirection, "asc", StringComparison.OrdinalIgnoreCase);
        leaveRequests = query.SortBy?.Trim().ToLowerInvariant() switch
        {
            "createdatutc" => isAscending ? leaveRequests.OrderBy(x => x.CreatedAtUtc) : leaveRequests.OrderByDescending(x => x.CreatedAtUtc),
            "status" => isAscending ? leaveRequests.OrderBy(x => x.Status) : leaveRequests.OrderByDescending(x => x.Status),
            _ => isAscending ? leaveRequests.OrderBy(x => x.LeaveDate).ThenBy(x => x.CreatedAtUtc) : leaveRequests.OrderByDescending(x => x.LeaveDate).ThenByDescending(x => x.CreatedAtUtc)
        };

        var totalCount = await leaveRequests.CountAsync(cancellationToken);

        if (!query.FetchAll)
        {
            leaveRequests = leaveRequests
                .Skip((query.PageNumber - 1) * query.PageSize)
                .Take(query.PageSize);
        }

        var items = await leaveRequests
            .Select(x => new LeaveRequestResponse(
                x.Id,
                x.UserId,
                x.User.Username,
                x.LeaveDate,
                x.LeaveTypeId,
                x.LeaveType.Name,
                x.IsHalfDay,
                x.Status.ToString().ToLowerInvariant(),
                x.Comment,
                x.ReviewedByUserId,
                x.ReviewedByUser != null ? x.ReviewedByUser.Username : null,
                x.ReviewerComment,
                x.CreatedAtUtc,
                x.ReviewedAtUtc))
            .ToListAsync(cancellationToken);

        return new PagedResult<LeaveRequestResponse>(
            items,
            totalCount,
            query.FetchAll ? 1 : query.PageNumber,
            query.FetchAll ? totalCount : query.PageSize,
            query.FetchAll);
    }


    public async Task<IReadOnlyList<LeaveRequest>> GetLeaveRequestsForCancellationAsync(Guid userId, Guid leaveId, CancellationToken cancellationToken)
    {
        return await dbContext.LeaveRequests
            .Where(lr => lr.UserId == userId && (lr.LeaveGroupId == leaveId || lr.Id == leaveId))
            .ToListAsync(cancellationToken);
    }

    public async Task<PagedResult<LeaveRequestResponse>> GetPendingLeaveRequestsAsync(Guid managerId, bool isAdmin, MyLeaveListQuery query, CancellationToken cancellationToken)
    {
        var pendingQuery = dbContext.LeaveRequests
            .AsNoTracking()
            .Where(x => x.Status == LeaveRequestStatus.Pending);

        if (!isAdmin)
        {
            pendingQuery = pendingQuery.Where(x => x.User.ManagerId == managerId);
        }

        if (!query.FetchAll)
        {
            if (query.FromDate.HasValue)
            {
                pendingQuery = pendingQuery.Where(x => x.LeaveDate >= query.FromDate.Value);
            }

            if (query.ToDate.HasValue)
            {
                pendingQuery = pendingQuery.Where(x => x.LeaveDate <= query.ToDate.Value);
            }
        }

        var isAscending = string.Equals(query.SortDirection, "asc", StringComparison.OrdinalIgnoreCase);
        pendingQuery = query.SortBy?.Trim().ToLowerInvariant() switch
        {
            "createdatutc" => isAscending ? pendingQuery.OrderBy(x => x.CreatedAtUtc) : pendingQuery.OrderByDescending(x => x.CreatedAtUtc),
            "status" => isAscending ? pendingQuery.OrderBy(x => x.Status) : pendingQuery.OrderByDescending(x => x.Status),
            _ => isAscending ? pendingQuery.OrderBy(x => x.LeaveDate).ThenBy(x => x.CreatedAtUtc) : pendingQuery.OrderByDescending(x => x.LeaveDate).ThenByDescending(x => x.CreatedAtUtc)
        };

        var totalCount = await pendingQuery.CountAsync(cancellationToken);

        if (!query.FetchAll)
        {
            pendingQuery = pendingQuery.Skip((query.PageNumber - 1) * query.PageSize).Take(query.PageSize);
        }

        var items = await pendingQuery
            .Select(x => new LeaveRequestResponse(
                x.Id,
                x.UserId,
                x.User.Username,
                x.LeaveDate,
                x.LeaveTypeId,
                x.LeaveType.Name,
                x.IsHalfDay,
                x.Status.ToString().ToLowerInvariant(),
                x.Comment,
                x.ReviewedByUserId,
                x.ReviewedByUser != null ? x.ReviewedByUser.Username : null,
                x.ReviewerComment,
                x.CreatedAtUtc,
                x.ReviewedAtUtc))
            .ToListAsync(cancellationToken);

        return new PagedResult<LeaveRequestResponse>(items, totalCount, query.FetchAll ? 1 : query.PageNumber, query.FetchAll ? totalCount : query.PageSize, query.FetchAll);
    }

    public Task<LeaveRequest?> GetLeaveWithUserAsync(Guid leaveRequestId, CancellationToken cancellationToken)
    {
        return dbContext.LeaveRequests.Include(x => x.User).SingleOrDefaultAsync(x => x.Id == leaveRequestId, cancellationToken);
    }

    public async Task<LeaveRequestResponse?> GetLeaveRequestResponseByIdAsync(Guid leaveRequestId, CancellationToken cancellationToken)
    {
        return await dbContext.LeaveRequests
            .AsNoTracking()
            .Where(x => x.Id == leaveRequestId)
            .Select(x => new LeaveRequestResponse(
                x.Id,
                x.UserId,
                x.User.Username,
                x.LeaveDate,
                x.LeaveTypeId,
                x.LeaveType.Name,
                x.IsHalfDay,
                x.Status.ToString().ToLowerInvariant(),
                x.Comment,
                x.ReviewedByUserId,
                x.ReviewedByUser != null ? x.ReviewedByUser.Username : null,
                x.ReviewerComment,
                x.CreatedAtUtc,
                x.ReviewedAtUtc))
            .SingleOrDefaultAsync(cancellationToken);
    }

}