namespace TimeSheet.Api.Models;

public class LeavePolicy
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public ICollection<LeavePolicyAllocation> Allocations { get; set; } = [];
    public ICollection<User> Users { get; set; } = [];
}
