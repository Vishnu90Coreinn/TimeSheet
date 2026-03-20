using TimeSheet.Domain.Entities;

namespace TimeSheet.Domain.Interfaces;

public interface ILeaveTypeRepository
{
    Task<LeaveType?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<LeaveType?> GetByNameAsync(string name, CancellationToken ct = default);
    void Add(LeaveType leaveType);
    void Update(LeaveType leaveType);
}
