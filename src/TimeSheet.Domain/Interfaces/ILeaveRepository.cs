using TimeSheet.Domain.Entities;

namespace TimeSheet.Domain.Interfaces;

public interface ILeaveRepository
{
    Task<LeaveRequest?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<LeaveRequest>> GetByIdOrGroupIdAsync(Guid idOrGroupId, CancellationToken ct = default);
    Task<IReadOnlyList<LeaveRequest>> GetPendingForManagerAsync(Guid managerId, CancellationToken ct = default);
    Task<IReadOnlyList<LeaveRequest>> GetByUserAsync(Guid userId, CancellationToken ct = default);
    Task<LeaveBalance?> GetBalanceAsync(Guid userId, Guid leaveTypeId, int year, CancellationToken ct = default);
    void Add(LeaveRequest leaveRequest);
    void AddRange(IEnumerable<LeaveRequest> leaveRequests);
    void RemoveRange(IEnumerable<LeaveRequest> leaveRequests);
    Task<IReadOnlyList<DateOnly>> GetActiveDatesAsync(Guid userId, IReadOnlyList<DateOnly> dates, CancellationToken ct = default);
    Task<IReadOnlyList<LeaveRequest>> GetRejectedForDatesAsync(Guid userId, IReadOnlyList<DateOnly> dates, CancellationToken ct = default);
    void AddBalance(LeaveBalance balance);
}
