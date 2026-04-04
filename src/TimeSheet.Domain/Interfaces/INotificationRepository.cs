using TimeSheet.Domain.Entities;

namespace TimeSheet.Domain.Interfaces;

public interface INotificationRepository
{
    Task<IReadOnlyList<Notification>> GetUnreadByUserAsync(Guid userId, CancellationToken ct = default);
    Task<IReadOnlyList<Notification>> GetUnreadAnomaliesByUserAsync(Guid userId, string? severity = null, CancellationToken ct = default);
    Task<Notification?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Notification?> GetAnomalyByIdAsync(Guid id, Guid userId, CancellationToken ct = default);
    Task<IReadOnlyList<Notification>> GetByUserAsync(Guid userId, CancellationToken ct = default);
    Task<(IReadOnlyList<Notification> Items, bool HasMore)> GetPageByUserAsync(Guid userId, int page, int pageSize, CancellationToken ct = default);
    Task<int> CountUnreadByUserAsync(Guid userId, CancellationToken ct = default);
    Task<IReadOnlyList<Notification>> GetAllByUserAsync(Guid userId, CancellationToken ct = default);
    void Add(Notification notification);
    void Remove(Notification notification);
    void RemoveRange(IEnumerable<Notification> notifications);
}
