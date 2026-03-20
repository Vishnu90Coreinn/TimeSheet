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
}
