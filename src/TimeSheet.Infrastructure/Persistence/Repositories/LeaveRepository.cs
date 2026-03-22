using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Enums;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class LeaveRepository(TimeSheetDbContext context)
    : BaseRepository<LeaveRequest>(context), ILeaveRepository
{
    public async Task<LeaveRequest?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await _dbSet
            .Include(lr => lr.LeaveType)
            .FirstOrDefaultAsync(lr => lr.Id == id, ct);

    public async Task<IReadOnlyList<LeaveRequest>> GetByIdOrGroupIdAsync(Guid idOrGroupId, CancellationToken ct = default)
        => await _dbSet
            .Include(lr => lr.LeaveType)
            .Where(lr => lr.Id == idOrGroupId || lr.LeaveGroupId == idOrGroupId)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<LeaveRequest>> GetPendingForManagerAsync(Guid managerId, CancellationToken ct = default)
        => await _dbSet
            .AsNoTracking()
            .Include(lr => lr.User)
            .Include(lr => lr.LeaveType)
            .Where(lr => lr.Status == LeaveRequestStatus.Pending && lr.User.ManagerId == managerId)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<LeaveRequest>> GetByUserAsync(Guid userId, CancellationToken ct = default)
        => await _dbSet
            .AsNoTracking()
            .Include(lr => lr.LeaveType)
            .Where(lr => lr.UserId == userId)
            .OrderByDescending(lr => lr.LeaveDate)
            .ToListAsync(ct);

    public async Task<LeaveBalance?> GetBalanceAsync(
        Guid userId, Guid leaveTypeId, int year, CancellationToken ct = default)
        => await _context.LeaveBalances
            .FirstOrDefaultAsync(
                lb => lb.UserId == userId && lb.LeaveTypeId == leaveTypeId && lb.Year == year, ct);

    public void Add(LeaveRequest leaveRequest) => _dbSet.Add(leaveRequest);

    public void AddRange(IEnumerable<LeaveRequest> leaveRequests) => _dbSet.AddRange(leaveRequests);

    public void RemoveRange(IEnumerable<LeaveRequest> leaveRequests) => _dbSet.RemoveRange(leaveRequests);

    public async Task<IReadOnlyList<DateOnly>> GetActiveDatesAsync(
        Guid userId, IReadOnlyList<DateOnly> dates, CancellationToken ct = default)
        => await _dbSet
            .AsNoTracking()
            .Where(lr => lr.UserId == userId
                && lr.Status != LeaveRequestStatus.Rejected
                && dates.Contains(lr.LeaveDate))
            .Select(lr => lr.LeaveDate)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<LeaveRequest>> GetRejectedForDatesAsync(
        Guid userId, IReadOnlyList<DateOnly> dates, CancellationToken ct = default)
        => await _dbSet
            .Where(lr => lr.UserId == userId
                && lr.Status == LeaveRequestStatus.Rejected
                && dates.Contains(lr.LeaveDate))
            .ToListAsync(ct);

    public void AddBalance(LeaveBalance balance) => _context.LeaveBalances.Add(balance);
}
