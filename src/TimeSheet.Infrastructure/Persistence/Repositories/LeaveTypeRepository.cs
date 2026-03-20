using Microsoft.EntityFrameworkCore;
using TimeSheet.Domain.Entities;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence.Repositories;

public class LeaveTypeRepository(TimeSheetDbContext context) : ILeaveTypeRepository
{
    private readonly DbSet<LeaveType> _dbSet = context.Set<LeaveType>();

    public async Task<LeaveType?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await _dbSet.FirstOrDefaultAsync(lt => lt.Id == id, ct);

    public async Task<LeaveType?> GetByNameAsync(string name, CancellationToken ct = default)
        => await _dbSet.FirstOrDefaultAsync(lt => lt.Name == name, ct);

    public void Add(LeaveType leaveType) => _dbSet.Add(leaveType);

    public void Update(LeaveType leaveType) => _dbSet.Update(leaveType);
}
