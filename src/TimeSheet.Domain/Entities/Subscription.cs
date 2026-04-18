namespace TimeSheet.Domain.Entities;

public enum SubscriptionPlan { Free, Starter, Pro, Enterprise }
public enum SubscriptionStatus { Active, Cancelled, PastDue }

public class Subscription
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public SubscriptionPlan Plan { get; set; } = SubscriptionPlan.Free;
    public SubscriptionStatus Status { get; set; } = SubscriptionStatus.Active;
    public int UserLimit { get; set; } = 5;
    public int CurrentUserCount { get; set; }
    public DateTime BillingCycleEnd { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}
