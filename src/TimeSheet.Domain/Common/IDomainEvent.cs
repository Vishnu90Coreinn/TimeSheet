using MediatR;

namespace TimeSheet.Domain.Common;

/// <summary>Marker interface for domain events dispatched after SaveChanges.</summary>
public interface IDomainEvent : INotification { }
