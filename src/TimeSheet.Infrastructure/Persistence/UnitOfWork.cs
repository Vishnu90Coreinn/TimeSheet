using MediatR;
using TimeSheet.Domain.Common;
using TimeSheet.Domain.Interfaces;

namespace TimeSheet.Infrastructure.Persistence;

public class UnitOfWork(TimeSheetDbContext context, IPublisher publisher) : IUnitOfWork
{
    public async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        // Collect domain events from all tracked entities
        var domainEvents = context.ChangeTracker
            .Entries<Entity>()
            .Select(e => e.Entity)
            .Where(e => e.DomainEvents.Any())
            .SelectMany(e =>
            {
                var events = e.DomainEvents.ToList();
                e.ClearDomainEvents();
                return events;
            })
            .ToList();

        var result = await context.SaveChangesAsync(cancellationToken);

        // Cast dynamically so Domain stays free of MediatR
        foreach (var domainEvent in domainEvents)
            await publisher.Publish((dynamic)domainEvent, cancellationToken);

        return result;
    }
}
